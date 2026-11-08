# ExpressTestApp working agreement

This is a small personal learning app named SnippetShelf. The current frontend scope is explicitly limited to login and a plain protected homepage with MUI and Formik. Snippet UI features require a separate request. The user approved patched React Router v7 while retaining the existing data-router structure, loaders and route guards; do not introduce framework mode or SSR.

## Boundaries

- `packages/contracts`: shared Zod request/response/error schemas and types inferred with `z.infer`; independent of Express and Prisma.
- `packages/database`: Prisma schema, additive SQL migrations, PostgreSQL adapter and backup tools.
- `apps/api/src/snippets/routes.ts`: HTTP input validation, authentication context and response contracts.
- `snippets/service.ts`: application rules and DTO conversion; no Express/Prisma imports.
- `snippets/repository.ts`: Prisma queries, ownership filters and transactions.
- `apps/web/src`: browser-only UI and shared contracts; no Prisma, database or API-server imports. Keep MUI appearance defaults in `theme.ts`. Use the existing Passport cookie session; never persist auth tokens or passwords in browser storage.
- Capture failures with `@itsezz/try-catch` (`tca` for async, `tc` for sync) instead of handwritten `try/catch` or Promise `.catch()` chains, including scripts. Pass HTTP failures to the global handler. Inspect every result and preserve cleanup even after a failure; use test lifecycle hooks for fixtures. ESLint enforces the convention. Do not silently substitute successful results.
- Keep Prisma/provider error translation separate from the global HTTP handler. Return only shared error codes, safe messages and request IDs.

## Review and validation

- Use English code comments and PR descriptions; explain non-obvious logic in the German learning documentation.
- Keep changes reviewable. Maintain the backend PR; the requested second frontend PR targets its branch until the backend is merged. Do not merge without an explicit instruction.
- Run `npm run format:check`, `npm run check`, `npm test` and the live smoke check for relevant backend changes. Check the final GitHub CI result.
- Test omitted fields, empty patches, null/false values, limits, malformed input, authorization, database failures and concurrent operations when affected.
- Start the actual API and verify PostgreSQL/Docker availability. Distinguish a local runtime problem from an application failure; record exactly what was tested.
- Tests must use isolated randomly named databases and clean up only fixtures they created. Keep local credentials, personal notes, dumps and generated code outside Git.
- Update README/API/learning docs when behavior changes. Apply general review feedback consistently across analogous code paths.
- For frontend auth changes, run `npm run test:web` against an isolated database and inspect desktop/mobile screenshots. Cover anonymous access, validation, login, reload, logout, expired sessions, network failures and keyboard use. Do not substitute mocked auth for the successful real login flow.
