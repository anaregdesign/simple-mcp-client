import fs from "node:fs";
import type { ClientMcpStdioServerConfig } from "~/lib/server/usecase/chat/mcp-server-config-types";
import {
  buildStdioSpawnEnvironment,
  isExecutableCommandAvailable,
  resolveExecutableInvocation,
} from "~/lib/server/infrastructure/gateways/chat/stdio-runtime-path";

export type PreparedStdioMcpServerLaunch = {
  env: Record<string, string>;
  command: string;
  args: string[];
  cwd?: string;
};

export function prepareStdioMcpServerLaunch(
  config: ClientMcpStdioServerConfig,
): PreparedStdioMcpServerLaunch {
  const env = buildStdioSpawnEnvironment(config.env);
  assertExecutableCommandAvailable(config.command, env, config.command);

  const invocation = resolveExecutableInvocation(config.command, config.args, env);
  assertExecutableCommandAvailable(invocation.command, env, config.command);

  const cwd = ensureWorkingDirectory(config.cwd);
  return {
    env,
    command: invocation.command,
    args: invocation.args,
    ...(cwd ? { cwd } : {}),
  };
}

function assertExecutableCommandAvailable(
  commandToValidate: string,
  env: Record<string, string>,
  requestedCommand: string,
): void {
  if (isExecutableCommandAvailable(commandToValidate, env)) {
    return;
  }

  throw new Error(
    buildMissingExecutableMessage({
      requestedCommand,
      missingCommand: commandToValidate,
    }),
  );
}

function ensureWorkingDirectory(cwd: string | undefined): string | undefined {
  if (!cwd) {
    return undefined;
  }

  try {
    fs.mkdirSync(cwd, { recursive: true });
    return cwd;
  } catch (error) {
    throw new Error(
      `Failed to prepare stdio MCP working directory (${cwd}): ${readErrorMessage(error)}`,
    );
  }
}

function buildMissingExecutableMessage(options: {
  requestedCommand: string;
  missingCommand: string;
}): string {
  if (options.requestedCommand === "npx") {
    return [
      "The `npx` command is not available on PATH.",
      "This app now launches stdio MCP servers through `npx` and does not bundle local MCP executables.",
      "Install Node.js LTS, restart the app, and verify the setup with `node --version` and `npx --version`.",
      "If those commands work in your shell but not here, launch the app from that shell or add Node's bin directory to your login PATH.",
      "Download Node.js from https://nodejs.org/.",
    ].join(" ");
  }

  return [
    `The \`${options.missingCommand}\` command is not available on PATH.`,
    `Install it and verify with \`${options.requestedCommand} --version\`, or update this MCP server configuration.`,
  ].join(" ");
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
