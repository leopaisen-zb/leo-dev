import type { RouteOptions } from '../../packages/cli/src/routing/score.js';

const now = new Date('2026-09-05T12:00:00.000Z');
const waiver = {};

const noOverride = { now } satisfies RouteOptions;
const requestedRiskOnly = { now, requestedRisk: 'standard' } satisfies RouteOptions;
const changeLowering = { now, requestedRisk: 'lite', waiver, scope: 'change', changeId: 'change' } satisfies RouteOptions;
const taskLowering = { now, requestedRisk: 'lite', waiver, scope: 'task', changeId: 'change', taskId: 'task' } satisfies RouteOptions;
void [noOverride, requestedRiskOnly, changeLowering, taskLowering];

// @ts-expect-error no-request state forbids waiver metadata
const noRequestWaiver: RouteOptions = { now, waiver };
// @ts-expect-error requested-only state forbids waiver metadata
const requestedWaiver: RouteOptions = { now, requestedRisk: 'lite', waiver };
// @ts-expect-error requested-only state forbids task target metadata
const requestedTaskTarget: RouteOptions = { now, requestedRisk: 'lite', scope: 'task', changeId: 'change', taskId: 'task' };
// @ts-expect-error scope is a closed discriminant
const invalidScope: RouteOptions = { now, requestedRisk: 'lite', waiver, scope: 'project', changeId: 'change' };
// @ts-expect-error change lowering forbids taskId
const changeWithTaskId: RouteOptions = { now, requestedRisk: 'lite', waiver, scope: 'change', changeId: 'change', taskId: 'task' };
// @ts-expect-error lowering requires waiver
const missingWaiver: RouteOptions = { now, requestedRisk: 'lite', scope: 'task', changeId: 'change', taskId: 'task' };
// @ts-expect-error change lowering requires changeId
const missingChangeId: RouteOptions = { now, requestedRisk: 'lite', waiver, scope: 'change' };
// @ts-expect-error task lowering requires taskId
const missingTaskId: RouteOptions = { now, requestedRisk: 'lite', waiver, scope: 'task', changeId: 'change' };
void [noRequestWaiver, requestedWaiver, requestedTaskTarget, invalidScope, changeWithTaskId, missingWaiver, missingChangeId, missingTaskId];
