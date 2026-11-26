const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assessAcceptanceCriteria,
  extractAcceptanceCriteria,
  enforceAcceptanceCriteriaPresence
} = require('../src/analysis/acceptanceCriteria');

test('classifies empty retrieved criteria as missing for null, undefined, empty and whitespace values', () => {
  for (const value of [null, undefined, '', ' \n\t ']) {
    const result = assessAcceptanceCriteria({
      description: '',
      acceptanceCriteria: { fieldRetrieved: true, value }
    });
    assert.equal(result.contentAvailable, false);
    assert.equal(result.deterministicStatus, 'MISSING');
  }
});

test('classifies unavailable fields with no description criteria as unavailable', () => {
  const result = assessAcceptanceCriteria({
    description: 'The user can save a draft.',
    acceptanceCriteria: { fieldRetrieved: false, value: null }
  });
  assert.equal(result.contentAvailable, false);
  assert.equal(result.deterministicStatus, 'UNAVAILABLE');
});

test('uses criteria embedded in the description even when the custom field is empty', () => {
  const result = assessAcceptanceCriteria({
    description: 'Feature summary.\nAcceptance Criteria:\n- Draft is saved.',
    acceptanceCriteria: { fieldRetrieved: true, value: '   ' }
  });
  assert.equal(result.contentAvailable, true);
  assert.equal(result.deterministicStatus, null);
  assert.equal(result.descriptionCriteria, '- Draft is saved.');
});

test('does not treat an empty ADF criteria section as meaningful content', () => {
  assert.equal(extractAcceptanceCriteria('Overview.\n## Acceptance Criteria\n\n## Notes\nNone.'), null);
  const result = assessAcceptanceCriteria({
    description: 'Overview.\n## Acceptance Criteria\n',
    acceptanceCriteria: { fieldRetrieved: true, value: null }
  });
  assert.equal(result.deterministicStatus, 'MISSING');
});

test('overrides incorrect LLM status and replaces inconsistent empty-criteria findings', () => {
  const assessment = assessAcceptanceCriteria({
    description: '',
    acceptanceCriteria: { fieldRetrieved: true, value: '' }
  });
  const llmAnalysis = {
    acceptanceCriteriaStatus: 'AVAILABLE_BUT_INCOMPLETE',
    acceptanceCriteriaFindings: {
      findings: ['Criteria may need more detail.'],
      clarity: 'Looks clear.',
      completeness: 'Incomplete.',
      measurability: 'Cannot assess.',
      testability: 'Can partially test.',
      consistency: 'Consistent.',
      positiveScenarios: ['A draft is saved.'],
      negativeScenarios: [],
      boundaryConditions: []
    }
  };
  const result = enforceAcceptanceCriteriaPresence(llmAnalysis, assessment);
  assert.equal(result.acceptanceCriteriaStatus, 'MISSING');
  assert.match(result.acceptanceCriteriaFindings.findings[0], /No meaningful acceptance criteria/);
  assert.match(result.acceptanceCriteriaFindings.completeness, /Cannot assess/);
  assert.deepEqual(result.acceptanceCriteriaFindings.positiveScenarios, []);
});
