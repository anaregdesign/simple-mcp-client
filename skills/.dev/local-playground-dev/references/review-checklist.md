# Local Playground Review Checklist

Use this checklist before finalizing any substantial change in this repository.

## Usage Timing (Mandatory)

Run this checklist repeatedly, not only at the end.

1. Pre-change gate:
   - Run sections 0-4 before editing.
2. In-change gate:
   - Re-run sections 0-4 after each logical change batch.
3. Final gate:
   - Run sections 0-7 before final response.

If any section fails, stop and fix before continuing.

## 0) Scope and Invocation Gate (Mandatory)

### Goal

Ensure this skill is used only for this repository and used for every implementation task.

### Checks

1. Confirm current task is Local Playground development work in the `local-playground` repository.
2. Confirm this skill was invoked before implementation and kept active during the task.
3. Confirm `AGENTS.md` and `docs/architecture/client-clean-architecture.md` were read before editing.
4. If repository scope differs, stop and switch to an appropriate skill.
5. Confirm the development-phase rule is applied: no backward compatibility/fallback implementation unless explicitly requested.

### Pass Criteria

- Task scope is this repository.
- Skill usage is explicit and continuous for the full implementation task.
- No unnecessary compatibility/fallback paths were added.

## 1) Shared Component First (Highest Priority)

### Goal

Prevent duplicated UI patterns and keep behavior consistent.

### Checks

1. Inspect existing shared primitives first.

```bash
rg --files app/components/client/shared
```

2. Verify changed Client UI files import and reuse primitives from the shared directory where applicable.

```bash
rg -n "from ['\\\"]~/components/client/shared|from ['\\\"].*/client/shared" app/components/client
```

3. If new markup pattern appears in 2+ places, extract to `app/components/client/shared/` immediately.
4. If a new copy button, tooltip shell, or status bar was added outside `shared`, treat it as a refactor candidate.

### Pass Criteria

- No avoidable duplicated wrapper patterns in tab/section files.
- Repeated patterns are centralized in `shared`.

## 2) Directory Structure and Naming Integrity

### Goal

Keep changed files aligned with the approved client-centered architecture.

### Checks

1. Review changed files.

```bash
git diff --name-only
```

2. Confirm no obsolete root directories were reintroduced:
   - `app/lib/azure/`
   - `app/lib/foundry/`
   - `app/lib/mcp/`
   - `app/lib/observability/`
   - `app/welcome/`
3. Confirm `app/lib` top-level structure stays within the approved layer set:
   - `client`
   - `contracts`
   - `constants`
   - `domain`
   - `server`
4. Confirm each new/changed client-facing file is in the correct folder:
   - Auth-only top-level panel(s) -> `app/components/client/authorize/`
   - Playground panel/renderers -> `app/components/client/playground/`
   - Config panel shell -> `app/components/client/config/`
   - Threads tab/sections -> `app/components/client/config/threads/`
   - MCP tab/sections -> `app/components/client/config/mcp/`
   - Skills tab/sections -> `app/components/client/config/skills/`
   - Settings tab/sections -> `app/components/client/config/settings/`
   - Reusable primitives -> `app/components/client/shared/`
5. Confirm new reusable server code targets `app/lib/server/application/`, `app/lib/server/infrastructure/`, or `app/lib/server/shared/`; treat other `app/lib/server/*` directories as migration residue that should shrink, not grow.
6. Confirm naming conventions:
   - top-level panes: `*Panel`
   - tab roots: `*Tab`
   - tab subsections: `*Section`
7. Confirm top-level panel directories mirror DOM hierarchy:
   - top-level panels are siblings under `app/components/client/`
   - no nesting of one top-level panel inside another panel directory
8. Validate schema-aligned terminology:
   - changed identifiers use Prisma schema vocabulary for the same domain concept
   - no parallel aliases remain for one concept across API/runtime/UI/tests/docs
9. Validate semantic identifier consistency:
   - same behavior uses the same identifier family across entities/modules
   - different behaviors use different identifier families
   - ordering/log identifiers reflect app behavior, not incidental implementation detail
10. If a rename/refactor happened, run static drift search for deprecated terms and contract keys.
   - Build a focused `rg` pattern list from replaced terms in this task and verify zero matches in `app/`.
11. Validate API contract integrity for changed `app/routes/api.*` handlers:
   - resource-first noun-based collection/item route shape
   - mutation resource IDs in path params (not query params)
   - query params limited to read concerns (filtering/pagination/sorting/projection)
   - side-effect-free `GET` handlers
   - method semantics: `POST` create/non-idempotent, `PUT`/`PATCH` update, `DELETE` idempotent
   - status codes: `200`/`201`/`204` success semantics, `409` state conflicts, `422` validation failures
   - structured JSON errors with machine-readable code + concise message
12. Validate command-style API exceptions stay limited to:
   - `/api/chat`
   - `/api/instruction-patches`
   - `/api/threads/title-suggestions`
13. Run static API drift checks for route handlers:
   - raw `405` implementation search in `api.*` files (should use `methodNotAllowedResponse`)
   - mutation query-contract search (resource IDs passed by query for mutations)
   - route-to-route import search in production route modules (must be zero)
   ```bash
   rg -n "from ['\\\"]\\./api\\.[^\\\"]+['\\\"]" app/routes -g 'api*.ts' -g '!*.test.ts'
   ```
14. If any `app/routes/api.*` file changed, run:
   - `npm run test:core -- app/routes/api.*.test.ts`
   - `npm run typecheck:core`
15. If any `app/routes/api.*` file changed, explicitly confirm REST best-practice compliance in your implementation report.
16. If `prisma/schema.prisma` changed for persisted models/fields, verify `/mcp/debug` schema design metadata was updated in `app/lib/server/persistence/mcp-debug-database.ts`:
   - metadata definition rows with field/type/nullability/description entries
   - latest-thread schema-source model list in `buildDatabaseDebugLatestThreadToolDescription`
17. If `prisma/schema.prisma` changed for persisted models/fields, verify `app/lib/server/persistence/mcp-debug-database.test.ts` was updated or remains valid for the new metadata and run:
   - `npm run test:core -- app/lib/server/persistence/mcp-debug-database.test.ts`
18. If `app/routes/api.chat.ts` changed, verify module boundary and lifecycle rules:
   - route remains orchestration-focused
   - parser/metadata/SSE/runtime helpers are implemented in dedicated server modules and extracted from the route when reusable
   - disconnect/cancel path propagates `AbortSignal` and cleanup hooks
19. If MCP validation changed in UI/route parsing paths, verify shared validator usage in `app/lib/contracts/mcp/validation.ts` from both frontend and backend entry points.
20. If `/mcp/debug` metadata changed, verify metadata source remains modular:
   - metadata rows in `app/lib/server/persistence/mcp-debug-database-metadata.ts`
   - shared metadata types in `app/lib/server/persistence/mcp-debug-database-types.ts`
   - runtime helper module consumes metadata definitions instead of re-inlining a large array
21. If `app/routes/api.chat.ts` changed, verify cancellation classification behavior:
   - stream disconnect path logs `chat_stream_canceled` at info level
   - disconnect does not emit upstream-failure error payload to stream clients
22. If MCP server parser behavior changed, verify shared parser module usage:
   - `app/lib/contracts/mcp/server-config-parser.ts` is the parser source for both chat payload entries and MCP server routes
   - route/request modules do not reintroduce duplicated MCP parser blocks
23. If `app/lib/client/controller/use-workspace-client-controller.ts` changed, verify operation and send boundaries:
   - Thread operation phase updates flow through `thread-operation-phase.ts` transition helpers
   - send-message pipeline boundaries remain delegated to `send-message-usecase.ts`
   - Client API auth/error branches are centralized via `api-client.ts`
24. If `app/lib/server/mcp/thread-mcp-server-session-pool.ts` changed, verify close-safety:
   - idle cleanup close failures are handled by best-effort safe close + warning log
   - tests cover close-reject behavior without unhandled rejection
25. If `app/lib/client/controller/use-workspace-client-controller.ts` changed, run hotspot duplication checks:
   - Thread selector duplication:
   ```bash
   rg -n "threadsRef\\.current\\.find\\(\\(thread\\) => thread\\.id ===" app/lib/client/controller/use-workspace-client-controller.ts
   ```
   - Manual response/auth branch duplication:
   ```bash
   rg -n "resolveAuthRequired\\(response\\.status|!response\\.ok" app/lib/client/controller/use-workspace-client-controller.ts
   ```
26. If `app/routes/api.chat.ts` changed, run route-helper concentration checks:
   ```bash
   rg -n "^function " app/routes/api.chat.ts
   rg -n "buildStdioSpawnEnvironment|resolveExecutableCommand" app/routes/api.chat.ts
   ```
   - New reusable low-level helpers should be added in dedicated server modules with dedicated unit tests.

### Pass Criteria

- File placement matches feature ownership.
- No obsolete root directories were reintroduced.
- Names communicate structural role (`Panel`, `Tab`, `Section`).
- Top-level panel placement matches DOM hierarchy.
- No naming-drift findings remain for this change batch.
- No REST/command API contract drift remains for changed handlers.
- No route-to-route production import findings remain for changed API handlers.
- REST best-practice compliance was re-validated whenever `app/routes/api.*` changed.
- Prisma schema and `/mcp/debug` metadata/test sync is confirmed when Prisma persisted models/fields changed.
- New guardrail checks (18-26) pass for the modules touched in this change batch.

## 3) Route vs Controller Ownership

### Goal

Keep route composition lightweight and runtime state centralized.

### Checks

1. Ensure Client route entries under `app/routes/` stay composition focused.

```bash
git diff --name-only | rg "^app/routes/"
```

2. If Client route modules in `app/routes/` changed, verify they are composition-focused (avoid primary runtime state ownership there).

```bash
rg -n "useState|useReducer|useEffect|useMemo|useCallback" app/routes
```

3. Keep thread/runtime ownership and persistence orchestration in `app/lib/client/controller/`.

```bash
git diff --name-only | rg "^app/lib/client/controller/"
```

4. For Thread state refactors, verify single-source ownership:
   - active runtime state is derived from `threads + activeThreadId`
   - avoid parallel mirrored state for `messages`, `mcpServers`, `mcpRpcLogs`, `skillSelections`

5. For controller operation flags, prefer phase-based state (`ThreadOperationPhase`) and shared guard helpers over multiple independent booleans.
6. For controller phase updates, avoid direct string assignment drift:
   - no new `setThreadOperationPhase(\"...\")` calls outside transition helper wrappers
   ```bash
   rg -n "setThreadOperationPhase\\(\\\"(loading|switching|creating|deleting|clearing|restoring|idle)\\\"\\)" app/lib/client/controller
   ```
7. For Client send pipeline changes, verify use-case delegation stays modular:
   ```bash
   rg -n "validateSendPreconditions|buildChatRequestPayload|consumeChatResponseStream|applySendResult" app/lib/client/controller/use-workspace-client-controller.ts app/lib/client/controller/send-message-usecase.ts
   ```
8. For Client API request handling changes, verify shared API client usage:
   ```bash
   rg -n "requestClientApi|resolveAuthRequired|mapApiError" app/lib/client/controller/use-workspace-client-controller.ts app/lib/client/controller/api-client.ts
   ```
9. For controller hotspot refactors, verify duplicated Thread lookup patterns were not reintroduced:
   ```bash
   rg -n "threadsRef\\.current\\.find\\(\\(thread\\) => thread\\.id ===" app/lib/client/controller/use-workspace-client-controller.ts
   ```
10. For controller hotspot refactors, verify manual auth/error branches were not reintroduced where `requestClientApi` should be used:
    ```bash
    rg -n "resolveAuthRequired\\(response\\.status|!response\\.ok" app/lib/client/controller/use-workspace-client-controller.ts
    ```
11. For `api.chat` hotspot refactors, verify low-level helper extraction is preserved:
    ```bash
    rg -n "^function " app/routes/api.chat.ts
    rg -n "buildStdioSpawnEnvironment|resolveExecutableCommand" app/routes/api.chat.ts
    ```
    - New reusable low-level helpers should be implemented in dedicated server modules.

### Pass Criteria

- Client route entries remain layout wiring only.
- Runtime state ownership is not fragmented across route-level hooks.
- Thread runtime state does not regress into duplicated mirrored state.
- Controller/chat hotspot duplicate patterns are not reintroduced.

## 4) State Persistence Policy (React First, Delayed DB Write)

### Goal

Keep interactive state responsive and persistence stable.

### Checks

1. Confirm persistent state is held in React/controller state first.
2. Confirm DB writes use delayed persistence (debounce/autosave), not eager write-on-every-change.
3. Confirm persistence orchestration lives in controller code (`app/lib/client/controller/`) or controller-adjacent runtime modules.
4. Treat SQLite records as durable snapshots, not as the immediate interaction source.
5. For debug tooling, `/mcp/debug` endpoint usage (including DB table inspection) is treated as development-only workflow.
6. Confirm Thread snapshot mutations/reads use pure helper modules where practical (selectors/updaters under `app/lib/client/threads/*`) instead of repeating ad-hoc mutation logic.

### Pass Criteria

- No unnecessary eager DB writes on each input mutation.
- React/controller remains the primary state owner during UI interaction.
- Thread runtime/state update flows remain deterministic and helper-driven.

## 5) Constants and Imports Hygiene

### Goal

Avoid drift in constant ownership and import style.

### Checks

1. Confirm shared constants are centralized under `app/lib/` (constants modules).
2. Avoid new non-local `UPPER_SNAKE_CASE` constants in feature files.
3. Import constants directly from the project constants module under `~/lib/` with original names.
4. For Client UI view/domain types shared across modules, define/import from `app/lib/client/shared/view-types.ts` and avoid duplicating local `*Like` aliases.

```bash
rg -n "type .*Like|interface .*Like|\\*Like" app/components/client app/lib/client -g '*.ts' -g '*.tsx'
```

### Pass Criteria

- Shared constants are centralized.
- Constant imports are direct and unaliased.
- Shared Client view/domain types are centralized and duplicate `*Like` aliases are removed when applicable.

## 6) UX and Layout Guardrails

### Goal

Preserve desktop-first two-pane UX and responsive behavior.

### Checks

1. Verify layout keeps:
   - left `Playground`, right tabbed panel
   - right panel tabs include `Threads`, `MCP Servers`, `Skills`, `Settings`
   - vertical splitter on desktop
   - stacked layout at narrow widths (`<= 980px`)
2. Verify minimum widths are preserved:
   - right pane min `320px`
   - left pane min `560px`
3. Keep `Added MCP Servers` chips and attachment bubbles under the composer.

### Pass Criteria

- No regression in two-pane behavior, splitter, or narrow-screen fallback.

## 7) Final Quality Gates (Required)

Run all commands:

```bash
npm run quality:gate
```

Expanded equivalent:

```bash
npm audit --omit=dev
npm run prisma:generate
npm run typecheck:core
npm run test:core
npm run build:core
```

### Pass Criteria

- All required checks pass.
- Any intentional exceptions are documented in the final response.
- Static drift checks for renamed/deprecated terminology are zero when naming/contract refactors are in scope.

## Compliance Report Format

Use this format in implementation responses:

1. Pre-change gate: pass/fail and key findings.
2. In-change gate: pass/fail and fixes applied during implementation.
3. Final gate: pass/fail for sections 1-7 and quality gates.
