# Contributing to BAR EditP

BAR EditP changes can affect browser state, generated Lua, and BAR runtime behavior at the same time. Keep changes focused and prove each layer still works.

## Before you start

1. Search the existing issues.
2. Open a feature request before beginning a large workflow, schema, or compiler change.
3. Read `EDITOR_ARCHITECTURE_AND_GUIDELINES.md` for state and stylesheet ownership rules.
4. Base the work on the latest `main` branch.

## Local setup

```bash
npm ci
npm run dev
```

Supabase variables are optional. The core editor must remain usable when collaboration services are absent or unavailable.

## Change rules

- Preserve existing project-file and generated-Lua compatibility unless a versioned migration is included.
- Use the canonical parameter catalogs and contract registries. Do not duplicate field definitions inside components.
- Keep persistent project state in the project store. Keep transient view state near the owning workspace.
- Give each selector one stylesheet owner. Use semantic theme tokens instead of raw colors or new override layers.
- Keep light and dark mode on the same component structure.
- Do not execute imported Lua in the browser.
- Add regression coverage for every fixed bug.

## Validation

Run the focused tests while developing. Run the full gate before submitting:

```bash
npm run verify
npm run test:e2e
```

For compiler, gadget, carrier, cluster, or advanced-mechanics changes, also run:

```bash
npm run test:bar-runtime
```

UI changes must be checked in light and dark mode at 1024, 1180, 1440, 1920, and 2560 pixels when the affected layout supports those widths.

## Pull requests

Describe the user-visible result first. Then include:

- the problem and its cause;
- the files or systems changed;
- tests run;
- screenshots for interface changes;
- sample generated Lua and BAR runtime results for compiler changes;
- migration notes when project data changes.

Avoid unrelated cleanup in the same pull request. Small diffs are easier to review and safer to ship.

