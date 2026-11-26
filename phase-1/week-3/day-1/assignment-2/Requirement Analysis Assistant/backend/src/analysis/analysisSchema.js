const CLARITY = ['CLEAR', 'PARTIALLY_CLEAR', 'AMBIGUOUS'];
const ACCEPTANCE_CRITERIA_STATUS = [
  'AVAILABLE_AND_VALID',
  'AVAILABLE_BUT_INCOMPLETE',
  'AVAILABLE_BUT_AMBIGUOUS',
  'AVAILABLE_BUT_NOT_TESTABLE',
  'MISSING',
  'UNAVAILABLE'
];
const READINESS = ['READY_FOR_TEST_DESIGN', 'PARTIALLY_READY', 'NOT_READY'];
const SEVERITY = ['High', 'Medium', 'Low'];
const CLARITY_DIMENSIONS = [
  'businessObjective',
  'userRole',
  'functionalCompleteness',
  'businessRules',
  'preconditions',
  'expectedOutcomes',
  'validationRules',
  'exceptionHandling',
  'scopeBoundaries',
  'consistency',
  'testability',
  'nonFunctionalRequirements'
];

const STRING_ARRAY = { type: 'array', items: { type: 'string' } };
const CLARITY_DIMENSION_SCHEMA = strictObject(Object.fromEntries(
  CLARITY_DIMENSIONS.map((dimension) => [dimension, { type: 'string' }])
));
const ACCEPTANCE_CRITERIA_FINDINGS_SCHEMA = strictObject({
  findings: STRING_ARRAY,
  clarity: { type: 'string' },
  completeness: { type: 'string' },
  measurability: { type: 'string' },
  testability: { type: 'string' },
  consistency: { type: 'string' },
  positiveScenarios: STRING_ARRAY,
  negativeScenarios: STRING_ARRAY,
  boundaryConditions: STRING_ARRAY
});
const GAP_SCHEMA = strictObject({
  category: { type: 'string' },
  description: { type: 'string' },
  evidence: { type: 'string' },
  testingImpact: { type: 'string' },
  severity: { type: 'string', enum: SEVERITY },
  clarificationRequired: { type: 'boolean' }
});
const CLARIFICATION_QUESTION_SCHEMA = strictObject({
  requirementId: { type: 'string' },
  question: { type: 'string' },
  associatedGap: { type: 'string' },
  reason: { type: 'string' },
  potentialImpact: { type: 'string' },
  priority: { type: 'string', enum: SEVERITY },
  blocksTestDesign: { type: 'boolean' }
});
const ANALYSIS_JSON_SCHEMA = strictObject({
  requirementId: { type: 'string' },
  title: { type: 'string' },
  clarityClassification: { type: 'string', enum: CLARITY },
  clarityReasoning: { type: 'string' },
  clarityDimensionFindings: CLARITY_DIMENSION_SCHEMA,
  acceptanceCriteriaStatus: { type: 'string', enum: ACCEPTANCE_CRITERIA_STATUS },
  acceptanceCriteriaFindings: ACCEPTANCE_CRITERIA_FINDINGS_SCHEMA,
  identifiedGaps: { type: 'array', items: GAP_SCHEMA },
  testDesignReadiness: { type: 'string', enum: READINESS },
  testExecutionReadiness: { type: 'string', enum: ['NOT_ASSESSED'] },
  testReadinessReasoning: { type: 'string' },
  clarificationQuestions: { type: 'array', items: CLARIFICATION_QUESTION_SCHEMA },
  recommendedNextAction: { type: 'string' }
});

function validateAnalysis(value, expectedId, expectedTitle) {
  if (!isObject(value)) invalidResponse(['response']);
  const fields = [];
  const check = (path, condition) => {
    if (!condition) fields.push(path);
  };
  check('requirementId', value.requirementId === expectedId);
  check('title', value.title === expectedTitle);
  check('clarityClassification', CLARITY.includes(value.clarityClassification));
  check('clarityReasoning', isNonEmptyString(value.clarityReasoning));
  check('clarityDimensionFindings', isObject(value.clarityDimensionFindings));
  CLARITY_DIMENSIONS.forEach((dimension) =>
    check(`clarityDimensionFindings.${dimension}`,
      isObject(value.clarityDimensionFindings) &&
      isNonEmptyString(value.clarityDimensionFindings[dimension]))
  );
  check('acceptanceCriteriaStatus', ACCEPTANCE_CRITERIA_STATUS.includes(value.acceptanceCriteriaStatus));
  check('acceptanceCriteriaFindings', isObject(value.acceptanceCriteriaFindings));
  const criteria = value.acceptanceCriteriaFindings;
  check('acceptanceCriteriaFindings.findings', isObject(criteria) && isStringArray(criteria.findings));
  ['clarity', 'completeness', 'measurability', 'testability', 'consistency'].forEach((key) =>
    check(`acceptanceCriteriaFindings.${key}`, isObject(criteria) && isNonEmptyString(criteria[key]))
  );
  ['positiveScenarios', 'negativeScenarios', 'boundaryConditions'].forEach((key) =>
    check(`acceptanceCriteriaFindings.${key}`, isObject(criteria) && isStringArray(criteria[key]))
  );
  check('identifiedGaps', Array.isArray(value.identifiedGaps));
  if (Array.isArray(value.identifiedGaps)) {
    value.identifiedGaps.forEach((gap, index) => {
      check(`identifiedGaps[${index}]`, isObject(gap));
      if (!isObject(gap)) return;
      ['category', 'description', 'evidence', 'testingImpact'].forEach((key) =>
        check(`identifiedGaps[${index}].${key}`, isNonEmptyString(gap[key]))
      );
      check(`identifiedGaps[${index}].severity`, SEVERITY.includes(gap.severity));
      check(`identifiedGaps[${index}].clarificationRequired`, typeof gap.clarificationRequired === 'boolean');
    });
  }
  check('testDesignReadiness', READINESS.includes(value.testDesignReadiness));
  check('testExecutionReadiness', value.testExecutionReadiness === 'NOT_ASSESSED');
  check('testReadinessReasoning', isNonEmptyString(value.testReadinessReasoning));
  check('clarificationQuestions', Array.isArray(value.clarificationQuestions));
  if (Array.isArray(value.clarificationQuestions)) {
    value.clarificationQuestions.forEach((question, index) => {
      check(`clarificationQuestions[${index}]`, isObject(question));
      if (!isObject(question)) return;
      check(`clarificationQuestions[${index}].requirementId`, question.requirementId === expectedId);
      ['question', 'associatedGap', 'reason', 'potentialImpact'].forEach((key) =>
        check(`clarificationQuestions[${index}].${key}`, isNonEmptyString(question[key]))
      );
      check(`clarificationQuestions[${index}].priority`, SEVERITY.includes(question.priority));
      check(`clarificationQuestions[${index}].blocksTestDesign`, typeof question.blocksTestDesign === 'boolean');
    });
  }
  check('recommendedNextAction', isNonEmptyString(value.recommendedNextAction));
  if (fields.length) invalidResponse(fields);
  return value;
}

class AnalysisError extends Error {
  constructor(message, statusCode = 502, code = 'ANALYSIS_FAILED') {
    super(message);
    this.name = 'AnalysisError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function invalidResponse(fields = ['response']) {
  const error = new AnalysisError('The AI response was incomplete or did not match the required analysis format.', 502, 'INVALID_RESPONSE');
  error.fields = fields;
  throw error;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function strictObject(properties) {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false
  };
}

module.exports = {
  validateAnalysis,
  AnalysisError,
  CLARITY,
  ACCEPTANCE_CRITERIA_STATUS,
  READINESS,
  CLARITY_DIMENSIONS,
  ANALYSIS_JSON_SCHEMA
};
