const DEFAULT_PRIORITY_WEIGHTS = Object.freeze({
  businessCriticality: 30,
  dependencyImpact: 25,
  jiraPriority: 20,
  testDesignReadiness: 15,
  risk: 10
});
const MINIMUM_WEIGHT_COVERAGE = 0.6;

const JIRA_PRIORITY_SCORES = new Map([
  ['blocker', 100],
  ['highest', 90],
  ['critical', 90],
  ['high', 75],
  ['major', 70],
  ['medium', 50],
  ['normal', 50],
  ['minor', 30],
  ['low', 25],
  ['lowest', 10],
  ['trivial', 15]
]);
const SEVERITY_SCORES = new Map([
  ['HIGH', 90],
  ['MEDIUM', 60],
  ['LOW', 25]
]);

class PrioritisationService {
  constructor(weights = configuredWeights()) {
    this.weights = validateWeights(weights);
  }

  rank(requirements, phase2ById, assessmentById, graph) {
    const scores = requirements.map((requirement) => {
      const factorScores = scoreFactors(
        requirement,
        phase2ById.get(requirement.id),
        assessmentById.get(requirement.id),
        graph
      );
      const knownWeight = Object.entries(this.weights)
        .reduce((total, [factor, weight]) =>
          total + (factorScores[factor].score === null ? 0 : weight), 0);
      const weightedTotal = Object.entries(this.weights)
        .reduce((total, [factor, weight]) =>
          total + (factorScores[factor].score === null ? 0 : factorScores[factor].score * weight), 0);
      const coverage = knownWeight / 100;
      return {
        requirementId: requirement.id,
        score: coverage >= MINIMUM_WEIGHT_COVERAGE
          ? Math.round(weightedTotal / knownWeight)
          : null,
        evidenceCoverage: Math.round(coverage * 100),
        rankingStatus: coverage >= MINIMUM_WEIGHT_COVERAGE ? 'RANKED' : 'UNRANKED',
        factors: Object.fromEntries(Object.entries(factorScores).map(([factor, value]) => [
          factor,
          { ...value, weight: this.weights[factor] }
        ])),
        reasoning: coverage >= MINIMUM_WEIGHT_COVERAGE
          ? `Score reflects ${knownWeight}% of configured factor weight; unknown factors were excluded and remaining weights were normalized.`
          : `Only ${knownWeight}% of configured factor weight is supported by available evidence; more information is needed before ranking.`
      };
    });
    const ordered = [...scores].sort((left, right) => {
      if (left.score === null && right.score !== null) return 1;
      if (left.score !== null && right.score === null) return -1;
      if (left.score !== right.score) return (right.score || 0) - (left.score || 0);
      return left.requirementId.localeCompare(right.requirementId);
    });
    ordered.forEach((item, index) => {
      item.rank = item.score === null ? null : index + 1;
    });
    return {
      weights: { ...this.weights },
      minimumEvidenceCoverage: MINIMUM_WEIGHT_COVERAGE,
      items: ordered
    };
  }
}

function scoreFactors(requirement, phase2, assessment, graph) {
  const assessmentConfidence = assessment && assessment.confidence;
  const reliableAssessment = assessment && assessmentConfidence !== 'LOW';
  const criticality = reliableAssessment
    ? severityScore(assessment.businessCriticality)
    : null;
  const risk = reliableAssessment ? severityScore(assessment.risk) : null;
  const relationships = graph.relationships.find((item) => item.requirementId === requirement.id);
  const dependencyKnown = Array.isArray(requirement.dependencies) ||
    graph.edges.some((edge) => edge.status === 'confirmed' &&
      (edge.prerequisiteId === requirement.id || edge.dependentId === requirement.id));
  const dependencyCount = relationships
    ? relationships.directPrerequisites.length + relationships.directDependents.length
    : 0;
  const dependencyImpact = !dependencyKnown
    ? null
    : dependencyCount === 0
      ? 0
      : Math.min(100, 25 + dependencyCount * 25);
  const jiraPriority = typeof requirement.priority === 'string'
    ? JIRA_PRIORITY_SCORES.get(requirement.priority.trim().toLowerCase()) ?? null
    : null;
  const readinessScores = {
    READY_FOR_TEST_DESIGN: 100,
    PARTIALLY_READY: 60,
    NOT_READY: 20
  };
  const readiness = phase2 && readinessScores[phase2.testDesignReadiness] !== undefined
    ? readinessScores[phase2.testDesignReadiness]
    : null;

  return {
    businessCriticality: factor(criticality, assessment?.criticalityEvidence, 'Business criticality is not stated or assessable.'),
    dependencyImpact: factor(
      dependencyImpact,
      dependencyKnown
        ? dependencyCount
          ? `${dependencyCount} direct dependency relationship(s) are in the confirmed scope.`
          : 'Retrieved Jira links show no confirmed blocking relationships.'
        : 'Jira issue-link data is unavailable and no confirmed relationship was reviewed.',
      'Dependency information is unavailable.'
    ),
    jiraPriority: factor(
      jiraPriority,
      jiraPriority === null ? null : `Jira priority is ${requirement.priority}.`,
      'Jira priority is unavailable or not recognized.'
    ),
    testDesignReadiness: factor(
      readiness,
      phase2?.testReadinessReasoning,
      'A validated Phase 2 test-design readiness assessment is unavailable.'
    ),
    risk: factor(risk, assessment?.riskEvidence, 'Risk evidence is not available or assessable.')
  };
}

function factor(score, evidence, unavailableReason) {
  return {
    score,
    evidence: score === null ? unavailableReason : evidence || 'Available evidence supports this factor.'
  };
}

function severityScore(value) {
  return SEVERITY_SCORES.get(String(value || '').toUpperCase()) ?? null;
}

function configuredWeights() {
  const configured = process.env.PLANNING_PRIORITY_WEIGHTS;
  if (!configured) return DEFAULT_PRIORITY_WEIGHTS;
  let parsed;
  try {
    parsed = JSON.parse(configured);
  } catch {
    throw new Error('PLANNING_PRIORITY_WEIGHTS must be a JSON object with the documented factors.');
  }
  return parsed;
}

function validateWeights(weights) {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    throw new Error('Priority weights must be a JSON object.');
  }
  const keys = Object.keys(DEFAULT_PRIORITY_WEIGHTS);
  if (Object.keys(weights).sort().join('|') !== [...keys].sort().join('|')) {
    throw new Error(`Priority weights must define exactly: ${keys.join(', ')}.`);
  }
  const values = keys.map((key) => weights[key]);
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new Error('Priority weights must be finite numbers from 0 to 100.');
  }
  if (values.reduce((sum, value) => sum + value, 0) !== 100) {
    throw new Error('Priority weights must total exactly 100.');
  }
  return Object.fromEntries(keys.map((key) => [key, weights[key]]));
}

module.exports = {
  PrioritisationService,
  DEFAULT_PRIORITY_WEIGHTS,
  MINIMUM_WEIGHT_COVERAGE,
  scoreFactors,
  validateWeights
};
