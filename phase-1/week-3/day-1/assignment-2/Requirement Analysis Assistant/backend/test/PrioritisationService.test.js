const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PrioritisationService,
  DEFAULT_PRIORITY_WEIGHTS,
  validateWeights
} = require('../src/planning/PrioritisationService');

function graphFor(id, { dependencies = [], known = true } = {}) {
  return {
    edges: dependencies,
    relationships: [{
      requirementId: id,
      directPrerequisites: dependencies.filter((edge) => edge.dependentId === id).map((edge) => edge.prerequisiteId),
      directDependents: dependencies.filter((edge) => edge.prerequisiteId === id).map((edge) => edge.dependentId)
    }],
    known
  };
}

test('normalizes scores from only known evidence and reports factor coverage', () => {
  const service = new PrioritisationService();
  const ranked = service.rank(
    [{ id: 'APP-1', priority: 'High', dependencies: [] }],
    new Map([['APP-1', { testDesignReadiness: 'READY_FOR_TEST_DESIGN', testReadinessReasoning: 'Assessment supports design.' }]]),
    new Map(),
    graphFor('APP-1')
  ).items[0];
  assert.equal(ranked.rankingStatus, 'RANKED');
  assert.equal(ranked.evidenceCoverage, 60);
  assert.equal(ranked.factors.businessCriticality.score, null);
  assert.equal(ranked.factors.risk.score, null);
  assert.equal(ranked.factors.dependencyImpact.score, 0);
  assert.equal(ranked.score, Math.round((75 * 20 + 0 * 25 + 100 * 15) / 60));
});

test('does not turn missing priority, dependency, readiness, risk, or criticality into zero', () => {
  const ranked = new PrioritisationService().rank(
    [{ id: 'APP-1', priority: null, dependencies: null }],
    new Map(),
    new Map([['APP-1', {
      businessCriticality: 'UNKNOWN',
      risk: 'UNKNOWN',
      criticalityEvidence: 'Cannot assess from available evidence.',
      riskEvidence: 'Cannot assess from available evidence.',
      confidence: 'HIGH'
    }]]),
    graphFor('APP-1')
  ).items[0];
  assert.equal(ranked.rankingStatus, 'UNRANKED');
  assert.equal(ranked.score, null);
  assert.equal(ranked.evidenceCoverage, 0);
  Object.values(ranked.factors).forEach((factor) => assert.equal(factor.score, null));
});

test('uses validated business weights and rejects invalid totals or keys', () => {
  assert.equal(Object.values(DEFAULT_PRIORITY_WEIGHTS).reduce((sum, value) => sum + value, 0), 100);
  assert.deepEqual(validateWeights({ ...DEFAULT_PRIORITY_WEIGHTS }), DEFAULT_PRIORITY_WEIGHTS);
  assert.throws(() => validateWeights({ ...DEFAULT_PRIORITY_WEIGHTS, risk: 11 }), /total exactly 100/);
  assert.throws(() => validateWeights({ ...DEFAULT_PRIORITY_WEIGHTS, extra: 0 }), /exactly/);
  assert.throws(() => validateWeights({ ...DEFAULT_PRIORITY_WEIGHTS, risk: Number.NaN }), /finite numbers/);
});
