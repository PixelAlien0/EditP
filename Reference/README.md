# Sanitized reference policy

BAR Editor keeps only synthetic regression fixtures in version control. The fixtures preserve useful Lua structures observed in real lobby tweaks, but they do not copy a community mod's source, branding, prose, balance values, identifiers, or encoded payloads.

The committed fixture package lives in `tests/fixtures/sanitizedReferencePackage.js` and covers both BAR delivery lanes:

- nine `tweakdefs` modules;
- nine `tweakunits` modules;
- clone helpers and registry merges;
- build-menu edits and auxiliary weapon definitions;
- carrier, cluster, and interceptor-style custom parameters;
- dynamic selectors, deletion, asset replacement, and runtime-loading warnings;
- dependency ordering, literal type diagnostics, and full lobby-bundle parsing.

All invented identifiers use the `editp_fixture_` namespace. Armada/Cortex identifiers are used only as public BAR donor or producer references where a realistic dependency is required.

## Private source material

Local research payloads belong in `Reference/private-originals/`, which is ignored by Git. They must never be imported directly by tests, application code, or build scripts. This keeps the application reproducible while avoiding redistribution of third-party tweak packages.

When a new real-world pattern is discovered, reproduce the smallest structural example with neutral names and values, add an explicit expected analyzer result, and keep the original material outside version control.
