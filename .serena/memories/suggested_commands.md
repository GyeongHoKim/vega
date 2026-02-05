# Suggested Commands

- **Format**: `npm run format` (Biome format write), `npm run format:check` (check only).
- **Lint**: `npm run lint` (Biome lint).
- **Typecheck**: `npm run typecheck` (tsc --noEmit).
- **Test**: `npm run test` (vitest run), `npm run test:watch` (vitest watch). Tests run in browser (Playwright Chromium).
- **Build**: `npm run build` (vite build + tsc for declarations).
- **Quality gate (after code changes)**: `npm run format` then `npm run lint` then `npm run typecheck` then `npm run test`.
- **Git**: husky pre-commit / commit-msg / pre-push; commitlint conventional commits.
