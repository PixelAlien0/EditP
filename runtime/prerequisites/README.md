# BAR EditP unit prerequisites

This package supplies the synchronized runtime behavior for BAR EditP's technology-prerequisite custom parameters.

## Installation

Copy `LuaRules/Gadgets/unit_build_prerequisites.lua` into the same path inside the BAR-derived game or mod package used by the lobby. A lobby `tweakdefs` or `tweakunits` payload can write prerequisite metadata, but it cannot install or execute a new LuaRules gadget by itself.

The package reads these UnitDef custom parameters:

- `editp_prerequisite_units`: whitespace- or comma-separated UnitDef IDs.
- `editp_prerequisite_mode`: `all` (default) or `any`.
- `editp_prerequisite_persistent`: `0`/`1` or a boolean. When enabled, satisfying the rule once permanently unlocks the target for that team.

Only finished units count. In strict mode, destroyed, reverse-built, captured, or transferred prerequisites update availability immediately. Rules are team-local, not ally-team-wide.

## Behavior boundary

The gadget rejects unavailable build commands and factory queue entries through synchronized `AllowCommand` and `AllowUnitCreation` call-ins. It does not hide locked icons from the build menu; adding a matching unsynced command-menu presentation layer is a separate optional feature.

Unknown prerequisite UnitDefs fail closed and are reported once through `Spring.Echo`. BAR EditP also blocks self-references and circular project rules during export validation.
