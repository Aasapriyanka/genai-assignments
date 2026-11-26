const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createRouter } = require('../src/routes');
const { AnalysisError } = require('../src/analysis/analysisSchema');
const { AnalysisProgressTracker } = require('../src/analysis/AnalysisProgressTracker');
const { createUsageAccumulator, recordUsage, serializeUsage } = require('../src/analysis/usage');

const jobId = '00000000-0000-4000-8000-000000000011';

test('does not present partial provider token metadata as a complete total', () => {
  const usage = createUsageAccumulator();
  recordUsage(usage, {
    operation: 'requirement-analysis',
    successfulRequests: 1,
    usageReports: 1,
    inputTokenReports: 1,
    inputTokens: 25
  });
  const result = serializeUsage(usage);
  assert.equal(result.inputTokens, 25);
  assert.equal(result.outputTokens, null);
  assert.equal(result.totalTokens, null);
  assert.equal(result.byOperation['requirement-analysis'].totalTokens, null);
});

async function withRouter(analysisService, run) {
  const app = express();
  app.use(express.json());
  app.use('/api', createRouter({}, analysisService, new AnalysisProgressTracker()));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}/api`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function postJson(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function analysisInput(id) {
  return {
    id,
    title: `Story ${id}`,
    description: 'A story description.',
    acceptanceCriteria: { fieldRetrieved: false, fieldName: null, value: null }
  };
}

test('returns one global configuration failure before analyzing any batch item', async () => {
  let analyzeCalls = 0;
  const analysisService = {
    concurrency: 1,
    async getRuntimeConfig() {
      throw new AnalysisError('Configured model is not available.', 503, 'MODEL_UNAVAILABLE');
    },
    async analyze() {
      analyzeCalls += 1;
    }
  };

  await withRouter(analysisService, async (baseUrl) => {
    await postJson(baseUrl, '/analysis/jobs', {
      jobId,
      requirementIds: ['APP-1', 'APP-2', 'APP-3']
    });
    const response = await postJson(baseUrl, '/analysis/batch', {
      jobId,
      requirements: ['APP-1', 'APP-2', 'APP-3'].map(analysisInput)
    });
    const result = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(result, {
      error: 'Configured model is not available.',
      code: 'MODEL_UNAVAILABLE',
      scope: 'configuration'
    });
    assert.equal(analyzeCalls, 0);
  });
});

test('validates runtime configuration once before analyzing a batch', async () => {
  let configChecks = 0;
  let analyzeCalls = 0;
  const analysisService = {
    concurrency: 1,
    async getRuntimeConfig() {
      configChecks += 1;
      return { model: 'openai/gpt-oss-20b', structuredOutputMode: 'json_schema' };
    },
    async analyze(requirement, callbacks) {
      analyzeCalls += 1;
      callbacks.onUsage({
        operation: 'requirement-analysis',
        inferenceRequests: 1,
        successfulRequests: 1,
        failedRequests: 0,
        retryAttempts: 0
      });
      callbacks.onUsage({
        operation: 'requirement-analysis',
        usageReports: 1,
        inputTokenReports: 1,
        outputTokenReports: 1,
        completeTokenReports: 1,
        inputTokens: 100,
        outputTokens: 25
      });
      return { requirementId: requirement.requirementId };
    }
  };

  await withRouter(analysisService, async (baseUrl) => {
    await postJson(baseUrl, '/analysis/jobs', {
      jobId,
      requirementIds: ['APP-1', 'APP-2']
    });
    const response = await postJson(baseUrl, '/analysis/batch', {
      jobId,
      requirements: ['APP-1', 'APP-2'].map(analysisInput)
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(configChecks, 1);
    assert.equal(analyzeCalls, 2);
    assert.deepEqual(result.results.map((entry) => entry.requirementId), ['APP-1', 'APP-2']);
    assert.equal(result.usage.inferenceRequests, 2);
    assert.equal(result.usage.inputTokens, 200);
    assert.equal(result.usage.totalTokens, 250);
  });
});

test('does not validate Groq configuration for an all-empty deterministic batch', async () => {
  let configChecks = 0;
  let analyzeCalls = 0;
  const analysisService = {
    concurrency: 1,
    async getRuntimeConfig() {
      configChecks += 1;
      throw new Error('An empty requirement does not need GroqCloud.');
    },
    async analyze(requirement) {
      analyzeCalls += 1;
      return {
        requirementId: requirement.requirementId,
        analysisSource: 'RULE_BASED',
        clarityClassification: 'AMBIGUOUS'
      };
    }
  };
  await withRouter(analysisService, async (baseUrl) => {
    const response = await postJson(baseUrl, '/analysis/jobs', {
      jobId,
      requirementIds: ['APP-EMPTY']
    });
    assert.equal(response.status, 202);
    const batch = await postJson(baseUrl, '/analysis/batch', {
      jobId,
      requirements: [{
        id: 'APP-EMPTY',
        title: 'Empty story',
        description: '   ',
        acceptanceCriteria: { fieldRetrieved: true, fieldName: null, value: '' }
      }]
    });
    const result = await batch.json();
    assert.equal(batch.status, 200);
    assert.equal(configChecks, 0);
    assert.equal(analyzeCalls, 1);
    assert.equal(result.model, null);
    assert.deepEqual(result.results.map((entry) => entry.analysis.analysisSource), ['RULE_BASED']);
  });
});
