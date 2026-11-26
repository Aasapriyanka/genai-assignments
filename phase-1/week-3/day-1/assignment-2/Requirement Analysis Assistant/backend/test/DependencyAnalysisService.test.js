const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DependencyAnalysisService,
  createGroups,
  DEPENDENCY_SYSTEM_PROMPT
} = require('../src/planning/DependencyAnalysisService');
const {
  DEPENDENCY_ANALYSIS_SCHEMA,
  validateDependencyAnalysis
} = require('../src/planning/dependencyAnalysisSchema');

function requirements(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `APP-${index + 1}`,
    title: `Title ${index + 1}`,
    description: `Description ${index + 1}`,
    priority: 'High',
    dependencies: []
  }));
}

function semanticResult(ids, overrides = {}) {
  return {
    dependencies: [],
    assessments: ids.map((requirementId) => ({
      requirementId,
      businessCriticality: 'UNKNOWN',
      criticalityEvidence: 'Cannot assess from the supplied requirement.',
      risk: 'UNKNOWN',
      riskEvidence: 'Cannot assess from the supplied requirement.',
      reasoning: 'There is not enough evidence to classify this item.',
      confidence: 'LOW'
    })),
    questions: [],
    ...overrides
  };
}

test('groups selected requirements, estimates size, and warns about cross-group coverage', () => {
  const service = new DependencyAnalysisService({ maxGroupSize: 2 });
  const groups = createGroups(requirements(5), [], 2);
  const estimate = service.estimate(requirements(5), []);
  assert.equal(groups.length, 3);
  assert.equal(estimate.requirements, 5);
  assert.equal(estimate.groups, 3);
  assert.ok(estimate.approximateInputTokens > 0);
  assert.match(estimate.note, /across separate groups/);
  assert.match(DEPENDENCY_SYSTEM_PROMPT, /similar names, numbering, order/);
});

test('session cache key changes when requirement text or Phase 2 evidence changes', () => {
  const [first] = createGroups(requirements(1), [], 5);
  const changedText = [{ ...requirements(1)[0], description: 'Updated description' }];
  const [second] = createGroups(changedText, [], 5);
  const phase2 = [{
    requirementId: 'APP-1',
    clarityClassification: 'CLEAR',
    clarityReasoning: 'A clear outcome is stated.',
    acceptanceCriteriaStatus: 'MISSING',
    testDesignReadiness: 'PARTIALLY_READY',
    testReadinessReasoning: 'Some evidence is absent.',
    identifiedGaps: [],
    clarificationQuestions: []
  }];
  const [third] = createGroups(requirements(1), phase2, 5);
  const [projectScope] = createGroups(requirements(1), [], 5, 'project');
  assert.notEqual(first.key, second.key);
  assert.notEqual(first.key, third.key);
  assert.notEqual(first.key, projectScope.key);
});

test('processes semantic groups sequentially by default and reports group progress', async () => {
  const statuses = [];
  let active = 0;
  let maximumActive = 0;
  const analysisService = {
    concurrency: 1,
    activeModel: 'configured-test-model',
    async completeStructuredJson({ userPayload, callbacks }) {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      callbacks.onRetry?.({ reason: 'invalid_response' });
      await new Promise((resolve) => setTimeout(resolve, 3));
      active -= 1;
      const ids = userPayload.requirements.map((item) => item.id);
      return semanticResult(ids);
    }
  };
  const service = new DependencyAnalysisService({ analysisService, maxGroupSize: 2 });
  const result = await service.analyze(requirements(5), [], {
    onGroupStatus: (key, status) => statuses.push({ key, status })
  });
  assert.equal(maximumActive, 1);
  assert.equal(result.summary.succeeded, 3);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.model, 'configured-test-model');
  assert.equal(statuses.filter((item) => item.status === 'retrying').length, 3);
  assert.equal(statuses.filter((item) => item.status === 'succeeded').length, 3);
});

test('retains successful group results when another group fails', async () => {
  const analysisService = {
    concurrency: 1,
    async completeStructuredJson({ userPayload }) {
      const ids = userPayload.requirements.map((item) => item.id);
      if (ids.includes('APP-3')) throw Object.assign(new Error('Temporary service failure.'), { code: 'UPSTREAM_UNAVAILABLE' });
      return semanticResult(ids);
    }
  };
  const service = new DependencyAnalysisService({ analysisService, maxGroupSize: 2 });
  const result = await service.analyze(requirements(4));
  assert.equal(result.summary.succeeded, 1);
  assert.equal(result.summary.failed, 1);
  assert.equal(result.groups[0].status, 'succeeded');
  assert.equal(result.groups[1].error.code, 'UPSTREAM_UNAVAILABLE');
});

test('reuses only schema-valid session cache entries and reports whether a Groq call is needed', async () => {
  let calls = 0;
  const analysisService = {
    concurrency: 1,
    async completeStructuredJson({ userPayload }) {
      calls += 1;
      return semanticResult(userPayload.requirements.map((item) => item.id));
    }
  };
  const service = new DependencyAnalysisService({ analysisService, maxGroupSize: 2 });
  const items = requirements(3);
  const manifest = service.getGroupManifest(items, []);
  const cachedResult = semanticResult(manifest[0].requirementIds);
  assert.equal(service.hasUncachedGroups(items, [], [{ key: manifest[0].key, result: cachedResult }]), true);
  const first = await service.analyze(items, [], {
    cachedGroups: [{ key: manifest[0].key, result: cachedResult }]
  });
  assert.equal(first.summary.cached, 1);
  assert.equal(first.summary.succeeded, 2);
  assert.equal(calls, 1);
  const [singleGroup] = service.getGroupManifest(items.slice(0, 2), []);
  const validForSingleGroup = semanticResult(singleGroup.requirementIds);
  assert.equal(service.hasUncachedGroups(items.slice(0, 2), [], [{
    key: singleGroup.key,
    result: validForSingleGroup
  }]), false);
  assert.equal(service.hasUncachedGroups(items.slice(0, 2), [], [{
    key: singleGroup.key,
    result: { ...cachedResult, extra: true }
  }]), true);
  const invalid = { ...validForSingleGroup, assessments: [] };
  assert.equal(service.hasUncachedGroups(items.slice(0, 2), [], [{
    key: singleGroup.key,
    result: invalid
  }]), true);
  const cachedOnly = await service.analyze(items.slice(0, 2), [], {
    scope: 'selected',
    cachedGroups: [{ key: singleGroup.key, result: validForSingleGroup, model: 'previous-test-model' }]
  });
  assert.equal(cachedOnly.model, 'previous-test-model');
});

test('validates semantic output IDs and uses a strict JSON schema', () => {
  const result = semanticResult(['APP-1']);
  assert.equal(validateDependencyAnalysis(result, ['APP-1']), result);
  assert.throws(() => validateDependencyAnalysis(semanticResult(['APP-2']), ['APP-1']), /required format/);
  assertStrictSchema(DEPENDENCY_ANALYSIS_SCHEMA);
});

function assertStrictSchema(schema) {
  assert.equal(schema.type, 'object');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, Object.keys(schema.properties));
  Object.values(schema.properties).forEach((property) => {
    if (property.type === 'object') assertStrictSchema(property);
    if (property.type === 'array' && property.items.type === 'object') assertStrictSchema(property.items);
  });
}
