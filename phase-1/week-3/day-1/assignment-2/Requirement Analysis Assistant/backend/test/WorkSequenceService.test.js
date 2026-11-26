const test = require('node:test');
const assert = require('node:assert/strict');
const { WorkSequenceService } = require('../src/planning/WorkSequenceService');
const { buildDependencyGraph } = require('../src/planning/DependencyGraph');

function requirement(id) {
  return { id, title: id, priority: 'High', dependencies: [] };
}

function analysis(id, readiness = 'READY_FOR_TEST_DESIGN', blockingQuestion = false) {
  return {
    requirementId: id,
    testDesignReadiness: readiness,
    clarificationQuestions: blockingQuestion ? [{ blocksTestDesign: true }] : [],
    testReadinessReasoning: 'The requirement analysis supports the recommendation.'
  };
}

function priority(requirementId, score) {
  return { requirementId, score, rankingStatus: 'RANKED' };
}

test('sequences prerequisites first and groups independent ready work in parallel', () => {
  const requirements = [requirement('APP-1'), requirement('APP-2'), requirement('APP-3')];
  const graph = buildDependencyGraph(requirements, [{
    id: 'block',
    prerequisiteId: 'APP-1',
    dependentId: 'APP-3',
    impact: 'BOTH',
    source: 'jira',
    status: 'explicit'
  }]);
  const result = new WorkSequenceService().create(
    requirements,
    graph,
    new Map(requirements.map((item) => [item.id, analysis(item.id)])),
    new Map(requirements.map((item, index) => [item.id, priority(item.id, 100 - index)]))
  );
  assert.deepEqual(result.waves, [
    { wave: 1, requirementIds: ['APP-1', 'APP-2'] },
    { wave: 2, requirementIds: ['APP-3'] }
  ]);
  assert.equal(result.items.find((item) => item.requirementId === 'APP-1').parallelGroup, 1);
  assert.deepEqual(result.items.find((item) => item.requirementId === 'APP-3').prerequisites, ['APP-1']);
});

test('does not schedule cycle members, externally blocked items, or unclear requirements as ready work', () => {
  const requirements = [requirement('APP-1'), requirement('APP-2'), requirement('APP-3'), requirement('APP-4')];
  const graph = buildDependencyGraph(requirements, [
    { id: 'cycle-a', prerequisiteId: 'APP-1', dependentId: 'APP-2', impact: 'BOTH', source: 'jira', status: 'explicit' },
    { id: 'cycle-b', prerequisiteId: 'APP-2', dependentId: 'APP-1', impact: 'BOTH', source: 'jira', status: 'explicit' },
    { id: 'external', prerequisiteId: 'APP-9', dependentId: 'APP-3', impact: 'BOTH', source: 'jira', status: 'explicit' }
  ]);
  const result = new WorkSequenceService().create(
    requirements,
    graph,
    new Map([
      ['APP-1', analysis('APP-1')],
      ['APP-2', analysis('APP-2')],
      ['APP-3', analysis('APP-3')],
      ['APP-4', analysis('APP-4', 'NOT_READY', true)]
    ]),
    new Map()
  );
  assert.equal(result.items.find((item) => item.requirementId === 'APP-1').action, 'RESOLVE_DEPENDENCY_CYCLE');
  assert.equal(result.items.find((item) => item.requirementId === 'APP-2').action, 'RESOLVE_DEPENDENCY_CYCLE');
  assert.equal(result.items.find((item) => item.requirementId === 'APP-3').action, 'INVESTIGATE_EXTERNAL_DEPENDENCY');
  assert.equal(result.items.find((item) => item.requirementId === 'APP-4').action, 'CLARIFY_WITH_PRODUCT_OWNER');
  assert.equal(result.waves.flatMap((wave) => wave.requirementIds).includes('APP-1'), false);
});

test('marks missing Phase 2 readiness as insufficient information', () => {
  const requirements = [requirement('APP-1')];
  const graph = buildDependencyGraph(requirements, []);
  const [item] = new WorkSequenceService().create(requirements, graph, new Map(), new Map()).items;
  assert.equal(item.action, 'INSUFFICIENT_INFORMATION');
});
