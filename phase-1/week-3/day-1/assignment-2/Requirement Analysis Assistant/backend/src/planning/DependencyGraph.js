const { createHash } = require('node:crypto');
const { IMPACT_TYPES } = require('./dependencyAnalysisSchema');

const STANDARD_DEPENDENCY_PHRASES = new Set([
  'blocks',
  'is blocked by',
  'depends on',
  'is depended on by',
  'requires',
  'is required by',
  'has prerequisite',
  'is prerequisite for',
  'enables',
  'is enabled by',
  'unblocks'
]);

function extractExplicitDependencies(requirements, customDependencyTypes = []) {
  const configured = new Set(
    customDependencyTypes.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
  );
  const edges = [];

  requirements.forEach((requirement) => {
    if (!Array.isArray(requirement.dependencies)) return;
    requirement.dependencies.forEach((link) => {
      if (!link || typeof link.key !== 'string' || !link.key.trim()) return;
      const relationship = relationshipForLink(link, configured);
      if (!relationship) return;
      const prerequisiteId = relationship.currentIsPrerequisite
        ? requirement.id
        : link.key;
      const dependentId = relationship.currentIsPrerequisite
        ? link.key
        : requirement.id;
      edges.push({
        id: edgeId(prerequisiteId, dependentId, `jira:${link.type || relationship.phrase}`),
        prerequisiteId,
        dependentId,
        kind: relationship.kind,
        impact: 'BOTH',
        source: 'jira',
        status: 'explicit',
        confidence: 'HIGH',
        evidence: `Jira issue link "${relationship.phrase}" on ${requirement.id}.`,
        reasoning: `Jira explicitly links ${prerequisiteId} as a prerequisite to ${dependentId}.`,
        linkType: link.type || null,
        linkDirection: link.direction || null,
        confirmationRequired: false
      });
    });
  });
  return deduplicateEdges(edges);
}

function relationshipForLink(link, configuredTypes) {
  const typeName = typeof link.type === 'string' ? link.type.trim().toLowerCase() : '';
  const isConfigured = configuredTypes.has(typeName);
  const phraseValue = link.direction === 'inward' ? link.inward : link.outward;
  const hasDirectionalPhrase = typeof phraseValue === 'string' && phraseValue.trim();
  const phrase = hasDirectionalPhrase ? phraseValue.trim() : typeName;
  const phraseMeaning = relationshipMeaning(phrase);

  if (!phraseMeaning && !STANDARD_DEPENDENCY_PHRASES.has(typeName) && !isConfigured) return null;

  const meaning = phraseMeaning || relationshipMeaning(typeName);
  if (!meaning) {
    // A configured custom type without directional labels follows Jira's outward/inward sides.
    return {
      currentIsPrerequisite: link.direction === 'outward',
      kind: 'BLOCKS',
      phrase: phrase || link.type || 'configured dependency'
    };
  }
  if (hasDirectionalPhrase && phraseMeaning) {
    return {
      currentIsPrerequisite: meaning.phraseDescribesCurrentPrerequisite,
      kind: meaning.kind,
      phrase
    };
  }
  const sideIsOutward = link.direction !== 'inward';
  return {
    currentIsPrerequisite: meaning.phraseDescribesCurrentPrerequisite === sideIsOutward,
    kind: meaning.kind,
    phrase: phrase || meaning.phrase
  };
}

function relationshipMeaning(value) {
  const phrase = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (['blocks', 'block', 'enables', 'unblocks', 'is prerequisite for', 'is required by', 'is depended on by'].includes(phrase)) {
    return { phrase, phraseDescribesCurrentPrerequisite: true, kind: phrase.startsWith('enabl') ? 'ENABLES' : 'BLOCKS' };
  }
  if (['is blocked by', 'depends on', 'is dependent on', 'requires', 'has prerequisite', 'is enabled by'].includes(phrase)) {
    return { phrase, phraseDescribesCurrentPrerequisite: false, kind: phrase === 'is enabled by' ? 'ENABLES' : 'REQUIRES' };
  }
  return null;
}

function buildDependencyGraph(requirements, edges) {
  const selectedIds = new Set(requirements.map((requirement) => requirement.id));
  const nodes = requirements.map((requirement) => ({
    id: requirement.id,
    title: requirement.title || '',
    inScope: true
  }));
  const externalIds = [...new Set(edges.flatMap((edge) => [
    edge.prerequisiteId,
    edge.dependentId
  ]).filter((id) => !selectedIds.has(id)))].sort();
  externalIds.forEach((id) => nodes.push({
    id,
    title: 'Outside selected scope',
    inScope: false
  }));

  const normalizedEdges = deduplicateEdges(edges.filter((edge) =>
    typeof edge.prerequisiteId === 'string' &&
    typeof edge.dependentId === 'string' &&
    edge.prerequisiteId !== edge.dependentId &&
    (selectedIds.has(edge.prerequisiteId) || selectedIds.has(edge.dependentId))
  ));
  const directBySource = new Map(nodes.map((node) => [node.id, []]));
  const directByTarget = new Map(nodes.map((node) => [node.id, []]));
  normalizedEdges.forEach((edge) => {
    if (!directBySource.has(edge.prerequisiteId)) directBySource.set(edge.prerequisiteId, []);
    if (!directByTarget.has(edge.dependentId)) directByTarget.set(edge.dependentId, []);
    directBySource.get(edge.prerequisiteId).push(edge);
    directByTarget.get(edge.dependentId).push(edge);
  });

  const cycles = findCycles(nodes.map((node) => node.id), normalizedEdges);
  const cycleIds = new Set(cycles.flatMap((cycle) => cycle.requirementIds));
  const descendantsOfCycle = new Set(reachableFrom(cycleIds, directBySource));
  const directRelations = nodes.map((node) => {
    const incoming = directByTarget.get(node.id) || [];
    const outgoing = directBySource.get(node.id) || [];
    return {
      requirementId: node.id,
      directPrerequisites: incoming.map((edge) => edge.prerequisiteId).sort(),
      directDependents: outgoing.map((edge) => edge.dependentId).sort(),
      upstream: reachableFrom(new Set([node.id]), reverseEdges(normalizedEdges)),
      downstream: reachableFrom(new Set([node.id]), directBySource),
      externalPrerequisites: incoming
        .filter((edge) => !selectedIds.has(edge.prerequisiteId))
        .map((edge) => edge.prerequisiteId)
        .sort(),
      cycleMember: cycleIds.has(node.id),
      blockedByCycle: !cycleIds.has(node.id) && descendantsOfCycle.has(node.id)
    };
  });
  const waves = topologicalWaves(requirements, normalizedEdges);

  return {
    nodes,
    edges: normalizedEdges,
    relationships: directRelations,
    cycles,
    topologicalWaves: waves.waves,
    blockedSequence: waves.blocked,
    summary: {
      explicit: normalizedEdges.filter((edge) => edge.source === 'jira').length,
      inferred: normalizedEdges.filter((edge) => edge.source === 'ai').length,
      confirmed: normalizedEdges.filter((edge) => edge.source === 'ai' && edge.status === 'confirmed').length,
      pendingReview: normalizedEdges.filter((edge) => edge.source === 'ai' && edge.status === 'pending').length,
      rejected: edges.filter((edge) => edge.source === 'ai' && edge.status === 'rejected').length,
      external: normalizedEdges.filter((edge) =>
        !selectedIds.has(edge.prerequisiteId) || !selectedIds.has(edge.dependentId)
      ).length,
      cycleCount: cycles.length,
      cycleRequirementCount: cycleIds.size,
      independent: requirements.filter((requirement) => {
        const info = directRelations.find((item) => item.requirementId === requirement.id);
        return info && !info.directPrerequisites.length && !info.directDependents.length;
      }).length
    }
  };
}

function makeSemanticEdges(groups, decisions = {}) {
  const edges = [];
  groups.forEach((group) => {
    (group.dependencies || []).forEach((item) => {
      const prerequisiteId = item.prerequisiteId;
      const dependentId = item.dependentId;
      const id = edgeId(prerequisiteId, dependentId, 'ai');
      const decision = decisions[id];
      const decisionStatus = typeof decision === 'string' ? decision : decision?.decision;
      const status = decisionStatus === 'confirmed' || decisionStatus === 'rejected'
        ? decisionStatus
        : 'pending';
      const reviewedPrerequisite = status === 'confirmed' && typeof decision === 'object'
        ? decision.prerequisiteId
        : null;
      const reviewedDependent = status === 'confirmed' && typeof decision === 'object'
        ? decision.dependentId
        : null;
      edges.push({
        id,
        prerequisiteId: reviewedPrerequisite || prerequisiteId,
        dependentId: reviewedDependent || dependentId,
        kind: status === 'confirmed' && typeof decision === 'object' && decision.kind
          ? decision.kind
          : item.kind,
        impact: status === 'confirmed' && typeof decision === 'object' && decision.impact
          ? decision.impact
          : item.impact,
        source: 'ai',
        status,
        confidence: item.confidence,
        evidence: item.evidence,
        reasoning: status === 'confirmed' && typeof decision === 'object'
          ? `${item.reasoning} Human-reviewed relationship${reviewedPrerequisite ? ' was edited and' : ''} confirmed.`
          : item.reasoning,
        suggestedQuestion: item.suggestedQuestion || '',
        confirmationRequired: true
      });
    });
  });
  return deduplicateEdges(edges);
}

function edgeId(prerequisiteId, dependentId, source) {
  const digest = createHash('sha256')
    .update(`${source}|${prerequisiteId}|${dependentId}`)
    .digest('hex')
    .slice(0, 12);
  return `${source}:${digest}`;
}

function deduplicateEdges(edges) {
  const seen = new Map();
  edges.forEach((edge) => {
    const key = `${edge.prerequisiteId}|${edge.dependentId}|${edge.source}`;
    if (!seen.has(key)) seen.set(key, edge);
  });
  return [...seen.values()];
}

function reverseEdges(edges) {
  const map = new Map();
  edges.forEach((edge) => {
    if (!map.has(edge.dependentId)) map.set(edge.dependentId, []);
    map.get(edge.dependentId).push({ ...edge, dependentId: edge.prerequisiteId });
  });
  return map;
}

function reachableFrom(startIds, adjacency) {
  const visited = new Set();
  const stack = [...startIds].flatMap((id) =>
    (adjacency.get(id) || []).map((edge) => edge.dependentId)
  );
  while (stack.length) {
    const id = stack.pop();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    (adjacency.get(id) || []).forEach((edge) => stack.push(edge.dependentId));
  }
  startIds.forEach((id) => visited.delete(id));
  return [...visited].sort();
}

function findCycles(nodeIds, edges) {
  const adjacency = adjacencyFor(nodeIds, edges, false);
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  let nextIndex = 0;

  const connect = (id) => {
    indexes.set(id, nextIndex);
    lowLinks.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);

    for (const dependentId of adjacency.get(id) || []) {
      if (!indexes.has(dependentId)) {
        connect(dependentId);
        lowLinks.set(id, Math.min(lowLinks.get(id), lowLinks.get(dependentId)));
      } else if (onStack.has(dependentId)) {
        lowLinks.set(id, Math.min(lowLinks.get(id), indexes.get(dependentId)));
      }
    }

    if (lowLinks.get(id) !== indexes.get(id)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== id);
    components.push(component.sort());
  };

  [...nodeIds].sort().forEach((id) => {
    if (!indexes.has(id)) connect(id);
  });

  return components
    .filter((component) => component.length > 1 ||
      (adjacency.get(component[0]) || []).includes(component[0]))
    .map((component) => ({
      path: findCyclePath(component, adjacency),
      requirementIds: component
    }))
    .sort((left, right) => left.requirementIds.join('|').localeCompare(right.requirementIds.join('|')));
}

function findCyclePath(component, adjacency) {
  const members = new Set(component);
  for (const start of component) {
    const path = [start];
    const visited = new Set(path);
    const visit = (current) => {
      for (const next of adjacency.get(current) || []) {
        if (!members.has(next)) continue;
        if (next === start) return [...path, start];
        if (visited.has(next)) continue;
        path.push(next);
        visited.add(next);
        const found = visit(next);
        if (found) return found;
        path.pop();
      }
      return null;
    };
    const pathFound = visit(start);
    if (pathFound) return pathFound;
  }
  return component;
}

function topologicalWaves(requirements, edges) {
  const ids = requirements.map((requirement) => requirement.id).sort();
  const selected = new Set(ids);
  const designEdges = edges.filter((edge) =>
    selected.has(edge.prerequisiteId) &&
    selected.has(edge.dependentId) &&
    ['TEST_DESIGN', 'BOTH'].includes(edge.impact || IMPACT_TYPES[2])
  );
  const incomingCount = new Map(ids.map((id) => [id, 0]));
  const dependents = new Map(ids.map((id) => [id, []]));
  designEdges.forEach((edge) => {
    incomingCount.set(edge.dependentId, incomingCount.get(edge.dependentId) + 1);
    dependents.get(edge.prerequisiteId).push(edge.dependentId);
  });
  let ready = ids.filter((id) => incomingCount.get(id) === 0);
  const waves = [];
  const visited = new Set();
  while (ready.length) {
    const wave = ready.sort();
    waves.push(wave);
    ready = [];
    wave.forEach((id) => {
      visited.add(id);
      (dependents.get(id) || []).forEach((dependentId) => {
        incomingCount.set(dependentId, incomingCount.get(dependentId) - 1);
        if (incomingCount.get(dependentId) === 0) ready.push(dependentId);
      });
    });
  }
  return { waves, blocked: ids.filter((id) => !visited.has(id)) };
}

function adjacencyFor(nodeIds, edges, onlySelected) {
  const selected = new Set(nodeIds);
  const map = new Map(nodeIds.map((id) => [id, []]));
  edges.forEach((edge) => {
    if (!map.has(edge.prerequisiteId)) map.set(edge.prerequisiteId, []);
    if (onlySelected && (!selected.has(edge.prerequisiteId) || !selected.has(edge.dependentId))) return;
    map.get(edge.prerequisiteId).push(edge.dependentId);
  });
  return map;
}

module.exports = {
  extractExplicitDependencies,
  relationshipForLink,
  relationshipMeaning,
  buildDependencyGraph,
  makeSemanticEdges,
  edgeId,
  findCycles,
  topologicalWaves
};
