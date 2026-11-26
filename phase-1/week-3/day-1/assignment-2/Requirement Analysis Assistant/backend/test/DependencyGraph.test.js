const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractExplicitDependencies,
  buildDependencyGraph,
  makeSemanticEdges,
  edgeId
} = require('../src/planning/DependencyGraph');

function requirement(id, dependencies = []) {
  return { id, title: id, dependencies };
}

function link(key, type, direction, inward, outward) {
  return { key, type, direction, inward, outward };
}

test('interprets Jira blocks and is-blocked-by labels in the correct direction', () => {
  const edges = extractExplicitDependencies([
    requirement('APP-1', [link('APP-2', 'Blocks', 'outward', 'is blocked by', 'blocks')]),
    requirement('APP-3', [link('APP-4', 'Blocks', 'inward', 'is blocked by', 'blocks')])
  ]);
  assert.deepEqual(edges.map(({ prerequisiteId, dependentId }) => [prerequisiteId, dependentId]), [
    ['APP-1', 'APP-2'],
    ['APP-4', 'APP-3']
  ]);
});

test('interprets depends-on labels and ignores relates-to and duplicate links', () => {
  const edges = extractExplicitDependencies([
    requirement('APP-1', [
      link('APP-2', 'Depends', 'outward', 'is required by', 'depends on'),
      link('APP-3', 'Relates', 'outward', 'relates to', 'relates to'),
      link('APP-4', 'Duplicate', 'outward', 'duplicates', 'is duplicated by')
    ])
  ]);
  assert.deepEqual(edges.map(({ prerequisiteId, dependentId }) => [prerequisiteId, dependentId]), [
    ['APP-2', 'APP-1']
  ]);
});

test('supports configured custom link types while leaving unconfigured types non-blocking', () => {
  const requirements = [requirement('APP-1', [
    link('APP-2', 'Requires before', 'outward', null, null)
  ])];
  assert.equal(extractExplicitDependencies(requirements).length, 0);
  const [edge] = extractExplicitDependencies(requirements, ['Requires before']);
  assert.equal(edge.prerequisiteId, 'APP-1');
  assert.equal(edge.dependentId, 'APP-2');
});

test('calculates direct and transitive relationships, external links and independent items', () => {
  const requirements = [
    requirement('APP-1'),
    requirement('APP-2'),
    requirement('APP-3'),
    requirement('APP-4')
  ];
  const graph = buildDependencyGraph(requirements, [
    { id: 'one-two', prerequisiteId: 'APP-1', dependentId: 'APP-2', source: 'jira', status: 'explicit', impact: 'BOTH' },
    { id: 'two-three', prerequisiteId: 'APP-2', dependentId: 'APP-3', source: 'jira', status: 'explicit', impact: 'BOTH' },
    { id: 'external-three', prerequisiteId: 'APP-9', dependentId: 'APP-3', source: 'jira', status: 'explicit', impact: 'BOTH' }
  ]);
  const third = graph.relationships.find((item) => item.requirementId === 'APP-3');
  assert.deepEqual(third.directPrerequisites, ['APP-2', 'APP-9']);
  assert.deepEqual(third.upstream, ['APP-1', 'APP-2', 'APP-9']);
  assert.deepEqual(third.externalPrerequisites, ['APP-9']);
  assert.equal(graph.summary.external, 1);
  assert.deepEqual(graph.relationships.find((item) => item.requirementId === 'APP-4').directPrerequisites, []);
  assert.deepEqual(graph.topologicalWaves, [['APP-1', 'APP-4'], ['APP-2'], ['APP-3']]);
});

test('detects cycles and keeps rejected or pending AI links out of the baseline graph', () => {
  const proposed = [{
    dependencies: [
      {
        prerequisiteId: 'APP-1',
        dependentId: 'APP-2',
        kind: 'BLOCKS',
        impact: 'BOTH',
        confidence: 'HIGH',
        evidence: 'APP-1 must complete first.',
        reasoning: 'The wording identifies a prerequisite.',
        suggestedQuestion: ''
      },
      {
        prerequisiteId: 'APP-2',
        dependentId: 'APP-1',
        kind: 'REQUIRES',
        impact: 'TEST_DESIGN',
        confidence: 'MEDIUM',
        evidence: 'APP-2 requires APP-1.',
        reasoning: 'The wording identifies a prerequisite.',
        suggestedQuestion: ''
      }
    ]
  }];
  const pending = makeSemanticEdges(proposed);
  assert.equal(pending[0].status, 'pending');
  const baseline = buildDependencyGraph([requirement('APP-1'), requirement('APP-2')], []);
  assert.equal(baseline.edges.length, 0);
  const cycle = buildDependencyGraph([requirement('APP-1'), requirement('APP-2')], pending.map((edge) => ({
    ...edge,
    status: 'confirmed'
  })));
  assert.equal(cycle.summary.cycleCount, 1);
  assert.equal(cycle.summary.cycleRequirementCount, 2);
  assert.equal(cycle.blockedSequence.length, 2);
  assert.match(cycle.cycles[0].path.join(' '), /APP-1.*APP-2.*APP-1/);
});

test('human-edited confirmation changes direction and impact while preserving review identity', () => {
  const suggestion = {
    dependencies: [{
      prerequisiteId: 'APP-1',
      dependentId: 'APP-2',
      kind: 'BLOCKS',
      impact: 'BOTH',
      confidence: 'HIGH',
      evidence: 'Evidence phrase.',
      reasoning: 'Reasoned from the supplied story.',
      suggestedQuestion: ''
    }]
  };
  const id = edgeId('APP-1', 'APP-2', 'ai');
  const [edge] = makeSemanticEdges([suggestion], {
    [id]: {
      decision: 'confirmed',
      prerequisiteId: 'APP-3',
      dependentId: 'APP-2',
      kind: 'REQUIRES',
      impact: 'TEST_DESIGN'
    }
  });
  assert.equal(edge.id, id);
  assert.equal(edge.prerequisiteId, 'APP-3');
  assert.equal(edge.status, 'confirmed');
  assert.equal(edge.kind, 'REQUIRES');
  assert.equal(edge.impact, 'TEST_DESIGN');
});

test('reports separate strongly connected cycle components deterministically', () => {
  const graph = buildDependencyGraph(
    ['APP-1', 'APP-2', 'APP-3', 'APP-4', 'APP-5'].map((id) => requirement(id)),
    [
      { id: 'one-two', prerequisiteId: 'APP-1', dependentId: 'APP-2', source: 'jira' },
      { id: 'two-one', prerequisiteId: 'APP-2', dependentId: 'APP-1', source: 'jira' },
      { id: 'two-three', prerequisiteId: 'APP-2', dependentId: 'APP-3', source: 'jira' },
      { id: 'four-five', prerequisiteId: 'APP-4', dependentId: 'APP-5', source: 'jira' },
      { id: 'five-four', prerequisiteId: 'APP-5', dependentId: 'APP-4', source: 'jira' }
    ]
  );
  assert.equal(graph.cycles.length, 2);
  assert.deepEqual(graph.cycles.map((cycle) => cycle.requirementIds), [
    ['APP-1', 'APP-2'],
    ['APP-4', 'APP-5']
  ]);
});
