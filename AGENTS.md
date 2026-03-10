# Commit Messages

- Write commit messages with Conventional Commits: `<type>[optional scope]: <description>`.
- Common `type`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

# Development Mode

- This repository is in active development.
- Do not add backward compatibility shims, dual-path contracts, or fallback behavior unless explicitly requested.
- Prefer direct replacement of old contracts and terminology.

# Architecture Baseline

- Treat [`skills/enforce-react-spa-architecture/SKILL.md`](skills/enforce-react-spa-architecture/SKILL.md) as the default architecture workflow and normative architecture source for new work in this repository.
- Keep dependency direction inward:
  - `app/routes/` and `app/components/` depend on client-facing orchestration, never on Prisma.
  - `app/lib/client/usecase/` depends on `domain` and client adapters.
  - `app/lib/server/usecase/` depends on `domain` and `app/lib/domain/repositories/`.
  - `app/lib/server/infrastructure/` implements repository ports and external integrations.
  - `app/lib/domain/*` depends only on other domain modules.
- Canonical placement for new code:
  - `app/routes/`
  - `app/components/`
  - `app/components/shared/`
  - `app/lib/client/usecase/<feature>/`
  - `app/lib/client/infrastructure/api/`
  - `app/lib/client/infrastructure/browser/`
  - `app/lib/server/usecase/`
  - `app/lib/server/infrastructure/repositories/`
  - `app/lib/server/infrastructure/gateways/`
  - `app/lib/domain/entities/`
  - `app/lib/domain/value-objects/`
  - `app/lib/domain/policies/`
  - `app/lib/domain/services/`
  - `app/lib/domain/repositories/`
- `app/lib/contracts/` and `app/lib/constants/` remain allowed for stable shared transport contracts and static configuration. Do not create new generic common buckets.
- Existing peer directories outside the canonical layout are migration residue and should shrink, not grow.
- Do not recreate obsolete roots:
  - `app/lib/azure/`
  - `app/lib/foundry/`
  - `app/lib/mcp/`
  - `app/lib/observability/`
  - `app/welcome/`

# Naming and Modeling

- Prisma schema entity and field names are the canonical domain vocabulary.
- Use one name for one concept across schema references, runtime code, API contracts, tests, and docs.
- When a rename is needed, apply it end-to-end in one pass.
- Legacy prefixes and historical names may still exist in the codebase. Treat them as migration residue, not as naming guidance for new code.
- Do not introduce new `home`-prefixed identifiers, `HOME_*` constants, or similar historical aliases for new work unless they are part of an external compatibility boundary that the user explicitly asked to preserve.
- Use `class` when identity, invariants, lifecycle, or orchestration behavior matter.
- Keep DTO, response envelopes, join rows, log rows, cache rows, and pure transforms as `type`/function-based modules.
- Put repository interfaces in `app/lib/domain/repositories/`.
- Keep transport `Request`, `Response`, DTO, and payload types near the owning route, API client, or use case first. Promote them to `app/lib/contracts/` only after the boundary is stable and truly reused.

# API and Module Boundaries

- Route modules own HTTP concerns only:
  - method dispatch
  - loader/action wiring
  - request validation
  - status codes
  - response shape
- Shared route logic must live under `app/lib/server/usecase/` or `app/lib/server/infrastructure/`.
- Do not import Prisma from `app/routes/`.
- Do not import one route module from another in `app/routes/api.*`.
- Do not introduce new `app/lib/server` -> `app/lib/client` imports.
- Standard APIs should be resource-first and noun-based.
- Command-style exceptions are limited to:
  - `/api/chat`
  - `/api/instruction-patches`
  - `/api/threads/title-suggestions`
- Use `methodNotAllowedResponse` for `405`.
- Keep structured JSON error payloads with stable machine-readable codes and concise messages.
- Resolve authentication at the edge, but keep authorization decisions in use cases or domain policies.
- Map domain, application, and infrastructure errors to transport responses at the edge.

# Client and UI Boundaries

- Keep `app/components/` presentational. Allow only ephemeral UI state there, such as local input focus or disclosure toggles.
- Keep route components under `app/routes/` focused on visual composition.
- Keep async state, mutation handlers, reducers, selectors, and derived view models in `app/lib/client/usecase/<feature>/`.
- Co-locate `state.ts`, `reducer.ts`, `selectors.ts`, `handlers.ts`, and `use-<feature>.ts` inside the owning `app/lib/client/usecase/<feature>/`.
- Put endpoint-specific API clients in `app/lib/client/infrastructure/api/`.
- Put browser-only adapters in `app/lib/client/infrastructure/browser/`.
- Prefer feature-local components first. Promote a component to `app/components/shared/` only after it proves to be truly feature-agnostic.
- Do not create horizontal buckets such as `app/state/`, `app/reducers/`, `app/stores/`, `app/handlers/`, or `app/lib/client/usecase/state/`.
- Use React Router primitives such as `loader`, `action`, `useFetcher`, and `useNavigation` before inventing new client state containers.
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
- Prisma baseline is v7.x. Treat non-v7 setup as migration work, not as an equal baseline.
- Keep Prisma imports inside `app/lib/server/infrastructure/`, `scripts/`, and migration or seed tooling only.
- Do not leak Prisma model types above infrastructure.
- Rebuild transaction-scoped dependencies per request or transaction, and keep transactions short.
- `/mcp/debug` is a development/debug workflow, not a production access path.
- When `prisma/schema.prisma` changes for persisted models or fields, update `/mcp/debug` metadata in the same batch and run:
  - `npm run test:core -- app/lib/server/infrastructure/persistence/mcp-debug-database.test.ts`

# Verification

- Run naming and structure drift checks after each meaningful refactor batch.
- Recommended static audits:
  - deprecated term search with `rg`
  - route-to-route import search
  - `server -> client` import search
  - Prisma import search outside `app/lib/server/infrastructure/`
  - horizontal `state` / `reducers` / `stores` / `handlers` directory search
  - feature-specific import search inside `app/components/shared/`
  - raw `405` search in `app/routes/api.*`
- If any `app/routes/api.*` file changed, run:
  - `npm run test:core -- app/routes/api.*.test.ts`
  - `npm run typecheck:core`
- Run `npm run quality:gate` after broader refactors and before finalizing substantial changes.
- Fix architecture violations before pushing even if tests pass.

# Documentation

- Keep `README.md`, `AGENTS.md`, architecture docs, and [`skills/enforce-react-spa-architecture/SKILL.md`](skills/enforce-react-spa-architecture/SKILL.md) aligned with implemented architecture.
- Prefer stable rules and durable concepts over exhaustive implementation inventories.
- Remove or simplify documentation sections that are likely to become stale quickly.
