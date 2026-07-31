# Project Rules & Safety Directives for Bar Editor

> **Master Architecture Guide**: Refer to [PROJECT_COMPREHENSIVE_KNOWLEDGE_BASE.md](file:///c:/Users/keith/Desktop/Bar%20editor/PROJECT_COMPREHENSIVE_KNOWLEDGE_BASE.md) for full architectural details.

## 1. Design & Aesthetic Guidelines
- **Japandi Aesthetic**: Maintain the warm, refined Japandi visual system (natural paper/wood surfaces, subtle ink borders, restrained Sakura accents).
- **Theme Tokens Only**: Use CSS variables from `src/styles/theme-tokens.css`. Never introduce hardcoded hex/RGB colors in feature CSS or inline JSX styles.

## 2. CSS Ownership Rules
- **Cascade Hierarchy**: `theme-tokens.css` -> `index.css` -> `features/*.css` -> `components/ui/ui.css` (loads last).
- **Single File Ownership**: Ensure every CSS selector has a single canonical file owner (0 collisions allowed). Run `npm run audit-css` to verify.
- **No `!important`**: Do not add new `!important` flags.

## 3. State & Safety Net Directives
- **Validation Safety**: Respect parameter min/max bounds (`useProjectValidation.js`) and special projectile behavior interceptors (`behaviorInterceptor.js`).
- **Clone Invariants**: Ensure clone creation/deletion unwinds roots correctly via `resolveCloneRootId(id)`.
- **Classification Filters**: Maintain domain-aware category filter logic (OR within Type/Tier domains, AND across domains).
- **Persistence & Exports**: Never break LocalStorage serialization, checkpoint schema compatibility, or compact Lua code generator outputs (`luaCompaction.js`, `tweakSerializer.js`).

## 4. Verification Workflow
Always run test and audit commands after modifying project files:
- `npm run audit-css`
- `npm test -- --run`
- `npm run build`
