# Parameter completeness

Run `npm run audit:parameters` after changing the BAR snapshot, parameter
metadata, the Edit Units workspace, behavior/interceptor controls, or compiler
field mappings.

The audit checks four connected surfaces:

1. Bundled unit and weapon fields in `unit-defaults.json`.
2. Unit and custom-parameter metadata used by the editor.
3. Weapon controls rendered by the main workspace and the secondary
   behavior/interceptor editor.
4. Compiler type and path schemas used to produce `tweakunits`.

The command fails when a snapshot field has no editing surface, a rendered
control cannot be compiled safely, metadata is incomplete, parameter keys are
duplicated, compiler type sets conflict, or an engine-only unit field lacks a
documented default. Compiler-only compatibility mappings and generic help text
are reported as advisories because they do not make generated output unsafe.

`npm run verify` includes this audit, so the same checks run in CI.
