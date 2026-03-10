/**
 * Repo-wide architecture audit script.
 */
import fs from "node:fs/promises";
import process from "node:process";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const workspaceRoot = process.cwd();

const checks = [
  {
    key: "serverHttpImports",
    description: "Routes and server modules must not import from ~/lib/server/http.",
    command: "rg",
    args: [
      "-n",
      "from ['\\\"]~/lib/server/http",
      "app/routes",
      "app/lib/server",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "serverHttpFiles",
    description: "Legacy app/lib/server/http files should be retired.",
    rootPath: "app/lib/server/http",
    command: "rg",
    args: ["--files", "app/lib/server/http"],
  },
  {
    key: "clientChatFiles",
    description: "Legacy app/lib/client/chat files should be retired.",
    rootPath: "app/lib/client/chat",
    command: "rg",
    args: ["--files", "app/lib/client/chat"],
  },
  {
    key: "sharedComponentBoundaryViolations",
    description:
      "Shared components must not depend on feature usecases, browser adapters, or server code.",
    command: "rg",
    args: [
      "-n",
      "from ['\\\"]~/lib/(client/usecase|client/infrastructure|server)|from ['\\\"]~/app/routes",
      "app/components/shared",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "domainRepositoryContractImports",
    description: "Domain repository ports must not import transport contracts.",
    command: "rg",
    args: ["-n", "from ['\\\"]~/lib/contracts/", "app/lib/domain/repositories"],
  },
  {
    key: "raw405InRoutes",
    description: "Route modules should use methodNotAllowedResponse helpers instead of raw 405 values.",
    command: "rg",
    args: [
      "-n",
      "\\b405\\b",
      "app/routes",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
  {
    key: "historicalNaming",
    description: "Historical thread/entity naming should not remain in app sources.",
    command: "rg",
    args: [
      "-n",
      "ThreadRecord|ThreadRecordSnapshot|AzureSelectionPreferenceSnapshot|savePayload\\(|toSnapshot\\(|fromSnapshot\\(",
      "app",
      "--glob",
      "!**/*.test.ts",
      "--glob",
      "!**/*.test.tsx",
    ],
  },
];

async function main() {
  const report = {};
  let hasAnyFindings = false;

  for (const check of checks) {
    const actual = await runCheck(check);
    const hasFindings = actual.length > 0;
    hasAnyFindings ||= hasFindings;

    report[check.key] = {
      description: check.description,
      actual,
    };
  }

  printReport(report);

  if (hasAnyFindings) {
    process.exitCode = 1;
  }
}

async function runCheck(check) {
  if (check.rootPath && !(await pathExists(path.join(workspaceRoot, check.rootPath)))) {
    return [];
  }

  try {
    const { stdout } = await execFile(check.command, check.args, {
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return normalizeFindings(stdout.split("\n"));
  } catch (error) {
    if (typeof error?.code === "number" && error.code === 1) {
      return normalizeFindings(error.stdout?.split("\n") ?? []);
    }
    throw error;
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeFindings(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => `${item}`.trim()).filter(Boolean))].sort();
}

function printReport(report) {
  const keys = Object.keys(report);
  for (const key of keys) {
    const section = report[key];
    const count = section.actual.length;
    console.log(`\n[${key}] ${section.description}`);
    console.log(`findings: ${count}`);
    for (const finding of section.actual) {
      console.log(`  - ${finding}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
