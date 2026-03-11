/**
 * Tests for stdio runtime path helpers.
 */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildStdioSpawnEnvironment,
  resolveExecutableInvocation,
  resolveExecutableCommand,
} from "~/lib/server/infrastructure/gateways/chat/stdio-runtime-path";

describe("buildStdioSpawnEnvironment", () => {
  it("keeps configured PATH entries and produces PATH output", () => {
    const customPathEntry = path.join(os.tmpdir(), "local-playground-custom-bin");
    const env = buildStdioSpawnEnvironment({
      PATH: customPathEntry,
    });

    const pathValue = env.PATH ?? "";
    expect(pathValue.length).toBeGreaterThan(0);
    expect(pathValue.split(path.delimiter)).toContain(customPathEntry);
  });
});

describe("resolveExecutableCommand", () => {
  it("returns path-like commands unchanged", () => {
    expect(resolveExecutableCommand("./demo-tool", {})).toBe("./demo-tool");
  });

  it("resolves commands from PATH entries", () => {
    const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "local-playground-chat-"));
    try {
      const commandName = process.platform === "win32" ? "demo-tool.cmd" : "demo-tool";
      const commandPath = path.join(tempDirectory, commandName);
      writeFileSync(
        commandPath,
        process.platform === "win32" ? "@echo off\r\necho demo\r\n" : "#!/bin/sh\necho demo\n",
        "utf8",
      );
      if (process.platform !== "win32") {
        chmodSync(commandPath, 0o755);
      }

      const resolved = resolveExecutableCommand("demo-tool", { PATH: tempDirectory });
      expect(resolved).toBe(commandPath);
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});

describe("resolveExecutableInvocation", () => {
  it("rewrites node shebang scripts to execute through node", () => {
    if (process.platform === "win32") {
      return;
    }

    const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "local-playground-chat-"));
    try {
      const nodePath = path.join(tempDirectory, "node");
      const scriptPath = path.join(tempDirectory, "npx");
      writeFileSync(nodePath, "#!/bin/sh\necho node\n", "utf8");
      writeFileSync(scriptPath, "#!/usr/bin/env node\nconsole.log('npx');\n", "utf8");
      chmodSync(nodePath, 0o755);
      chmodSync(scriptPath, 0o755);

      const invocation = resolveExecutableInvocation("npx", ["-y", "@microsoft/workiq", "mcp"], {
        PATH: tempDirectory,
      });
      expect(invocation.command).toBe(nodePath);
      expect(invocation.args).toEqual([scriptPath, "-y", "@microsoft/workiq", "mcp"]);
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it("keeps non-node shebang scripts unchanged", () => {
    const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "local-playground-chat-"));
    try {
      const scriptPath = path.join(tempDirectory, "demo-tool");
      writeFileSync(scriptPath, "#!/bin/sh\necho demo\n", "utf8");
      chmodSync(scriptPath, 0o755);

      const invocation = resolveExecutableInvocation("demo-tool", ["--flag"], {
        PATH: tempDirectory,
      });
      expect(invocation.command).toBe(scriptPath);
      expect(invocation.args).toEqual(["--flag"]);
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
