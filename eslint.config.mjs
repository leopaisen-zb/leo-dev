import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: [
      'packages/cli/src/changes/design-admission.ts',
      'packages/cli/src/changes/design-events.ts',
      'packages/cli/src/changes/design-policy.ts',
      'packages/cli/src/schema/validate.ts',
    ],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
);
