import { normalizeRepositoryPath } from '../security/paths.js';
import { validateDocument, validateTaskDefinition } from '../schema/validate.js';
import type { TaskDefinition } from '../state/types.js';

export class TaskPlanError extends Error {}
/** @deprecated Retained for callers that imported the Lite-era error name. */
export class LiteTaskPlanError extends TaskPlanError {}

export function validateTaskPlan(value: unknown, revisionPolicy: (task: TaskDefinition) => string | undefined): TaskDefinition[] {
  const document = validateDocument('task-plan', value);
  if (!document.ok) throw new TaskPlanError(`Task plan is schema-invalid: ${document.details.join('; ')}`);
  const tasks = (document.value as { tasks: TaskDefinition[] }).tasks;
  if (tasks.length === 0) throw new TaskPlanError('Task plan must contain at least one task');
  const ids = new Set<string>();
  for (const task of tasks) {
    const validation = validateTaskDefinition(task);
    if (!validation.ok) throw new TaskPlanError(`Task ${task.id} is invalid: ${validation.details.join('; ')}`);
    if (ids.has(task.id)) throw new TaskPlanError(`Task plan has duplicate task id: ${task.id}`);
    ids.add(task.id);
    if (task.acceptance.length === 0 || task.gateIds.length !== 1) throw new TaskPlanError(`Task ${task.id} must declare acceptance and exactly one gate`);
    if (task.state !== (task.dependsOn.length === 0 ? 'ready' : 'pending') || task.dependsOn.includes(task.id)) throw new TaskPlanError(`Task ${task.id} has invalid dependency initial state`);
    for (const path of task.allowedPaths) if (normalizeRepositoryPath(path) !== path) throw new TaskPlanError(`Task ${task.id} has a non-normalized allowed path`);
    const revisionError = revisionPolicy(task); if (revisionError) throw new TaskPlanError(revisionError);
  }
  for (const task of tasks) for (const dependency of task.dependsOn) if (!ids.has(dependency)) throw new TaskPlanError(`Task ${task.id} depends on missing task ${dependency}`);
  const visiting = new Set<string>(); const complete = new Set<string>(); const byId = new Map(tasks.map((task) => [task.id, task]));
  const visit = (id: string): void => {
    if (complete.has(id)) return;
    if (visiting.has(id)) throw new TaskPlanError(`Task plan has a dependency cycle at ${id}`);
    visiting.add(id); for (const dependency of byId.get(id)!.dependsOn) visit(dependency); visiting.delete(id); complete.add(id);
  };
  for (const task of tasks) visit(task.id);
  const integrations = tasks.filter((task) => task.role === 'integration');
  if (integrations.length > 1) throw new TaskPlanError('Task plan has more than one integration task');
  const integration = integrations[0];
  if (integration) {
    if (tasks.some((task) => task.id !== integration.id && task.dependsOn.includes(integration.id))) throw new TaskPlanError('Integration task cannot have successors');
    const dependencies = new Set<string>();
    const collect = (id: string): void => { for (const dependency of byId.get(id)!.dependsOn) if (!dependencies.has(dependency)) { dependencies.add(dependency); collect(dependency); } };
    collect(integration.id);
    if (tasks.some((task) => task.id !== integration.id && !dependencies.has(task.id))) throw new TaskPlanError('Integration task must transitively depend on every other task');
  }
  return tasks;
}

export const validateLiteTaskPlan = validateTaskPlan;
