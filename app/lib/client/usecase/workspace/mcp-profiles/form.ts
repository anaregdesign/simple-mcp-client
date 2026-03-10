import type { McpTransport } from "~/lib/client/usecase/workspace/view-types";
import { MCP_DEFAULT_AZURE_AUTH_SCOPE } from "~/lib/constants/mcp";
import type { McpServerConfig } from "~/lib/contracts/mcp/profile";
import {
  parseAzureAuthScopeInput,
  parseHttpHeadersInput,
  parseMcpTimeoutSecondsInput,
} from "~/lib/client/usecase/workspace/mcp-profiles/http-inputs";
import {
  parseStdioArgsInput,
  parseStdioEnvInput,
} from "~/lib/client/usecase/workspace/mcp-profiles/stdio-inputs";

export type McpProfileFormState = {
  editingMcpServerId: string;
  mcpNameInput: string;
  mcpTransport: McpTransport;
  mcpUrlInput: string;
  mcpCommandInput: string;
  mcpArgsInput: string;
  mcpCwdInput: string;
  mcpEnvInput: string;
  mcpHeadersInput: string;
  mcpUseAzureAuthInput: boolean;
  mcpAzureAuthScopeInput: string;
  mcpTimeoutSecondsInput: string;
};

export type BuildMcpServerFromProfileFormResult =
  | {
      ok: true;
      server: McpServerConfig;
    }
  | {
      ok: false;
      error: string;
    };

export function buildMcpServerFromProfileForm(options: {
  serverId: string;
  formState: McpProfileFormState;
}): BuildMcpServerFromProfileFormResult {
  const rawName = options.formState.mcpNameInput.trim();

  if (options.formState.mcpTransport === "stdio") {
    const command = options.formState.mcpCommandInput.trim();
    if (!command) {
      return {
        ok: false,
        error: "MCP stdio command is required.",
      };
    }

    if (/\s/.test(command)) {
      return {
        ok: false,
        error: "MCP stdio command must not include spaces.",
      };
    }

    const argsResult = parseStdioArgsInput(options.formState.mcpArgsInput);
    if (!argsResult.ok) {
      return argsResult;
    }

    const envResult = parseStdioEnvInput(options.formState.mcpEnvInput);
    if (!envResult.ok) {
      return envResult;
    }

    const cwd = options.formState.mcpCwdInput.trim();
    return {
      ok: true,
      server: {
        id: options.serverId,
        name: rawName || command,
        transport: "stdio",
        command,
        args: argsResult.value,
        cwd: cwd || undefined,
        env: envResult.value,
      },
    };
  }

  const rawUrl = options.formState.mcpUrlInput.trim();
  if (!rawUrl) {
    return {
      ok: false,
      error: "MCP server URL is required.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      error: "MCP server URL is invalid.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      error: "MCP server URL must start with http:// or https://.",
    };
  }

  const name = rawName || parsed.hostname;
  if (!name) {
    return {
      ok: false,
      error: "MCP server name is required.",
    };
  }

  const headersResult = parseHttpHeadersInput(options.formState.mcpHeadersInput);
  if (!headersResult.ok) {
    return headersResult;
  }

  let azureAuthScope = MCP_DEFAULT_AZURE_AUTH_SCOPE;
  if (options.formState.mcpUseAzureAuthInput) {
    const scopeResult = parseAzureAuthScopeInput(
      options.formState.mcpAzureAuthScopeInput,
    );
    if (!scopeResult.ok) {
      return scopeResult;
    }
    azureAuthScope = scopeResult.value;
  }

  const timeoutResult = parseMcpTimeoutSecondsInput(
    options.formState.mcpTimeoutSecondsInput,
  );
  if (!timeoutResult.ok) {
    return timeoutResult;
  }

  return {
    ok: true,
    server: {
      id: options.serverId,
      name,
      url: parsed.toString(),
      transport: options.formState.mcpTransport,
      headers: headersResult.value,
      useAzureAuth: options.formState.mcpUseAzureAuthInput,
      azureAuthScope,
      timeoutSeconds: timeoutResult.value,
    },
  };
}
