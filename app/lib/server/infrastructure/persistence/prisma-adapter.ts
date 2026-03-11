import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PersistenceDatabaseProvider } from "~/lib/server/infrastructure/persistence/database-config";

export function createPrismaAdapter(options: {
  provider: PersistenceDatabaseProvider;
  databaseUrl: string;
}):
  | PrismaBetterSqlite3
  | PrismaPg
  | PrismaMariaDb
  | PrismaMssql {
  switch (options.provider) {
    case "sqlite":
      return new PrismaBetterSqlite3({
        url: options.databaseUrl,
      });
    case "postgresql":
    case "cockroachdb":
      return new PrismaPg({
        connectionString: options.databaseUrl,
      });
    case "mysql":
      return new PrismaMariaDb(options.databaseUrl);
    case "sqlserver":
      return new PrismaMssql(options.databaseUrl);
  }
}
