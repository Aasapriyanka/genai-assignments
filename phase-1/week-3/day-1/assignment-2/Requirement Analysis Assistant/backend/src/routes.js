const express = require('express');
const { JiraConnector, JiraApiError } = require('./jira/JiraConnector');
const { GroqAnalysisService } = require('./analysis/GroqAnalysisService');
const { AnalysisError, validateAnalysis } = require('./analysis/analysisSchema');
const { analyzeBatch } = require('./analysis/analyzeBatch');
const { AnalysisProgressTracker } = require('./analysis/AnalysisProgressTracker');
const { isStructurallyEmptyRequirement } = require('./analysis/acceptanceCriteria');
const { createUsageAccumulator, recordUsage, serializeUsage } = require('./analysis/usage');
const { PlanningOrchestrator } = require('./planning/PlanningOrchestrator');
const { PlanningProgressTracker } = require('./planning/PlanningProgressTracker');
const { validateDependencyAnalysis } = require('./planning/dependencyAnalysisSchema');

function createRouter(
  connector = new JiraConnector(),
  analysisService = new GroqAnalysisService(),
  progressTracker = new AnalysisProgressTracker(),
  planningOrchestrator = new PlanningOrchestrator({ analysisService }),
  planningProgressTracker = new PlanningProgressTracker()
) {
  const router = express.Router();

  router.post('/jira/validate', async (req, res) => {
    try {
      const credentials = readCredentials(req.body);
      const user = await connector.validateCredentials(credentials);
      res.json({ user });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/jira/projects', async (req, res) => {
    try {
      const credentials = readCredentials(req.body);
      const projects = await connector.getProjects(credentials);
      res.json({ projects });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/jira/stories', async (req, res) => {
    try {
      const credentials = readCredentials(req.body);
      const issues = await connector.getStories(credentials, req.body.projectKey);
      const { normaliseRequirement } = require('./normaliseRequirement');
      res.json({ requirements: issues.map(normaliseRequirement) });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/analysis/batch', async (req, res) => {
    let jobId;
    let requirementIds = [];
    let claimed = false;
    try {
      const requirements = validateAnalysisBatch(req.body && req.body.requirements);
      jobId = validateJobId(req.body && req.body.jobId);
      if (requirements.some((requirement) => !isStructurallyEmptyRequirement(requirement))) {
        try {
          await analysisService.getRuntimeConfig();
        } catch (error) {
          return sendError(res, error, 'configuration');
        }
      }
      requirementIds = requirements.map((requirement) => requirement.requirementId);
      progressTracker.claim(jobId, requirementIds);
      claimed = true;
      const usage = createUsageAccumulator();
      const results = await analyzeBatch(
        requirements,
        analysisService,
        analysisService.concurrency,
        (id, status) => progressTracker.update(jobId, id, status),
        (event) => recordUsage(usage, event)
      );
      const usedGroq = results.some((result) => result.analysis?.analysisSource !== 'RULE_BASED');
      res.json({
        model: usedGroq ? analysisService.activeModel : null,
        usage: serializeUsage(usage),
        results: results.filter((result) => result.analysis),
        failures: results.filter((result) => result.error)
      });
    } catch (error) {
      if (claimed) requirementIds.forEach((id) => progressTracker.update(jobId, id, 'failed'));
      sendError(res, error);
    }
  });

  router.post('/analysis/config', async (req, res) => {
    try {
      res.json(await analysisService.getRuntimeConfig());
    } catch (error) {
      sendError(res, error, 'configuration');
    }
  });

  router.post('/analysis/jobs', (req, res) => {
    try {
      const job = validateAnalysisJob(req.body || {});
      progressTracker.start(job.jobId, job.requirementIds);
      res.status(202).json({ jobId: job.jobId });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/analysis/progress', (req, res) => {
    try {
      const jobId = validateJobId(req.body && req.body.jobId);
      res.json(progressTracker.snapshot(jobId));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/analysis/jobs/finish', (req, res) => {
    try {
      const jobId = validateJobId(req.body && req.body.jobId);
      progressTracker.finish(jobId);
      res.json({ finished: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/planning/estimate', (req, res) => {
    try {
      const input = validatePlanningRequest(req.body);
      const groups = planningOrchestrator.getGroupManifest(input.requirements, input.phase2Analyses, input.scope);
      res.json({
        estimate: planningOrchestrator.estimate(input.requirements, input.phase2Analyses, input.scope),
        groups
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/planning/rules', (req, res) => {
    try {
      const input = validatePlanningRequest(req.body);
      const plan = planningOrchestrator.buildPlan({
        ...input,
        mode: 'rule-based',
        semanticGroups: [],
        reviewDecisions: {}
      });
      res.json({ plan });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/planning/jobs', (req, res) => {
    try {
      const job = validatePlanningJob(req.body || {});
      planningProgressTracker.start(job.jobId, job.groupIds);
      res.status(202).json({ jobId: job.jobId });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/planning/progress', (req, res) => {
    try {
      const jobId = validateJobId(req.body && req.body.jobId);
      res.json(planningProgressTracker.snapshot(jobId));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/planning/jobs/finish', (req, res) => {
    try {
      const jobId = validateJobId(req.body && req.body.jobId);
      planningProgressTracker.finish(jobId);
      res.json({ finished: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/planning/ai', async (req, res) => {
    let jobId;
    let claimed = false;
    const usage = createUsageAccumulator();
    try {
      const input = validatePlanningRequest(req.body, { requireConsent: true });
      jobId = validateJobId(req.body && req.body.jobId);
      const manifest = planningOrchestrator.getGroupManifest(input.requirements, input.phase2Analyses, input.scope);
      const manifestKeys = manifest.map((group) => group.key);
      planningProgressTracker.claim(jobId, manifestKeys);
      claimed = true;
      const currentModel = analysisService.activeModel || analysisService.configuredModel || null;
      const cachedNeedsModelCheck = input.cachedGroups.length > 0 && (
        !currentModel ||
        input.cachedGroups.some((entry) => !entry.model || entry.model !== currentModel)
      );
      const requiresConfiguration = cachedNeedsModelCheck || planningOrchestrator.hasUncachedGroups(
        input.requirements,
        input.phase2Analyses,
        input.cachedGroups,
        input.scope
      );
      let cachedGroups = input.cachedGroups;
      if (requiresConfiguration) {
        try {
          const config = await analysisService.getRuntimeConfig();
          if (cachedNeedsModelCheck) {
            cachedGroups = input.cachedGroups.filter((entry) => entry.model === config.model);
          }
        } catch (error) {
          planningProgressTracker.finish(jobId);
          return sendError(res, error, 'configuration');
        }
      }

      const semanticAnalysis = await planningOrchestrator.analyze(
        input.requirements,
        input.phase2Analyses,
        {
          cachedGroups,
          scope: input.scope,
          onGroupStatus: (groupId, status) => planningProgressTracker.update(jobId, groupId, status),
          onUsage: (event) => recordUsage(usage, event)
        }
      );
      const plan = planningOrchestrator.buildPlan({
        ...input,
        semanticGroups: semanticAnalysis.groups,
        reviewDecisions: input.reviewDecisions,
        mode: 'ai-enhanced',
        model: semanticAnalysis.model || analysisService.activeModel || analysisService.configuredModel || null
      });
      planningProgressTracker.finish(jobId);
      res.json({ plan, semanticGroups: semanticAnalysis.groups, usage: serializeUsage(usage) });
    } catch (error) {
      if (claimed) {
        try {
          planningProgressTracker.finish(jobId);
        } catch {
          // A pruned progress record must not hide the original operation error.
        }
      }
      sendError(res, error);
    }
  });

  router.post('/planning/recalculate', (req, res) => {
    try {
      const input = validatePlanningRequest(req.body);
      const manifest = planningOrchestrator.getGroupManifest(input.requirements, input.phase2Analyses, input.scope);
      const semanticGroups = validateSemanticGroups(
        req.body && req.body.semanticGroups,
        manifest,
        input.requirements
      );
      const reviewDecisions = validateReviewDecisions(
        req.body && req.body.reviewDecisions,
        new Set(input.requirements.map((requirement) => requirement.id))
      );
      if (req.body.mode !== undefined && !['rule-based', 'ai-enhanced'].includes(req.body.mode)) {
        throw new AnalysisError('Planning mode is invalid.', 400, 'INVALID_REQUEST');
      }
      const plan = planningOrchestrator.buildPlan({
        ...input,
        semanticGroups,
        reviewDecisions,
        mode: req.body.mode || 'rule-based',
        model: typeof req.body.model === 'string' ? req.body.model.slice(0, 100) : null
      });
      res.json({ plan });
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}

function validatePlanningRequest(body, { requireConsent = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AnalysisError('The planning request must be a JSON object.', 400, 'INVALID_REQUEST');
  }
  const requirements = body && body.requirements;
  if (!Array.isArray(requirements) || requirements.length < 1 || requirements.length > 100) {
    throw new AnalysisError('Select between 1 and 100 requirements for planning.', 400, 'INVALID_REQUEST');
  }
  const requirementIds = new Set();
  let totalTextLength = 0;
  const normalizedRequirements = requirements.map((requirement) => {
    if (
      !requirement ||
      typeof requirement.id !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_]{0,63}-[0-9]{1,12}$/.test(requirement.id) ||
      typeof requirement.title !== 'string' ||
      requirement.title.length > 2000 ||
      !(requirement.description === null || typeof requirement.description === 'string') ||
      (typeof requirement.description === 'string' && requirement.description.length > 12000) ||
      !(requirement.priority === null || typeof requirement.priority === 'string') ||
      (typeof requirement.priority === 'string' && requirement.priority.length > 100) ||
      !(requirement.dependencies === null || Array.isArray(requirement.dependencies)) ||
      (Array.isArray(requirement.dependencies) && requirement.dependencies.length > 200)
    ) {
      throw new AnalysisError('Each planning requirement must contain valid Jira ID, title, description, priority and dependency fields.', 400, 'INVALID_REQUEST');
    }
    if (requirementIds.has(requirement.id)) {
      throw new AnalysisError('A planning scope cannot contain duplicate requirement IDs.', 400, 'INVALID_REQUEST');
    }
    requirementIds.add(requirement.id);
    totalTextLength += requirement.title.length + (requirement.description || '').length;
    const dependencies = requirement.dependencies === null
      ? null
      : requirement.dependencies.map((link) => {
        if (
          !link ||
          typeof link.key !== 'string' ||
          !/^[A-Za-z][A-Za-z0-9_]{0,63}-[0-9]{1,12}$/.test(link.key) ||
          !(link.type === null || typeof link.type === 'string') ||
          (typeof link.type === 'string' && link.type.length > 100) ||
          !['inward', 'outward'].includes(link.direction) ||
          !(link.inward === null || typeof link.inward === 'string') ||
          (typeof link.inward === 'string' && link.inward.length > 100) ||
          !(link.outward === null || typeof link.outward === 'string') ||
          (typeof link.outward === 'string' && link.outward.length > 100)
        ) {
          throw new AnalysisError('A Jira issue link in the planning scope is invalid.', 400, 'INVALID_REQUEST');
        }
        return {
          key: link.key,
          type: link.type,
          direction: link.direction,
          inward: link.inward,
          outward: link.outward
        };
      });
    return {
      id: requirement.id,
      title: requirement.title,
      description: requirement.description,
      priority: requirement.priority,
      dependencies
    };
  });
  if (totalTextLength > 600000) {
    throw new AnalysisError('The selected requirement text exceeds the supported planning scope size.', 413, 'PROMPT_TOO_LARGE');
  }

  const analyses = body.phase2Analyses === undefined ? [] : body.phase2Analyses;
  if (!Array.isArray(analyses) || analyses.length > requirements.length) {
    throw new AnalysisError('Phase 2 analysis data must be an array within the selected planning scope.', 400, 'INVALID_REQUEST');
  }
  const requirementById = new Map(normalizedRequirements.map((requirement) => [requirement.id, requirement]));
  const seenAnalyses = new Set();
  const phase2Analyses = analyses.map((analysis) => {
    if (!analysis || typeof analysis.requirementId !== 'string') {
      throw new AnalysisError('A Phase 2 analysis in the planning scope is invalid.', 400, 'INVALID_REQUEST');
    }
    const requirement = requirementById.get(analysis.requirementId);
    if (!requirement || seenAnalyses.has(analysis.requirementId)) {
      throw new AnalysisError('Phase 2 analyses must match unique requirements in the selected scope.', 400, 'INVALID_REQUEST');
    }
    seenAnalyses.add(analysis.requirementId);
    return validateAnalysis(analysis, requirement.id, requirement.title);
  });

  if (requireConsent && body.consent !== true) {
    throw new AnalysisError('Confirm the GroqCloud disclosure before starting semantic planning.', 400, 'CONSENT_REQUIRED');
  }
  if (body.scope !== undefined && !['selected', 'project'].includes(body.scope)) {
    throw new AnalysisError('Planning scope must be selected requirements or the retrieved project.', 400, 'INVALID_REQUEST');
  }
  const cachedGroups = validateCachedGroups(body.cachedGroups);
  const reviewDecisions = validateReviewDecisions(body.reviewDecisions, requirementIds);
  const scope = body.scope === 'project' ? 'project' : 'selected';
  return { requirements: normalizedRequirements, phase2Analyses, cachedGroups, reviewDecisions, scope };
}

function validateCachedGroups(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) {
    throw new AnalysisError('Cached semantic results must be a bounded array.', 400, 'INVALID_REQUEST');
  }
  return value.map((entry) => {
    if (!entry || !/^[a-f0-9]{64}$/.test(entry.key) || !entry.result || typeof entry.result !== 'object') {
      throw new AnalysisError('A cached semantic result is invalid.', 400, 'INVALID_REQUEST');
    }
    return {
      key: entry.key,
      result: entry.result,
      ...(typeof entry.model === 'string' ? { model: entry.model.slice(0, 100) } : {})
    };
  });
}

function validateReviewDecisions(value, requirementIds) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 500) {
    throw new AnalysisError('Dependency review decisions are invalid.', 400, 'INVALID_REQUEST');
  }
  const decisions = {};
  Object.entries(value).forEach(([id, decision]) => {
    const simpleDecision = decision === 'confirmed' || decision === 'rejected';
    const editedDecision = decision && typeof decision === 'object' &&
      !Array.isArray(decision) &&
      decision.decision === 'confirmed' &&
      typeof decision.prerequisiteId === 'string' &&
      typeof decision.dependentId === 'string' &&
      decision.prerequisiteId !== decision.dependentId &&
      ['BLOCKS', 'REQUIRES', 'ENABLES'].includes(decision.kind) &&
      ['TEST_DESIGN', 'TEST_EXECUTION', 'BOTH'].includes(decision.impact) &&
      (!requirementIds || (
        requirementIds.has(decision.prerequisiteId) &&
        requirementIds.has(decision.dependentId)
      ));
    if (!/^ai:[a-f0-9]{12}$/.test(id) || (!simpleDecision && !editedDecision)) {
      throw new AnalysisError('A dependency review decision is invalid.', 400, 'INVALID_REQUEST');
    }
    decisions[id] = decision;
  });
  return decisions;
}

function validatePlanningJob(body) {
  const jobId = validateJobId(body.jobId);
  const groupIds = body.groupIds;
  if (!Array.isArray(groupIds) || groupIds.length < 1 || groupIds.length > 20 ||
    groupIds.some((id) => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) ||
    new Set(groupIds).size !== groupIds.length) {
    throw new AnalysisError('A planning operation must include 1 to 20 unique semantic groups.', 400, 'INVALID_REQUEST');
  }
  return { jobId, groupIds };
}

function validateSemanticGroups(value, manifest, requirements) {
  if (!Array.isArray(value) || value.length !== manifest.length) {
    throw new AnalysisError('Semantic analysis groups do not match the current planning scope.', 400, 'INVALID_REQUEST');
  }
  const groupsByKey = new Map(manifest.map((group) => [group.key, group]));
  const seen = new Set();
  return value.map((group) => {
    const groupKey = group && group.cacheKey;
    const expected = groupsByKey.get(groupKey);
    if (
      !group ||
      !expected ||
      seen.has(groupKey) ||
      !Array.isArray(group.requirementIds) ||
      group.requirementIds.join('|') !== expected.requirementIds.join('|') ||
      !['succeeded', 'failed'].includes(group.status)
    ) {
      throw new AnalysisError('A semantic analysis group is invalid or stale.', 400, 'INVALID_REQUEST');
    }
    seen.add(groupKey);
    if (group.status === 'succeeded') {
      validateDependencyAnalysis(group.analysis, expected.requirementIds);
      return {
        cacheKey: groupKey,
        requirementIds: expected.requirementIds,
        status: 'succeeded',
        cached: group.cached === true,
        analysis: group.analysis
      };
    }
    return {
      cacheKey: groupKey,
      requirementIds: expected.requirementIds,
      status: 'failed',
      cached: false,
      error: {
        code: typeof group.error?.code === 'string' ? group.error.code.slice(0, 80) : 'ANALYSIS_FAILED',
        message: typeof group.error?.message === 'string'
          ? group.error.message.slice(0, 300)
          : 'Dependency analysis failed.'
      }
    };
  });
}

function validateAnalysisJob(body) {
  const jobId = validateJobId(body.jobId);
  const requirementIds = body.requirementIds;
  if (!Array.isArray(requirementIds) || requirementIds.length < 1 || requirementIds.length > 100) {
    throw new AnalysisError('An analysis operation must include between 1 and 100 requirement IDs.', 400, 'INVALID_REQUEST');
  }
  if (requirementIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 100)) {
    throw new AnalysisError('The analysis operation contains an invalid requirement ID.', 400, 'INVALID_REQUEST');
  }
  if (new Set(requirementIds).size !== requirementIds.length) {
    throw new AnalysisError('An analysis operation cannot contain duplicate requirement IDs.', 400, 'INVALID_REQUEST');
  }
  return { jobId, requirementIds };
}

function validateJobId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AnalysisError('Invalid analysis operation ID.', 400, 'INVALID_REQUEST');
  }
  return value;
}

function validateAnalysisBatch(requirements) {
  if (!Array.isArray(requirements) || requirements.length < 1 || requirements.length > 4) {
    throw new AnalysisError('Submit between 1 and 4 requirements per analysis request.', 400, 'INVALID_REQUEST');
  }
  const ids = new Set();
  return requirements.map((requirement) => {
    if (
      !requirement ||
      typeof requirement.id !== 'string' ||
      !requirement.id.trim() ||
      requirement.id.length > 100 ||
      typeof requirement.title !== 'string' ||
      requirement.title.length > 2000 ||
      !(requirement.description === null || typeof requirement.description === 'string') ||
      (typeof requirement.description === 'string' && requirement.description.length > 12000)
    ) {
      throw new AnalysisError('Each requirement must have an ID, title and description within supported length limits.', 400, 'INVALID_REQUEST');
    }
    if (ids.has(requirement.id)) {
      throw new AnalysisError('A batch cannot contain duplicate requirement IDs.', 400, 'INVALID_REQUEST');
    }
    ids.add(requirement.id);

    const acceptanceCriteria = requirement.acceptanceCriteria;
    if (
      !acceptanceCriteria ||
      typeof acceptanceCriteria.fieldRetrieved !== 'boolean' ||
      !(acceptanceCriteria.fieldName === null || typeof acceptanceCriteria.fieldName === 'string') ||
      (typeof acceptanceCriteria.fieldName === 'string' && acceptanceCriteria.fieldName.length > 200) ||
      !(acceptanceCriteria.value === null || typeof acceptanceCriteria.value === 'string') ||
      (typeof acceptanceCriteria.value === 'string' && acceptanceCriteria.value.length > 6000)
    ) {
      throw new AnalysisError('Acceptance-criteria availability and value must be provided explicitly.', 400, 'INVALID_REQUEST');
    }

    return {
      requirementId: requirement.id,
      title: requirement.title,
      description: requirement.description,
      acceptanceCriteria: {
        fieldRetrieved: acceptanceCriteria.fieldRetrieved,
        fieldName: acceptanceCriteria.fieldName,
        value: acceptanceCriteria.value
      }
    };
  });
}

function readCredentials(body) {
  const { instanceUrl, email, apiToken } = body || {};
  if (
    typeof instanceUrl !== 'string' ||
    typeof email !== 'string' ||
    typeof apiToken !== 'string' ||
    !instanceUrl.trim() ||
    !email.trim() ||
    !apiToken
  ) {
    throw new JiraApiError('Enter your Jira URL, email and API token.', 400);
  }
  return { instanceUrl: instanceUrl.trim(), email: email.trim(), apiToken };
}

function sendError(res, error, scope) {
  if (error instanceof JiraApiError || error instanceof AnalysisError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      ...(scope ? { scope } : {})
    });
  }
  return res.status(500).json({
    error: 'The request could not be completed. Please try again.',
    ...(scope ? { scope } : {})
  });
}

module.exports = {
  createRouter,
  validateAnalysisBatch,
  validateAnalysisJob,
  validateJobId,
  validatePlanningRequest,
  validatePlanningJob,
  validateReviewDecisions,
  validateSemanticGroups
};
