import { describe, expect, it } from "vitest";
import {
  cloneChatAttachment,
  cloneChatAttachments,
  readChatAttachmentFromUnknown,
  readChatAttachmentListFromUnknown,
} from "./attachments";

describe("readChatAttachmentFromUnknown", () => {
  it("parses a valid attachment payload", () => {
    expect(
      readChatAttachmentFromUnknown({
        name: " spec.pdf ",
        mimeType: " application/pdf ",
        sizeBytes: 42,
        dataUrl: " data:application/pdf;base64,abc ",
      }),
    ).toEqual({
      name: "spec.pdf",
      mimeType: "application/pdf",
      sizeBytes: 42,
      dataUrl: "data:application/pdf;base64,abc",
    });
  });

  it("rejects malformed attachment payloads", () => {
    expect(
      readChatAttachmentFromUnknown({
        name: "spec.pdf",
        mimeType: "application/pdf",
        sizeBytes: -1,
        dataUrl: "data:application/pdf;base64,abc",
      }),
    ).toBeNull();
    expect(readChatAttachmentFromUnknown("invalid")).toBeNull();
  });
});

describe("readChatAttachmentListFromUnknown", () => {
  it("filters malformed entries and preserves order, including duplicates", () => {
    expect(
      readChatAttachmentListFromUnknown([
        {
          name: "spec.pdf",
          mimeType: "application/pdf",
          sizeBytes: 42,
          dataUrl: "data:application/pdf;base64,abc",
        },
        {
          name: "",
          mimeType: "application/pdf",
          sizeBytes: 10,
          dataUrl: "data:application/pdf;base64,def",
        },
        {
          name: "spec.pdf",
          mimeType: "application/pdf",
          sizeBytes: 42,
          dataUrl: "data:application/pdf;base64,abc",
        },
      ]),
    ).toEqual([
      {
        name: "spec.pdf",
        mimeType: "application/pdf",
        sizeBytes: 42,
        dataUrl: "data:application/pdf;base64,abc",
      },
      {
        name: "spec.pdf",
        mimeType: "application/pdf",
        sizeBytes: 42,
        dataUrl: "data:application/pdf;base64,abc",
      },
    ]);
  });

  it("returns an empty list for non-array payloads", () => {
    expect(readChatAttachmentListFromUnknown(null)).toEqual([]);
  });
});

describe("cloneChatAttachment", () => {
  it("returns defensive clones", () => {
    const attachment = {
      name: "spec.pdf",
      mimeType: "application/pdf",
      sizeBytes: 42,
      dataUrl: "data:application/pdf;base64,abc",
    };

    const clonedAttachment = cloneChatAttachment(attachment);
    const clonedAttachments = cloneChatAttachments([attachment]);

    expect(clonedAttachment).toEqual(attachment);
    expect(clonedAttachment).not.toBe(attachment);
    expect(clonedAttachments[0]).toEqual(attachment);
    expect(clonedAttachments[0]).not.toBe(attachment);
  });
});
