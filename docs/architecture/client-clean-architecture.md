# Client-Centered Clean Architecture

This document is the contributor architecture baseline for Local Playground.

Use it together with:

- `AGENTS.md`

## Goals

- Keep the app as a SPA with a clear `client` runtime boundary.
- Keep `app/lib` organized by layer, not by ad-hoc feature roots.
- Move reusable behavior into explicit modules instead of growing hotspot files.
- Prefer direct replacement over compatibility shims during active development.
- Keep Prisma vocabulary as the naming source of truth.

## Top-Level Layout

`app/lib` is restricted to these top-level directories:

```text
app/lib/
  client/
  constants/
  contracts/
  domain/
  server/
```

Do not add new top-level feature directories under `app/lib/`.

These historical roots are obsolete and must not be recreated:

- `app/lib/azure/`
- `app/lib/foundry/`
- `app/lib/mcp/`
- `app/lib/observability/`
- `app/welcome/`

## Layer Responsibilities

### `app/lib/client/`

SPA runtime logic lives under explicit `usecase` and `infrastructure` boundaries.

Preferred structure:

```text
app/lib/client/
  usecase/
    <feature>/
      use-<feature>.ts
      state.ts
      reducer.ts
      selectors.ts
      handlers.ts
  infrastructure/
    api/
    browser/
```

Use this layer for:

- feature-local usecase Hooks and selectors
- feature-specific API clients
- browser adapters such as clipboard or file save integration
- client-only parsers and view-model mapping

Do not put server logic, persistence adapters, or route handlers here.

### `app/lib/constants/`

Shared static constants only.

Use feature modules such as:

- `azure.ts`
- `chat.ts`
- `client.ts`
- `instruction.ts`
- `mcp.ts`
- `persistence.ts`
- `skills.ts`

Do not create new cross-file constants in feature modules when they belong here.

### `app/lib/contracts/`

Shared request/response contracts, parser/validation helpers, and DTO-adjacent structures used across client and server.

Current examples:

- `app/lib/contracts/mcp/server-config-parser.ts`
- `app/lib/contracts/mcp/validation.ts`
- `app/lib/contracts/shared/runtime-event-log.ts`

### `app/lib/domain/`

Canonical domain vocabulary, domain policies, and behavior-bearing models that are independent of client and server frameworks.

Current examples:

- `app/lib/domain/mcp/config-key.ts`

### `app/lib/server/`

Server-side logic only.

Target structure:

```text
app/lib/server/
  usecase/
  infrastructure/
```

Migration residue still exists under additional `app/lib/server/*` directories such as `auth/`, `chat/`, `mcp/`, `observability/`, and `skills/`. When touching those areas:

- prefer extracting reusable logic into `usecase/` or `infrastructure/`
- avoid creating new legacy top-level siblings
- avoid expanding route-local helper sprawl

## Dependency Rules

- `client` may import `constants`, `contracts`, and `domain`.
- `domain` must not import `client`, `server`, or route modules.
- `contracts` must stay framework-light and may be shared by `client` and `server`.
- `server` must not import `client` for new work.
- if server code needs a shared shape or parser currently living in `client`, move it to `contracts`, `domain`, or `constants`
- route modules must not import other route modules
- route modules own HTTP concerns only and delegate reusable behavior to server modules

## Feature Placement Rules

### Client UI

Use:

- `app/components/authorize/`
- `app/components/playground/`
- `app/components/config/threads/`
- `app/components/config/mcp/`
- `app/components/config/skills/`
- `app/components/config/settings/`
- `app/components/shared/`

Do not create route-local component trees for these concerns.

### Server Infrastructure

Use `app/lib/server/infrastructure/` for environment-aware integrations and persistence-adjacent infrastructure.

Examples:

- Azure dependency wiring
- filesystem/config path resolution
- OpenAI gateway setup
- external service transport helpers

### Contracts and Shared Parsing

Use `app/lib/contracts/` for shared parsing and validation logic rather than recreating feature roots.

Contracts should expose explicit DTO and resource shapes. Do not leak Prisma model types into `contracts`.

Examples:

- MCP validation
- MCP config parsing
- normalized response payload types

## Hotspot Shrink Rules

The following files are migration hotspots and should shrink over time:

- `app/lib/client/usecase/workspace/use-workspace.ts`
- `app/routes/api.chat.ts`

When adding new behavior:

- do not add reusable orchestration to these files if an extracted module is possible
- prefer feature-local usecase modules, `client/infrastructure/api`, `client/infrastructure/browser`, selector helpers, and server-side usecase modules
- keep route files focused on parsing, dispatch, and response wiring

## Class Policy

Use `class` only when identity, invariants, lifecycle, or orchestration behavior matter.

### Prefer `class`

- domain models with behavior and invariants
- usecase services
- API clients
- repositories
- gateways
- mappers

### Prefer `type` or functions

- DTO
- response envelopes
- request payloads
- join-table rows
- log rows
- cache rows
- pure transforms
- scalar unions

### Prisma Model Rule

Do not mechanically map every Prisma model to a class.

Good candidates:

- `Thread`
- `WorkspaceMcpServerProfile`
- `WorkspaceSkillProfile`
- `AzureSelectionPreference`

Poor candidates:

- `ThreadSkillActivation`
- `ThreadMessageSkillActivation`
- `ThreadOperationLog`
- `RuntimeEventLog`
- `SkillRegistryCache`

## API Contract Rules

- Use resource-first routes for standard APIs.
- Keep command-style exceptions limited to:
  - `/api/chat`
  - `/api/instruction-patches`
  - `/api/threads/title-suggestions`
- Success envelope:
  - `{ data, meta? }`
- Error envelope:
  - `{ error: { code, message, details? } }`
- Use `methodNotAllowedResponse` for `405`.

## Naming Rules

- Use Prisma schema names as the canonical vocabulary.
- Apply renames end-to-end in one batch.
- Remove old aliases instead of keeping compatibility names.
- Keep UI terminology consistent:
  - `Playground`
  - `Threads`
  - `MCP Servers`
  - `Skills`
  - `Settings`

## Persistence and Skill Roots

- SQLite/config root:
  - macOS/Linux: `~/.foundry_local_playground/`
  - Windows: `%APPDATA%\\FoundryLocalPlayground\\`
- Workspace-user skill root:
  - `<foundry-config-dir>/users/<user-id>/skills/`
- Shared Codex skill root:
  - `$CODEX_HOME/skills/`

## Refactor Workflow

- Create `codex/*` branches.
- Use Conventional Commits.
- Work in reviewable batches.
- After each refactor batch:
  - run focused `rg` drift checks
  - run route audits for changed `api.*` files
  - run `npm run typecheck:core`
- After substantial batches:
  - run `npm run quality:gate`

## Practical Review Questions

Before finalizing a change, verify:

1. Did the change keep `app/lib` within the approved layer layout?
2. Did it avoid reintroducing obsolete roots such as `app/lib/mcp/` or `app/welcome/`?
3. Did reusable logic move out of hotspot files instead of expanding them?
4. Did shared client/server parsing move into `contracts/` instead of `client/` or route modules?
5. Did naming stay aligned with Prisma vocabulary and current API contracts?
