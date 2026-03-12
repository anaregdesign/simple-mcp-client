import {
  chmodSync,
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareStdioMcpServerLaunch } from "~/lib/server/infrastructure/gateways/mcp/mcp-stdio-launch-preflight";

const originalPathEnvironmentValue = process.env.PATH;

afterEach(() => {
  if (originalPathEnvironmentValue === undefined) {
    delete process.env.PATH;
    return;
  }

  process.env.PATH = originalPathEnvironmentValue;
});

describe("prepareStdioMcpServerLaunch", () => {
  it("returns an npx install guide when npx is unavailable", () => {
    const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "local-playground-mcp-stdio-"));
    try {
      process.env.PATH = tempDirectory;

      expect(() =>
        prepareStdioMcpServerLaunch({
          name: "workiq",
          transport: "stdio",
          command: "npx",
          args: ["-y", "@microsoft/workiq", "mcp"],
          cwd: path.join(tempDirectory, "workspace"),
          env: {},
        }),
      ).toThrow(/Install Node\.js LTS/);
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("creates a missing working directory before launching stdio MCP", () => {
    const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "local-playground-mcp-stdio-"));
    try {
      const commandName = process.platform === "win32" ? "npx.cmd" : "npx";
      const commandPath = path.join(tempDirectory, commandName);
      writeFileSync(
        commandPath,
        process.platform === "win32" ? "@echo off\r\necho npx\r\n" : "#!/bin/sh\necho npx\n",
        "utf8",
      );
      if (process.platform !== "win32") {
        chmodSync(commandPath, 0o755);
      }

      process.env.PATH = tempDirectory;

      const missingWorkingDirectory = path.join(tempDirectory, "workspace", "nested");
      expect(existsSync(missingWorkingDirectory)).toBe(false);

      const launch = prepareStdioMcpServerLaunch({
        name: "filesystem",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
        cwd: missingWorkingDirectory,
        env: {},
      });

      expect(existsSync(missingWorkingDirectory)).toBe(true);
      expect(launch.cwd).toBe(missingWorkingDirectory);
      expect(launch.command).toBe(commandPath);
      expect(launch.args).toEqual(["-y", "@modelcontextprotocol/server-filesystem", "."]);
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
