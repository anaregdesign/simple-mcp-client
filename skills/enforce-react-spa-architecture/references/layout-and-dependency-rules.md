# Layout And Dependency Rules

## Canonical Layout

```text
app/
  routes/
  components/
    shared/
  lib/
    client/
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
    server/
      usecase/
      infrastructure/
        repositories/
        gateways/
    domain/
      entities/
      value-objects/
      policies/
      services/
      repositories/
```

Use these directories by responsibility, not by team preference or historical drift.

These are approved directories, not mandatory occupancy targets. Add them when their responsibility is genuinely present; do not create empty folder taxonomies just to satisfy the diagram.

## State Module Placement

For non-trivial client interaction flows, create a feature directory under `app/lib/client/usecase/` and colocate the state modules there.

Preferred shape:

```text
app/lib/client/usecase/thread-composer/
  use-profile-editor.ts
  state.ts
  reducer.ts
  selectors.ts
  handlers.ts
  types.ts
```

Use these files by responsibility:

- `state.ts`: state shape and initial state
- `reducer.ts`: reducer function and action definitions
- `selectors.ts`: derived read models and computed flags
- `handlers.ts`: event-to-dispatch mapping or async command helpers
- `use-<feature>.ts`: public Hook or controller entry point

Do not create horizontal buckets such as:

- `app/state/`
- `app/reducers/`
- `app/stores/`
- `app/handlers/`
- `app/lib/client/usecase/state/`
- `app/lib/client/usecase/reducers/`

Keep state modules close to the owning use case so that transitions, selectors, and handlers evolve together.

## Dependency Direction

Follow this direction strictly:

```text
routes/components
  -> client/usecase
  -> client/infrastructure
  -> domain

components/shared
  -> nothing application-specific

server/usecase
  -> domain
  -> domain/repositories

server/infrastructure
  -> domain
  -> external systems
```

Treat `domain` as the inner policy layer and `server/infrastructure` as the outer integration layer.

## No Generic Common Bucket

Do not add a catch-all common directory.

Prefer this order instead:

1. Keep code with the route, use case, or domain module that owns it
2. Duplicate a tiny utility once if the reuse pattern is still uncertain
3. Extract only after the abstraction is clearly stable

This avoids a low-signal common layer that slowly collects unrelated helpers and weakens boundaries.

## Contract Placement Rule

Do not move API `Request` or `Response` structures into `domain` just because they are reused.

Use this decision order:

1. Keep route-specific transport shapes near the owning route or server use case
2. Keep client transport DTOs near the owning API client
3. Promote a type into `domain` only when it is a real business concept with invariants
4. If transport contracts become broadly shared across many boundaries, introduce a dedicated `app/lib/contracts/` directory later instead of polluting `domain`

Shared transport shape is not the same thing as canonical domain language.

## Validation Ownership Rule

Validate at the narrowest boundary that can correctly own the rule.

Use this split:

- routes and API adapters: request shape, query parsing, content-type, required fields, basic schema validation
- use cases: permission checks, workflow preconditions, cross-field application rules
- domain: business invariants that must always hold
- infrastructure: persistence constraints and external service response validation

Do not push domain invariants outward just because the route can reject early.
Do not pull HTTP-specific validation into `domain`.

General examples:

- route validates that `page` is an integer query parameter
- use case validates that a user may cancel the resource in the current workflow state
- domain entity validates that a line-item total cannot be negative
- repository maps unique-constraint failure into a known infrastructure error

## Error Mapping Rule

Keep error categories explicit.

Useful categories:

- transport errors
- application or use-case errors
- domain errors
- infrastructure errors

Use cases should return or throw errors that still make sense without HTTP.
Route modules should translate those errors into status codes and response envelopes.

Do not let raw database or SDK errors leak directly to API responses.

## Authorization Ownership Rule

Keep authentication and authorization distinct.

Use this split:

- route or server entry: resolve the current principal or session
- use case: decide whether the requested operation is allowed
- domain policy: enforce reusable business authorization rules when they are part of the domain language

Do not bury authorization in repositories.
Do not make UI visibility checks the only access control.

General examples:

- route resolves the current session user
- use case checks whether that user may update the resource
- domain policy decides whether a role may transition ownership

## Serialization Rule

Convert between transport, persistence, and domain shapes at explicit boundaries.

Do not let these cross boundaries unchanged without intent:

- `Date`
- database ids
- money-like values
- enums with transport-specific names
- value objects

General examples:

- route or API client converts ISO date strings to a boundary DTO
- use case rebuilds a `DateRange` value object from primitive inputs
- infrastructure maps decimal-like persistence fields into a domain `Money` value object

Prefer DTOs with primitives over leaking runtime-rich objects across HTTP.

## Dependency Injection Rule

Instantiate repositories, gateways, and infrastructure services at the application edge.

Preferred composition points:

- route loaders and actions
- server entry points
- worker entry points
- dedicated dependency factory modules such as `dependencies.ts`

Prefer manual DI first:

1. define a domain-facing interface
2. implement it in infrastructure
3. inject the implementation into the use case constructor
4. wire the graph in one composition root

Do not instantiate infrastructure directly inside:

- domain entities
- domain value objects
- domain policies
- domain services
- server use cases

Use a DI container only when manual factories have become genuinely hard to maintain.

## Barrel Export Rule

Use `index.ts` or other barrel files sparingly.

Allow a barrel when:

- it defines the clear public API of a feature
- it does not hide ownership
- it does not introduce cycles

Avoid barrels for:

- deep re-export chains
- unstable feature internals
- directories where tree ownership should stay obvious

## Feature Public API Rule

Treat each feature directory as having a public entry point and private internals.

Prefer:

- `client/usecase/<feature>/use-<feature>.ts` as the public client entry
- `server/usecase/<feature>/index.ts` or one primary use-case module as the public server entry

Avoid importing another feature's private files such as:

- `reducer.ts`
- `selectors.ts`
- `handlers.ts`
- `state.ts`

This keeps refactors local and reduces accidental cross-feature coupling.

## Circular Dependency Rule

Treat import cycles as architecture violations, especially inside feature internals.

Common bad cycles:

- `selectors -> handlers -> reducer -> selectors`
- `route -> usecase -> route`
- `infrastructure -> usecase -> infrastructure`

When a cycle appears:

1. move shared pure logic to a lower-level leaf module
2. invert the dependency through an interface or parameter
3. merge modules back together if the split was artificial

## TS And TSX Naming Rule

Keep file names explicit enough that responsibility is visible before opening the file.

Use these defaults:

- route modules: follow FlatRoute naming, such as `api.orders.ts`, `api.orders.$orderId.ts`, or `settings.profile.tsx`
- React component files: `PascalCase.tsx`
- non-component modules: responsibility-based `kebab-case.ts`

For component files:

- make the primary exported component name match the file name
- use `.tsx` only when the file renders JSX
- keep feature views near their owning feature until they prove to be generic

General examples:

- `OrderDetailsPage.tsx`
- `CheckoutSummaryView.tsx`
- `Button.tsx`
- `Dialog.tsx`

For non-component modules, encode the role in the file name rather than falling back to vague names.

General examples:

- `use-checkout-flow.ts`
- `orders-api-client.ts`
- `prisma-order-repository.ts`
- `discount-policy.ts`
- `pricing-service.ts`
- `theme-storage.ts`
- `request-parser.ts`
- `response-mapper.ts`

Inside a feature directory, these short file names are acceptable because the directory already provides the feature context:

- `state.ts`
- `reducer.ts`
- `selectors.ts`
- `handlers.ts`
- `types.ts`

Avoid vague file names such as:

- `helpers.ts`
- `utils.ts`
- `common.ts`
- `misc.ts`
- `temp.ts`
- `new.ts`

Use `index.ts` only when it is a deliberate public entry point, in line with the barrel export rule.

## Async And Request Safety Rule

In this stack, the main hazard is usually not shared-memory threading but async overlap and request leakage.

Protect against:

- module-level mutable state on the server
- singleton services storing current user or request context
- transaction clients being reused outside their transaction scope
- caches that do not partition by tenant or user when required
- client responses arriving out of order and overwriting newer state

Prefer:

- stateless singleton repositories and gateways
- explicit request context passed as parameters
- transaction-scoped repository factories
- immutable state transitions in client reducers
- request cancellation or request ordering guards for client fetch flows

## Background Side Effect Rule

Treat external side effects separately from core request handling when they are slow, retryable, or operationally important.

Typical candidates:

- email sending
- webhook dispatch
- report generation
- search indexing
- long-running file export

Prefer:

- use case decides that a side effect should happen
- infrastructure adapter or job runner performs it
- request path only performs it inline when latency and failure semantics are acceptable

Do not hide these side effects inside low-visibility helper code.

## Allowed Responsibilities

### `app/routes/`

- Define route modules.
- Read loader and action inputs.
- Map route data into page composition.
- Delegate non-trivial logic to `client/usecase` or `server/usecase`.

General examples:

- `orders.$orderId.tsx`: read route params, call a server use case, and compose the detail page
- `settings.profile.tsx`: wire a form action and choose which presentational component to render
- `reports._index.tsx`: normalize query params and hand them to a server use case

Do not:

- call Prisma directly
- hide business rules in route files
- let route modules become the main state container for reusable interactions

### `app/components/`

- Render UI from props.
- Hold tiny UI-local state only when it is truly view-local:
  - popover open or closed
  - active tab index
  - focused element
  - uncontrolled input bridge

General examples:

- `CheckoutSummaryView.tsx`: render totals and actions from props
- `ProfileEditorView.tsx`: render fields and call passed handlers
- `SearchFilterPanel.tsx`: render filter controls while keeping filter logic outside

Do not:

- fetch data
- own mutation orchestration
- build DTOs for the server
- contain business rules or persistence rules
- introduce component-local `state/` or `reducers/` directories

### `app/components/shared/`

- Hold reusable presentational primitives.
- Keep these components styleable and composable.
- Prefer this directory for UI building blocks such as `Button`, `Dialog`, `Field`, `Card`, or `Spinner`.
- Treat `shared` as an extraction target, not as the default starting location for new components.

General examples:

- `Button.tsx`: shared button variants and loading state visuals
- `Dialog.tsx`: modal shell with title, body, and action slots
- `Field.tsx`: reusable label, hint, and validation layout
- `EmptyState.tsx`: generic empty-state presentation

Do not:

- import feature use cases
- own business terminology that belongs to a specific product feature
- hide data fetching or mutation logic

Promote a component to `shared` only when all of these are true:

1. the component is used or is clearly about to be used across multiple features
2. the API can be expressed in generic UI terms rather than product vocabulary
3. the component does not need feature-specific state or handlers
4. extracting it reduces duplication without turning it into a configurable monster

Keep the component near the feature when:

- prop names encode domain vocabulary
- one screen drives most of its behavior
- variants keep accumulating for different product contexts
- extraction would mostly move complexity rather than reduce it

### `app/lib/client/usecase/`

- Own screen-level state and event handlers.
- Assemble view models for components.
- Coordinate API clients, router calls, optimistic UI, reducers, and derived state.
- Hold use-case-local DTO mapping when that mapping is part of the interaction flow.
- Expose a stable interface for the view layer.
- Prefer a feature directory when more than one file is needed for the same flow.
- Guard against stale async results when multiple requests for the same screen can overlap.
- Keep internal modules private to the feature unless a stable public entry is intentionally exported.

General examples:

- `checkout-flow/use-checkout-flow.ts`: draft state, submit handler, pending and error mapping
- `profile-editor/reducer.ts`: state transitions for profile edits
- `search-results/selectors.ts`: derived flags such as `hasResults` or `showRetry`
- `billing-settings/handlers.ts`: async save and retry orchestration

Typical outputs:

- `viewModel`
- `isPending`
- `errorMessage`
- `handleChange`
- `handleSubmit`
- `handleRetry`

Reserve `store.ts` for cases where shared identity and lifecycle actually matter across multiple sibling views. Do not default to a store when a Hook plus reducer is enough.

### `app/lib/client/infrastructure/`

- Implement browser-facing and network-facing adapters.
- Wrap `fetch`, `localStorage`, clipboard, browser events, and router integration.
- Translate transport details into domain-friendly or usecase-friendly interfaces.

General examples:

- a `fetchJson` wrapper with standard headers and error parsing
- a router adapter that normalizes navigation failures
- a clipboard adapter reused by multiple use cases

Keep framework adapters here, not in a generic common layer.

### `app/lib/client/infrastructure/api/`

- Hold feature or resource API clients.
- Keep transport and serialization details here.
- Return shapes that the owning use case can consume directly.
- Default to JSON DTOs, not domain entity instances.
- Keep client-side mapping shallow here; put use-case-specific reconstruction in the owning use case.
- Keep `Request` and `Response` DTO definitions here when they are client-transport-specific.

General examples:

- `orders-api-client.ts`: `getOrder`, `cancelOrder`, `listOrders`
- `session-api-client.ts`: `getSession`, `refreshSession`
- `catalog-api-contract.ts`: request and response DTOs for listing endpoints

Client flow should normally be:

```text
client/usecase
  -> client/infrastructure/api
  -> HTTP JSON DTO
  -> server/usecase
```

Do not assume a server-side `Entity` instance crosses the network boundary intact.

### `app/lib/client/infrastructure/browser/`

- Hold browser-only integrations such as `localStorage`, `sessionStorage`, clipboard, media query, `BroadcastChannel`, `IntersectionObserver`, or document event adapters.
- Keep direct DOM and browser API calls here unless the logic is tiny and strictly component-local.

General examples:

- `theme-storage.ts`: persist the selected theme
- `clipboard-service.ts`: copy text or rich content
- `visibility-listener.ts`: react to document visibility changes
- `media-query-store.ts`: expose breakpoint changes to a use case

### Optional `client/infrastructure/repositories/`

Do not make this a baseline directory.

Add a client-side repository layer only when the client must hide multiple data sources behind one abstraction, for example:

- IndexedDB plus remote API
- memory cache plus remote fetch
- offline-first synchronization
- local-first conflict handling

General examples:

- `message-history-repository.ts`: unify memory cache, IndexedDB, and remote fetch
- `draft-repository.ts`: load local drafts first, then reconcile with server state

If the client is only calling HTTP endpoints, prefer `api/` instead of a repository abstraction.

### `app/lib/domain/entities/`

- Hold business concepts that enforce invariants or domain behavior.
- Use `class` when identity or invariants matter.
- Keep entities free from React, Prisma, browser APIs, and HTTP concerns.
- Promote a reusable concept here only when it is truly business language, not just a transport helper.
- Do not place `CreateXRequest`, `UpdateXPayload`, or `ListXResponse` types here unless they are genuinely domain concepts, which is rare.

General examples:

- `Order`: enforce totals, transitions, and cancellation rules
- `Subscription`: enforce renewal and suspension invariants
- `TeamMembership`: enforce role-change and ownership rules

### `app/lib/domain/value-objects/`

- Hold small immutable domain concepts with validation and equality semantics.
- Prefer this directory for concepts like `EmailAddress`, `DisplayName`, `Slug`, or `DateRange`.
- Keep them free from transport, framework, and persistence details.
- Do not use value objects as a disguised home for endpoint DTOs.

General examples:

- `EmailAddress`: normalize and validate email text
- `Money`: amount plus currency with safe arithmetic
- `Slug`: route-safe identifier
- `DateRange`: validated start and end pair

### `app/lib/domain/policies/`

- Hold business rules that span multiple entities or require explicit decision logic.
- Prefer this directory when the code reads like a rule or policy statement.

General examples:

- discount eligibility policy
- password rotation policy
- account lockout policy
- reservation overlap policy

### `app/lib/domain/services/`

- Hold domain-level orchestration that is still infrastructure-free and not naturally owned by a single entity or value object.
- Use this directory sparingly.
- Prefer `policies/` when the code is fundamentally a rule, and prefer `services/` only when it is true domain orchestration.

General examples:

- invoice generation service combining several domain objects
- access review service computing changes across memberships and roles
- pricing service combining plans, discounts, and usage bands without external calls

### `app/lib/domain/repositories/`

- Define repository ports as interfaces or types.
- Describe what the domain or use case needs from persistence.
- Keep these contracts independent from Prisma models and SQL details.
- Keep cross-server repository contracts here instead of inventing a generic common repository layer.
- Treat these as domain-facing persistence ports first. Do not assume client transport adapters must implement them.
- Do not turn repository ports into generic request or response contract storage.

General examples:

- `OrderRepository`: load and save orders
- `UserSessionRepository`: persist and revoke sessions
- `InvoiceRepository`: query invoices by business criteria

### `app/lib/server/usecase/`

- Implement server-side application services.
- Orchestrate repositories and domain rules.
- Map between route inputs and domain operations.
- Accept repositories and gateways through constructors or explicit function parameters.
- Keep HTTP response formatting and status selection out of this layer.
- Keep authorization checks and side-effect decisions visible in this layer.

General examples:

- `CreateOrderUseCase`: validate input, create an order, persist it
- `RotateApiKeyUseCase`: revoke the old key, issue a new one, record audit metadata
- `ExportReportUseCase`: gather data and coordinate export preparation

Do not:

- export Prisma-specific details upward
- leak ORM types into domain or client layers
- instantiate Prisma-backed repositories inline with `new`

### `app/lib/server/infrastructure/`

- Hold Prisma clients, repository implementations, external API gateways, filesystem access, and environment-aware wiring.
- Map storage or service details into repository ports.
- Hold explicit job or side-effect adapters when a use case must trigger background work.

General examples:

- database client bootstrap
- filesystem path resolver
- SDK configuration factory
- dependency wiring for server entry points

This is the only layer that should know Prisma exists.

### `app/lib/server/infrastructure/repositories/`

- Hold repository implementations backed by Prisma, SQL, filesystem persistence, or other durable stores.
- Keep repository classes or modules close to the persistence technology they adapt.
- Accept long-lived clients such as `PrismaClient` through constructors so lifetime stays explicit.
- Keep repositories stateless with respect to request identity, auth state, and current transaction.

General examples:

- `PrismaOrderRepository`
- `SqlUserSessionRepository`
- `FileBackedTemplateRepository`

### `app/lib/server/infrastructure/gateways/`

- Hold integrations with external SDKs and remote services.
- Prefer this directory for OpenAI, Azure SDK, GitHub API, or other outbound adapters.
- Accept SDK clients or configuration through constructors or explicit factory helpers.

General examples:

- `EmailGateway`: send transactional email through an external provider
- `StorageGateway`: upload files to object storage
- `BillingGateway`: call a payment provider API
- `SearchGateway`: query an external search index

## Lifetime Guidance

- Prefer singleton lifetime for `PrismaClient` and other expensive stateless SDK clients.
- Prefer lightweight singleton or factory-created lifetime for stateless repositories and gateways.
- Prefer request scope for auth context, correlation context, and request-specific wrappers.
- Prefer transaction scope for repositories built from a transaction handle.

When using Prisma transactions, create a transaction-scoped dependency factory instead of reusing the root repository instances.

Avoid storing any of the following on singleton instances:

- current user id
- current tenant id
- current request id
- current transaction client
- mutable per-request caches

## Migration Workflow Rule

When persisted schema changes, update the surrounding layers in the same change set.

Typical order:

1. schema change
2. generated client or adapter regeneration
3. repository mapping update
4. DTO or contract update
5. use case update
6. route or API client update
7. tests and seed data update

Do not stop after the schema file compiles.

## Import Smell Checks

Treat these as architecture failures:

- `components` importing Prisma or server modules
- `components/shared` importing feature-specific client use cases
- `client/usecase` importing server modules
- `domain` importing React Router, browser APIs, or Prisma
- `server/usecase` depending on concrete Prisma repository classes when a repository port would do
- `client/infrastructure/api` returning server ORM objects or pretending to transport live entity instances
- transport `Request` or `Response` types being moved into `domain` without real business invariants
- `usecase` code constructing its own repositories or gateways with `new`
- module-level mutable server state holding request or user context
- circular imports across route, use case, or infrastructure boundaries
- authorization enforced only in the UI with no server-side check
- persistence or transport serialization leaking directly into domain rules

Treat these as placement smells that should trigger review:

- a utility used in two places being extracted too early into a broad common module
- transport DTOs being promoted into `domain` without business meaning
- browser-only helpers being imported into server code or vice versa
- a module being put in `domain/services` even though it is really an application use case
- a module being put in `domain/policies` even though it is only UI validation
- a client-side repository abstraction being introduced even though a plain API client would suffice
- a type being promoted to `domain` only because multiple endpoints share the same DTO shape
- a service locator being introduced where constructor injection or explicit parameters would suffice
- a singleton repository or gateway storing request-local fields
- a feature importing another feature's private reducer, selector, or handler module
- an `index.ts` barrel hiding ownership or introducing cycles
- a schema migration merged without updating the adjacent mappings and tests

## Typical Flow

For a form submission:

1. A route module renders a container page.
2. A client use case Hook owns the draft state and handlers.
3. A presentational component renders fields and calls passed handlers.
4. A client infrastructure API client sends the request or a route action handles it.
5. A server use case applies the business rule.
6. A server infrastructure repository persists via Prisma.

Each step should only depend on the next layer inward or on an adapter explicitly created for that boundary.
