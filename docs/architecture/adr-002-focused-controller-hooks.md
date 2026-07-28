# ADR-002: Focused controller hooks

## Status

Accepted.

## Context

The centralized project store removed competing ownership of persistent project
data, but `App.jsx` still contained domain workflows for clones, factory rosters,
tweak packages, validation, and project files. Those workflows mixed derivation,
mutation, browser I/O, and page composition in one component.

A single all-purpose controller would only move the same coupling into another
large file. A new global state framework would also duplicate the project store.

## Decision

Keep `App.jsx` as the application composition root and extract focused controller
hooks by domain:

- `useCloneController`
- `useFactoryRosterController`
- `useTweakPackageController`
- `useProjectValidation`
- `useProjectFileController`

Persistent edits continue to flow exclusively through `useProjectStore`.
Controllers receive their data and actions explicitly and may own only local UI
state that belongs to their workflow. Pure controller helpers are exported for
unit testing.

## Consequences

- Domain workflows can be tested without rendering the complete application.
- Project mutations remain atomic and compatible with undo, redo, persistence,
  imports, and generated output.
- `App.jsx` is smaller and primarily composes data, controllers, and workspaces.
- Controller interfaces are intentionally explicit, so some prop lists remain
  longer than they would with hidden global context.
- Future extraction should follow domain boundaries rather than chasing a line
  count or creating one oversized controller.
