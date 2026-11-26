const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createUsageSummary,
  addUsageSummary,
  analysisCoverage,
  completeTokenTotal,
  deduplicateQuestions,
  buildCsv,
  buildHtmlReport,
  humanReadableEvidence,
  activateView,
  analysisConfigChanged,
  dependencyPanelState,
  planningOverview
} = require('../../extension/workspace-utils');

test('aggregates actual token reports and usage by operation without inventing unknown totals', () => {
  const usage = createUsageSummary();
  addUsageSummary(usage, {
    inferenceRequests: 2,
    successfulRequests: 1,
    failedRequests: 1,
    retryAttempts: 1,
    usageReports: 1,
    inputTokenReports: 1,
    outputTokenReports: 1,
    completeTokenReports: 1,
    inputTokens: 140,
    outputTokens: 35,
    byOperation: {
      'requirement-analysis': {
        inferenceRequests: 2,
        successfulRequests: 1,
        failedRequests: 1,
        retryAttempts: 1,
        usageReports: 1,
        inputTokenReports: 1,
        outputTokenReports: 1,
        completeTokenReports: 1,
        inputTokens: 140,
        outputTokens: 35
      }
    }
  });
  addUsageSummary(usage, {
    inferenceRequests: 1,
    successfulRequests: 1,
    failedRequests: 0,
    retryAttempts: 0,
    usageReports: 0,
    inputTokens: null,
    outputTokens: null
  });
  assert.equal(usage.inferenceRequests, 3);
  assert.equal(usage.failedRequests, 1);
  assert.equal(usage.inputTokens, 140);
  assert.equal(usage.outputTokens, 35);
  assert.equal(completeTokenTotal(usage), null);
});

test('reports token totals only when every successful response has both token counts', () => {
  const usage = createUsageSummary();
  addUsageSummary(usage, {
    successfulRequests: 2,
    completeTokenReports: 2,
    inputTokens: 100,
    outputTokens: 30
  });
  assert.equal(completeTokenTotal(usage), 130);
  addUsageSummary(usage, { successfulRequests: 1, completeTokenReports: 0 });
  assert.equal(completeTokenTotal(usage), null);
});

test('keeps analyzed, failed, and pending dashboard counts consistent with retrieved requirements', () => {
  const coverage = analysisCoverage(6, 3, 2);
  assert.deepEqual(coverage, { total: 6, analysed: 3, failed: 2, pending: 1 });
  assert.equal(coverage.analysed + coverage.failed + coverage.pending, coverage.total);
  assert.deepEqual(analysisCoverage(2, 4, 3), {
    total: 2,
    analysed: 2,
    failed: 0,
    pending: 0
  });
});

test('consolidates equivalent questions while preserving distinct questions and source references', () => {
  const result = deduplicateQuestions([
    {
      requirementIds: ['APP-1'],
      question: 'What is the expected result?',
      associatedGap: 'Expected outcome',
      reason: 'The result is unclear.',
      source: 'Requirement analysis',
      priority: 'MEDIUM'
    },
    {
      requirementIds: ['APP-2'],
      question: 'What is the expected result?',
      associatedGap: 'Acceptance criteria',
      reason: 'The result is not measurable.',
      source: 'Dependency analysis',
      priority: 'HIGH',
      blocksTestDesign: true
    },
    {
      requirementIds: ['APP-2'],
      question: 'Which user role can perform this action?',
      reason: 'No role is given.',
      source: 'Requirement analysis',
      priority: 'LOW'
    }
  ]);
  assert.equal(result.originalCount, 3);
  assert.equal(result.consolidatedCount, 2);
  assert.deepEqual(result.questions[0].requirementIds, ['APP-1', 'APP-2']);
  assert.equal(result.questions[0].sources.length, 2);
  assert.equal(result.questions[0].associatedGaps.length, 2);
  assert.equal(result.questions[0].blocksTestDesign, true);
});

test('protects CSV fields against spreadsheet formulas', () => {
  const csv = buildCsv(['title', 'note'], [['=1+1', '  @SUM(A1:A2)']]);
  assert.equal(csv, '"title","note"\r\n"\'=1+1","\'  @SUM(A1:A2)"');
});

test('escapes all untrusted report content in generated HTML', () => {
  const report = buildHtmlReport({
    productName: 'Requirement Analysis Assistant',
    projectName: '<img src=x onerror=alert(1)>',
    projectKey: 'SAFE',
    generatedAt: '2026-11-26',
    scopeCount: 1,
    model: null,
    metrics: [['Requirements', 1]],
    sections: [{
      title: 'Requirement analysis',
      items: [{ title: '<script>bad()</script>', details: [['Description', '<b>untrusted</b>']] }]
    }],
    disclaimer: 'Human review required.'
  });
  assert.ok(report.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(report.includes('&lt;script&gt;bad()&lt;/script&gt;'));
  assert.ok(!report.includes('<script>bad()</script>'));
});

test('replaces structured evidence payloads with human-readable explanations', () => {
  const expected = 'The relevant information is not clearly stated in the retrieved requirement text.';
  assert.equal(humanReadableEvidence('{"acceptanceCriteria":""}'), expected);
  assert.equal(humanReadableEvidence('"{\\"scope\\":\\"missing\\"}"'), expected);
  assert.equal(humanReadableEvidence(''), 'No supporting explanation was provided.');
  assert.equal(humanReadableEvidence('The expected response is not described.'), 'The expected response is not described.');
});

test('switches sections without altering workspace data and invalidates caches when model or schema fingerprint changes', () => {
  const views = [
    { id: 'view-overview', hidden: false },
    { id: 'view-requirements', hidden: true }
  ];
  const buttons = [
    { dataset: { view: 'overview' }, classList: { toggle(_name, selected) { this.active = selected; } }, setAttribute() {}, removeAttribute() {} },
    { dataset: { view: 'requirements' }, classList: { toggle(_name, selected) { this.active = selected; } }, setAttribute() {}, removeAttribute() {} }
  ];
  const workspace = { results: new Map([['APP-1', { clarityClassification: 'CLEAR' }]]), selection: new Set(['APP-1']) };
  assert.equal(activateView(views, buttons, 'requirements'), true);
  assert.equal(views[0].hidden, true);
  assert.equal(views[1].hidden, false);
  assert.equal(buttons[1].classList.active, true);
  assert.equal(workspace.results.size, 1);
  assert.equal(workspace.selection.has('APP-1'), true);
  assert.equal(analysisConfigChanged({ model: 'model-a', analysisFingerprint: 'schema-a' },
    { model: 'model-a', analysisFingerprint: 'schema-b' }, 'fallback'), true);
  assert.equal(analysisConfigChanged({ model: 'model-a' }, { model: 'model-b' }, 'fallback'), true);
});

test('distinguishes unselected, out-of-scope, and no-known-dependency graph states', () => {
  assert.deepEqual(dependencyPanelState({}), {
    state: 'unselected',
    title: 'Select a requirement to view its dependencies and supporting evidence.',
    message: ''
  });
  assert.equal(dependencyPanelState({ selectedId: 'APP-2', inScope: false }).state, 'out-of-scope');
  assert.equal(dependencyPanelState({ selectedId: 'APP-1', inScope: true }).message,
    'No known dependency links were found in this scope. This does not confirm independence.');
});

test('planning overview distinguishes an unplanned scope from planned zero counts', () => {
  assert.deepEqual(planningOverview(null, 'selected', 0), {
    planned: false,
    scopeLabel: 'Selected requirements',
    requirementCount: 0,
    explicitLinkCount: null,
    confirmedLinkCount: null,
    proposedLinkCount: null,
    noDocumentedLinksCount: null,
    unavailableLinkDataCount: null,
    rankedCount: null,
    unrankedCount: null,
    unclassifiedCount: null,
    rankingCountsReconcile: null,
    rankingSummaryConsistent: null
  });

  const zeroPlan = {
    summary: {
      requirements: 0,
      dependencies: { explicit: 0, independent: 0 },
      confirmedInferredRelationships: 0,
      proposedRelationships: 0,
      jiraLinkDataUnavailable: 0,
      ranked: 0,
      unranked: 0
    },
    prioritisation: { items: [] }
  };
  const overview = planningOverview(zeroPlan, 'project', 4);
  assert.equal(overview.planned, true);
  assert.equal(overview.scopeLabel, 'All retrieved requirements');
  assert.equal(overview.requirementCount, 0);
  assert.equal(overview.noDocumentedLinksCount, 0);
  assert.equal(overview.unavailableLinkDataCount, 0);
  assert.equal(overview.rankedCount + overview.unrankedCount, overview.requirementCount);
  assert.equal(overview.rankingCountsReconcile, true);
});

test('maps dependency metrics from the nested plan summary and reports unavailable Jira link data separately', () => {
  const plan = {
    summary: {
      requirements: 3,
      dependencies: { explicit: 1, independent: 2 },
      confirmedInferredRelationships: 1,
      proposedRelationships: 2,
      jiraLinkDataUnavailable: 1,
      ranked: 1,
      unranked: 2
    },
    prioritisation: {
      items: [
        { rankingStatus: 'RANKED' },
        { rankingStatus: 'UNRANKED' },
        { rankingStatus: 'UNRANKED' }
      ]
    }
  };
  const overview = planningOverview(plan, 'selected', 9);
  assert.equal(overview.requirementCount, 3);
  assert.equal(overview.noDocumentedLinksCount, 2);
  assert.equal(overview.unavailableLinkDataCount, 1);
  assert.equal(overview.rankedCount, 1);
  assert.equal(overview.unrankedCount, 2);
  assert.equal(overview.rankingCountsReconcile, true);
  assert.equal(overview.rankingSummaryConsistent, true);
});

test('reconciles a single requirement in the selected planning scope', () => {
  const plan = {
    summary: {
      requirements: 1,
      dependencies: { explicit: 0, independent: 1 },
      confirmedInferredRelationships: 0,
      proposedRelationships: 0,
      jiraLinkDataUnavailable: 0,
      ranked: 0,
      unranked: 1
    },
    prioritisation: { items: [{ rankingStatus: 'UNRANKED' }] }
  };
  const overview = planningOverview(plan, 'selected', 3);
  assert.equal(overview.requirementCount, 1);
  assert.equal(overview.noDocumentedLinksCount, 1);
  assert.equal(overview.rankedCount, 0);
  assert.equal(overview.unrankedCount, 1);
  assert.equal(overview.rankingCountsReconcile, true);
});

test('keeps absent planning metrics unavailable and flags ranking counts that do not match the plan', () => {
  const plan = {
    summary: {
      requirements: 2,
      dependencies: {},
      ranked: 0,
      unranked: 2
    },
    prioritisation: {
      items: [
        { rankingStatus: 'RANKED' },
        { rankingStatus: 'UNRANKED' },
        { rankingStatus: 'PENDING' }
      ]
    }
  };
  const overview = planningOverview(plan, 'selected', 2);
  assert.equal(overview.noDocumentedLinksCount, null);
  assert.equal(overview.unavailableLinkDataCount, null);
  assert.equal(overview.rankedCount, 1);
  assert.equal(overview.unrankedCount, 1);
  assert.equal(overview.unclassifiedCount, 1);
  assert.equal(overview.rankingCountsReconcile, false);
  assert.equal(overview.rankingSummaryConsistent, false);
});
