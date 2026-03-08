---
name: local-playground-dev
description: Mandatory workflow for development work in the Local Playground repository. Use it to enforce architecture, naming, and verification rules during implementation.
---

# Local Playground Development Skill

## Scope

- Use this skill only for development work in this repository.
- Keep this skill active for the full task, not only at the start.

## Required Inputs

Before editing:

1. Read [`AGENTS.md`](../../../../AGENTS.md).
2. Read [`client-clean-architecture.md`](../../../../docs/architecture/client-clean-architecture.md).
3. Use [`review-checklist.md`](references/review-checklist.md) as the implementation gate.

## Core Rules

- This repository is in active development mode.
- Do not add backward compatibility layers unless explicitly requested.
- Treat Prisma schema vocabulary as the naming source of truth.
- Do not treat legacy prefixes or historical names as canonical naming guidance.
- Keep `app/lib` restricted to:
  - `client`
  - `contracts`
  - `constants`
  - `domain`
  - `server`
- Do not recreate obsolete roots such as legacy `azure`, `foundry`, `mcp`, `observability`, or `welcome` folders under `app/lib` or `app/`.
- New shared parser/validation logic goes to `contracts`.
- New framework-independent model behavior goes to `domain`.
- New server-only integrations go to `server/infrastructure`.
- New route-shared logic goes to `server/application` or `server/shared`.
- Do not introduce new `server -> client` imports.
- Do not import one API route module from another.

## Modeling Rules

- Use `class` for:
  - domain models with invariants or behavior
  - controllers and stores
  - API clients
  - services, repositories, gateways, mappers
- Keep the following as `type`/function-based code unless there is a strong reason otherwise:
  - DTO
  - API payloads
  - response envelopes
  - join rows
  - log rows
  - cache rows
  - pure transforms

## Implementation Workflow

1. Audit
   - Check changed areas for naming drift, layer violations, and obsolete roots.
2. Implement
   - Work in small batches.
   - Keep reusable logic out of hotspot files when extraction is possible.
3. Verify
   - Run the review checklist.
   - Run route-specific checks when API routes changed.
   - Run persistence metadata checks when Prisma changed.
4. Report
   - State whether naming drift remains.
   - State whether the new code follows the approved layer direction.

## Verification Minimums

- If `app/routes/api.*` changed:
  - `npm run test:core -- app/routes/api.*.test.ts`
  - `npm run typecheck:core`
- If persisted Prisma models or fields changed:
  - `npm run test:core -- app/lib/server/persistence/mcp-debug-database.test.ts`
- After broader refactors:
  - `npm run quality:gate`

## Documentation Rule

- Keep `README.md`, `AGENTS.md`, and this skill aligned with the implemented architecture.
- Prefer stable principles over exhaustive implementation inventories.
- Remove documentation that is likely to become stale quickly.

## Reference

- [`review-checklist.md`](references/review-checklist.md)
