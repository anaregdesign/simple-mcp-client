# Local Playground

`Local Playground` is a desktop-first SPA for working with Azure OpenAI chat, thread-scoped MCP servers, and thread-scoped Skills in one place.

## Quick Start

```bash
git clone https://github.com/anaregdesign/local-playground.git
cd local-playground
npm install
npm run dev
```

Open `http://localhost:5173`.

If sign-in is required, complete Azure authentication from the app before using chat, project discovery, or deployment selection.

## What The App Does

- `Playground`: chat execution and per-turn runtime visibility
- `Threads`: thread lifecycle, instruction editing, and archived thread restore
- `MCP Servers`: saved profile management and thread-scoped MCP connection
- `Skills`: installed Skill discovery and registry-backed Skill workflows
- `Settings`: Azure authentication, project/deployment selection, and app-level preferences

## Contributor Baseline

The contributor architecture source of truth is:

- [`AGENTS.md`](AGENTS.md)
- [`skills/enforce-react-spa-architecture/SKILL.md`](skills/enforce-react-spa-architecture/SKILL.md)

Current workspace UI behavior baseline for post-refactor bug fixing:

- [`workspace-ui-behavior-baseline.md`](docs/architecture/workspace-ui-behavior-baseline.md)

There is intentionally no competing architecture migration doc under `docs/architecture/`. Durable architecture rules live in `AGENTS.md` and the skill; the baseline doc records current UI behavior only.

Stable contributor rules:

- `app/lib` is organized by layer, not by ad-hoc feature roots
- shared client/server parsing and contract logic belongs in `app/lib/contracts/`
- framework-independent model behavior belongs in `app/lib/domain/`
- server-only integrations belong in `app/lib/server/infrastructure/`
- route modules should stay thin and delegate reusable logic to `app/lib/server/usecase/` and `app/lib/server/infrastructure/`
- Prisma vocabulary is the naming source of truth
- legacy prefixes that still remain in the codebase should not be copied into new names
- `npm run architecture:check` is a strict zero-findings gate, not a baseline drift check

## Runtime Model

- The app is a SPA with `client` runtime ownership.
- Thread state is the main persisted unit: metadata, instruction, messages, MCP connections, operation logs, and Skill selections.
- Interactive state lives in the runtime first and is persisted as durable snapshots.
- Azure authentication uses `DefaultAzureCredential`.
- Local development can use `/mcp/debug` for debugging and database inspection.

## Development Commands

```bash
npm run dev
npm run architecture:check
npm run typecheck:core
npm run test:core
npm run quality:gate
```

Desktop packaging:

```bash
npm run desktop:dev
npm run desktop:start
npm run desktop:package
```

Desktop builds wrap the same React Router SPA in Electron. There is no separate desktop renderer shell.
`desktop:start` rebuilds Electron-native dependencies before launching the production shell. Installer builds rebuild native dependencies through `electron-builder`.

## Screenshots

![Local Playground overview](docs/images/local-playground-desktop.png)
![Local Playground chat](docs/images/local-playground-chat-log.png)
