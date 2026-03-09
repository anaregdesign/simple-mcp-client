# Verification Gates

## Use This Before Push

Run verification in this order:

1. Targeted tests for the changed behavior
2. Typecheck
3. Lint or project quality gate
4. Architecture drift checks
5. Manual spot check of the touched flow

Do not push code that passes tests but breaks layer direction.

## Architecture Drift Checklist

Confirm all of the following:

- no Prisma imports outside `app/lib/server/infrastructure/`
- no server imports inside `app/components/` or `app/lib/client/*`
- no React or browser imports inside `app/lib/domain/*`
- no generic catch-all common directory reintroduced
- no horizontal `state`, `reducers`, `stores`, or `handlers` directories introduced under `app/`
- no feature-specific logic imported into `app/components/shared/`
- no component moved into `shared` only for convenience while still carrying feature vocabulary
- no client adapter pretending to return server-side live instances across the network
- no transport `Request` or `Response` DTOs promoted into `domain` without domain meaning
- no `usecase` or `domain` module instantiating repositories or gateways directly
- no module-level mutable server state carrying request or user context
- no circular imports introduced across feature internals or layers
- no authorization rule enforced only in the UI
- no boundary object such as `Date`, ORM record, or raw persistence shape leaking where a mapped shape should exist
- no business logic buried in route modules
- no non-trivial async orchestration left inside presentational components
- no new vague file names such as `helpers.ts`, `utils.ts`, or `common.ts`

## Useful Search Patterns

Use `rg` for quick audits:

```bash
rg -n "prisma" app
rg -n "lib/server" app/routes app/components app/lib/client
rg -n "from ['\"][^'\"]*react" app/lib/domain
find app/lib -maxdepth 2 -type d | sort
find app -type d \\( -name state -o -name states -o -name reducer -o -name reducers -o -name store -o -name stores -o -name handler -o -name handlers \\) | sort
rg -n "lib/client/usecase|lib/server|routes/" app/components/shared
rg -n "Thread|Chat|Billing|Project|Profile|Order|Invoice|Session" app/components/shared
rg -n "new [A-Z][A-Za-z0-9_]+\\(|instanceof " app/lib/client
rg -n "Request|Response|Payload|Dto|DTO" app/lib/domain
rg -n "new .*Repository|new .*Gateway|new Prisma" app/lib/domain app/lib/server/usecase
rg -n "let current|let active|let request|let user|let tenant|globalThis\\.|module\\.exports\\." app/lib/server
madge --circular app 2>/dev/null || true
rg -n "index\\.ts$" app
rg --files app | rg "/(helpers|utils|common|misc|temp|new)\\.(ts|tsx)$"
rg -n "useEffect\\(" app/components
```

Interpret results, do not blindly fail on matches. The point is to surface suspicious files quickly.

## Push Gate Heuristic

Before `git push`, be able to state all of the following:

- the use case layer owns the interaction logic
- the view layer is mostly props plus rendering
- `components/shared` stays presentational and feature-agnostic
- components started life near their feature unless they proved to be generic
- reducer and state modules live with their owning feature use case
- client data access returns DTOs unless a real local-first repository abstraction is justified
- transport contracts still live near their boundary unless they have become true domain concepts
- dependencies are wired at the edge rather than instantiated inside use cases
- mutable request context does not leak through singleton or module-level state
- validation rules live at the correct layer rather than collapsing into one layer
- errors are mapped intentionally rather than leaking raw infrastructure failures
- authorization has a server-side home and is not only a UI concern
- serialization boundaries remain explicit
- server persistence goes through server infrastructure
- file names reveal module responsibility without fallback names like `helpers` or `utils`
- reusable helpers still live in a specific owning layer unless the abstraction is clearly stable
- the changed area has tests or a clear reason why tests were not added

If any statement is false, fix the architecture before pushing.
