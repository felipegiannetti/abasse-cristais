// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // prisma/*.ts (run standalone via ts-node) and test/security.mjs (a plain Node script) aren't part
  // of the src/ tsconfig project, so type-aware linting can't cover them without a second tsconfig.
  { ignores: ['eslint.config.mjs', 'vitest.config.ts', 'vitest.setup.ts', 'dist/**', 'prisma/**', 'test/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
