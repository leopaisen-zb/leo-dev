import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';
import { portableFiles } from '../../scripts/build-adapters.mjs';
import { upstreamPortableFiles } from '../../scripts/upstream-resources.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const skillDirectory = join(root, 'skills/develop');
const references = Object.freeze([
  'references/acceptance.md', 'references/autonomous-execution.md', 'references/components.md',
  'references/codex-team.md',
  'references/delivery.md', 'references/gates.md', 'references/host-subagents.md', 'references/lifecycle.md',
  'references/review-protocol.md', 'references/upstream-methods.md',
]);
const authorityCategories = Object.freeze([
  'deploy', 'push', 'PR', 'merge', 'publication', 'paid service', 'credential expansion',
  'permission expansion', 'destructive data action', 'irreversible data action',
]);
type Documents = {
  skill: string; lifecycle: string; gates: string; autonomy: string; delivery: string;
  review: string; components: string; acceptance: string;
};

async function loadDocuments(): Promise<Documents> {
  const read = (path: string) => readFile(join(skillDirectory, path), 'utf8');
  const [skill, lifecycle, gates, autonomy, delivery, review, components, acceptance] = await Promise.all([
    read('SKILL.md'), read('references/lifecycle.md'), read('references/gates.md'),
    read('references/autonomous-execution.md'), read('references/delivery.md'), read('references/review-protocol.md'),
    read('references/components.md'), read('references/acceptance.md'),
  ]);
  return { skill, lifecycle, gates, autonomy, delivery, review, components, acceptance };
}
function frontmatter(text: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  expect(match, 'SKILL.md must start with YAML frontmatter').toBeTruthy();
  return parse(match![1]);
}
function linkedReferences(text: string) {
  return [...text.matchAll(/\]\((references\/[\w-]+\.md)\)/g)].map((match) => match[1]);
}
function publicCommands(indexSource: string) {
  const match = /const commandNames = \[([^\]]+)\]/.exec(indexSource);
  if (!match) throw new Error('Unable to read public CLI command inventory');
  return new Set([...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]));
}
function documentedCommands(text: string) {
  return [...text.matchAll(/`leo-dev ([a-z-]+)(?:\s[^`]*)?`/g)].map((item) => item[1]);
}
function requireClause(text: string, clause: string, label: string) {
  if (!text.includes(clause)) throw new Error(`${label}: missing normative clause “${clause}”`);
}
function withoutMarkdownEmphasis(text: string) { return text.replaceAll('**', ''); }
function forbidClause(text: string, clause: string, label: string) {
  if (text.includes(clause)) throw new Error(`${label}: forbidden contradictory claim “${clause}”`);
}
function replaceRequired(text: string, before: string, after: string, label: string) {
  expect(text, `${label}: base clause must exist before mutation`).toContain(before);
  const changed = text.replace(before, after);
  expect(changed, `${label}: replacement must change the document`).not.toBe(text);
  return changed;
}
function requireAuthorityClause(text: string, category: string) {
  const line = text.split(/\r?\n/).find((candidate) => candidate.includes(category));
  if (!line || !line.includes('requires exact operation-specific authority')) {
    throw new Error(`authority/${category}: missing operation-specific stop clause`);
  }
}
function validateSemantics(documents: Documents, commands: Set<string>) {
  requireClause(documents.skill, '`develop` is the only public development entry.', 'single-entry');
  requireClause(documents.skill, 'Any product-code or behavior change enters the full cycle.', 'skill/full-cycle');
  requireClause(documents.skill, 'Direct answers and read-only review/diagnosis bypass durable change state.', 'skill/bypass');
  requireClause(documents.skill, 'Do not read every reference before starting.', 'skill/on-demand');
  requireClause(documents.lifecycle, 'Conceptual phases are not literal CLI commands.', 'lifecycle/conceptual');
  requireClause(documents.lifecycle, 'Artifacts are controller-created and controller-validated outputs, not a command.', 'lifecycle/artifacts');
  requireClause(documents.lifecycle, 'Existing change: run `leo-dev inspect --change <id>` or `leo-dev status --change <id>`, then use `leo-dev resume --change <id>` or the next supported command returned by state.', 'lifecycle/existing');
  requireClause(documents.lifecycle, 'New change: run `leo-dev init --change <id> --spec <path>`, then `leo-dev inspect --change <id>`, then the reviewed `leo-dev route` path.', 'lifecycle/new-change');
  requireClause(documents.lifecycle, '`route` accepts the legacy `--task/--gate` Lite form and a repository task plan.', 'lifecycle/route-forms');
  requireClause(documents.lifecycle, 'a caller must not silently downgrade a Standard/Full plan to use a Lite path.', 'risk/no-downgrade');
  requireClause(documents.lifecycle, 'Standard/Full must enter `design-review`, obtain a current design receipt, then enter `design-approved` before `task-ready`.', 'risk/design-review');
  requireClause(documents.gates, 'C2 enforcement applies to the supported routed controller path.', 'repair/policy');
  requireClause(documents.gates, 'Repair continues until the independent review passes or stalls with no new evidence.', 'repair/attempts');
  requireClause(documents.delivery, '`integration-review` is not release-ready.', 'release/evidence');
  requireClause(documents.review, 'Review specification compliance before code quality.', 'review/order');
  requireClause(documents.review, 'Journaled changes require a distinct platform session from the recorded implementer or a human receipt.', 'review/journaled');
  requireClause(documents.review, 'Standard/Full requires a distinct platform session from the recorded implementer or a human receipt; a missing implementer session cannot prove platform independence.', 'review/provenance');
  requireClause(documents.review, 'Full also requires current, candidate-bound architecture, security, and NFR assessments', 'review/full-assessments');
  requireClause(documents.review, 'Manager retains final-response ownership.', 'review/manager');
  requireClause(documents.components, 'Load stage methods by gap, not by brand name.', 'methods/loading');
  requireClause(documents.components, 'Do not inherit automatic worktree, commit, push, merge, hooks, telemetry, model, permission, or MCP changes.', 'methods/inheritance');
  requireClause(documents.components, 'leo-dev commit may create a local git commit', 'methods/local-commit');
  requireClause(documents.autonomy, 'Local commit is allowed only after independent review passes and evidence matches the current tree.', 'autonomy/local-commit');
  requireClause(documents.gates, 'Gate failure never authorizes test deletion, assertion weakening, threshold lowering, or hidden failures.', 'gate/safety');
  const delivery = withoutMarkdownEmphasis(documents.delivery);
  requireClause(delivery, '通过：本轮实际执行并符合验收要求。', 'evidence/passed');
  requireClause(delivery, '失败：实际执行但不符合验收要求。', 'evidence/failed');
  requireClause(delivery, '未执行：没有运行，不推测结果。', 'evidence/not-run');
  requireClause(delivery, '阻塞：缺少所需授权、依赖、设备或外部状态。', 'evidence/blocked');
  requireClause(delivery, '不适用：与本次类型/范围不相关，不算通过。', 'evidence/not-applicable');
  requireClause(delivery, '未执行必须报告为未执行，不能报告为通过。', 'evidence/not-run');
  requireClause(documents.acceptance, 'Select acceptance checks from project context and change risk; no universal checklist is mandatory.', 'acceptance/risk');
  for (const category of authorityCategories) requireAuthorityClause(documents.autonomy, category);

  forbidClause(documents.skill, 'Use BMAD as a second public workflow.', 'single-entry');
  forbidClause(documents.skill, 'truly tiny unambiguous edits', 'skill/tiny-edit');
  forbidClause(documents.lifecycle, 'A caller may silently downgrade a Standard/Full plan to use a Lite path.', 'risk/no-downgrade');
  forbidClause(documents.lifecycle, 'Standard/Full may enter task-ready without design review.', 'risk/design-review');
  forbidClause(documents.gates, 'C2 enforcement is limited to the supported Lite controller path.', 'repair/policy');
  forbidClause(documents.gates, 'Unlimited remediation attempts are allowed.', 'repair/attempts');
  forbidClause(documents.gates, 'At most two normal remediation attempts are allowed.', 'repair/attempts-cap');
  forbidClause(documents.gates, 'An additional fresh-context root-cause pass is allowed.', 'repair/root-cause');
  forbidClause(documents.delivery, '`integration-review` is release-ready.', 'release/evidence');
  forbidClause(documents.review, 'Review code quality before specification compliance.', 'review/order');
  forbidClause(documents.review, 'Same-session role-play is independent Standard/Full review.', 'review/provenance');
  forbidClause(documents.review, 'Lite allows clearly labelled self-review; actual independent review must be labelled accurately.', 'review/lite');
  forbidClause(documents.review, 'Full needs no candidate-bound architecture, security, and NFR assessments.', 'review/full-assessments');
  forbidClause(documents.components, 'Load Superpowers methods explicitly and selectively.', 'methods/loading');
  forbidClause(documents.components, 'Automatically inherit worktree, commit, push, merge, hooks, telemetry, model, permission, and MCP changes.', 'methods/inheritance');
  forbidClause(documents.gates, 'Gate failure authorizes test deletion, assertion weakening, threshold lowering, and hidden failures.', 'gate/safety');
  forbidClause(documents.delivery, 'Report not-run evidence as passed.', 'evidence/not-run');
  forbidClause(documents.delivery, '未执行可报告为通过。', 'evidence/not-run');
  forbidClause(documents.delivery, '不适用可报告为通过。', 'evidence/not-applicable');

  const documented = documentedCommands(`${documents.skill}\n${documents.lifecycle}`);
  for (const command of documented) if (!commands.has(command)) throw new Error(`lifecycle/command: leo-dev ${command} is not public`);
  if (documented.includes('artifacts')) throw new Error('lifecycle/command: leo-dev artifacts is forbidden');
  const init = documents.lifecycle.indexOf('`leo-dev init --change <id> --spec <path>`');
  const inspect = documents.lifecycle.indexOf('`leo-dev inspect --change <id>`', init);
  const route = documents.lifecycle.indexOf('`leo-dev route`', inspect);
  if (init < 0 || inspect < init || route < inspect) throw new Error('lifecycle/new-change: init must precede inspect and route');
}

describe('develop portable operating contract', () => {
  test('has an immutable portable reference inventory and valid frontmatter', async () => {
    const skill = await readFile(join(skillDirectory, 'SKILL.md'), 'utf8');
    expect(Object.isFrozen(references)).toBe(true);
    expect(frontmatter(skill)).toMatchObject({ name: 'develop' });
    const linked = linkedReferences(skill);
    for (const path of linked) expect(references, `linked ${path} must be in the frozen inventory`).toContain(path);
    expect(linked).toContain('references/host-subagents.md');
    expect([...portableFiles].sort()).toEqual(['SKILL.md', ...references, 'references/upstream/bmad-team-LICENSE.txt', ...upstreamPortableFiles].sort());
    await Promise.all(references.map(async (path) => expect((await stat(join(skillDirectory, path))).isFile()).toBe(true)));
  });

  test('maps literal lifecycle commands to the authoritative public CLI inventory', async () => {
    const [documents, index] = await Promise.all([loadDocuments(), readFile(join(root, 'packages/cli/src/index.ts'), 'utf8')]);
    const commands = publicCommands(index);
    expect(commands).toContain('init');
    expect(commands).toContain('inspect');
    expect(commands).toContain('route');
    expect(commands).not.toContain('artifacts');
    expect(() => validateSemantics(documents, commands)).not.toThrow();
  });

  test('tells Grok to spawn an independent reviewer subagent', async () => {
    const host = await readFile(join(skillDirectory, 'references/host-subagents.md'), 'utf8');
    expect(host).toContain('Grok Build');
    expect(host).toContain('spawn_subagent');
  });

  test('has explicit bypass, approved-spec reuse, one-question discovery, and authority boundaries', async () => {
    const { skill, autonomy } = await loadDocuments();
    expect(skill).not.toContain('truly tiny unambiguous edits');
    expect(skill).toContain('Direct answers and read-only review/diagnosis bypass durable change state.');
    expect(skill).toContain('Any product-code or behavior change enters the full cycle.');
    expect(skill).toContain('reuse it without a second interview or competing specification');
    expect(skill).toContain('ask exactly one highest-leverage material question at a time');
    expect(autonomy).toContain('A historic “continue” is not operation-specific approval.');
  });

  test('keeps domain and CLI Vitest isolated while routing npm filters only to final Vitest', async () => {
    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(packageJson.scripts.test).toBe('npm run test:controller --');
    const segments = packageJson.scripts['test:controller'].split(' && ');
    expect(segments).toHaveLength(4);
    expect(segments[0]).toBe('npm run build');
    expect(segments[1]).toBe('vitest run tests/changes tests/repository tests/routing tests/schema tests/state tests/gates');
    expect(segments[2]).toBe('node --test tests/**/*.test.mjs');
    expect(segments[3]).toBe('vitest run --no-file-parallelism tests/skill-contract tests/cli');
  });

  test('rejects replacement semantic inversions with the same validator', async () => {
    const [documents, index] = await Promise.all([loadDocuments(), readFile(join(root, 'packages/cli/src/index.ts'), 'utf8')]);
    const commands = publicCommands(index);
    const mutations: Array<[string, Documents]> = [
      ['second public workflow', { ...documents, skill: replaceRequired(documents.skill, '`develop` is the only public development entry.', '`develop` is one public development entry.', 'second public workflow') }],
      ['risk downgrade', { ...documents, lifecycle: replaceRequired(documents.lifecycle, 'a caller must not silently downgrade a Standard/Full plan to use a Lite path.', 'A caller may silently downgrade a Standard/Full plan to use a Lite path.', 'risk downgrade') }],
      ['missing design review', { ...documents, lifecycle: replaceRequired(documents.lifecycle, 'Standard/Full must enter `design-review`, obtain a current design receipt, then enter `design-approved` before `task-ready`.', 'Standard/Full may enter task-ready without design review.', 'missing design review') }],
      ['unsupported Lite-only repair', { ...documents, gates: replaceRequired(documents.gates, 'C2 enforcement applies to the supported routed controller path.', 'C2 enforcement is limited to the supported Lite controller path.', 'unsupported Lite-only repair') }],
      ['tiny-edit bypass', { ...documents, skill: replaceRequired(documents.skill, 'Direct answers and read-only review/diagnosis bypass durable change state.', 'Direct answers, read-only review/diagnosis, or truly tiny unambiguous edits bypass durable change state.', 'tiny-edit bypass') }],
      ['capped repair', { ...documents, gates: replaceRequired(documents.gates, 'Repair continues until the independent review passes or stalls with no new evidence.', 'At most two normal remediation attempts are allowed.', 'capped repair') }],
      ['mislabelled independent review', { ...documents, review: replaceRequired(documents.review, 'Journaled changes require a distinct platform session from the recorded implementer or a human receipt.', 'Lite allows clearly labelled self-review; actual independent review must be labelled accurately.', 'mislabelled independent review') }],
      ['brand-required methods', { ...documents, components: replaceRequired(documents.components, 'Load stage methods by gap, not by brand name.', 'Load Superpowers methods explicitly and selectively.', 'brand-required methods') }],
      ['missing Full assessments', { ...documents, review: replaceRequired(documents.review, 'Full also requires current, candidate-bound architecture, security, and NFR assessments', 'Full needs no candidate-bound architecture, security, and NFR assessments', 'missing Full assessments') }],
      ['release ready', { ...documents, delivery: replaceRequired(documents.delivery, '`integration-review` is not release-ready.', '`integration-review` is release-ready.', 'release ready') }],
    ];
    for (const [label, mutated] of mutations) expect(() => validateSemantics(mutated, commands), label).toThrow();
  });

  test('rejects contradictions appended after otherwise correct guidance', async () => {
    const [documents, index] = await Promise.all([loadDocuments(), readFile(join(root, 'packages/cli/src/index.ts'), 'utf8')]);
    const commands = publicCommands(index);
    const additions: Array<[string, Documents]> = [
      ['second workflow', { ...documents, skill: `${documents.skill}\nUse BMAD as a second public workflow.` }],
      ['risk downgrade', { ...documents, lifecycle: `${documents.lifecycle}\nA caller may silently downgrade a Standard/Full plan to use a Lite path.` }],
      ['missing design review', { ...documents, lifecycle: `${documents.lifecycle}\nStandard/Full may enter task-ready without design review.` }],
      ['Lite-only controller repair', { ...documents, gates: `${documents.gates}\nC2 enforcement is limited to the supported Lite controller path.` }],
      ['unlimited repair', { ...documents, gates: `${documents.gates}\nUnlimited remediation attempts are allowed.` }],
      ['capped repair', { ...documents, gates: `${documents.gates}\nAt most two normal remediation attempts are allowed.` }],
      ['tiny-edit bypass', { ...documents, skill: `${documents.skill}\ntruly tiny unambiguous edits` }],
      ['lite self-review', { ...documents, review: `${documents.review}\nLite allows clearly labelled self-review; actual independent review must be labelled accurately.` }],
      ['brand-required methods', { ...documents, components: `${documents.components}\nLoad Superpowers methods explicitly and selectively.` }],
      ['extra root-cause', { ...documents, gates: `${documents.gates}\nAn additional fresh-context root-cause pass is allowed.` }],
      ['release ready', { ...documents, delivery: `${documents.delivery}\n\`integration-review\` is release-ready.` }],
      ['review order', { ...documents, review: `${documents.review}\nReview code quality before specification compliance.` }],
      ['review role-play', { ...documents, review: `${documents.review}\nSame-session role-play is independent Standard/Full review.` }],
      ['missing Full assessments', { ...documents, review: `${documents.review}\nFull needs no candidate-bound architecture, security, and NFR assessments.` }],
      ['inherited automation', { ...documents, components: `${documents.components}\nAutomatically inherit worktree, commit, push, merge, hooks, telemetry, model, permission, and MCP changes.` }],
      ['unsafe gates', { ...documents, gates: `${documents.gates}\nGate failure authorizes test deletion, assertion weakening, threshold lowering, and hidden failures.` }],
      ['not-run passed', { ...documents, delivery: `${documents.delivery}\nReport not-run evidence as passed.` }],
      ['not-run Chinese passed', { ...documents, delivery: `${documents.delivery}\n未执行可报告为通过。` }],
      ['not-applicable Chinese passed', { ...documents, delivery: `${documents.delivery}\n不适用可报告为通过。` }],
    ];
    for (const [label, mutated] of additions) expect(() => validateSemantics(mutated, commands), label).toThrow();
  });
});
