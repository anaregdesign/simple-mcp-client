/**
 * Repo-wide architecture audit script.
 *
 * By default this script enforces "no new findings" relative to the checked-in
 * baseline so large refactors can land in reviewable waves. Set
 * ARCHITECTURE_CHECK_STRICT=1 to require zero findings.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const workspaceRoot = process.cwd();
const baselinePath = path.join(
  workspaceRoot,
  "scripts",
  "architecture-check-baseline.json",
);
const strictMode = process.env.ARCHITECTURE_CHECK_STRICT === "1";
const shouldWriteBaseline = process.argv.includes("--write-baseline");

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
    command: "rg",
    args: ["--files", "app/lib/server/http"],
  },
  {
    key: "clientChatFiles",
    description: "Legacy app/lib/client/chat files should be retired.",
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
  const baseline = await readBaseline();
  const report = {};
  let hasNewFindings = false;
  let hasAnyFindings = false;
  const nextBaseline = {};

  for (const check of checks) {
    const actual = await runCheck(check);
    const expected = normalizeFindings(baseline[check.key]);
    const unexpected = actual.filter((item) => !expected.includes(item));
    const resolved = expected.filter((item) => !actual.includes(item));
    const hasFindings = actual.length > 0;
    hasAnyFindings ||= hasFindings;
    hasNewFindings ||= unexpected.length > 0;
    nextBaseline[check.key] = actual;

    report[check.key] = {
      description: check.description,
      actual,
      unexpected,
      resolved,
    };
  }

  if (shouldWriteBaseline) {
    await fs.writeFile(
      baselinePath,
      `${JSON.stringify(nextBaseline, null, 2)}\n`,
      "utf8",
    );
  }

  printReport(report);

  if (strictMode && hasAnyFindings) {
    process.exitCode = 1;
    return;
  }

  if (hasNewFindings) {
    process.exitCode = 1;
  }
}

async function readBaseline() {
  try {
    const source = await fs.readFile(baselinePath, "utf8");
    const parsed = JSON.parse(source);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }
    throw error;
  }
}

async function runCheck(check) {
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
      const marker = section.unexpected.includes(finding) ? "+" : "=";
      console.log(`  ${marker} ${finding}`);
    }
    for (const finding of section.resolved) {
      console.log(`  - ${finding}`);
    }
  }
}

function isMissingFileError(error) {
  return Boolean(error) && typeof error === "object" && error.code === "ENOENT";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
