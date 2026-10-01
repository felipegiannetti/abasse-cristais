import { defineConfig } from 'vitest/config';

// Unit tests for pure business-logic functions (money math, slugs, input normalization). The
// end-to-end/security behavior of the API as a whole is covered by test/security.mjs instead.
//
// The files under test are NestJS services, so importing them runs their `@Injectable()` class
// decorators at module load time (nothing is ever instantiated here, just defined) — Vitest's
// default transform (oxc) parses that syntax without extra configuration.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
