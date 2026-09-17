import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    include: [
      'tests/changes/design-events.test.ts',
      'tests/schema/validation.test.ts',
      'tests/cli/codex-design.test.ts',
      'tests/cli/codex-claim-continuation.test.ts',
      'tests/cli/codex-claim-continuation-integrity.test.ts',
      'tests/cli/crash-atomicity.test.ts',
      'tests/state/recovery.test.ts',
      'tests/state/fencing.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'packages/cli/src/changes/design-admission.ts',
        'packages/cli/src/changes/design-events.ts',
        'packages/cli/src/changes/design-policy.ts',
        'packages/cli/src/schema/validate.ts',
      ],
      reportsDirectory: 'coverage/quality',
      reporter: ['text', 'json', 'html'],
    },
  },
});
