<div align="center">
  <img src="public/logo.svg" width="76" alt="BAR EditP logo">

  # BAR EditP

  **A local-first definition editor for Beyond All Reason.**

  Edit units and weapons, build production rosters, inspect BAR data, and export validated lobby tweak packages from one browser workspace.

  [Open BAR EditP](https://edit-p-nine.vercel.app/) | [Report a bug](https://github.com/PixelAlien0/EditP/issues/new?template=bug_report.yml) | [Request a feature](https://github.com/PixelAlien0/EditP/issues/new?template=feature_request.yml)

  [![Quality](https://github.com/PixelAlien0/EditP/actions/workflows/quality.yml/badge.svg)](https://github.com/PixelAlien0/EditP/actions/workflows/quality.yml)
  ![React](https://img.shields.io/badge/React-19-20232a?logo=react&logoColor=61dafb)
  ![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
  ![Local first](https://img.shields.io/badge/project_data-local--first-bb8797)
</div>

## What it does

BAR EditP turns BAR definitions into an approachable editing workspace while retaining access to advanced engine and gadget contracts.

- Edit unit, movement, economy, weapon, behavior, asset, and custom-parameter data.
- Clone units and reusable WeaponDefs without changing their source definitions.
- Compose factory and builder rosters in the Factory Roster Designer.
- Organize units with nested Collections and preserve complete project snapshots as Presets.
- Build weapons in the Weapon Laboratory and manage supporting WeaponDefs independently.
- Inspect community Lua and lobby bundles in the Tweak Package Lab without executing imported code.
- Search verified units, weapons, sounds, models, effects, and other assets in the BAR Reference Library.
- Run compatibility preflight, inspect export traces, and compile deterministic `tweakdefs` and `tweakunits` commands.

## Workflow

1. **Edit Units** to tune definitions, clone chassis, replace weapons, and review inherited values.
2. **Collections** to group units for focused editing and comparison.
3. **Build Menus** to place units into factory and builder production lists.
4. **Review & Export** to resolve blockers and copy the numbered lobby commands.

Projects remain in the browser until they are downloaded or explicitly shared. Presence and temporary chat are optional Supabase features and do not store editor projects.

## Run locally

Requirements:

- Node.js 22
- npm

```bash
git clone https://github.com/PixelAlien0/EditP.git
cd EditP
npm ci
npm run dev
```

Vite prints the local address after startup. No environment variables are required for the core editor.

### Optional collaboration features

Copy `.env.example` to `.env.local` and supply a Supabase project URL and publishable key:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Temporary chat also requires the one-time SQL setup described in [docs/temporary-chat-setup.md](docs/temporary-chat-setup.md).

## Validate a change

```bash
npm run lint
npm run test
npm run test:bar-runtime
npm run build
```

Run the complete repository gate before a release or pull request:

```bash
npm run verify
```

The complete gate checks lint, unit tests, production output, bundle budgets, CSS ownership, BAR data integrity, parameter coverage, and artwork integrity. Browser workflows are covered separately by Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

## Repository map

| Path | Purpose |
| --- | --- |
| `src/components` | Workspaces, dialogs, and shared interface components |
| `src/controllers` | Feature orchestration and editor actions |
| `src/config` | Parameter catalogs and runtime contracts |
| `src/data` | Pinned BAR definition and asset snapshots |
| `src/project` | Project schemas, migration, compilation, and validation |
| `src/styles` | Semantic tokens and feature-owned stylesheets |
| `scripts` | BAR synchronization, audits, and build maintenance |
| `tests/e2e` | Playwright workflow and visual regression coverage |
| `supabase` | Optional temporary-chat database setup |

Read [EDITOR_ARCHITECTURE_AND_GUIDELINES.md](EDITOR_ARCHITECTURE_AND_GUIDELINES.md) before changing state ownership, compilation, or stylesheet boundaries. The [UI regression checklist](docs/ui-regression-checklist.md) records the supported desktop validation pass.

## BAR data and generated assets

The editor ships with a pinned, validated BAR snapshot. Browsers do not fetch game definitions from GitHub during ordinary use. Maintenance scripts refresh definitions, parameters, artwork, tactical icons, assets, and model references deliberately.

Unit artwork is converted to content-addressed WebP files and deduplicated. Model assets are loaded only when the reference viewer is opened. Audits reject missing manifest targets, duplicate output, stale data, and deployment-budget violations.

## Contributing

Bug reports, focused improvements, and BAR compatibility findings are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Include the affected unit or WeaponDef ID, expected BAR behavior, generated Lua when relevant, and exact reproduction steps.

## Project status and attribution

BAR EditP is an independent, fan-made editor maintained by **[Grump]SunlessK**. It is not affiliated with, authorized by, or endorsed by the Beyond All Reason development team.

Unit names, definition data, and referenced game assets originate from the public [Beyond All Reason repository](https://github.com/beyond-all-reason/Beyond-All-Reason) and remain subject to their respective upstream licenses. Test generated output in BAR before distributing or using a project in a multiplayer lobby.
