# Project Rules for Bar Editor

## 1. Design & Aesthetic Guidelines
- **Japandi Aesthetic**: Always maintain the warm, refined Japandi visual system (natural paper/wood surfaces, subtle ink borders, restrained Sakura accents).
- **Theme Tokens Only**: Use CSS variables from `src/styles/theme-tokens.css`. Never introduce hardcoded hex/RGB colors in feature CSS or inline JSX styles.

## 2. CSS Ownership Rules
- **Cascade Hierarchy**: `theme-tokens.css` -> `index.css` -> `features/*.css` -> `components/ui/ui.css`.
- **Single File Ownership**: Ensure every CSS selector has a single canonical file owner. Run `npm run audit-css` to verify.
- **No `!important`**: Do not add new `!important` flags.

## 3. State & Performance Integrity
- **Unit Library Performance**: Ensure input searches and list updates in `unit-library-pane` do not trigger full editor tree re-renders. Use memoization where appropriate.
- **Persistence & Exports**: Never break local storage serialization or Lua code generator output.

## 4. Verification Workflow
Always run test and audit commands after modifying project files:
- `npm run audit-css`
- `npm test`
- `npm run build`
