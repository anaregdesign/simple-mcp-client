# View State And Handler Patterns

## Goal

Keep `app/components/` close to pure rendering. Move state transitions, async work, and handler composition into `app/lib/client/usecase/`.

## Core Rules

- Keep components and Hooks pure during render.
- Derive display state during render whenever possible instead of storing redundant state.
- Use Effects only to synchronize with external systems.
- Use event handlers for user-driven updates.
- Use React Router state for network lifecycle before adding local pending flags.

## Preferred Composition

Split each non-trivial screen into two parts:

1. A use case Hook or controller in `app/lib/client/usecase/`
2. A presentational component in `app/components/`

When the use case needs multiple files, prefer this feature directory shape:

```text
app/lib/client/usecase/profile-editor/
  use-profile-editor.ts
  state.ts
  reducer.ts
  selectors.ts
  handlers.ts
```

Do not create cross-feature directories like `reducers/`, `state/`, or `handlers/`.

The use case layer should own:

- source state
- reducer transitions
- validation
- async submission
- retry logic
- mapping raw data into view-ready labels or flags
- rebuilding client-facing objects from DTOs when needed

The component layer should own:

- markup
- accessibility wiring
- visual branching
- tiny UI-only state that does not matter outside the component tree

## Recommended Hook Shape

Prefer returning a narrow view contract instead of leaking internal state:

```ts
type ProfileEditorViewModel = {
  name: string;
  bio: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  canSubmit: boolean;
};

type ProfileEditorHandlers = {
  handleNameChange(nextName: string): void;
  handleBioChange(nextBio: string): void;
  handleSubmit(): Promise<void>;
  handleRetry(): Promise<void>;
};

export function useProfileEditor(): ProfileEditorViewModel &
  ProfileEditorHandlers {
  // reducer, router state, API calls, derived flags
}
```

This keeps the component API explicit and stable.

## Directory Rules For State And Reducers

- Put reducer-backed screen state under `app/lib/client/usecase/<feature>/`.
- Put state shape and `initialState` in `state.ts`.
- Put reducer logic and action unions in `reducer.ts`.
- Put derived flags and computed read models in `selectors.ts`.
- Put async command helpers or dispatching helpers in `handlers.ts` when they are large enough to deserve extraction.
- Keep the public Hook in `use-<feature>.ts` and treat the rest as use-case internals.
- Avoid `store.ts` unless multiple sibling views need the same long-lived identity.
- Avoid top-level `state`, `reducer`, `store`, or `handler` directories anywhere under `app/`.

## Reducer First For Complex Screens

Use `useReducer` when:

- several fields change together
- pending, success, and error state interact
- multiple handlers update the same state
- transitions need to stay testable and explicit

Prefer a reducer over many loosely related `useState` calls when the screen has real state transitions.

## Route Data First For Server State

In React Router applications:

- use loaders for route reads
- use actions for route-owned mutations
- use `useFetcher` for non-navigation mutations
- use `useNavigation` and fetcher state for pending UI

Do not mirror loader or fetcher state into another client store unless there is a clear offline or optimistic requirement.

## DTO Mapping Rule

- Expect loaders, actions, and API clients to return JSON DTOs.
- Convert DTOs into value objects or richer client-facing shapes inside the owning use case when that conversion improves invariants or readability.
- Do not try to share live server-side class instances across the network.
- Keep the mapping close to the screen or use case that benefits from it.

## Async Safety On The Client

- Treat overlapping requests as a normal case.
- Cancel obsolete requests when the platform supports it.
- Prefer React Router pending state and fetcher lifecycle over ad-hoc race handling when possible.
- If multiple requests can resolve out of order, compare request ids or discard stale completions before committing state.
- Do not let an older response overwrite a newer user intent.

## Effect Discipline

Avoid Effects for:

- deriving state from props or other state
- handling button clicks
- computing filtered lists
- mapping server data into simple display flags

Use Effects for:

- subscriptions
- timers
- imperative browser APIs
- syncing with systems outside React

When an Effect needs the latest callback or state without forcing resubscription, prefer `useEffectEvent` inside the use case Hook.

## Container And View Example

```ts
// app/lib/client/usecase/use-profile-editor.ts
export function useProfileEditor(apiClient: ProfileApiClient) {
  const navigation = useNavigation();
  const [state, dispatch] = useReducer(reducer, initialState);

  async function handleSubmit() {
    dispatch({ type: "submitRequested" });
    try {
      await apiClient.saveProfile({ name: state.name, bio: state.bio });
      dispatch({ type: "submitSucceeded" });
    } catch (error) {
      dispatch({ type: "submitFailed", error });
    }
  }

  return {
    name: state.name,
    bio: state.bio,
    errorMessage: state.errorMessage,
    isSubmitting: navigation.state !== "idle" || state.isSubmitting,
    canSubmit: state.name.trim().length > 0,
    handleNameChange(nextName: string) {
      dispatch({ type: "nameChanged", nextName });
    },
    handleBioChange(nextBio: string) {
      dispatch({ type: "bioChanged", nextBio });
    },
    handleSubmit,
  };
}
```

```tsx
// app/components/profile/ProfileEditorView.tsx
type Props = {
  name: string;
  bio: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  canSubmit: boolean;
  handleNameChange(nextName: string): void;
  handleBioChange(nextBio: string): void;
  handleSubmit(): void;
};

export function ProfileEditorView(props: Props) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void props.handleSubmit();
      }}
    >
      {/* render only */}
    </form>
  );
}
```

## Smell List

Refactor when a component starts to:

- call `fetch` directly
- import Prisma or server modules
- build request payloads for more than one backend action
- own multiple pending flags and retry branches
- contain reducer-worthy transition logic inline
- use Effects to respond to ordinary user events
- commit async results without checking whether the request is still current

When that happens, move the logic into `client/usecase` and keep the component as a view.
