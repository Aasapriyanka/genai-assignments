const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createRouter, validatePlanningRequest, validateReviewDecisions } = require('../src/routes');
const { AnalysisError } = require('../src/analysis/analysisSchema');
const { PlanningOrchestrator } = require('../src/planning/PlanningOrchestrator');
const { PlanningProgressTracker } = require('../src/planning/PlanningProgressTracker');

function planningRequirements() {
  return [
    { id: 'APP-1', title: 'Create record', description: 'A record can be created.', priority: 'High', dependencies: [] },
    { id: 'APP-2', title: 'Publish record', description: 'After a record is created, it can be published.', priority: 'Medium', dependencies: [] }
  ];
}

function semanticOutput(ids) {
  return {
    dependencies: [{
      prerequisiteId: ids[0],
      dependentId: ids[1],
      kind: 'REQUIRES',
      impact: 'BOTH',
      evidence: 'Publishing follows record creation.',
      reasoning: 'The supplied requirement states that publishing happens after creation.',
      confidence: 'HIGH',
      suggestedQuestion: 'Can publishing begin before record creation is complete?'
    }],
    assessments: ids.map((requirementId) => ({
      requirementId,
      businessCriticality: 'UNKNOWN',
      criticalityEvidence: 'Cannot assess from the supplied story.',
      risk: 'UNKNOWN',
      riskEvidence: 'Cannot assess from the supplied story.',
      reasoning: 'There is not enough evidence for a reliable assessment.',
      confidence: 'LOW'
    })),
    questions: []
  };
}

async function withRouter(analysisService, testFn) {
  const orchestrator = new PlanningOrchestrator({ analysisService });
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', createRouter(
    {},
    analysisService,
    undefined,
    orchestrator,
    new PlanningProgressTracker()
  ));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await testFn(`http://127.0.0.1:${address.port}/api`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function post(base, path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

test('planning request validation strips unrelated fields and preserves missing-link availability', () => {
  const [submitted] = validatePlanningRequest({
    requirements: [{
      ...planningRequirements()[0],
      dependencies: null,
      jiraCredentials: { apiToken: 'do-not-forward' },
      secret: 'also excluded'
    }]
  }).requirements;
  assert.deepEqual(submitted, {
    id: 'APP-1',
    title: 'Create record',
    description: 'A record can be created.',
    priority: 'High',
    dependencies: null
  });
  assert.equal(JSON.stringify(submitted).includes('do-not-forward'), false);
});

test('rejects invalid or out-of-scope edited dependency reviews', () => {
  assert.throws(() => validateReviewDecisions({
    'ai:123456789abc': {
      decision: 'confirmed',
      prerequisiteId: 'APP-1',
      dependentId: 'APP-9',
      kind: 'BLOCKS',
      impact: 'BOTH'
    }
  }, new Set(['APP-1', 'APP-2'])), /review decision is invalid/);
});

test('rule-based endpoint completes without any Groq API or model validation calls', async () => {
  let groqCalls = 0;
  const service = {
    concurrency: 1,
    async getRuntimeConfig() {
      groqCalls += 1;
      throw new Error('Rule-based planning must not call Groq.');
    },
    async completeStructuredJson() {
      groqCalls += 1;
      throw new Error('Rule-based planning must not call Groq.');
    }
  };
  await withRouter(service, async (base) => {
    const response = await post(base, '/planning/rules', {
      requirements: planningRequirements(),
      phase2Analyses: []
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.plan.mode, 'rule-based');
    assert.equal(groqCalls, 0);
  });
});

test('AI planning requires consent, tracks progress, preserves results, and recalculates reviews locally', async () => {
  let modelChecks = 0;
  let completionCalls = 0;
  const service = {
    concurrency: 1,
    activeModel: 'test-configured-model',
    async getRuntimeConfig() {
      modelChecks += 1;
      return { model: this.activeModel };
    },
    async completeStructuredJson({ userPayload, callbacks }) {
      completionCalls += 1;
      callbacks.onRetry?.({ reason: 'invalid_response' });
      return semanticOutput(userPayload.requirements.map((item) => item.id));
    }
  };
  await withRouter(service, async (base) => {
    const request = { requirements: planningRequirements(), phase2Analyses: [], scope: 'selected' };
    const estimate = await post(base, '/planning/estimate', request);
    assert.equal(estimate.status, 200);
    assert.equal(estimate.body.estimate.groups, 1);
    const jobId = '123e4567-e89b-42d3-a456-426614174000';
    const groupIds = estimate.body.groups.map((group) => group.key);
    assert.equal((await post(base, '/planning/jobs', { jobId, groupIds })).status, 202);

    const withoutConsent = await post(base, '/planning/ai', { ...request, jobId });
    assert.equal(withoutConsent.status, 400);
    assert.equal(completionCalls, 0);

    const result = await post(base, '/planning/ai', {
      ...request,
      jobId,
      consent: true,
      cachedGroups: []
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.plan.mode, 'ai-enhanced');
    assert.equal(result.body.plan.model, 'test-configured-model');
    assert.equal(result.body.plan.graph.edges.length, 0);
    assert.equal(result.body.plan.provisionalGraph.edges.length, 1);
    assert.equal(result.body.semanticGroups[0].status, 'succeeded');
    assert.equal(modelChecks, 1);
    assert.equal(completionCalls, 1);

    const duplicate = await post(base, '/planning/ai', {
      ...request,
      jobId,
      consent: true,
      cachedGroups: []
    });
    assert.equal(duplicate.status, 409);
    assert.equal(completionCalls, 1);

    const proposed = result.body.plan.reviewableRelationships[0];
    const recalculate = await post(base, '/planning/recalculate', {
      ...request,
      semanticGroups: result.body.semanticGroups,
      reviewDecisions: { [proposed.id]: 'confirmed' },
      mode: 'ai-enhanced',
      model: 'test-configured-model'
    });
    assert.equal(recalculate.status, 200);
    assert.equal(recalculate.body.plan.graph.summary.confirmed, 1);
    assert.equal(completionCalls, 1);
    assert.equal(modelChecks, 1);
  });
});

test('returns one global planning configuration error before any semantic group call', async () => {
  let completions = 0;
  const service = {
    concurrency: 1,
    async getRuntimeConfig() {
      throw new AnalysisError('Configured model unavailable.', 503, 'MODEL_UNAVAILABLE');
    },
    async completeStructuredJson() {
      completions += 1;
    }
  };
  await withRouter(service, async (base) => {
    const request = { requirements: planningRequirements(), phase2Analyses: [] };
    const estimate = await post(base, '/planning/estimate', request);
    const jobId = '223e4567-e89b-42d3-a456-426614174000';
    await post(base, '/planning/jobs', {
      jobId,
      groupIds: estimate.body.groups.map((group) => group.key)
    });
    const response = await post(base, '/planning/ai', { ...request, jobId, consent: true });
    assert.equal(response.status, 503);
    assert.equal(response.body.scope, 'configuration');
    assert.equal(response.body.code, 'MODEL_UNAVAILABLE');
    assert.equal(completions, 0);
  });
});
