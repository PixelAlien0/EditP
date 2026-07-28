# ADR-001: Central Project Store

## Status

Accepted

## Context

BAR Editor previously kept its persistent project values in one reducer, but
project history and multi-field workflows were coordinated in `App.jsx`.
Operations such as creating a clone, assigning builders, or converting an
imported tweak package updated several fields independently. That allowed
undo/redo to observe partial states and made persistence depend on component
update ordering.

The editor must preserve its current project JSON and generated Lua formats.
Temporary interface state such as open dialogs, searches, active tabs, and
hover state must remain local to the owning workspace.

## Decision

Use one React reducer-backed project store as the canonical owner of persistent
editor data.

- The store owns the current project, undo history, and redo history.
- Existing field setters remain available as compatibility adapters.
- Coupled workflows use `transactProject` and create one history entry.
- Recovery hydration replaces the current project without creating history.
- Presets remain a separate local library and are not rolled backward with the
  active project.
- UI-only state remains outside the project store.

No external state framework is introduced.

## Rationale

1. A reducer provides deterministic, testable transitions without adding a new
   dependency or hidden global state.
2. Compatibility setters allow the migration to remain incremental.
3. Atomic transactions prevent clones, build menus, definitions, and tweaks
   from becoming temporarily inconsistent.
4. Keeping transient UI state local avoids unnecessary project persistence and
   broad application rerenders.

## Trade-offs

- The reducer retains compatibility setters, so not every caller immediately
  uses a domain-specific action.
- History snapshots still retain up to 50 project states and can use meaningful
  memory for very large tweak packages.
- Project metadata and compiler-view flags retain their previous independent
  undo behavior to avoid turning ordinary text entry into excessive history.

## Consequences

- Undo and redo are available through the store rather than `App.jsx`.
- New workflows that change multiple project fields must use
  `transactProject`.
- Persistence consumes only the store's present project.
- Future feature extraction can receive store state and actions without
  depending on component-local persistence logic.

## Revisit Trigger

Reconsider the storage strategy if profiling shows that 50 in-memory snapshots
are too expensive for real-world package sizes. At that point, use bounded
patch history or structural sharing while keeping the same store interface.
