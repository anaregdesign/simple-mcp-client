# FlatRoute REST API Guidelines

Use these rules when defining HTTP APIs with React Router file route conventions and `flatRoutes()`.

## FlatRoute Mapping Rule

React Router file route conventions map file names to URL pathnames, and `.` in a file name becomes `/` in the URL. Dynamic path segments use the `$` prefix.

Design API files so the file name reads like the URL, and the URL reads like the resource model.

## Resource-First Naming

Prefer resource-oriented URLs with nouns and plural collections.

Good patterns:

- `api.orders.ts` -> `/api/orders`
- `api.orders.$orderId.ts` -> `/api/orders/:orderId`
- `api.orders.$orderId.items.ts` -> `/api/orders/:orderId/items`
- `api.users.$userId.sessions.$sessionId.ts` -> `/api/users/:userId/sessions/:sessionId`

Avoid verb-oriented file names such as:

- `api.create-order.ts`
- `api.get-user.ts`
- `api.delete-session.ts`

The HTTP method already expresses the action.

General method mapping:

- `GET /api/orders` -> list collection
- `POST /api/orders` -> create resource
- `GET /api/orders/:orderId` -> get one resource
- `PATCH /api/orders/:orderId` -> partially update
- `PUT /api/orders/:orderId` -> replace when full replacement is intentional
- `DELETE /api/orders/:orderId` -> remove resource

This is an inference from React Router's file-to-path convention plus standard resource-oriented REST guidance.

## Collection And Item Pattern

For each resource, keep collection and item routes explicit and separate.

Preferred file set:

```text
app/routes/
  api.orders.ts
  api.orders.$orderId.ts
```

Use the collection file for:

- `GET` collection listing
- `POST` creation

Use the item file for:

- `GET` one resource
- `PATCH` or `PUT`
- `DELETE`

This keeps method dispatch localized to the resource level rather than scattered across unrelated files.

## Subresource Pattern

Use nested resource paths when the child belongs to the parent resource model.

Good examples:

- `api.orders.$orderId.items.ts`
- `api.projects.$projectId.members.ts`
- `api.users.$userId.sessions.ts`

Use a direct top-level collection when the resource has its own identity and is not only meaningful through the parent.

Prefer:

- `/api/invoices/:invoiceId`

over forcing:

- `/api/customers/:customerId/invoices/:invoiceId`

unless the parent scope is part of the canonical identifier.

## Dynamic Segment Rule

Use `$segment` for stable resource identifiers, not for verbs or commands.

Good examples:

- `api.orders.$orderId.ts`
- `api.catalog.$slug.ts`

Avoid:

- `api.orders.$action.ts`
- `api.jobs.$operation.ts`

If the segment is really an action, the resource model is probably wrong or the endpoint is an intentional command exception.

## Query Parameter Rule

Keep filtering, sorting, search, and pagination in query parameters, not in extra path segments.

Prefer:

- `GET /api/orders?status=open&page=2`
- `GET /api/users?search=hiroki&sort=createdAt`

Avoid:

- `/api/orders/open`
- `/api/orders/page/2`
- `/api/users/search/hiroki`

unless those are truly distinct resources rather than list queries.

## Command Exception Rule

Some actions are not naturally modeled as resource CRUD. When an explicit command endpoint is truly better, keep it rare and obvious.

Reasonable examples:

- `/api/chat`
- `/api/uploads/complete`
- `/api/reports/generate`

When using a command endpoint:

- make the command name explicit
- keep it outside ordinary resource CRUD trees when possible
- document why resource modeling was not a good fit

Do not let command endpoints become the default style for ordinary CRUD operations.

## FlatRoute File Naming Examples

Good file names:

- `api.orders.ts`
- `api.orders.$orderId.ts`
- `api.orders.$orderId.items.ts`
- `api.projects.$projectId.members.$memberId.ts`

Bad file names:

- `api.order-list.ts`
- `api.order-detail.ts`
- `api.update-order.ts`
- `api.projects.members.ts` when the URL actually needs `:projectId`

## Route Module Responsibility

Keep API route modules focused on HTTP concerns:

- parse params
- parse query parameters
- validate request bodies
- dispatch by method
- set status codes and response shape

Move reusable logic into server use cases.

Do not let route modules hold:

- Prisma queries
- business invariants
- cross-route orchestration
- reusable DTO mapping logic that belongs in infrastructure or use case modules

## Response And Status Guidance

Prefer standard HTTP semantics:

- `200` for successful reads and updates with a body
- `201` for creates
- `204` for successful deletes with no body
- `400` for invalid input
- `404` when the target resource does not exist
- `409` for state conflicts or uniqueness conflicts
- `422` only when you intentionally distinguish semantic validation from generic bad input
- `500` for unexpected server failures

Do not return `200` for obvious failure states just because the response body contains an error object.

## Consistency Heuristic

When reviewing a FlatRoute API file name, ask:

1. Can I predict the URL from the file name?
2. Can I predict the resource from the URL?
3. Does the HTTP method, rather than the path name, express the action?
4. Would another developer place the sibling collection or item route in the same location?

If any answer is no, rename the route before adding more API surface.
