import type { RiskRoute } from './score.js';

const title = (risk: string) => risk[0].toUpperCase() + risk.slice(1);

export function explainRisk(route: RiskRoute): string {
  const reasons = route.explanations.length === 0 ? 'No scored risk factors.' : route.explanations.join(' ');
  return `Baseline route: ${title(route.baselineRisk)}. Final route: ${title(route.finalRisk)}. Policy floor: ${title(route.policyFloor)}. Score: ${route.totalScore}. ${reasons}`;
}
