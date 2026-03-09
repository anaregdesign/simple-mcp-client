import { toFile } from "openai";
import {
  CHAT_CODE_INTERPRETER_UPLOAD_TIMEOUT_MS,
} from "~/lib/constants/chat";

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

type AttachmentInput = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

type UploadedFile = Awaited<ReturnType<typeof toFile>>;

type CodeInterpreterAttachmentClient = {
  containers: {
    create: (options: { name: string }) => Promise<{ id?: string | null }>;
    delete: (containerId: string) => Promise<void>;
    files: {
      create: (
        containerId: string,
        options: { file: UploadedFile },
      ) => Promise<unknown>;
    };
  };
};

export async function createCodeInterpreterContainerWithAttachments(
  attachments: AttachmentInput[],
  client: CodeInterpreterAttachmentClient,
): Promise<string> {
  const container = await awaitWithTimeout(
    client.containers.create({
      name: "local-playground-chat",
    }),
    CHAT_CODE_INTERPRETER_UPLOAD_TIMEOUT_MS,
    "Timed out while creating a Code Interpreter container.",
  );
  const containerId =
    typeof container.id === "string" ? container.id.trim() : "";
  if (!containerId) {
    throw new Error("Failed to initialize a Code Interpreter container.");
  }

  try {
    for (const attachment of attachments) {
      const parsedAttachmentDataUrl = parseAttachmentDataUrl(
        attachment.dataUrl,
        `attachments[\"${attachment.name}\"].dataUrl`,
      );
      if (!parsedAttachmentDataUrl.ok) {
        throw new Error(parsedAttachmentDataUrl.error);
      }

      const base64Payload = readDataUrlBase64Payload(
        parsedAttachmentDataUrl.value.dataUrl,
      );
      const attachmentBuffer = Buffer.from(base64Payload, "base64");
      const normalizedMimeType =
        attachment.mimeType ||
        parsedAttachmentDataUrl.value.mimeType ||
        "application/octet-stream";
      const file = await toFile(attachmentBuffer, attachment.name, {
        type: normalizedMimeType,
      });
      try {
        await awaitWithTimeout(
          client.containers.files.create(containerId, { file }),
          CHAT_CODE_INTERPRETER_UPLOAD_TIMEOUT_MS,
          `Timed out while uploading \"${attachment.name}\" to Code Interpreter.`,
        );
      } catch (error) {
        throw buildCodeInterpreterAttachmentUploadError(attachment.name, error);
      }
    }

    return containerId;
  } catch (error) {
    try {
      await client.containers.delete(containerId);
    } catch {
      // Best-effort cleanup when attachment upload fails.
    }
    throw error;
  }
}

function buildCodeInterpreterAttachmentUploadError(
  fileName: string,
  error: unknown,
): Error {
  const message = readErrorMessage(error);
  if (
    /unsupported extension/i.test(message) ||
    /invalid filename/i.test(message) ||
    /filename contains an invalid filename/i.test(message)
  ) {
    return new Error(
      `Code Interpreter rejected \"${fileName}\" on this deployment. ${message}`,
    );
  }

  return new Error(
    `Failed to upload attachment \"${fileName}\" for Code Interpreter: ${message}`,
  );
}

function readDataUrlBase64Payload(dataUrl: string): string {
  const separatorIndex = dataUrl.indexOf(",");
  return separatorIndex >= 0 ? dataUrl.slice(separatorIndex + 1) : dataUrl;
}

function parseAttachmentDataUrl(
  dataUrl: string,
  pathLabel: string,
): ParseResult<{
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
}> {
  const dataUrlMatch = /^data:([^,]*),([\s\S]*)$/i.exec(dataUrl);
  if (!dataUrlMatch) {
    return {
      ok: false,
      error: `\`${pathLabel}\` must be a valid data URL.`,
    };
  }

  const metadata = (dataUrlMatch[1] ?? "").trim();
  const payload = (dataUrlMatch[2] ?? "").trim();
  if (!payload) {
    return { ok: false, error: `\`${pathLabel}\` must include data.` };
  }

  const metadataParts = metadata
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const hasBase64 = metadataParts.some(
    (part) => part.toLowerCase() === "base64",
  );
  if (!hasBase64) {
    return {
      ok: false,
      error: `\`${pathLabel}\` must use base64 encoding.`,
    };
  }

  const normalizedBase64 = payload.replace(/\s+/g, "");
  if (
    normalizedBase64.length === 0 ||
    normalizedBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedBase64)
  ) {
    return {
      ok: false,
      error: `\`${pathLabel}\` contains invalid base64 data.`,
    };
  }

  const sizeBytes = Buffer.from(normalizedBase64, "base64").byteLength;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    return {
      ok: false,
      error: `\`${pathLabel}\` is empty.`,
    };
  }

  const rawMimeType = metadataParts[0]?.toLowerCase() ?? "";
  const mimeType = rawMimeType && rawMimeType !== "base64" ? rawMimeType : "";
  return {
    ok: true,
    value: {
      dataUrl,
      mimeType,
      sizeBytes,
    },
  };
}

async function awaitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
