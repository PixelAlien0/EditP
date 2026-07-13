# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Unitpics sync

Unit icons are sourced from the Beyond All Reason `unitpics` repository. The sync pipeline resolves each unit's current `buildpic`, converts the source DDS to a 192px WebP, deduplicates identical output by content hash, and refreshes `src/data/unitpic-manifest.json`.

Generated artwork is written to `public/unitpics/assets`. Missing upstream artwork is mapped explicitly to the BAR Editor logo, so the browser never guesses filenames or requests known-missing assets.

```bash
npm run sync-unitpics
```

Run the read-only audit after a sync or production build:

```bash
npm run audit-unitpics
npm run build
npm run audit-unitpics:dist
```

The audit verifies manifest coverage, WebP signatures, content uniqueness, orphaned files, per-image limits, the 75 MB artwork budget, and the 80 MB production-build budget. The browser loads only self-hosted, immutable hashed assets and does not depend on an external artwork CDN at runtime.
