# Local Playground Review Checklist

Use this checklist before finalizing any meaningful change in this repository.

## 0) Scope Gate

- Confirm the task is development work in `local-playground`.
- Confirm [`AGENTS.md`](../../../../AGENTS.md) and [`client-clean-architecture.md`](../../../../docs/architecture/client-clean-architecture.md) were read before editing.
- Confirm the development-mode rule is being followed:
  - no compatibility shims unless explicitly requested

## 1) Naming And Structure Gate

- Review changed files:

```bash
git diff --name-only
```

- Confirm no obsolete roots were reintroduced:

```bash
find app/lib -maxdepth 1 -type d | sort
```

- Confirm changed names follow Prisma vocabulary for the same domain concept.
- Confirm new names do not copy historical prefixes or stale aliases.
- Confirm one concept still has one name across runtime code, API contracts, tests, and docs.

Useful drift search:

```bash
rg -n "\\bhome\\b|Home[A-Z]|HOME_[A-Z_]+|requestHomeApi|useWorkspaceController|homeTheme" app docs skills README.md AGENTS.md
```

## 2) Layer Direction Gate

- Confirm `app/lib` stays within:
  - `client`
  - `contracts`
  - `constants`
  - `domain`
  - `server`
- Confirm new shared parser/validation code is not being added to `client` or route files when it belongs in `contracts`.
- Confirm new framework-independent behavior is not being added to `client` or `server` when it belongs in `domain`.
- Confirm new server-only integration code is not being added outside `server/infrastructure`.
- Confirm no new `server -> client` imports:

```bash
rg -n "~/lib/client/" app/lib/server app/routes -g '!*.test.ts'
```

## 3) Route And API Gate

- Confirm route modules do not import other route modules:

```bash
rg -n "from ['\\\"]\\./api\\.[^'\\\"]+['\\\"]" app/routes -g 'api*.ts' -g '!*.test.ts'
```

- Confirm route modules stay focused on HTTP concerns.
- Confirm standard APIs remain resource-first and noun-based.
- Confirm command-style exceptions stay limited to:
  - `/api/chat`
  - `/api/instruction-patches`
  - `/api/threads/title-suggestions`
- Confirm `405` responses use `methodNotAllowedResponse`:

```bash
rg -n "405" app/routes/api*.ts
```

- If any `app/routes/api.*` file changed, run:

```bash
npm run test:core -- app/routes/api.*.test.ts
npm run typecheck:core
```

## 4) Client And UI Gate

- Confirm route-level UI files remain visual composition only.
- Confirm state ownership stays in `app/lib/client/` rather than scattering across route modules.
- Confirm repeated UI patterns are reused from `app/components/client/shared/`.
- Confirm new component boundaries match the real DOM hierarchy.

## 5) Persistence And Metadata Gate

- If `prisma/schema.prisma` changed for persisted models or fields:
  - update `/mcp/debug` metadata in the same batch
  - run:

```bash
npm run test:core -- app/lib/server/persistence/mcp-debug-database.test.ts
```

- Confirm persisted resources remain user-scoped by default.

## 6) Documentation Gate

- Confirm `README.md`, `AGENTS.md`, and skill guidance still match the implemented architecture.
- Prefer durable rules and concepts over exhaustive lists of implementation detail.
- Remove or simplify stale documentation while touching the same area.

## 7) Final Verification Gate

- Run targeted tests for the changed area.
- Run broader verification for substantial refactors:

```bash
npm run quality:gate
```

- In the final report, state:
  - whether naming drift still remains
  - whether layer direction rules were preserved
  - whether verification completed successfully
