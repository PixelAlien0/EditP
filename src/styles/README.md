# Stylesheet architecture

CSS is loaded in deliberate cascade order from `main.jsx`.

1. `theme-tokens.css` defines semantic colors, spacing, type, radii, shadows, motion, and control dimensions.
2. `index.css` is the remaining legacy migration layer. Existing unmigrated feature styles stay here until they receive a canonical owner.
3. `features/dark-mode.css` completes theme coverage for legacy surfaces.
4. Files in `features/` own the final feature-specific layout and presentation in their import order.
5. `components/ui/ui.css` owns reusable interactive components and loads last so features cannot redefine shared states accidentally.

## Ownership rules

- Put reusable controls, fields, feedback, tabs, cards, and dialogs in `components/ui/ui.css`.
- Put feature layout in its named file under `features/`.
- Consume semantic tokens; do not add literal theme colors to feature files.
- Do not add new “final override” sections to `index.css`.
- Avoid `!important`. Existing declarations remain only where the legacy cascade still requires them.
- A selector should have one canonical owner. Run `npm run audit-css` to find cross-file ownership before merging a UI change.
- Preserve the import order in `main.jsx` until the legacy layer has been fully migrated.

After a larger migration, run `npm run consolidate-css`. It removes only exact
duplicate declarations under the same selector and at-rule context, preserving
intentional fallbacks and state-specific overrides.
