# Stylesheet architecture

CSS is loaded in deliberate cascade order from `main.jsx`.

1. `theme-tokens.css` defines semantic colors, spacing, type, radii, shadows, motion, and control dimensions.
2. `base.css` owns only document reset, root sizing, application canvas, selection, and scrollbar foundations.
3. Files in `features/` own feature-specific layout and presentation in their import order.
4. `components/ui/ui.css` owns reusable interactive components and loads last so features cannot redefine shared states accidentally.

Light and dark themes share the same component rules. Theme changes happen through
the semantic values in `theme-tokens.css`; do not add a separate theme-wide override
layer. A feature may use a narrowly scoped `[data-theme]` selector only when its
behavior cannot be expressed by an existing semantic token.

## Ownership rules

- Put reusable controls, fields, feedback, tabs, cards, and dialogs in `components/ui/ui.css`.
- Put feature layout in its named file under `features/`.
- Consume semantic tokens; do not add literal theme colors to feature files.
- Do not add theme or feature overrides to `base.css`.
- Avoid `!important`; narrowly documented accessibility or third-party integration exceptions require justification.
- A selector should have one canonical owner. Run `npm run audit-css` to find cross-file ownership before merging a UI change.
- Preserve the import order in `main.jsx`: tokens, base, feature owners, then shared UI primitives.

After a larger migration, run `npm run consolidate-css`. The consolidator:

- removes exact duplicates and declarations superseded in the same selector and at-rule context;
- removes grouped declarations only when every selector is superseded.

It does not infer shorthand/longhand equivalence or merge state selectors. Run
`npm run audit-css` afterward; the audit is at-rule-aware and enforces both
single-file ownership and the project CSS size budget.
