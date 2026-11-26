const test = require('node:test');
const assert = require('node:assert/strict');
const { PlanningOrchestrator } = require('../src/planning/PlanningOrchestrator');
const { PrioritisationService } = require('../src/planning/PrioritisationService');

function requirements(count = 2) {
  return Array.from({ length: count }, (_, index) => ({
    id: `APP-${index + 1}`,
    title: `Requirement ${index + 1}`,
    description: `Requirement text ${index + 1}`,
    priority: 'High',
    dependencies: []
  }));
}

function phase2(id, overrides = {}) {
  return {
    requirementId: id,
    clarityClassification: 'CLEAR',
    clarityReasoning: 'The core user action is stated.',
    acceptanceCriteriaStatus: 'AVAILABLE_AND_VALID',
    testDesignReadiness: 'READY_FOR_TEST_DESIGN',
    testReadinessReasoning: 'The outcome can be designed and verified.',
    identifiedGaps: [],
    clarificationQuestions: [],
    ...overrides
  };
}

function group(items, { dependencies = [], questions = [] } = {}) {
  const ids = items.map((item) => item.id);
  return {
    cacheKey: 'a'.repeat(64),
    requirementIds: ids,
    status: 'succeeded',
    cached: false,
    analysis: {
      dependencies,
      assessments: ids.map((requirementId) => ({
        requirementId,
        businessCriticality: 'UNKNOWN',
        criticalityEvidence: 'Cannot assess from the supplied story.',
        risk: 'UNKNOWN',
        riskEvidence: 'Cannot assess from the supplied story.',
        reasoning: 'There is insufficient evidence.',
        confidence: 'LOW'
      })),
      questions
    }
  };
}

function dependency(overrides = {}) {
  return {
    prerequisiteId: 'APP-1',
    dependentId: 'APP-2',
    kind: 'BLOCKS',
    impact: 'BOTH',
    evidence: 'The second activity starts after the first is complete.',
    reasoning: 'The description explicitly states the ordering.',
    confidence: 'HIGH',
    suggestedQuestion: 'Does the second activity depend on the first?',
    ...overrides
  };
}

test('rule-based planning uses explicit Jira links and makes no semantic calls', () => {
  let groqCalls = 0;
  const orchestrator = new PlanningOrchestrator({
    dependencyAnalysisService: {
      estimate() { groqCalls += 1; },
      async analyze() { groqCalls += 1; }
    }
  });
  const items = requirements();
  items[0].dependencies = [{
    key: 'APP-2',
    type: 'Blocks',
    direction: 'outward',
    outward: 'blocks',
    inward: 'is blocked by'
  }];
  const plan = orchestrator.buildPlan({
    requirements: items,
    phase2Analyses: [phase2('APP-1'), phase2('APP-2')],
    mode: 'rule-based'
  });
  assert.equal(groqCalls, 0);
  assert.equal(plan.graph.summary.explicit, 1);
  assert.equal(plan.summary.proposedRelationships, 0);
  assert.equal(plan.semanticAnalysis.summary.total, 0);
  assert.equal(plan.workSequence.items.find((item) => item.requirementId === 'APP-2').wave, 2);
});

test('AI suggestions remain provisional until confirmed and edited relationships affect the baseline', () => {
  const items = requirements(3);
  const semanticGroup = group(items, { dependencies: [dependency()] });
  const orchestrator = new PlanningOrchestrator();
  const proposed = orchestrator.buildPlan({
    requirements: items,
    semanticGroups: [semanticGroup],
    mode: 'ai-enhanced'
  });
  assert.equal(proposed.graph.edges.length, 0);
  assert.equal(proposed.provisionalGraph.edges.length, 1);
  assert.equal(proposed.summary.proposedRelationships, 1);
  const edge = proposed.reviewableRelationships[0];
  const reviewed = orchestrator.buildPlan({
    requirements: items,
    semanticGroups: [semanticGroup],
    reviewDecisions: {
      [edge.id]: {
        decision: 'confirmed',
        prerequisiteId: 'APP-3',
        dependentId: 'APP-2',
        kind: 'REQUIRES',
        impact: 'TEST_DESIGN'
      }
    },
    mode: 'ai-enhanced'
  });
  assert.equal(reviewed.graph.edges[0].prerequisiteId, 'APP-3');
  assert.equal(reviewed.graph.edges[0].status, 'confirmed');
  assert.equal(reviewed.summary.confirmedInferredRelationships, 1);
  assert.equal(reviewed.summary.proposedRelationships, 0);
});

test('does not present an AI relationship already documented by an explicit Jira link', () => {
  const items = requirements();
  items[0].dependencies = [{
    key: 'APP-2',
    type: 'Blocks',
    direction: 'outward',
    outward: 'blocks',
    inward: 'is blocked by'
  }];
  const plan = new PlanningOrchestrator().buildPlan({
    requirements: items,
    semanticGroups: [group(items, { dependencies: [dependency()] })],
    mode: 'ai-enhanced'
  });
  assert.equal(plan.graph.summary.explicit, 1);
  assert.equal(plan.graph.edges.length, 1);
  assert.equal(plan.reviewableRelationships.length, 0);
  assert.equal(plan.summary.proposedRelationships, 0);
});

test('partial semantic failures preserve successful groups and report unassessed coverage', () => {
  const items = requirements(6);
  const firstGroup = group(items.slice(0, 5));
  const failedGroup = {
    cacheKey: 'b'.repeat(64),
    requirementIds: ['APP-6'],
    status: 'failed',
    error: { code: 'NETWORK_ERROR', message: 'Temporary failure.' }
  };
  const plan = new PlanningOrchestrator().buildPlan({
    requirements: items,
    semanticGroups: [firstGroup, failedGroup],
    mode: 'ai-enhanced'
  });
  assert.equal(plan.semanticAnalysis.summary.succeeded, 1);
  assert.equal(plan.semanticAnalysis.summary.failed, 1);
  assert.equal(plan.semanticAnalysis.summary.pairCoverage, 67);
  assert.ok(plan.warnings.some((warning) => warning.includes('Successful groups remain available')));
  assert.ok(plan.warnings.some((warning) => warning.includes('different groups')));
});

test('deduplicates equivalent questions and retains all related requirements', () => {
  const items = requirements();
  const phase2Analyses = [
    phase2('APP-1', {
      clarificationQuestions: [{
        requirementId: 'APP-1',
        question: 'What is the expected completion order?',
        reason: 'The sequence is unclear.',
        potentialImpact: 'Test design may be blocked.',
        priority: 'High',
        blocksTestDesign: true
      }]
    })
  ];
  const semanticGroup = group(items, {
    questions: [{
      requirementIds: ['APP-1', 'APP-2'],
      question: 'What is the expected completion order?',
      reason: 'The dependency order is uncertain.',
      potentialImpact: 'Work sequence may change.',
      priority: 'MEDIUM',
      blocksTestDesign: false,
      blocksTestExecution: false
    }]
  });
  const plan = new PlanningOrchestrator().buildPlan({
    requirements: items,
    phase2Analyses,
    semanticGroups: [semanticGroup],
    mode: 'ai-enhanced'
  });
  assert.equal(plan.questions.length, 1);
  assert.deepEqual(plan.questions[0].requirementIds, ['APP-1', 'APP-2']);
  assert.equal(plan.questions[0].blocksTestDesign, true);
  assert.equal(plan.questions[0].priority, 'HIGH');
  assert.deepEqual(plan.questions[0].sources, ['dependency-analysis', 'requirement-analysis']);
  assert.equal(plan.questions[0].reasons.length, 2);
});

test('retains distinct clarification questions rather than merging by shared requirement', () => {
  const items = requirements();
  const analysis = phase2('APP-1', {
    clarificationQuestions: [{
      requirementId: 'APP-1',
      question: 'Which user role can submit the request?',
      associatedGap: 'User role',
      reason: 'The actor is not identified.',
      potentialImpact: 'Role-based access cannot be tested.',
      priority: 'High',
      blocksTestDesign: true
    }, {
      requirementId: 'APP-1',
      question: 'What response is expected when the request is rejected?',
      associatedGap: 'Exception handling',
      reason: 'The rejection outcome is not stated.',
      potentialImpact: 'Negative behavior cannot be validated.',
      priority: 'Medium',
      blocksTestDesign: false
    }]
  });
  const plan = new PlanningOrchestrator().buildPlan({
    requirements: items,
    phase2Analyses: [analysis],
    mode: 'rule-based'
  });
  assert.equal(plan.questions.length, 2);
  assert.equal(new Set(plan.questions.map((question) => question.question)).size, 2);
});

test('does not sequence work as ready when a semantic planning question blocks test design', () => {
  const items = requirements();
  const semanticGroup = group(items, {
    questions: [{
      requirementIds: ['APP-2'],
      question: 'Does the external approval need to finish first?',
      reason: 'The ordering is not explicit.',
      potentialImpact: 'Test design order may change.',
      priority: 'HIGH',
      blocksTestDesign: true,
      blocksTestExecution: false
    }]
  });
  const plan = new PlanningOrchestrator().buildPlan({
    requirements: items,
    phase2Analyses: items.map((item) => phase2(item.id)),
    semanticGroups: [semanticGroup],
    mode: 'ai-enhanced'
  });
  assert.equal(plan.workSequence.items.find((item) => item.requirementId === 'APP-2').action,
    'CLARIFY_WITH_PRODUCT_OWNER');
});

test('makes requirements unranked when known factors do not meet evidence coverage', () => {
  const items = requirements(1);
  items[0].priority = null;
  items[0].dependencies = null;
  const plan = new PlanningOrchestrator({
    prioritisationService: new PrioritisationService()
  }).buildPlan({ requirements: items });
  assert.equal(plan.prioritisation.items[0].rankingStatus, 'UNRANKED');
  assert.equal(plan.prioritisation.items[0].score, null);
});

test('keeps graph, ranking, question, and sequence summary counts consistent with their detailed views', () => {
  const items = requirements(3);
  const semanticGroup = group(items, { dependencies: [dependency()] });
  const edgeId = require('../src/planning/DependencyGraph').edgeId('APP-1', 'APP-2', 'ai');
  const plan = new PlanningOrchestrator().buildPlan({
    requirements: items,
    phase2Analyses: items.map((item) => phase2(item.id)),
    semanticGroups: [semanticGroup],
    reviewDecisions: { [edgeId]: 'confirmed' },
    mode: 'ai-enhanced'
  });
  assert.equal(plan.summary.requirements, plan.prioritisation.items.length);
  assert.equal(plan.summary.ranked + plan.summary.unranked, plan.prioritisation.items.length);
  assert.equal(plan.summary.questions, plan.questions.length);
  assert.equal(plan.summary.confirmedInferredRelationships,
    plan.reviewableRelationships.filter((edge) => edge.status === 'confirmed').length);
  assert.equal(plan.summary.proposedRelationships,
    plan.reviewableRelationships.filter((edge) => edge.status === 'pending').length);
  assert.equal(plan.summary.sequencingActions, plan.workSequence.items.length);
});
