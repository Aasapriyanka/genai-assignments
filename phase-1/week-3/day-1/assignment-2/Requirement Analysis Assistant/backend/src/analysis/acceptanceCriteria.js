const EMPTY_STATUS = {
  MISSING: {
    status: 'MISSING',
    reason: 'No meaningful acceptance criteria were found in the retrieved Jira field or the description.'
  },
  UNAVAILABLE: {
    status: 'UNAVAILABLE',
    reason: 'Acceptance criteria are unavailable: the Jira field was not retrieved and no criteria were identified in the description.'
  }
};

function extractAcceptanceCriteria(description) {
  if (typeof description !== 'string' || description.trim() === '') return null;

  const lines = description.split(/\r?\n/);
  const collected = [];
  let collecting = false;

  for (const line of lines) {
    const heading = line.match(/^\s*(?:#{1,6}\s*)?(?:acceptance\s+criteria|acceptance\s+criterion|acceptance\s+conditions|ac)\s*:?\s*(.*)$/i);
    if (heading) {
      collecting = true;
      if (heading[1].trim()) collected.push(heading[1].trim());
      continue;
    }

    if (collecting && isSectionHeading(line)) break;
    if (collecting) collected.push(line);
  }

  const content = collected.join('\n').trim();
  return content || null;
}

function assessAcceptanceCriteria(requirement) {
  const criteria = requirement && requirement.acceptanceCriteria || {};
  const fieldRetrieved = criteria.fieldRetrieved === true;
  const fieldValue = meaningfulText(criteria.value);
  const descriptionCriteria = extractAcceptanceCriteria(requirement && requirement.description);
  const content = [
    fieldValue ? `Jira field${criteria.fieldName ? ` (${criteria.fieldName})` : ''}:\n${fieldValue}` : '',
    descriptionCriteria ? `Description section:\n${descriptionCriteria}` : ''
  ].filter(Boolean).join('\n\n');
  const contentAvailable = content.length > 0;
  const emptyClassification = contentAvailable
    ? null
    : EMPTY_STATUS[fieldRetrieved ? 'MISSING' : 'UNAVAILABLE'];

  return {
    fieldRetrieved,
    fieldName: typeof criteria.fieldName === 'string' ? criteria.fieldName : null,
    fieldValue: typeof criteria.value === 'string' ? criteria.value : null,
    descriptionCriteria,
    content,
    contentAvailable,
    deterministicStatus: emptyClassification && emptyClassification.status,
    deterministicReason: emptyClassification && emptyClassification.reason
  };
}

function isStructurallyEmptyRequirement(requirement) {
  const presence = assessAcceptanceCriteria(requirement);
  return meaningfulText(requirement && requirement.description) === '' && !presence.contentAvailable;
}

function buildEmptyRequirementAnalysis(requirement, assessment = assessAcceptanceCriteria(requirement)) {
  const missingText = 'The Jira description contains no meaningful requirement content.';
  const cannotAssess = 'Cannot assess because no meaningful description or acceptance criteria are available.';
  const criteriaStatus = assessment.deterministicStatus || 'UNAVAILABLE';
  const criteriaGap = {
    category: 'Acceptance criteria',
    description: criteriaStatus === 'MISSING'
      ? 'Acceptance criteria are missing from the retrieved Jira field and description.'
      : 'Acceptance criteria could not be retrieved and are not present in the description.',
    evidence: assessment.deterministicReason || cannotAssess,
    testingImpact: 'Expected outcomes and verifiable conditions cannot be established.',
    severity: 'High',
    clarificationRequired: true
  };
  const gaps = [
    ['Business objective', 'The business objective is not stated.'],
    ['Intended functionality', 'The intended user-visible functionality is not stated.'],
    ['User role or stakeholder', 'The user role or stakeholder is not identified.'],
    [criteriaGap.category, criteriaGap.description]
  ];
  const identifiedGaps = gaps.map(([category, description]) => ({
    category,
    description,
    evidence: category === criteriaGap.category ? criteriaGap.evidence : missingText,
    testingImpact: category === criteriaGap.category
      ? criteriaGap.testingImpact
      : 'The expected behavior and relevant test scope cannot be determined.',
    severity: 'High',
    clarificationRequired: true
  }));
  const clarificationQuestions = [
    ['Business objective', 'What business objective should this requirement achieve?'],
    ['Intended functionality', 'What should the user be able to do, and what outcome should the system provide?'],
    ['User role or stakeholder', 'Which user role or stakeholder is expected to use or be affected by this functionality?'],
    ['Acceptance criteria', criteriaStatus === 'MISSING'
      ? 'What acceptance criteria define the expected and verifiable outcomes?'
      : 'Can you provide the acceptance criteria for this requirement?']
  ].map(([associatedGap, question]) => ({
    requirementId: requirement.requirementId,
    question,
    associatedGap,
    reason: gaps.find(([category]) => category === associatedGap)[1],
    potentialImpact: 'Test design cannot be completed reliably without this information.',
    priority: 'High',
    blocksTestDesign: true
  }));
  const dimensionFindings = {
    businessObjective: 'Not stated in the retrieved description.',
    userRole: 'No user role or stakeholder is stated.',
    functionalCompleteness: 'Cannot assess intended functionality because the description is empty.',
    businessRules: cannotAssess,
    preconditions: cannotAssess,
    expectedOutcomes: cannotAssess,
    validationRules: cannotAssess,
    exceptionHandling: 'Cannot assess; no relevant behavior is described.',
    scopeBoundaries: cannotAssess,
    consistency: cannotAssess,
    testability: 'Cannot assess without a described behavior or expected outcome.',
    nonFunctionalRequirements: 'Cannot assess relevance without a described behavior.'
  };
  return {
    requirementId: requirement.requirementId,
    title: requirement.title,
    clarityClassification: 'AMBIGUOUS',
    clarityReasoning: 'The Jira description and acceptance-criteria content are empty, so the intended objective and behavior cannot be established.',
    clarityDimensionFindings: dimensionFindings,
    acceptanceCriteriaStatus: criteriaStatus,
    acceptanceCriteriaFindings: {
      findings: [criteriaGap.description],
      clarity: cannotAssess,
      completeness: cannotAssess,
      measurability: cannotAssess,
      testability: cannotAssess,
      consistency: cannotAssess,
      positiveScenarios: [],
      negativeScenarios: [],
      boundaryConditions: []
    },
    identifiedGaps,
    testDesignReadiness: 'NOT_READY',
    testExecutionReadiness: 'NOT_ASSESSED',
    testReadinessReasoning: 'Test design is not ready because there is no meaningful requirement description or acceptance-criteria content.',
    clarificationQuestions,
    recommendedNextAction: 'Ask the Product Owner to provide the business objective, intended functionality, affected user role, and acceptance criteria.',
    analysisSource: 'RULE_BASED'
  };
}

function enforceAcceptanceCriteriaPresence(analysis, assessment) {
  if (!assessment.deterministicStatus) return analysis;

  const cannotAssess = 'Cannot assess because no meaningful acceptance-criteria content is available.';
  return {
    ...analysis,
    acceptanceCriteriaStatus: assessment.deterministicStatus,
    acceptanceCriteriaFindings: {
      findings: [assessment.deterministicReason],
      clarity: cannotAssess,
      completeness: cannotAssess,
      measurability: cannotAssess,
      testability: cannotAssess,
      consistency: cannotAssess,
      positiveScenarios: [],
      negativeScenarios: [],
      boundaryConditions: []
    }
  };
}

function meaningfulText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isSectionHeading(line) {
  const trimmed = line.trim();
  if (/^#{1,6}\s+\S/.test(trimmed)) return true;
  return /^(?:description|background|business rules?|preconditions?|notes?|out of scope|non[- ]functional requirements?)\s*:\s*.*$/i.test(trimmed);
}

module.exports = {
  extractAcceptanceCriteria,
  assessAcceptanceCriteria,
  enforceAcceptanceCriteriaPresence,
  isStructurallyEmptyRequirement,
  buildEmptyRequirementAnalysis
};
