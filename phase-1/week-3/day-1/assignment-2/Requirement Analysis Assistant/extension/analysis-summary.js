(function initializeAnalysisSummary(root, factory) {
  const summary = factory();
  if (typeof module === 'object' && module.exports) module.exports = summary;
  else root.RequirementAnalysisSummary = summary;
}(globalThis, function createAnalysisSummary() {
  function summarizeAnalyses(analyses) {
    return {
      total: analyses.length,
      clear: analyses.filter((item) => item.clarityClassification === 'CLEAR').length,
      partiallyClear: analyses.filter((item) => item.clarityClassification === 'PARTIALLY_CLEAR').length,
      ambiguous: analyses.filter((item) => item.clarityClassification === 'AMBIGUOUS').length,
      missingOrUnavailableCriteria: analyses.filter((item) =>
        ['MISSING', 'UNAVAILABLE'].includes(item.acceptanceCriteriaStatus)
      ).length,
      readyForTestDesign: analyses.filter((item) =>
        item.testDesignReadiness === 'READY_FOR_TEST_DESIGN'
      ).length,
      requiringClarification: analyses.filter((item) =>
        item.identifiedGaps.some((gap) => gap.clarificationRequired)
      ).length,
      clarificationQuestions: analyses.reduce((total, item) =>
        total + item.clarificationQuestions.length, 0)
    };
  }

  function matchesAnalysisFilters(analysis, filters) {
    return (!filters.clarity || analysis.clarityClassification === filters.clarity) &&
      (!filters.acceptanceCriteriaStatus || analysis.acceptanceCriteriaStatus === filters.acceptanceCriteriaStatus) &&
      (!filters.testDesignReadiness || analysis.testDesignReadiness === filters.testDesignReadiness);
  }

  return { summarizeAnalyses, matchesAnalysisFilters };
}));
