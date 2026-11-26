const test = require('node:test');
const assert = require('node:assert/strict');
const {
  summarizeAnalyses,
  matchesAnalysisFilters
} = require('../../extension/analysis-summary');

test('dashboard summaries count deterministic missing and unavailable criteria statuses', () => {
  const summary = summarizeAnalyses([
    {
      clarityClassification: 'CLEAR',
      acceptanceCriteriaStatus: 'MISSING',
      testDesignReadiness: 'PARTIALLY_READY',
      identifiedGaps: [{ clarificationRequired: true }],
      clarificationQuestions: [{ question: 'What is the expected result?' }]
    },
    {
      clarityClassification: 'AMBIGUOUS',
      acceptanceCriteriaStatus: 'UNAVAILABLE',
      testDesignReadiness: 'NOT_READY',
      identifiedGaps: [],
      clarificationQuestions: []
    },
    {
      clarityClassification: 'PARTIALLY_CLEAR',
      acceptanceCriteriaStatus: 'AVAILABLE_AND_VALID',
      testDesignReadiness: 'READY_FOR_TEST_DESIGN',
      identifiedGaps: [{ clarificationRequired: false }],
      clarificationQuestions: []
    }
  ]);

  assert.deepEqual(summary, {
    total: 3,
    clear: 1,
    partiallyClear: 1,
    ambiguous: 1,
    missingOrUnavailableCriteria: 2,
    readyForTestDesign: 1,
    requiringClarification: 1,
    clarificationQuestions: 1
  });
});

test('dashboard filters match the final acceptance-criteria classification', () => {
  const missing = { acceptanceCriteriaStatus: 'MISSING', clarityClassification: 'AMBIGUOUS', testDesignReadiness: 'NOT_READY' };
  assert.equal(matchesAnalysisFilters(missing, { acceptanceCriteriaStatus: 'MISSING' }), true);
  assert.equal(matchesAnalysisFilters(missing, { acceptanceCriteriaStatus: 'AVAILABLE_BUT_INCOMPLETE' }), false);
  assert.equal(matchesAnalysisFilters(missing, {
    acceptanceCriteriaStatus: 'MISSING',
    clarity: 'CLEAR'
  }), false);
});
