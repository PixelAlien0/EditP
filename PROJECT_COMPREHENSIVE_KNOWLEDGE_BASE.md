# BAR Editor — Comprehensive Knowledge Base & System Architecture

> **Master Reference & Self-Reflection Document**  
> This file documents the complete architectural design, safety net mechanisms, UI styling system, state flow, Lua compilation engine, and safe edit directives for the **Bar Editor** workspace.

---

## 1. System Purpose & Engine Context

The **BAR Editor** (Beyond All Reason Unit Editor) is a web-based IDE for authoring, customizing, and balancing units, weapons, factory build rosters, carrier drone linkages, and tweak packages for the Beyond All Reason RTS engine.

* **Target Output**: Beyond All Reason Spring/Recoil engine `TweakDefs` Lua tables.
* **Lobby Constraint**: Modded configurations are transferred across multiplayer lobby payloads. Payload size must strictly remain within the engine byte budget (warning threshold at 64KB).

---

## 2. Safety Net Architecture

The editor implements multiple defensive layers to prevent engine crashes, data loss, invalid state, or lobby disconnects:

### A. Parameter Validation (`useProjectValidation.js`)
* **Numeric Boundary Checks**:
  * Health / Build Time / Spawn Rates: Must be strictly positive ($> 0$).
  * Reload Time / Stockpile Time: Engine minimum limit is 0.033s. Lower values trigger warning.
  * Speeds & Ranges: Speed cap warning at $> 400$; Range warning at $> 10000$. Costs and ranges cannot be negative.
  * Bitmasks (`targetable`, `interceptor`, `interceptedbyshieldtype`): Must be non-negative integers.
* **Vector Formats**:
  * 3D Offset & Scale vectors (`collisionvolumeoffsets`, `collisionvolumescales`) require exactly 3 numeric values: `X Y Z`.
* **Carrier Drone Lists**:
  * Lists (`maxunits`, `startingdronecount`, `spawn_metal_cost`, etc.) require space-separated numeric values matching drone slot arrays. Whole numbers enforced for counts.

### B. Behavior Interceptor (`behaviorInterceptor.js`)
* Validates special projectile behavior tags (`speceffect`).
* Prevents illegal target category masks that crash the BAR unit handler engine.

### C. Clone Inheritance & Safety (`useCloneController.js`)
* **Root Resolution**: Custom unit clones inherit base stats from their root parent unit.
* **Circular Prevention**: Prevents a clone from referencing another clone in a circular root loop. `resolveCloneRootId(id)` always unwinds to the canonical base unit.
* **Deletion Safeguard**: Deleting a clone automatically cleans up its entries in `tweaks`, `unitDescriptions`, and factory rosters.

### D. Local Storage & Undo History Safeguards (`useProjectStore.js` & `projectStorage.js`)
* **History Isolation**: `useProjectStore` maintains an undo/redo stack up to 50 steps (`PROJECT_HISTORY_LIMIT`). History records unit tweaks, clones, and collections, while project metadata and presets remain independent.
* **Quota Protection**: LocalStorage saves catch `QuotaExceededError` gracefully and fall back to draft recovery mechanisms.

### E. Lua Compaction & Byte Budget Enforcer (`luaCompaction.js` & `byteBudget.js`)
* Strips redundant whitespace, formats numbers compactly, escapes string literals, and deduplicates repeated table definitions.
* `useCompiledProjectOutputs.js` tracks payload byte count against lobby limits.

---

## 3. UI Styling & Design System (Japandi Aesthetic)

### 🎨 Visual Identity
* Warm natural paper/wood surface tones, dark plum/ink borders, soft ambient lighting, and restrained Sakura accent highlights.
* **Token Registry**: Defined exclusively in `src/styles/theme-tokens.css`.

### 🛡️ CSS Ownership Rules
1. **Cascade Hierarchy**:
   ```text
   src/styles/theme-tokens.css
     └── src/styles/base.css (Global document and application foundations)
           └── src/styles/features/*.css (Feature layout owners)
                 └── src/components/ui/ui.css (Reusable UI controls — loaded LAST)
   ```
2. **Single-File Ownership Rule**:
   * Every CSS selector MUST have **exactly ONE canonical owner file**.
   * Run `npm run audit-css` to verify 0 selector collisions across all 33+ CSS files.
3. **No Hardcoded Hex/RGB**:
   * Never introduce literal hex/RGB colors (`#ffffff`, `rgba(...)`) in component CSS or inline styles. Always use semantic tokens (`var(--color-surface-...)`, `var(--color-text-...)`, `var(--color-border-...)`).
4. **No New `!important` Flags**:
   * Do not add new `!important` declarations. Existing ones remain only in legacy override contexts.

---

## 4. Combined Filter & Classification Logic

* **Domain-Aware Category Filters**:
  * **Type Domain** (`bots`, `vehicles`, `aircraft`, `ships`, `hovercraft`, `factories`, `defenses`, `buildings`): Multi-select inside Type matches **OR** (`bots` OR `vehicles`).
  * **Tier Domain** (`t1`, `t2`, `t3`, `t4`): Multi-select inside Tier matches **OR** (`t1` OR `t2`).
  * **Cross-Domain**: Combined selections match **AND** across domains: `(Type Match) AND (Tier Match) AND (Faction Match) AND (Search Query Match)`.
* **Search Integration**: Text queries search across unit ID, name, description, AND unit category tags.
* **Selection Safeguard**: When filter changes exclude the current selected unit, selection automatically shifts to `filteredUnits[0]`.

---

## 5. Safe Development & Execution Checklist

Before merging or committing any code changes:

1. **Verify State & Invariants**:
   * Ensure LocalStorage persistence and Lua table generation formats remain intact.
   * Ensure clone inheritance handles root resolution without broken references.
2. **Run Automated Test Suite**:
   ```bash
   npm test -- --run
   ```
3. **Run CSS Single-File Ownership Audit**:
   ```bash
   npm run audit-css
   ```
4. **Run Production Build Check**:
   ```bash
   npm run build
   ```
