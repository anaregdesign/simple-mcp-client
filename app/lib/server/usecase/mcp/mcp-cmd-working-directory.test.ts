import fs from "node:fs";
import nodeOs from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveThreadFilesystemWorkingDirectory } from "./workspace-mcp-server-default-paths";
import { resolveWorkingDirectory } from "./mcp-cmd-working-directory";

const createdPaths = new Set<string>();

afterEach(() => {
  for (const createdPath of createdPaths) {
    fs.rmSync(createdPath, { recursive: true, force: true });
  }
  createdPaths.clear();
});

describe("resolveWorkingDirectory", () => {
  it("uses the workspace thread directory by default", () => {
    const threadId = "working-dir-default";
    const expectedThreadDirectory = resolveThreadFilesystemWorkingDirectory(42, threadId);
    createdPaths.add(expectedThreadDirectory);

    expect(resolveWorkingDirectory(42, threadId, null)).toEqual({
      ok: true,
      value: {
        threadDirectory: expectedThreadDirectory,
        workingDirectory: expectedThreadDirectory,
      },
    });
  });

  it("rejects missing thread context", () => {
    expect(resolveWorkingDirectory(42, null, null)).toEqual({
      ok: false,
      error: "threadContext.threadId is required for secure command execution.",
    });
  });

  it("rejects workingDirectory outside the thread directory", () => {
    const outsideDirectory = fs.mkdtempSync(
      path.join(nodeOs.tmpdir(), "local-playground-mcp-cmd-dir-test-"),
    );
    createdPaths.add(outsideDirectory);

    const result = resolveWorkingDirectory(
      42,
      "working-dir-outside",
      outsideDirectory,
    );

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("workingDirectory must be inside thread directory"),
    });
  });
});
