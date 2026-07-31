# Bar Editor Architecture & Development Guidelines

> **Crucial Reference**: This document consolidates all architectural lessons, Japandi design system rules, CSS ownership principles, state management strategies, and performance guidelines learned from previous development sessions (Session `019f5106-1d87-7ce1-8702-54e5c3b54baf`).
> **Goal**: Prevent UI regressions, preserve state/Lua synchronization, and maintain single-file CSS ownership during all future feature additions and refactoring passes.

---

## 1. Japandi Design System & Aesthetics

### 🎨 Visual Language
- **Theme Concept**: Modern Japandi—combining warm natural wood/paper surface tones, subtle ink borders, soft ambient lighting, and restrained Sakura accent highlights.
- **Palette Principles**:
  - Light & Dark modes must use semantic CSS tokens from `src/styles/theme-tokens.css`.
  - **Forbidden**: Hex colors (`#ffffff`, `#1a1a1a`), raw `rgb/rgba` values, or inline color declarations inside React component styles or feature CSS files.
  - **Required**: Use `var(--color-surface-...)`, `var(--color-text-...)`, `var(--color-border-...)`, `var(--color-sakura-accent)`, etc.
- **Surface & Depth**:
  - Restrained elevation: Soft multi-layered box shadows (`var(--shadow-sm)`, `var(--shadow-md)`), no harsh heavy black drop-shadows.
  - Subtle hover lift (`transform: translateY(-1px)` or soft border glow), clean rounded radii (`var(--radius-sm)`, `var(--radius-md)`).
  - Avoid rainbow/neon gradients or unnecessary decorative lines.

### 📐 Layout & Spacing
- **Responsive Workspace**: Designed for desktop viewports (1024px+).
- **Proportions**: Avoid cramped center-heavy layouts. Use full flex/grid container bounds for `editor-workspace`, `editor-unit-header`, `editor-scroll-area`, and `code-pane`.
- **Dynamic Math**: Avoid arbitrary static pixel offsets (e.g., `+ 12px` or `font_size * 2.0`). Derive heights and padding dynamically from container bounds or semantic token steps (`var(--space-2)`, `var(--space-4)`, `var(--space-6)`).

---

## 2. CSS Architecture & Ownership Rules

### 🏗️ Cascade Hierarchy
Styles are loaded in deliberate cascade order in `src/main.jsx`:
1. `src/styles/theme-tokens.css` – Defines all semantic tokens (colors, spacing, typography, radii, shadows, motion, control dimensions).
2. `src/index.css` – Legacy migration layer. Holds unmigrated feature rules; no new rules should be added here.
3. `src/styles/features/dark-mode.css` – Legacy dark mode overrides.
4. `src/styles/features/*.css` – Feature-specific layout & presentation (e.g., `build-menu.css`, `formula-mutator.css`, `header.css`, `editor-context.css`).
5. `src/components/ui/ui.css` – Reusable interactive controls (buttons, inputs, tabs, cards, dialogs). Must load **last** so features cannot accidentally overwrite shared control states.

### 🛡️ Single-File Ownership Rule
- **Every CSS selector must have exactly ONE canonical owner file.**
- Feature files in `features/` own feature layout. Reusable controls belong in `ui.css`.
- **`!important` Rule**: Do not use `!important` on new CSS rules.
- **Verification Commands**:
  - Run `npm run audit-css` to verify single-file selector ownership and size budgets.
  - Run `npm run consolidate-css` after migrations to clean legacy declarations in `index.css`.

---

## 3. Component Architecture & Data Persistence

### ⚛️ Component Structure
- **Core State Hub**: `App.jsx` and files in `src/state/` / `src/controllers/`.
- **Decoupled Feature Dialogs & Pages**:
  - `CarrierDroneWorkbenchDialog.jsx` – Drone linkage math & workbench layout.
  - `FormulaMutatorDialog.jsx` – Formula calculation & mutator controls.
  - `BatchAdjustDialog.jsx` – Multi-unit parameter batch modification.
  - `PresetGalleryPage.jsx` / `CollectionsPage.jsx` / `TweakPackageLabPage.jsx` – Preset management.
  - `WeaponLaboratoryPage.jsx` / `WeaponBlueprintParameterEditor.jsx` – Weapon tweaking.
  - `BarReferenceLibraryPage.jsx` – Reference library & unit defaults inspector.

### 💾 Data Persistence & Lua Export Integrity
- **Local Storage Schema**: Preset choices, custom tweak packages, project checkpoints, and user preferences must retain data across navigation, theme toggle, and page reloads.
- **Lua Sync**: Ensure modifications to unit parameters, weapons, or drone linkages preserve exact backwards compatibility with exported Lua code structures.

---

## 4. Performance & Rendering Optimization

### ⚡ Critical Performance Rules
- **Unit Library Pane (`unit-library-pane`)**:
  - Prevent re-render lag when filtering/searching hundreds of unit definitions.
  - Keep search input state local or memoized (`useMemo`, `useCallback`, React `memo`) so typing does not re-render the entire editor tree.
  - Virtualize or slice large list renders where necessary.
- **Lazy Loading**: Route pages should use genuine React `React.lazy()` / code-splitting boundaries to keep initial bundle load fast.

---

## 5. Development & QA Verification Checklist

Before finalizing any changes or declaring a task complete, run the following verification steps:

1. **Linting & Code Quality**:
   ```bash
   npm run lint
   ```
2. **CSS Ownership & Audit**:
   ```bash
   npm run audit-css
   ```
3. **Automated Tests**:
   ```bash
   npm test
   ```
4. **Production Build Check**:
   ```bash
   npm run build
   ```
5. **Visual QA Check**:
   - Toggle Light / Dark themes to verify Japandi token coverage.
   - Verify layout responsiveness on desktop widths (1024px+).
