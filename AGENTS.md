# Commit Messages

- Write commit messages with Conventional Commits: `<type>[optional scope]: <description>`.
- Common `type`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

# Skill Prerequisite

- Before development, enable the repository skill:
  - `export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}" && npm run skill:enable`
- Restart Codex after installing or updating the skill.

# Development Mode

- This repository is in active development.
- Do not add backward compatibility shims, dual-path contracts, or fallback behavior unless explicitly requested.
- Prefer direct replacement of old contracts and terminology.

# Architecture Baseline

- Treat [`docs/architecture/client-clean-architecture.md`](docs/architecture/client-clean-architecture.md) as the architecture source of truth.
- `app/lib` top-level directories are restricted to:
  - `app/lib/client/`
  - `app/lib/contracts/`
  - `app/lib/constants/`
  - `app/lib/domain/`
  - `app/lib/server/`
- Do not create new top-level feature roots under `app/lib/`.
- Do not recreate obsolete roots:
  - `app/lib/azure/`
  - `app/lib/foundry/`
  - `app/lib/mcp/`
  - `app/lib/observability/`
  - `app/welcome/`
- Place reusable code by responsibility:
  - SPA runtime and view orchestration -> `app/lib/client/`
  - shared request/response contracts and parsing -> `app/lib/contracts/`
  - shared static configuration -> `app/lib/constants/`
  - framework-independent model behavior and policy -> `app/lib/domain/`
  - server use cases, integrations, and server-only utilities -> `app/lib/server/`
- Under `app/lib/server/`, prefer `application/`, `infrastructure/`, and `shared/`. Existing peer directories outside these buckets are migration residue and should shrink, not grow.

# Naming and Modeling

- Prisma schema entity and field names are the canonical domain vocabulary.
- Use one name for one concept across schema references, runtime code, API contracts, tests, and docs.
- When a rename is needed, apply it end-to-end in one pass.
- Legacy prefixes and historical names may still exist in the codebase. Treat them as migration residue, not as naming guidance for new code.
- Do not introduce new `home`-prefixed identifiers, `HOME_*` constants, or similar historical aliases for new work unless they are part of an external compatibility boundary that the user explicitly asked to preserve.
- Use `class` when identity, invariants, lifecycle, or orchestration behavior matter.
- Keep DTO, response envelopes, join rows, log rows, cache rows, and pure transforms as `type`/function-based modules.

# API and Module Boundaries

- Route modules own HTTP concerns only:
  - method dispatch
  - request validation
  - status codes
  - response shape
- Shared route logic must live under `app/lib/server/`.
- Do not import one route module from another in `app/routes/api.*`.
- Do not introduce new `app/lib/server` -> `app/lib/client` imports.
- Standard APIs should be resource-first and noun-based.
- Command-style exceptions are limited to:
  - `/api/chat`
  - `/api/instruction-patches`
  - `/api/threads/title-suggestions`
- Use `methodNotAllowedResponse` for `405`.
- Keep structured JSON error payloads with stable machine-readable codes and concise messages.

# Client and UI Boundaries

- Keep route components under `app/routes/` focused on visual composition.
- Keep SPA runtime state and side effects in `app/lib/client/`.
- Reuse `app/components/client/shared/` before adding repeated UI patterns.
- Prefer one-directional dependencies:
  - panel -> tab -> section -> shared
- Keep product terminology consistent:
  - `Playground`
  - `Threads`
  - `MCP Servers`
  - `Skills`
  - `Settings`
- Preserve desktop-first behavior while keeping the UI responsive.

# Persistence, Auth, and Debug

- Treat controller/runtime state as the immediate source of truth during interaction.
- Treat persisted storage as the durable snapshot layer.
- Use `DefaultAzureCredential` for Azure authentication flows.
- Keep user-scoped persisted resources user-scoped in both DB records and filesystem layout.
- `/mcp/debug` is a development/debug workflow, not a production access path.
- When `prisma/schema.prisma` changes for persisted models or fields, update `/mcp/debug` metadata in the same batch and run:
  - `npm run test:core -- app/lib/server/persistence/mcp-debug-database.test.ts`

# Verification

- Run naming and structure drift checks after each meaningful refactor batch.
- Recommended static audits:
  - deprecated term search with `rg`
  - route-to-route import search
  - `server -> client` import search
  - raw `405` search in `app/routes/api.*`
- If any `app/routes/api.*` file changed, run:
  - `npm run test:core -- app/routes/api.*.test.ts`
  - `npm run typecheck:core`
- Run `npm run quality:gate` after broader refactors and before finalizing substantial changes.

# Documentation

- Keep `README.md`, architecture docs, and the repository skill aligned with implemented architecture.
- Prefer stable rules and durable concepts over exhaustive implementation inventories.
- Remove or simplify documentation sections that are likely to become stale quickly.
