import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: readPrismaDatasourceUrl(),
  },
});

function readPrismaDatasourceUrl(): string {
  const configuredUrl =
    readTrimmedString(process.env.LOCAL_PLAYGROUND_DATABASE_URL) ||
    readTrimmedString(process.env.DATABASE_URL);
  if (configuredUrl) {
    return configuredUrl;
  }

  const provider = readDatabaseProvider(
    process.env.LOCAL_PLAYGROUND_DATABASE_PROVIDER || process.env.DATABASE_PROVIDER,
  );
  switch (provider) {
    case "postgresql":
    case "cockroachdb":
      return "postgresql://prisma:prisma@localhost:5432/local_playground";
    case "mysql":
      return "mysql://prisma:prisma@localhost:3306/local_playground";
    case "sqlserver":
      return "sqlserver://localhost:1433;database=local_playground;user=sa;password=Password123!;encrypt=true;trustServerCertificate=true";
    case "sqlite":
    default:
      return "file:./local-playground.sqlite";
  }
}

function readDatabaseProvider(
  rawValue: string | undefined,
): "sqlite" | "postgresql" | "mysql" | "cockroachdb" | "sqlserver" {
  const normalized = readTrimmedString(rawValue).toLowerCase();
  if (normalized === "postgres" || normalized === "postgresql") {
    return "postgresql";
  }
  if (normalized === "mysql") {
    return "mysql";
  }
  if (normalized === "cockroach" || normalized === "cockroachdb") {
    return "cockroachdb";
  }
  if (normalized === "mssql" || normalized === "sqlserver") {
    return "sqlserver";
  }
  return "sqlite";
}

function readTrimmedString(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}
