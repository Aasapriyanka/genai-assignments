const { AnalysisError } = require('../analysis/analysisSchema');

const DEPENDENCY_KINDS = ['BLOCKS', 'REQUIRES', 'ENABLES', 'OTHER'];
const IMPACT_TYPES = ['TEST_DESIGN', 'TEST_EXECUTION', 'BOTH'];
const SEVERITIES = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
const CONFIDENCE = ['HIGH', 'MEDIUM', 'LOW'];

const STRING_ARRAY = { type: 'array', items: { type: 'string' } };
const DEPENDENCY_ITEM_SCHEMA = strictObject({
  prerequisiteId: { type: 'string' },
  dependentId: { type: 'string' },
  kind: { type: 'string', enum: DEPENDENCY_KINDS },
  impact: { type: 'string', enum: IMPACT_TYPES },
  evidence: { type: 'string' },
  reasoning: { type: 'string' },
  confidence: { type: 'string', enum: CONFIDENCE },
  suggestedQuestion: { type: 'string' }
});
const REQUIREMENT_ASSESSMENT_SCHEMA = strictObject({
  requirementId: { type: 'string' },
  businessCriticality: { type: 'string', enum: SEVERITIES },
  criticalityEvidence: { type: 'string' },
  risk: { type: 'string', enum: SEVERITIES },
  riskEvidence: { type: 'string' },
  reasoning: { type: 'string' },
  confidence: { type: 'string', enum: CONFIDENCE }
});
const QUESTION_SCHEMA = strictObject({
  requirementIds: STRING_ARRAY,
  question: { type: 'string' },
  reason: { type: 'string' },
  potentialImpact: { type: 'string' },
  priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
  blocksTestDesign: { type: 'boolean' },
  blocksTestExecution: { type: 'boolean' }
});
const DEPENDENCY_ANALYSIS_SCHEMA = strictObject({
  dependencies: { type: 'array', items: DEPENDENCY_ITEM_SCHEMA },
  assessments: { type: 'array', items: REQUIREMENT_ASSESSMENT_SCHEMA },
  questions: { type: 'array', items: QUESTION_SCHEMA }
});

function validateDependencyAnalysis(value, requirementIds) {
  const fields = [];
  const check = (field, condition) => {
    if (!condition) fields.push(field);
  };
  check('response', isObject(value));
  if (!isObject(value)) invalid(fields);
  check('response.additionalProperties', hasExactKeys(value, ['dependencies', 'assessments', 'questions']));

  check('dependencies', Array.isArray(value.dependencies));
  check('assessments', Array.isArray(value.assessments));
  check('questions', Array.isArray(value.questions));

  const ids = new Set(requirementIds);
  if (Array.isArray(value.dependencies)) {
    value.dependencies.forEach((item, index) => {
      const path = `dependencies[${index}]`;
      check(path, isObject(item));
      if (!isObject(item)) return;
      check(`${path}.additionalProperties`, hasExactKeys(item, [
        'prerequisiteId', 'dependentId', 'kind', 'impact', 'evidence',
        'reasoning', 'confidence', 'suggestedQuestion'
      ]));
      check(`${path}.prerequisiteId`, ids.has(item.prerequisiteId));
      check(`${path}.dependentId`, ids.has(item.dependentId));
      check(`${path}.differentEndpoints`,
        typeof item.prerequisiteId === 'string' && item.prerequisiteId !== item.dependentId);
      check(`${path}.kind`, DEPENDENCY_KINDS.includes(item.kind) && item.kind !== 'OTHER');
      check(`${path}.impact`, IMPACT_TYPES.includes(item.impact));
      check(`${path}.evidence`, isNonEmpty(item.evidence));
      check(`${path}.reasoning`, isNonEmpty(item.reasoning));
      check(`${path}.confidence`, CONFIDENCE.includes(item.confidence));
      check(`${path}.suggestedQuestion`, typeof item.suggestedQuestion === 'string');
    });
  }
  if (Array.isArray(value.assessments)) {
    check('assessments.count', value.assessments.length === ids.size);
    const seen = new Set();
    value.assessments.forEach((item, index) => {
      const path = `assessments[${index}]`;
      check(path, isObject(item));
      if (!isObject(item)) return;
      check(`${path}.additionalProperties`, hasExactKeys(item, [
        'requirementId', 'businessCriticality', 'criticalityEvidence',
        'risk', 'riskEvidence', 'reasoning', 'confidence'
      ]));
      check(`${path}.requirementId`, ids.has(item.requirementId) && !seen.has(item.requirementId));
      seen.add(item.requirementId);
      check(`${path}.businessCriticality`, SEVERITIES.includes(item.businessCriticality));
      check(`${path}.criticalityEvidence`, isNonEmpty(item.criticalityEvidence));
      check(`${path}.risk`, SEVERITIES.includes(item.risk));
      check(`${path}.riskEvidence`, isNonEmpty(item.riskEvidence));
      check(`${path}.reasoning`, isNonEmpty(item.reasoning));
      check(`${path}.confidence`, CONFIDENCE.includes(item.confidence));
    });
    ids.forEach((id) => check(`assessments.${id}`, seen.has(id)));
  }
  if (Array.isArray(value.questions)) {
    value.questions.forEach((item, index) => {
      const path = `questions[${index}]`;
      check(path, isObject(item));
      if (!isObject(item)) return;
      check(`${path}.additionalProperties`, hasExactKeys(item, [
        'requirementIds', 'question', 'reason', 'potentialImpact',
        'priority', 'blocksTestDesign', 'blocksTestExecution'
      ]));
      check(`${path}.requirementIds`,
        Array.isArray(item.requirementIds) &&
        item.requirementIds.length > 0 &&
        item.requirementIds.every((id) => ids.has(id)));
      check(`${path}.question`, isNonEmpty(item.question));
      check(`${path}.reason`, isNonEmpty(item.reason));
      check(`${path}.potentialImpact`, isNonEmpty(item.potentialImpact));
      check(`${path}.priority`, ['HIGH', 'MEDIUM', 'LOW'].includes(item.priority));
      check(`${path}.blocksTestDesign`, typeof item.blocksTestDesign === 'boolean');
      check(`${path}.blocksTestExecution`, typeof item.blocksTestExecution === 'boolean');
    });
  }
  if (fields.length) invalid(fields);
  return value;
}

function strictObject(properties) {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false
  };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasExactKeys(value, keys) {
  return Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}

function invalid(fields) {
  const error = new AnalysisError('The AI dependency analysis did not match the required format.', 502, 'INVALID_RESPONSE');
  error.fields = fields.length ? fields : ['response'];
  throw error;
}

module.exports = {
  DEPENDENCY_ANALYSIS_SCHEMA,
  validateDependencyAnalysis,
  DEPENDENCY_KINDS,
  IMPACT_TYPES,
  SEVERITIES,
  CONFIDENCE
};
