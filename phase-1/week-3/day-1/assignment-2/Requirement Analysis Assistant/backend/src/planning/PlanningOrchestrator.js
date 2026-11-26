const {
  extractExplicitDependencies,
  buildDependencyGraph,
  makeSemanticEdges
} = require('./DependencyGraph');
const { PrioritisationService } = require('./PrioritisationService');
const { WorkSequenceService } = require('./WorkSequenceService');
const { DependencyAnalysisService } = require('./DependencyAnalysisService');

class PlanningOrchestrator {
  constructor({
    analysisService,
    dependencyAnalysisService,
    prioritisationService = new PrioritisationService(),
    workSequenceService = new WorkSequenceService(),
    customDependencyTypes = process.env.JIRA_DEPENDENCY_LINK_TYPES || ''
  } = {}) {
    this.dependencyAnalysisService = dependencyAnalysisService ||
      new DependencyAnalysisService({ analysisService });
    this.prioritisationService = prioritisationService;
    this.workSequenceService = workSequenceService;
    this.customDependencyTypes = parseCustomDependencyTypes(customDependencyTypes);
  }

  estimate(requirements, phase2Analyses, scope) {
    return this.dependencyAnalysisService.estimate(requirements, phase2Analyses, scope);
  }

  getGroupManifest(requirements, phase2Analyses, scope) {
    return this.dependencyAnalysisService.getGroupManifest(requirements, phase2Analyses, scope);
  }

  hasUncachedGroups(requirements, phase2Analyses, cachedGroups, scope) {
    return this.dependencyAnalysisService.hasUncachedGroups(requirements, phase2Analyses, cachedGroups, scope);
  }

  async analyze(requirements, phase2Analyses, options = {}) {
    return this.dependencyAnalysisService.analyze(requirements, phase2Analyses, options);
  }

  buildPlan({
    requirements,
    phase2Analyses = [],
    semanticGroups = [],
    reviewDecisions = {},
    mode = 'rule-based',
    scope = 'selected',
    model = null
  }) {
    const phase2ById = new Map(phase2Analyses.map((analysis) => [analysis.requirementId, analysis]));
    const assessmentById = new Map();
    const successfulGroups = semanticGroups.filter((group) => group.status === 'succeeded' && group.analysis);
    successfulGroups.forEach((group) => {
      (group.analysis.assessments || []).forEach((assessment) =>
        assessmentById.set(assessment.requirementId, assessment));
    });

    const explicitEdges = extractExplicitDependencies(requirements, this.customDependencyTypes);
    const explicitPairs = new Set(explicitEdges.map((edge) =>
      `${edge.prerequisiteId}|${edge.dependentId}`
    ));
    const inferredEdges = makeSemanticEdges(successfulGroups.map((group) => group.analysis), reviewDecisions)
      .filter((edge) => !explicitPairs.has(`${edge.prerequisiteId}|${edge.dependentId}`));
    const baselineEdges = [
      ...explicitEdges,
      ...inferredEdges.filter((edge) => edge.status === 'confirmed')
    ];
    const provisionalEdges = [
      ...explicitEdges,
      ...inferredEdges.filter((edge) => edge.status !== 'rejected')
    ];
    const baselineGraph = buildDependencyGraph(requirements, baselineEdges);
    const provisionalGraph = buildDependencyGraph(requirements, provisionalEdges);
    const prioritisation = this.prioritisationService.rank(
      requirements,
      phase2ById,
      assessmentById,
      baselineGraph
    );
    const priorityById = new Map(prioritisation.items.map((item) => [item.requirementId, item]));
    const questions = collectQuestions(
      phase2Analyses,
      successfulGroups,
      inferredEdges,
      baselineGraph
    );
    const workSequence = this.workSequenceService.create(
      requirements,
      baselineGraph,
      phase2ById,
      priorityById,
      questions
    );
    const totalPairs = requirements.length * (requirements.length - 1) / 2;
    const assessedPairs = successfulGroups.reduce((sum, group) => {
      const count = group.requirementIds?.length || group.analysis.assessments?.length || 0;
      return sum + count * (count - 1) / 2;
    }, 0);
    const failedGroups = semanticGroups.filter((group) => group.status === 'failed').length;
    const pairCoverage = totalPairs === 0
      ? 100
      : Math.min(100, Math.round((assessedPairs / totalPairs) * 100));

    return {
      mode,
      scope,
      model,
      generatedAt: new Date().toISOString(),
      graph: baselineGraph,
      provisionalGraph,
      reviewableRelationships: inferredEdges,
      prioritisation,
      workSequence,
      questions,
      semanticAnalysis: {
        groups: semanticGroups.map((group) => ({
          cacheKey: group.cacheKey,
          requirementIds: group.requirementIds,
          status: group.status,
          cached: group.cached === true,
          ...(group.error ? { error: group.error } : {})
        })),
        summary: {
          total: semanticGroups.length,
          succeeded: semanticGroups.filter((group) => group.status === 'succeeded').length,
          failed: failedGroups,
          cached: semanticGroups.filter((group) => group.cached === true).length,
          complete: semanticGroups.length > 0 &&
            semanticGroups.every((group) => group.status === 'succeeded'),
          pairCoverage,
          possibleInScopePairs: totalPairs,
          assessedInGroupPairs: assessedPairs
        }
      },
      summary: {
        requirements: requirements.length,
        phase2Analysed: requirements.filter((requirement) => phase2ById.has(requirement.id)).length,
        dependencies: baselineGraph.summary,
        proposedRelationships: inferredEdges.filter((edge) => edge.status === 'pending').length,
        confirmedInferredRelationships: inferredEdges.filter((edge) => edge.status === 'confirmed').length,
        rejectedInferredRelationships: inferredEdges.filter((edge) => edge.status === 'rejected').length,
        questions: questions.length,
        ranked: prioritisation.items.filter((item) => item.rankingStatus === 'RANKED').length,
        unranked: prioritisation.items.filter((item) => item.rankingStatus === 'UNRANKED').length,
        sequencingActions: workSequence.items.length,
        unresolvedCycles: baselineGraph.summary.cycleCount,
        jiraLinkDataUnavailable: requirements.filter((requirement) =>
          !Array.isArray(requirement.dependencies)).length
      },
      warnings: buildWarnings({
        requirements,
        semanticGroups,
        failedGroups,
        pairCoverage,
        unresolvedCycles: baselineGraph.summary.cycleCount
      })
    };
  }
}

function collectQuestions(phase2Analyses, successfulGroups, inferredEdges, graph) {
  const questions = [];
  phase2Analyses.forEach((analysis) => {
    (analysis.clarificationQuestions || []).forEach((question) => {
      questions.push({
        id: `phase2:${analysis.requirementId}:${normalizeQuestion(question.question)}`,
        source: 'requirement-analysis',
        requirementIds: [analysis.requirementId],
        question: question.question,
        reason: question.reason,
        potentialImpact: question.potentialImpact,
        associatedGaps: question.associatedGap ? [question.associatedGap] : [],
        priority: normalizePriority(question.priority),
        blocksTestDesign: question.blocksTestDesign === true,
        blocksTestExecution: false
      });
    });
  });
  successfulGroups.forEach((group) => {
    (group.analysis.questions || []).forEach((question) => {
      questions.push({
        id: `planning:${normalizeQuestion(question.question)}`,
        source: 'dependency-analysis',
        requirementIds: [...new Set(question.requirementIds)].sort(),
        question: question.question,
        reason: question.reason,
        potentialImpact: question.potentialImpact,
        associatedGaps: question.associatedGap ? [question.associatedGap] : [],
        priority: normalizePriority(question.priority),
        blocksTestDesign: question.blocksTestDesign === true,
        blocksTestExecution: question.blocksTestExecution === true
      });
    });
  });
  inferredEdges.filter((edge) => edge.status === 'pending' && edge.suggestedQuestion).forEach((edge) => {
    questions.push({
      id: `edge:${edge.id}`,
      source: 'dependency-review',
      requirementIds: [edge.prerequisiteId, edge.dependentId].sort(),
      question: edge.suggestedQuestion,
      reason: `Confirm the suggested ${edge.kind.toLowerCase()} relationship using the cited requirement evidence.`,
      potentialImpact: 'Dependency order may change if this relationship is confirmed.',
      associatedGaps: [],
      priority: normalizePriority(edge.confidence),
      blocksTestDesign: edge.impact !== 'TEST_EXECUTION',
      blocksTestExecution: ['TEST_EXECUTION', 'BOTH'].includes(edge.impact)
    });
  });
  graph.edges.filter((edge) => edge.source === 'jira' &&
    (!graph.nodes.find((node) => node.id === edge.prerequisiteId)?.inScope ||
      !graph.nodes.find((node) => node.id === edge.dependentId)?.inScope)
  ).forEach((edge) => {
    questions.push({
      id: `external:${edge.id}`,
      source: 'external-dependency',
      requirementIds: [edge.prerequisiteId, edge.dependentId].sort(),
      question: `What is the current status of the linked requirement ${!graph.nodes.find((node) => node.id === edge.prerequisiteId)?.inScope ? edge.prerequisiteId : edge.dependentId}?`,
      reason: 'The Jira link points outside the selected planning scope.',
      potentialImpact: 'The external relationship may affect the proposed work order.',
      associatedGaps: [],
      priority: 'MEDIUM',
      blocksTestDesign: edge.impact !== 'TEST_EXECUTION',
      blocksTestExecution: ['TEST_EXECUTION', 'BOTH'].includes(edge.impact)
    });
  });

  const deduplicated = new Map();
  questions.forEach((question) => {
    const key = normalizeQuestion(question.question);
    const existing = deduplicated.get(key);
    if (!existing) {
      deduplicated.set(key, {
        ...question,
        sources: [question.source],
        sourceReferences: [{ source: question.source, requirementIds: [...question.requirementIds] }],
        reasons: [question.reason],
        potentialImpacts: [question.potentialImpact],
        associatedGaps: question.associatedGaps || []
      });
      return;
    }
    existing.requirementIds = [...new Set([...existing.requirementIds, ...question.requirementIds])].sort();
    if (existing.source !== question.source) existing.source = 'combined';
    existing.sources = [...new Set([...existing.sources, question.source])].sort();
    const sourceReference = {
      source: question.source,
      requirementIds: [...question.requirementIds]
    };
    if (!existing.sourceReferences.some((reference) =>
      reference.source === sourceReference.source &&
      reference.requirementIds.join('|') === sourceReference.requirementIds.join('|')
    )) existing.sourceReferences.push(sourceReference);
    existing.reasons = [...new Set([...existing.reasons, question.reason])];
    existing.potentialImpacts = [...new Set([...existing.potentialImpacts, question.potentialImpact])];
    existing.associatedGaps = [...new Set([...existing.associatedGaps, ...(question.associatedGaps || [])])];
    existing.blocksTestDesign ||= question.blocksTestDesign;
    existing.blocksTestExecution ||= question.blocksTestExecution;
    if (priorityRank(question.priority) < priorityRank(existing.priority)) existing.priority = question.priority;
  });
  return [...deduplicated.values()].sort((left, right) =>
    priorityRank(left.priority) - priorityRank(right.priority) ||
    left.requirementIds.join('|').localeCompare(right.requirementIds.join('|'))
  );
}

function buildWarnings({ requirements, semanticGroups, failedGroups, pairCoverage, unresolvedCycles }) {
  const warnings = [];
  if (requirements.some((requirement) => !Array.isArray(requirement.dependencies))) {
    warnings.push('Jira issue-link data was unavailable for one or more requirements; explicit dependency coverage is incomplete.');
  }
  if (semanticGroups.length > 1) {
    warnings.push('AI dependency analysis was grouped to control request size. Relationships across different groups were not assessed.');
  }
  if (semanticGroups.length && pairCoverage < 100) {
    warnings.push(`Semantic relationship coverage is approximately ${pairCoverage}% of in-scope pairs.`);
  }
  if (failedGroups) {
    warnings.push(`${failedGroups} semantic group(s) failed. Successful groups remain available; retry only failed groups.`);
  }
  if (unresolvedCycles) {
    warnings.push(`${unresolvedCycles} confirmed dependency cycle(s) prevent a valid sequence for affected requirements.`);
  }
  if (requirements.length > 1 && semanticGroups.length === 0) {
    warnings.push('Rule-based planning uses explicit Jira links only and does not infer relationships.');
  }
  return warnings;
}

function parseCustomDependencyTypes(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeQuestion(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizePriority(value) {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'HIGH') return 'HIGH';
  if (normalized === 'LOW') return 'LOW';
  return 'MEDIUM';
}

function priorityRank(value) {
  return { HIGH: 0, MEDIUM: 1, LOW: 2 }[normalizePriority(value)];
}

module.exports = {
  PlanningOrchestrator,
  collectQuestions,
  buildWarnings,
  parseCustomDependencyTypes
};
