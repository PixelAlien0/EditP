# ADR-003: Canonical weapon parameter catalog

## Status

Accepted

## Context

Weapon controls were declared inline in the Edit Units workspace while compiler
paths, value coercion, advanced carrier fields, command-palette entries, and
package-import expectations lived in separate modules. A field could therefore
be visible but compile with the wrong type, or remain compiler-compatible
without appearing in editor discovery.

Saved project keys and generated Lua must remain backward-compatible.

## Decision

`src/config/weaponParameters.js` is the canonical weapon schema. Each definition
owns its presentation metadata and normalized compiler contract:

- editor key and label;
- UI surface, group, ordering, control type, and optional asset picker;
- compiler target, Lua path, and value type;
- compatibility-only aliases when old projects still require them.

The Edit Units workspace, behavior/interceptor controls, target masks, command
palette, tweak-package analyzer, compiler, and completeness audit consume this
catalog. Unknown historical keys retain numeric identity-path fallback in the
compiler so existing projects are not discarded.

## Trade-offs

- The module is intentionally data-heavy, but removes larger duplicated arrays
  and condition sets from feature code.
- Legacy schema exports in `editorParameters.js` remain temporarily as inputs
  while downstream compatibility is verified.
- Specialized controls still own their layout; they obtain field identity and
  copy from the shared catalog.

## Consequences

- Adding a supported weapon field now requires one catalog entry.
- Relevance, discovery, validation, import, and compilation use the same field
  identity.
- The parameter completeness audit can inspect data directly instead of parsing
  JSX source text.
- Saved projects and generated tweak formats remain unchanged.
