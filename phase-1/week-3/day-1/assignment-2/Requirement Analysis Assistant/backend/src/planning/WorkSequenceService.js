const ACTIONS = Object.freeze({
  START: 'START_TEST_DESIGN',
  PARTIAL: 'START_PARTIAL_DESIGN',
  CLARIFY: 'CLARIFY_WITH_PRODUCT_OWNER',
  INVESTIGATE: 'INVESTIGATE_EXTERNAL_DEPENDENCY',
  CYCLE: 'RESOLVE_DEPENDENCY_CYCLE',
  INSUFFICIENT: 'INSUFFICIENT_INFORMATION'
});

class WorkSequenceService {
  create(requirements, graph, phase2ById, priorityById, questions = []) {
    const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
    const relationById = new Map(graph.relationships.map((relation) => [relation.requirementId, relation]));
    const waveById = new Map();
    graph.topologicalWaves.forEach((wave, index) => wave.forEach((id) => waveById.set(id, index + 1)));
    const cyclesFor = new Map();
    graph.cycles.forEach((cycle) => cycle.requirementIds.forEach((id) => {
      const existing = cyclesFor.get(id) || [];
      cyclesFor.set(id, [...existing, cycle.path]);
    }));

    const items = requirements.map((requirement) => {
      const relation = relationById.get(requirement.id);
      const phase2 = phase2ById.get(requirement.id);
      const priority = priorityById.get(requirement.id);
      const incoming = graph.edges.filter((edge) => edge.dependentId === requirement.id);
      const designDependencies = incoming.filter((edge) =>
        ['TEST_DESIGN', 'BOTH'].includes(edge.impact || 'BOTH')
      );
      const externalBlocking = designDependencies.some((edge) =>
        !requirementById.has(edge.prerequisiteId)
      );
      const cyclePaths = cyclesFor.get(requirement.id) || [];
      const phase2ClarificationBlocks = phase2 && phase2.clarificationQuestions.some((question) =>
        question.blocksTestDesign === true);
      const planningClarificationBlocks = questions.some((question) =>
        question.blocksTestDesign === true &&
        question.requirementIds.includes(requirement.id) &&
        ['dependency-analysis', 'combined'].includes(question.source));
      const clarificationBlocks = phase2ClarificationBlocks || planningClarificationBlocks;
      let action;
      let reason;

      if (cyclePaths.length || relation?.blockedByCycle) {
        action = ACTIONS.CYCLE;
        reason = cyclePaths.length
          ? `A confirmed dependency cycle includes ${cyclePaths[0].join(' → ')}.`
          : 'A prerequisite is part of a confirmed dependency cycle.';
      } else if (externalBlocking) {
        action = ACTIONS.INVESTIGATE;
        reason = 'A required prerequisite is outside the selected planning scope; confirm its status before sequencing this work.';
      } else if (!phase2) {
        action = ACTIONS.INSUFFICIENT;
        reason = 'No validated Phase 2 readiness analysis is available.';
      } else if (clarificationBlocks || phase2.testDesignReadiness === 'NOT_READY') {
        action = ACTIONS.CLARIFY;
        reason = planningClarificationBlocks && !phase2ClarificationBlocks
          ? 'A planning clarification question is marked as blocking test design.'
          : 'The available requirement analysis identifies information that blocks test design.';
      } else if (phase2.testDesignReadiness === 'PARTIALLY_READY') {
        action = ACTIONS.PARTIAL;
        reason = 'Some test design can begin, but the stated gaps should remain visible for review.';
      } else if (phase2.testDesignReadiness === 'READY_FOR_TEST_DESIGN') {
        action = ACTIONS.START;
        reason = 'The validated Phase 2 assessment marks this requirement ready for test design.';
      } else {
        action = ACTIONS.INSUFFICIENT;
        reason = 'The requirement has no supported test-design readiness classification.';
      }

      return {
        requirementId: requirement.id,
        title: requirement.title || '',
        wave: waveById.get(requirement.id) || null,
        action,
        reason,
        priorityScore: priority?.score ?? null,
        rankingStatus: priority?.rankingStatus || 'UNRANKED',
        prerequisites: relation?.directPrerequisites || [],
        dependents: relation?.directDependents || [],
        transitivePrerequisites: relation?.upstream || [],
        transitiveDependents: relation?.downstream || [],
        externalPrerequisites: relation?.externalPrerequisites || [],
        blockedByCycle: Boolean(cyclePaths.length || relation?.blockedByCycle),
        cyclePaths,
        readyForParallelWork: [ACTIONS.START, ACTIONS.PARTIAL].includes(action)
      };
    });

    const waveMembers = new Map();
    items.forEach((item) => {
      if (item.wave && item.readyForParallelWork) {
        const members = waveMembers.get(item.wave) || [];
        waveMembers.set(item.wave, [...members, item]);
      }
    });
    items.forEach((item) => {
      const members = waveMembers.get(item.wave) || [];
      if (item.readyForParallelWork && members.length > 1) {
        item.parallelGroup = item.wave;
        item.parallelNote = 'This work can be considered alongside other ready items in the same dependency wave.';
      } else {
        item.parallelGroup = null;
        item.parallelNote = '';
      }
    });

    const actionOrder = [ACTIONS.CYCLE, ACTIONS.INVESTIGATE, ACTIONS.CLARIFY, ACTIONS.PARTIAL, ACTIONS.START, ACTIONS.INSUFFICIENT];
    items.sort((left, right) => {
      const orderDifference = actionOrder.indexOf(left.action) - actionOrder.indexOf(right.action);
      if (orderDifference) return orderDifference;
      if (left.wave !== right.wave) return (left.wave || Number.MAX_SAFE_INTEGER) - (right.wave || Number.MAX_SAFE_INTEGER);
      if (left.priorityScore !== right.priorityScore) return (right.priorityScore ?? -1) - (left.priorityScore ?? -1);
      return left.requirementId.localeCompare(right.requirementId);
    });
    return {
      items,
      waves: [...waveMembers.entries()].sort(([left], [right]) => left - right).map(([wave, members]) => ({
        wave,
        requirementIds: members
          .sort((left, right) => (right.priorityScore ?? -1) - (left.priorityScore ?? -1) ||
            left.requirementId.localeCompare(right.requirementId))
          .map((item) => item.requirementId)
      }))
    };
  }
}

module.exports = { WorkSequenceService, ACTIONS };
