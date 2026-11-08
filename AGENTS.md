# ExpressTestApp working agreement

This is a small personal learning app. Keep the current scope on the snippet database and backend; add frontend features only when requested. Preserve React Router v6 for the future frontend.

## Boundaries

- `packages/contracts`: shared Zod request/response/error schemas and types inferred with `z.infer`; independent of Express and Prisma.
- `packages/database`: Prisma schema, additive SQL migrations, PostgreSQL adapter and backup tools.
- `apps/api/src/snippets/routes.ts`: HTTP input validation, authentication context and response contracts.
- `snippets/service.ts`: application rules and DTO conversion; no Express/Prisma imports.
- `snippets/repository.ts`: Prisma queries, ownership filters and transactions.
- Capture failures with `@itsezz/try-catch` (`tca` for async, `tc` for sync) instead of handwritten `try/catch` or Promise `.catch()` chains, including scripts. Pass HTTP failures to the global handler. Inspect every result and preserve cleanup even after a failure; use test lifecycle hooks for fixtures. ESLint enforces the convention. Do not silently substitute successful results.
- Keep Prisma/provider error translation separate from the global HTTP handler. Return only shared error codes, safe messages and request IDs.

## Review and validation

- Use English code comments and PR descriptions; explain non-obvious logic in the German learning documentation.
- Keep changes reviewable. Maintain the existing review PR and do not merge without an explicit instruction.
- Run `npm run format:check`, `npm run check`, `npm test` and the live smoke check for relevant backend changes. Check the final GitHub CI result.
- Test omitted fields, empty patches, null/false values, limits, malformed input, authorization, database failures and concurrent operations when affected.
- Start the actual API and verify PostgreSQL/Docker availability. Distinguish a local runtime problem from an application failure; record exactly what was tested.
- Tests must use isolated randomly named databases and clean up only fixtures they created. Keep local credentials, personal notes, dumps and generated code outside Git.
- Update README/API/learning docs when behavior changes. Apply general review feedback consistently across analogous code paths.
