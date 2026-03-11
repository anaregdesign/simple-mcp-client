---
name: enforce-react-spa-architecture
description: Enforce clean-architecture-based development for Vite + React Router + Prisma v7 single-page applications. Use when implementing features, refactoring structure, reviewing code, running quality gates, or preparing to push changes in a React Router SPA that should keep FlatRoute modules thin, components presentational, Prisma server-only, and dependencies flowing inward.
---

# Enforce React Spa Architecture

## Overview

Use this skill as the default architecture workflow for a React Router SPA that uses Vite and Prisma v7. Keep FlatRoute modules declarative, view files thin, data access server-only, and dependency direction explicit before writing code.

## Quick Start

1. Classify the requested change:
   - route composition
   - presentational UI
   - client interaction flow
   - server use case
   - persistence or external integration
   - domain rule
   - cross-boundary contract or utility
2. Place code in the canonical layout:
   - `app/routes/`
   - `app/components/`
   - `app/components/shared/`
   - `app/lib/client/usecase/`
   - `app/lib/client/usecase/<feature>/use-<feature>.ts`
   - `app/lib/client/usecase/<feature>/state.ts`
   - `app/lib/client/usecase/<feature>/reducer.ts`
   - `app/lib/client/usecase/<feature>/selectors.ts`
   - `app/lib/client/usecase/<feature>/handlers.ts`
   - `app/lib/client/infrastructure/`
   - `app/lib/client/infrastructure/api/`
   - `app/lib/client/infrastructure/browser/`
   - `app/lib/server/usecase/`
   - `app/lib/server/infrastructure/`
   - `app/lib/server/infrastructure/repositories/`
   - `app/lib/server/infrastructure/gateways/`
   - `app/lib/domain/entities/`
   - `app/lib/domain/value-objects/`
   - `app/lib/domain/policies/`
   - `app/lib/domain/services/`
   - `app/lib/domain/repositories/`
3. Read the matching reference file before implementing:
   - dependency and placement rules: [`references/layout-and-dependency-rules.md`](references/layout-and-dependency-rules.md)
   - FlatRoute REST API rules: [`references/flat-route-rest-api-guidelines.md`](references/flat-route-rest-api-guidelines.md)
   - Prisma usage rules: [`references/prisma-boundary-rules.md`](references/prisma-boundary-rules.md)
   - state and handler composition: [`references/view-state-and-handler-patterns.md`](references/view-state-and-handler-patterns.md)
   - stateful flow compromise rules: [`references/stateful-flow-compromises.md`](references/stateful-flow-compromises.md)
   - hotspot refactor workflow: [`references/hotspot-refactor-workflow.md`](references/hotspot-refactor-workflow.md)
   - verification before push: [`references/verification-gates.md`](references/verification-gates.md)

## Non-Negotiable Rules

- Keep dependency direction inward:
  - `app/routes` and `app/components` depend on client-facing orchestration, never on Prisma
  - `app/lib/client/usecase` depends on `domain` and client adapters
  - `app/lib/server/usecase` depends on `domain` and repository ports
  - `app/lib/server/infrastructure` implements repository ports and external integrations
  - `app/lib/domain/*` depends only on other domain modules
- Keep Prisma imports inside `app/lib/server/infrastructure/`.
- Keep `app/components/` presentational. Allow only ephemeral UI state there, such as local input focus or disclosure toggles.
- Keep async state, mutation handlers, and derived view models in `app/lib/client/usecase/`.
- Co-locate `state`, `reducer`, `selector`, and `handler` modules inside the owning feature directory under `app/lib/client/usecase/<feature>/`.
- Do not create horizontal buckets such as `app/state/`, `app/reducers/`, `app/stores/`, `app/handlers/`, or `app/lib/client/usecase/state/`.
- Keep route modules responsible for HTTP, loader/action wiring, and top-level composition only.
- Validate at the correct layer: transport shape in routes or API adapters, application rules in use cases, business invariants in domain.
- Default client-side data access to `api` adapters plus DTO mapping inside the owning use case. Introduce a client-side repository abstraction only for clear multi-source or local-first requirements.
- Instantiate repositories and gateways in a composition root or dependency factory, not inside domain models or use cases.
- Fix Prisma usage to Prisma ORM v7.x. Treat non-v7 setup as migration work, not as an equal baseline.
- Keep authorization, serialization, migration steps, background side effects, and barrel exports intentional rather than ad hoc.
- Treat thread safety mainly as async safety and request safety: avoid module-level mutable state, keep request context out of singletons, and rebuild transaction-scoped dependencies per request.
- Keep feature internals private by default and avoid circular dependencies across extracted modules.
- Do not create a generic common bucket. Keep code in the narrowest owning layer, and duplicate small utilities until a stable abstraction is obvious.
- Prefer direct replacement over compatibility aliases when renaming architecture terms.

## Implementation Workflow

### 1. Model the change around a use case

- Name the user intent first.
- Put invariants in `domain/entities` or `domain/value-objects`, and put cross-entity rules in `domain/policies` or `domain/services` when they do not naturally belong to one model.
- Put repository interfaces in `domain/repositories`.
- Keep request or response shapes next to the route, API client, or use case that owns them. Promote them only after the boundary is stable and truly reused.
- Do not move transport `Request` or `Response` types into `domain` just because several modules share them.

### 2. Keep view logic out of components

- Build a custom Hook, controller, or view-model module in `app/lib/client/usecase/` for each non-trivial screen or interaction flow.
- When the interaction has enough complexity to need submodules, create a feature directory and keep the use case internals there.
- Keep feature components near the feature by default. Promote a component to `app/components/shared/` only after it proves to be truly feature-agnostic.
- Let that module own:
  - async calls
  - reducer logic
  - derived screen state
  - event handlers
  - error and pending mapping
- Pass view-ready props into `app/components/`.

### 3. Use React Router primitives before inventing new state containers

- Use loader data for route reads.
- Use action or fetcher state for mutations.
- Use navigation or fetcher pending state instead of duplicating network flags in component state.
- Add client state only for interaction state that is not already owned by the router.

### 4. Move DTOs through the client boundary explicitly

- Return JSON DTOs from route loaders, actions, or API endpoints.
- Let `client/infrastructure/api` fetch those DTOs.
- Rebuild client-facing objects or value objects inside the owning use case only when that adds real value.
- Do not expect server-side `Entity` instance identity to cross the network boundary.

### 5. Assemble dependencies at the edge

- Keep `usecase` and `domain` code constructor-injected.
- Build repository, gateway, and service instances in route loaders, actions, server entry points, or dedicated dependency factories.
- Prefer manual DI with explicit factory functions before introducing a DI container.
- Recreate request-scoped dependencies such as transaction-bound repositories from the current request or transaction context.

### 6. Validate and map errors by layer

- Keep request parsing and input shape validation at the HTTP or client transport boundary.
- Keep use-case rule validation in `server/usecase` or `client/usecase`.
- Keep invariant enforcement in `domain`.
- Map domain, application, and infrastructure errors to transport responses at the edge.

### 7. Keep authorization and serialization explicit

- Resolve authentication at the edge, but keep authorization decisions in use cases or domain policies.
- Convert `Date`, ids, money-like values, and value objects at boundaries rather than leaking transport or ORM shapes inward.

### 8. Keep mutable state scoped

- Do not store request-specific state in module globals or singleton services.
- Pass auth context, user context, tenant context, and correlation metadata explicitly.
- Keep transaction handles scoped to the current transaction only.
- Treat client-side async race conditions as correctness issues and guard against stale responses.

### 9. Use explicit compromises for stateful flows

- For chat, streaming, session, playback, or wizard-style flows, allow a feature-local controller or store when lifecycle and identity genuinely matter.
- Keep that compromise inside `app/lib/client/usecase/<feature>/` rather than spreading mutable state across routes or components.
- Split durable state, ephemeral runtime state, and infrastructure handles explicitly.

### 10. Push side effects and migrations into explicit workflows

- Keep schema changes, background jobs, external notifications, and indexing side effects visible and testable.
- Do not hide them inside random route handlers or repositories.
- Use barrel exports sparingly and only when they do not obscure ownership or create cycles.

### 11. Verify before push

- Run targeted tests for the touched area.
- Run typecheck and lint or the project quality gate.
- Audit for boundary drift and forbidden imports.
- Fix architecture violations before pushing even if tests pass.

### 12. Refactor overloaded files in phases

- When a `ts` or `tsx` file has too many responsibilities, do not rewrite it in one jump.
- Follow the hotspot workflow in [`references/hotspot-refactor-workflow.md`](references/hotspot-refactor-workflow.md).
- Separate analysis, planning, extraction sequencing, execution, and verification.
- Move one stable seam at a time and keep the file working after each batch.

## Placement Guide

- Need pure rendering and markup: `app/components/`
- Need reusable pure UI primitives: `app/components/shared/`
- Need route composition or loader/action bridging: `app/routes/`
- Need client-side state, handlers, reducers, selectors, or orchestration: `app/lib/client/usecase/<feature>/`
- Need browser APIs, API clients, or router adapters: `app/lib/client/infrastructure/`
- Need endpoint-specific API clients: `app/lib/client/infrastructure/api/`
- Need browser-only adapters such as storage, clipboard, media queries, or channel APIs: `app/lib/client/infrastructure/browser/`
- Need a business invariant or behavior-rich model: `app/lib/domain/entities/`
- Need a small immutable business concept with validation: `app/lib/domain/value-objects/`
- Need cross-entity business rules: prefer `app/lib/domain/policies/`
- Need domain-level orchestration that is still infrastructure-free: `app/lib/domain/services/`
- Need a repository port or domain-facing persistence contract: `app/lib/domain/repositories/`
- Need server orchestration: `app/lib/server/usecase/`
- Need Prisma, file system, or external service code: `app/lib/server/infrastructure/`
- Need persistence implementations: `app/lib/server/infrastructure/repositories/`
- Need external SDK or HTTP adapters: `app/lib/server/infrastructure/gateways/`
- Need a reusable type or utility: place it with the owning route, use case, or domain module first; extract only after repeated reuse proves the boundary

## References

- [`references/layout-and-dependency-rules.md`](references/layout-and-dependency-rules.md)
- [`references/flat-route-rest-api-guidelines.md`](references/flat-route-rest-api-guidelines.md)
- [`references/prisma-boundary-rules.md`](references/prisma-boundary-rules.md)
- [`references/view-state-and-handler-patterns.md`](references/view-state-and-handler-patterns.md)
- [`references/stateful-flow-compromises.md`](references/stateful-flow-compromises.md)
- [`references/hotspot-refactor-workflow.md`](references/hotspot-refactor-workflow.md)
- [`references/verification-gates.md`](references/verification-gates.md)
