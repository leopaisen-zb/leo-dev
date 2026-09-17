# P2 filesystem review diff

Before: /private/tmp/leo-dev-production-before.Y5JjLF. After: current source. No HEAD/commit range exists. New P2 files: governance-report.md (separate input).

```diff
--- /private/tmp/leo-dev-production-before.Y5JjLF/packages/cli/src/controller/controller.ts	2026-09-10 17:10:32
+++ packages/cli/src/controller/controller.ts	2026-09-11 12:02:40
@@ -205,6 +205,10 @@
   };
   for (const task of tasks) visit(task.id);
   return tasks;
+}
+
+function planAssessmentTaskId(tasks: TaskDefinition[]): string {
+  return `plan:${fingerprint(tasks)}`;
 }
 
 const journalHashPattern = /^[a-f0-9]{64}$/;
@@ -550,6 +554,7 @@
     if (command === 'run-gates') boundedGateOutput(options.maxOutputBytes);
     if (command === 'claim') positiveInteger(options.ttl, 300_000, '--ttl');
     let plannedRecovery = false;
+    let routeDryRunState: RecordValue | undefined;
     if (command === 'init') {
       plannedRecovery = (await this.planInitialization(repositoryRoot, changeId!, options)).pendingAuthority;
     }
@@ -620,10 +625,15 @@
         if (lifecycle.changeState !== 'triage') throw new ControllerError(3, 'TRANSITION_FORBIDDEN', 'Lite routing is only available from triage', lifecycle);
         if (latestPayload<Routed>(events, 'route.selected')) throw new ControllerError(5, 'CONFLICT', 'This Lite change is already routed', lifecycle);
         if (planReference) {
-          if (options.assessment !== undefined || this.assessmentHistory(events).length > 0) throw new ControllerError(7, 'ASSESSMENT_REQUIRED', 'Plan routing with supplied or historical governance assessment is unsupported in C2', await this.state(repositoryRoot, changeId, events));
           const planPath = resolve(repositoryRoot, planReference);
           try { await assertContained(repositoryRoot, planPath); } catch { throw new ControllerError(2, 'VALIDATION_ERROR', `Plan path escapes repository: ${planPath}`); }
-          for (const task of validatePlanTasks(await loadYaml(planPath))) registry.get(task.gateIds[0]!);
+          const tasks = validatePlanTasks(await loadYaml(planPath));
+          for (const task of tasks) registry.get(task.gateIds[0]!);
+          const governance = await this.governanceAdmission(repositoryRoot, changeId, planAssessmentTaskId(tasks), options, events);
+          const planAssessmentContext = await this.planAssessmentContext(repositoryRoot, changeId, events, planAssessmentTaskId(tasks), governance.recorded);
+          if (!governance.recorded && governance.previous) this.governanceRefusal(governance.previous.disposition === 'approval-required' ? 'approval-required' : 'assessment-required', { ...(await this.state(repositoryRoot, changeId, events)), planAssessmentContext });
+          if (governance.recorded && governance.recorded.disposition !== 'ready') this.governanceRefusal(governance.recorded.disposition, { ...(await this.state(repositoryRoot, changeId, events)), planAssessmentContext });
+          routeDryRunState = { ...(await this.state(repositoryRoot, changeId, events)), planAssessmentContext };
         } else {
           registry.get(gateId!);
           const governance = await this.governanceAdmission(repositoryRoot, changeId, routeTaskId!, options, events);
@@ -691,7 +701,7 @@
         }
       }
     }
-    return result('DRY_RUN', { command, changeId: changeId ?? null, planned: true, plannedRecovery, writes: [] });
+    return result('DRY_RUN', { ...(routeDryRunState ?? {}), command, changeId: changeId ?? null, planned: true, plannedRecovery, writes: [] });
   }
 
   private async readEvents(repositoryRoot: string, changeId: string, allowIncompleteTail = false, allowPendingGateHandoff = false, allowSpecDrift = false, allowPendingControllerBatch = false): Promise<JournalEvent[]> {
@@ -837,6 +847,11 @@
     };
   }
 
+  private async planAssessmentContext(repositoryRoot: string, changeId: string, events: JournalEvent[], taskId: string, candidate?: RecordedAssessment): Promise<RecordValue> {
+    const context = await this.governanceState(repositoryRoot, changeId, events);
+    return { ...context, taskId, status: candidate?.disposition ?? context.status };
+  }
+
   private governanceRefusal(disposition: 'approval-required' | 'assessment-required' | 'local-remediation-required', state: unknown): never {
     if (disposition === 'approval-required') throw new ControllerError(6, 'APPROVAL_REQUIRED', 'Governance admission requires a scope-specific user decision; an ordinary receipt or later ready assessment cannot authorize material work', state);
     if (disposition === 'local-remediation-required') throw new ControllerError(7, 'LOCAL_REMEDIATION_REQUIRED', 'Governance assessment requires a bounded local repair before Lite task admission', state);
@@ -1444,23 +1459,22 @@
     const lifecycle = reduceJournal(events);
     if (lifecycle.changeState !== 'triage') throw new ControllerError(3, 'TRANSITION_FORBIDDEN', 'Lite routing is only available from triage', lifecycle);
     if (latestPayload<Routed>(events, 'route.selected')) throw new ControllerError(5, 'CONFLICT', 'This Lite change is already routed', lifecycle);
-    if (planReference && (options.assessment !== undefined || this.assessmentHistory(events).length > 0)) throw new ControllerError(7, 'ASSESSMENT_REQUIRED', 'Plan routing with supplied or historical governance assessment is unsupported in C2', await this.state(repositoryRoot, changeId, events));
-    const governance: { recorded?: RecordedAssessment; previous?: RecordedAssessment; subjectTreeHash: string } = planReference
-      ? { subjectTreeHash: (await canonicalTreeHash(repositoryRoot)).hash }
-      : await this.governanceAdmission(repositoryRoot, changeId, taskId!, options, events);
-    if (!governance.recorded && governance.previous) {
-      const state = await this.state(repositoryRoot, changeId, events);
-      this.governanceRefusal(governance.previous.disposition === 'approval-required' ? 'approval-required' : 'assessment-required', state);
-    }
-    const registryPath = resolve(repositoryRoot, typeof options.registry === 'string' ? options.registry : 'core/gates/default.yaml');
-    await assertContained(repositoryRoot, registryPath);
-    const registry = await GateRegistry.fromYaml(registryPath);
-    let tasks: TaskDefinition[];
+    let tasks: TaskDefinition[] | undefined;
     if (planReference) {
       const planPath = resolve(repositoryRoot, planReference);
       try { await assertContained(repositoryRoot, planPath); } catch { throw new ControllerError(2, 'VALIDATION_ERROR', `Plan path escapes repository: ${planPath}`); }
       tasks = validatePlanTasks(await loadYaml(planPath));
-    } else tasks = [{ id: taskId!, revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['.'], acceptance: ['The approved Lite task acceptance is satisfied'], gateIds: [gateId!], risk: 'lite' }];
+    }
+    const registryPath = resolve(repositoryRoot, typeof options.registry === 'string' ? options.registry : 'core/gates/default.yaml');
+    await assertContained(repositoryRoot, registryPath);
+    const registry = await GateRegistry.fromYaml(registryPath);
+    if (tasks) for (const task of tasks) registry.get(task.gateIds[0]!);
+    const governance = await this.governanceAdmission(repositoryRoot, changeId, tasks ? planAssessmentTaskId(tasks) : taskId!, options, events);
+    if (!governance.recorded && governance.previous) {
+      const state = await this.state(repositoryRoot, changeId, events);
+      this.governanceRefusal(governance.previous.disposition === 'approval-required' ? 'approval-required' : 'assessment-required', state);
+    }
+    tasks ??= [{ id: taskId!, revision: 1, state: 'ready', dependsOn: [], allowedPaths: ['.'], acceptance: ['The approved Lite task acceptance is satisfied'], gateIds: [gateId!], risk: 'lite' }];
     const routeds = tasks.map((task) => {
       const validation = validateTaskDefinition(task);
       if (!validation.ok) validationError(validation.details, 'task');
--- /private/tmp/leo-dev-production-before.Y5JjLF/tests/cli/codex-plan.test.ts	2026-09-09 10:11:52
+++ tests/cli/codex-plan.test.ts	2026-09-11 12:05:36
@@ -1,13 +1,16 @@
+import { createHash } from 'node:crypto';
 import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
 import { spawnSync } from 'node:child_process';
 import { join, resolve } from 'node:path';
 import { tmpdir } from 'node:os';
 import { afterEach, expect, test } from 'vitest';
+import { Controller } from '../../packages/cli/src/controller/controller.js';
 
 const repository = resolve(import.meta.dirname, '../..');
 const executable = join(repository, 'packages/cli/dist/index.js');
 const owned: string[] = [];
 const task = (id: string, dependsOn: string[] = []) => ({ id, revision: 1, state: dependsOn.length ? 'pending' : 'ready', dependsOn, allowedPaths: ['src'], acceptance: [`Implement ${id}`], gateIds: ['pass'], risk: 'lite' });
+const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
 
 function cli(root: string, ...args: string[]) {
   const run = spawnSync(process.execPath, [executable, ...args, '--repo', root, '--json'], { cwd: repository, encoding: 'utf8', timeout: 15_000 });
@@ -36,6 +39,35 @@
   return root;
 }
 
+type PlanContext = { taskId: string; specHash: string; subjectTreeHash: string; latestAssessmentFingerprint: string | null; status: string };
+
+function planDryRun(root: string) {
+  return cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--dry-run');
+}
+
+function contextFrom(dry: ReturnType<typeof planDryRun>): PlanContext {
+  return (dry.result.state.planAssessmentContext as PlanContext);
+}
+
+async function planAssessment(root: string, context: PlanContext, overrides: Record<string, unknown> = {}): Promise<string> {
+  const document = {
+    schemaVersion: 1,
+    assessmentId: 'assessment-plan',
+    changeId: 'plan',
+    taskId: context.taskId,
+    specHash: context.specHash,
+    subjectTreeHash: context.subjectTreeHash,
+    coverage: 'complete',
+    findings: [{
+      id: 'legacy', severity: 'low', relation: 'unrelated', boundary: 'legacy boundary', rationale: 'not caused by this plan',
+      evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'local',
+    }],
+    ...overrides,
+  };
+  await writeFile(join(root, '.leo-dev/runtime/plan/assessment-input.yaml'), JSON.stringify(document));
+  return '.leo-dev/runtime/plan/assessment-input.yaml';
+}
+
 afterEach(async () => { await Promise.all(owned.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
 
 test('plan-only dry-run validates the same route without writing projections or journal', async () => {
@@ -66,14 +98,104 @@
   expect(cli(root, 'status', '--change', 'plan').result.state.tasks).toEqual({});
 }, 20_000);
 
-test('plan route refuses composite governance and ambiguous legacy flags without writes', async () => {
+test('ready assessment admits a dependent plan through the compiled CLI and dry-run publishes its plan scope', async () => {
   const root = await fixture([task('a'), task('b', ['a'])]);
   const before = await contents(root);
-  const assessed = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', 'assessment.json');
-  expect(assessed.status, JSON.stringify(assessed.result)).toBe(7);
-  expect(assessed.result.code).toBe('ASSESSMENT_REQUIRED');
-  expect(assessed.result.errors[0].message).toContain('unsupported');
+  const dry = planDryRun(root);
+  expect(dry.status, JSON.stringify(dry.result)).toBe(0);
+  expect(contextFrom(dry)).toMatchObject({
+    taskId: expect.stringMatching(/^plan:[a-f0-9]{64}$/),
+    specHash: expect.stringMatching(/^[a-f0-9]{64}$/),
+    subjectTreeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
+    status: 'not-assessed',
+  });
+  expect(await contents(root)).toEqual(before);
+  const input = await planAssessment(root, contextFrom(dry));
+  const routed = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', input);
+  expect(routed.status, JSON.stringify(routed.result)).toBe(0);
+  expect(routed.result.state).toMatchObject({
+    tasks: { a: { state: 'ready' }, b: { state: 'pending' } },
+    assessmentContext: { status: 'ready' },
+  });
+}, 20_000);
+
+test.each([
+  ['partial', { coverage: 'partial' }, 7, 'ASSESSMENT_REQUIRED'],
+  ['unknown repair scope', { findings: [{ id: 'unknown', severity: 'low', relation: 'required-by-change', boundary: 'affected', rationale: 'unknown scope', evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'unknown' }] }, 7, 'ASSESSMENT_REQUIRED'],
+  ['local high finding', { findings: [{ id: 'high', severity: 'high', relation: 'worsened-by-change', boundary: 'affected', rationale: 'repair first', evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'local' }] }, 7, 'LOCAL_REMEDIATION_REQUIRED'],
+  ['material finding', { findings: [{ id: 'material', severity: 'low', relation: 'required-by-change', boundary: 'affected', rationale: 'material decision', evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'material' }] }, 6, 'APPROVAL_REQUIRED'],
+])('records %s assessment but selects no plan routes', async (_name, overrides, status, code) => {
+  const root = await fixture([task('a'), task('b', ['a'])]);
+  const input = await planAssessment(root, contextFrom(planDryRun(root)), overrides);
+  const refused = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', input);
+  expect(refused.status, JSON.stringify(refused.result)).toBe(status);
+  expect(refused.result.code).toBe(code);
+  expect(refused.result.state).toMatchObject({ tasks: {}, route: null });
+}, 20_000);
+
+test('a recorded plan refusal cannot be bypassed by omitting assessment and dry-run keeps the scoped refusal visible without writes', async () => {
+  const root = await fixture([task('a'), task('b', ['a'])]);
+  const input = await planAssessment(root, contextFrom(planDryRun(root)), { coverage: 'partial' });
+  expect(cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', input).status).toBe(7);
+  const before = await contents(root);
+  const bypass = planDryRun(root);
+  expect(bypass.status, JSON.stringify(bypass.result)).toBe(7);
+  expect(bypass.result.code).toBe('ASSESSMENT_REQUIRED');
+  expect(bypass.result.state).toMatchObject({
+    assessmentContext: { status: 'assessment-required' },
+    planAssessmentContext: { taskId: expect.stringMatching(/^plan:/), status: 'assessment-required' },
+  });
+  expect(await contents(root)).toEqual(before);
+}, 20_000);
+
+test('rejects an assessment scoped to a different validated plan without route or assessment writes', async () => {
+  const root = await fixture([task('a'), task('b', ['a'])]);
+  const context = contextFrom(planDryRun(root));
+  const input = await planAssessment(root, context);
+  await writeFile(join(root, 'other-plan.json'), JSON.stringify({ schemaVersion: 1, tasks: [task('a'), task('b', ['a']), task('c', ['b'])] }));
+  const before = await contents(root);
+  const stale = cli(root, 'route', '--change', 'plan', '--plan', 'other-plan.json', '--assessment', input);
+  expect(stale.status, JSON.stringify(stale.result)).toBe(5);
+  expect(stale.result.code).toBe('CONFLICT');
+  expect(await contents(root)).toEqual(before);
+}, 20_000);
+
+test('requires a linked successor to clear a plan-local high finding before admitting its dependent tasks', async () => {
+  const root = await fixture([task('a'), task('b', ['a'])]);
+  const firstContext = contextFrom(planDryRun(root));
+  const first = await planAssessment(root, firstContext, {
+    findings: [{ id: 'high', severity: 'high', relation: 'worsened-by-change', boundary: 'affected', rationale: 'repair first', evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'local' }],
+  });
+  expect(cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', first).status).toBe(7);
+  await writeFile(join(root, 'resolved.md'), 'fresh plan repair evidence\n');
+  const previous = cli(root, 'status', '--change', 'plan').result.state.assessmentContext as PlanContext;
+  const successor = await planAssessment(root, { ...previous, taskId: firstContext.taskId }, {
+    assessmentId: 'assessment-plan-successor',
+    previousAssessmentFingerprint: previous.latestAssessmentFingerprint,
+    findings: [{ id: 'high', severity: 'low', relation: 'unrelated', boundary: 'affected', rationale: 'repair complete', evidence: [{ path: 'spec.md', sha256: sha256('# Synthetic plan validation fixture\n') }], repairScope: 'local' }],
+    resolutions: [{ findingId: 'high', rationale: 'new evidence for the bounded repair', evidence: [{ path: 'resolved.md', sha256: sha256('fresh plan repair evidence\n') }] }],
+  });
+  const routed = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--assessment', successor);
+  expect(routed.status, JSON.stringify(routed.result)).toBe(0);
+  expect(routed.result.state).toMatchObject({ tasks: { a: { state: 'ready' }, b: { state: 'pending' } }, assessmentContext: { status: 'ready' } });
+}, 20_000);
+
+test('recovers an interrupted ready plan assessment-and-route batch without splitting its projections', async () => {
+  const root = await fixture([task('a'), task('b', ['a'])]);
+  const input = await planAssessment(root, contextFrom(planDryRun(root)));
+  await expect(new Controller().execute('route', { repo: root, change: 'plan', plan: 'plan.json', assessment: input, faultAt: 'after-batch-projection' })).rejects.toMatchObject({ publicCode: 'INTERNAL_ERROR' });
+  const resumed = cli(root, 'resume', '--change', 'plan');
+  expect(resumed.status, JSON.stringify(resumed.result)).toBe(0);
+  expect(resumed.result.state).toMatchObject({ tasks: { a: { state: 'ready' }, b: { state: 'pending' } }, assessmentContext: { status: 'ready' } });
+}, 20_000);
+
+test('unassessed legacy plans remain explicitly not-assessed and ambiguous legacy flags still fail validation', async () => {
+  const root = await fixture([task('a'), task('b', ['a'])]);
+  const routed = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json');
+  expect(routed.status, JSON.stringify(routed.result)).toBe(0);
+  expect(routed.result.state).toMatchObject({ assessmentContext: { status: 'not-assessed' } });
+  const second = await fixture([task('a'), task('b', ['a'])]);
   const ambiguous = cli(root, 'route', '--change', 'plan', '--plan', 'plan.json', '--task', 'a', '--gate', 'pass');
   expect(ambiguous.status, JSON.stringify(ambiguous.result)).toBe(2);
-  expect(await contents(root)).toEqual(before);
+  expect(cli(second, 'route', '--change', 'plan', '--plan', 'plan.json', '--task', 'a', '--gate', 'pass').status).toBe(2);
 }, 20_000);

```

