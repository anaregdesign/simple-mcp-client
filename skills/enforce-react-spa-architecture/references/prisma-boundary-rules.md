# Prisma Boundary Rules

Use these rules when the project uses Prisma ORM.

## Version Guidance

- Use Prisma ORM v7.x for SQL-backed applications.
- Use the matching major for both `prisma` and `@prisma/client`.
- Prefer Prisma v7 driver adapters instead of older connection patterns.
- Treat non-v7 Prisma setup as migration work.

For this skill, Prisma v7 is mandatory.

## Placement Rule

Keep Prisma usage inside server-side infrastructure code.

Allowed places:

- `app/lib/server/infrastructure/`
- `scripts/`
- migration and seed tooling

Do not import Prisma from:

- `app/lib/domain/`
- `app/lib/server/usecase/`
- `app/lib/client/`
- `app/components/`
- `app/routes/`

Route modules should call a dependency factory or server use case, not Prisma directly.

## Client Construction

- Reuse one long-lived `PrismaClient` per app process unless your runtime model requires a different lifetime.
- Do not create a new `PrismaClient` per request.
- Do not disconnect on every request in a long-running server process.
- In Prisma v7, configure the required driver adapter explicitly.

## Mapping Rule

- Do not leak Prisma model types above infrastructure.
- Map Prisma records into domain objects, value objects, or transport DTOs inside infrastructure.
- Keep `Prisma.*` helper types and generated model details out of `domain` and `client`.

## Query Discipline

- Prefer `select` or other narrow projections over broad record loading.
- Avoid large `include` trees unless the use case genuinely needs them.
- Keep query shape aligned with the calling use case instead of returning oversized records.

## Transaction Rule

- Keep transactions short.
- Do not perform remote HTTP calls, SDK calls, or slow file I/O inside a transaction when it can be avoided.
- Build transaction-scoped repositories from the current transaction client.
- Do not reuse root repository instances inside a transaction if they were built from the root client.

## Migration Discipline

When Prisma schema changes, update the surrounding code in the same batch:

- regenerate the Prisma client
- update repository mappings
- update related DTOs and contracts
- update use case assumptions
- update tests and any seed or fixture data

Do not treat schema edits as isolated changes.

## Raw SQL Rule

- Prefer Prisma query APIs first.
- If raw SQL is needed, prefer typed or parameterized safe forms.
- Treat unsafe raw execution as an exception that requires explicit justification.

## Review Checklist

Treat these as Prisma smells:

- Prisma imported outside server infrastructure or tooling
- `new PrismaClient()` inside use case or route code
- request-scoped auth or transaction state stored on a singleton repository
- Prisma model types exposed in API or domain contracts
- broad `include` usage without a concrete caller need
