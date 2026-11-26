const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAnalysisBatch } = require('../src/routes');

test('passes only the requirement content allowed for Groq analysis', () => {
  const [submitted] = validateAnalysisBatch([{
      id: 'APP-1',
      title: 'Search records',
      description: 'As a user, search records.',
      acceptanceCriteria: { fieldRetrieved: false, fieldName: null, value: null },
      priority: 'Blocker',
      status: 'In Progress',
      dependencies: ['APP-9'],
      jiraCredentials: { apiToken: 'must-not-be-forwarded' },
      arbitraryMetadata: 'excluded'
    }]);

  assert.deepEqual(submitted, {
    requirementId: 'APP-1',
    title: 'Search records',
    description: 'As a user, search records.',
    acceptanceCriteria: { fieldRetrieved: false, fieldName: null, value: null }
  });
  assert.equal(JSON.stringify(submitted).includes('must-not-be-forwarded'), false);
});

test('rejects duplicate IDs and oversized analysis batches', () => {
  const item = {
    id: 'APP-1',
    title: 'Story',
    description: null,
    acceptanceCriteria: { fieldRetrieved: false, fieldName: null, value: null }
  };
  assert.throws(() => validateAnalysisBatch([item, item]), /duplicate requirement IDs/);
  assert.throws(() => validateAnalysisBatch(Array(5).fill(item)), /between 1 and 4/);
});

test('rejects requirement text beyond the bounded prompt size', () => {
  assert.throws(() => validateAnalysisBatch([{
      id: 'APP-2',
      title: 'Story',
      description: 'x'.repeat(12001),
      acceptanceCriteria: { fieldRetrieved: false, fieldName: null, value: null }
    }]), /within supported length limits/);
});
