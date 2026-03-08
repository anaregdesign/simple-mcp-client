/**
 * Tests for stdio runtime path helpers.
 */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildStdioSpawnEnvironment,
  resolveExecutableCommand,
} from "~/lib/server/chat/stdio-runtime-path";

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
