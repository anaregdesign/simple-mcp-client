# Workspace UI Behavior Baseline

This document records the current expected UI behavior of the Local Playground workspace before the big-bang architecture reset.

Use this as a bug-fix oracle after the refactor. It describes the behavior that users currently experience, not the ideal future behavior.

Source of truth for this baseline:

- existing component and usecase tests under `app/components/` and `app/lib/client/usecase/workspace/`
- current route composition in `app/routes/_index.tsx`
- current screenshots under `docs/images/`

## Global Screen Composition

### Initial state

- The workspace renders from `app/routes/_index.tsx`.
- `useWorkspace()` returns all screen state, handlers, layout refs, and panel props.
- The main route always mounts a Fluent `FluentProvider` and chooses a light or dark theme from the workspace state.

### Auth gate

- When `isAzureAuthRequired` is `true`, the route renders only `UnauthenticatedPanel`.
- When `isAzureAuthRequired` is `false`, the route renders the split workspace layout with `PlaygroundPanel`, a draggable splitter, and `ConfigPanel`.

### Visible result

- The unauthenticated screen is a dedicated full-page gate rather than a partially disabled workspace.
- The authenticated screen is a two-pane desktop-first layout with Playground on the left and config panels on the right.

### Known quirks

- `ConfigPanel` still has internal logic for locked tab behavior even though the full route can already switch to `UnauthenticatedPanel`.
- Current screenshots in `docs/images/local-playground-*.png` are descriptive references, not exact visual approval snapshots.

## Layout And Splitter

### Initial state

- The workspace layout uses a CSS custom property for `--right-pane-width`.
- A vertical splitter separates Playground and the side panel.

### User action

- The user drags the main splitter.

### Expected state change

- `rightPaneWidth` updates and the layout re-renders with the new width.
- `isMainSplitterResizing` becomes `true` during drag and returns to `false` after drag ends.

### Visible result

- The right pane width changes immediately.
- The splitter gains a `resizing` class while active.

### Known quirks

- Splitter behavior is desktop-first and pointer-driven. There is no distinct mobile-first interaction model in the current baseline.

## Playground Conversation And Composer

### Initial state

- The Playground shows the active thread name in the header.
- The conversation renders messages, per-turn operation logs, progress messages, desktop update status, system notices, and current errors.
- The composer contains the message textarea, attachment picker, command menu, Azure selectors, reasoning-effort selector, web-search toggle, skill bubbles, and MCP bubbles.

### User action

- The user types a message, attaches files, invokes a `$` command, submits a message, copies content, or removes selected skills/MCP servers.

### Expected state change

- Draft text and attachment state update immediately.
- `$` command suggestions come from message-skill activation options.
- Submitting dispatches the send-message flow and transitions the active thread request state to sending.
- Removing a selected message skill activation or thread skill updates local workspace state immediately.

### Visible result

- The textarea is `readOnly` when chat is locked, not `disabled`.
- Progress messages appear while a send is in flight.
- Operation logs are grouped by turn and the active/error turn logs render separately.
- Desktop updater actions are visible in the Playground header.

### Known quirks

- Composer locking is modeled as `readOnly`, so browser focus and selection behavior remain closer to an editable textarea than a disabled control.
- Current component contract for `PlaygroundPanel` is a very large prop surface and acts as a rendering shell rather than a narrow view model.

## Azure Login, Tenant, Project, And Deployment Selection

### Initial state

- Azure state includes tenant session, project catalog, deployment catalog, selected Playground project/deployment, selected Utility project/deployment, auth errors, and theme preference.
- The selected Utility deployment drives Utility reasoning-effort support and available options.

### User action

- The user signs in, switches tenant, reloads the catalog, changes Playground project/deployment, changes Utility project/deployment, or signs out.

### Expected state change

- Azure login loads tenants and projects.
- Tenant switch clears and reloads Azure-dependent workspace state.
- Selecting a project clears the corresponding deployment selection.
- Utility reasoning-effort options derive from the selected Utility deployment.
- Theme changes persist through the Azure selection preference path.

### Visible result

- Settings shows Azure principal summary, selected Playground project/deployment, selected Utility project/deployment, and Azure auth/session errors.
- Utility deployment selectors and Utility reasoning-effort selector are rendered from shared Azure view types.

### Known quirks

- Azure settings still expose a large callback-heavy contract and depend on request-sequencing runtime state.
- Playground reasoning-effort compatibility is derived in a wrapper Hook instead of the canonical `use-azure-settings.ts` public surface.

## Threads Lifecycle

### Initial state

- Threads are represented as active and archived lists.
- The active thread snapshot is the source of truth for Playground, instruction editor, and MCP/thread skill state.

### User action

- The user creates, switches, renames, clears, archives, restores, or cancels a thread.

### Expected state change

- Creating a thread flushes the current snapshot first when the current state is persistable.
- Switching a thread flushes the active snapshot before applying the next one.
- Renaming the active thread updates local state optimistically and then persists.
- Clearing the active thread empties messages and operation logs and reapplies the cleared snapshot.
- Removing an unsaved empty active thread removes it from local state without a server round-trip.

### Visible result

- Threads tab reflects active and archived thread options.
- The active thread name in the Playground header follows the active thread input state.
- Busy flags and per-operation pending states are reflected in the Threads tab UI.

### Known quirks

- Thread lifecycle still relies on a broad dependency object and root composition wiring from `use-workspace.ts`.
- Thread and Playground state are coupled through root composition instead of a dedicated screen-level feature owner.

## MCP Servers

### Initial state

- The side panel exposes saved workspace MCP Server profiles and active-thread MCP servers as related but distinct concepts.
- The form supports both HTTP/SSE and stdio transports.

### User action

- The user reloads profiles, toggles connect-on-workspace, edits a profile, deletes a profile, adds a new profile, or removes an MCP server from the active thread.

### Expected state change

- Editing populates the form from the selected profile.
- Toggling a workspace profile updates saved workspace profile state.
- Adding a server validates current form input and persists the profile.
- Connecting a workspace profile to the active thread updates the thread snapshot immediately.

### Visible result

- MCP tab shows saved profile options, editing state, transport-specific form fields, and validation/warning messages.

### Known quirks

- The current MCP form and tab contract is still a large mixed bag of form state, mutation handlers, and selection state.

## Skills

### Initial state

- Skills are shown both as registry groups in the side panel and as selected skill bubbles in the Playground.
- Thread skills and message skill activations are separate selections.

### User action

- The user reloads skills, toggles a thread skill, toggles a registry skill, adds a message skill activation through the `$` command menu, or removes selected skills.

### Expected state change

- Reload uses the current workspace user and Azure auth state.
- Toggling a thread skill updates the active thread snapshot.
- Adding a message skill activation updates Playground-local selected message skill state.

### Visible result

- Skills tab reflects registry mutation state, warnings, and success messages.
- Playground shows selected thread skills and selected message skill activations as separate bubble groups.

### Known quirks

- Message skill activation state is still rooted in Playground session state rather than a narrower message-composer feature owner.

## Instruction Editor And Title Suggestion

### Initial state

- Instruction editor owns the current agent instruction, instruction context toggles, loaded file name, save/enhance status, and enhance comparison state.
- Active thread rename and title suggestion are separate flows.

### User action

- The user edits the instruction, loads a file, saves the instruction prompt, enhances the instruction, adopts the enhanced/original version, or triggers title refresh indirectly through thread activity.

### Expected state change

- File loading and prompt save clear previous success/error state before updating.
- Instruction enhancement updates compare/adopt state for the active thread.
- Title refresh runs in the background when thread state changes meet current refresh conditions.

### Visible result

- Threads tab shows instruction save/enhance messages and compare/adopt controls.
- Thread names update optimistically and later persist.

### Known quirks

- Title suggestion depends on Utility deployment state and thread background effects, so title updates can feel indirect from the user perspective.

## Notices, Errors, And Desktop Updater

### Initial state

- `uiError`, `systemNotice`, Azure auth errors, thread errors, instruction errors, MCP form errors, and skill warnings are all surfaced in feature-specific places.
- Desktop updater status is shown in the Playground header.

### User action

- The user triggers an update check, applies an update, causes an Azure auth failure, or hits a mutation failure in a side panel.

### Expected state change

- System notices can be cleared from the composer region.
- Feature-specific warnings and success messages clear through local handlers.
- Desktop updater action state moves between `check` and `apply` flows.

### Visible result

- Notices are not centralized into a single status center. They appear in the feature region that owns them.
- Desktop updater actions remain visible even while the conversation pane is otherwise idle.

### Known quirks

- Error ownership is intentional but dispersed, so the same underlying problem can surface in multiple regions with slightly different wording.

## Refactor Note

This baseline is intentionally conservative. If behavior changes after the architecture reset, compare the new behavior to this document first, then decide whether:

1. the behavior was broken by the refactor,
2. the previous behavior was a known quirk worth correcting, or
3. the baseline doc itself needs to be updated because the product decision changed.
