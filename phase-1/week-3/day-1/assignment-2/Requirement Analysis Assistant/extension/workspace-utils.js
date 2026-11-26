(function initializeWorkspaceUtils(root, factory) {
  const utils = factory();
  if (typeof module === 'object' && module.exports) module.exports = utils;
  else root.RequirementWorkspaceUtils = utils;
}(globalThis, function createWorkspaceUtils() {
  function createUsageSummary() {
    return {
      inferenceRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retryAttempts: 0,
      usageReports: 0,
      inputTokenReports: 0,
      outputTokenReports: 0,
      completeTokenReports: 0,
      inputTokens: 0,
      outputTokens: 0,
      byOperation: {}
    };
  }

  function analysisCoverage(total, analysed, failed) {
    const requirementCount = Math.max(0, Math.floor(finiteNumber(total)));
    const analysedCount = Math.min(requirementCount, Math.max(0, Math.floor(finiteNumber(analysed))));
    const failedCount = Math.min(
      requirementCount - analysedCount,
      Math.max(0, Math.floor(finiteNumber(failed)))
    );
    return {
      total: requirementCount,
      analysed: analysedCount,
      failed: failedCount,
      pending: requirementCount - analysedCount - failedCount
    };
  }

  function completeTokenTotal(usage) {
    if (
      !usage ||
      usage.successfulRequests < 1 ||
      usage.completeTokenReports !== usage.successfulRequests
    ) return null;
    return usage.inputTokens + usage.outputTokens;
  }

  function addUsageSummary(target, source) {
    if (!source || typeof source !== 'object') return target;
    [
      'inferenceRequests', 'successfulRequests', 'failedRequests', 'retryAttempts',
      'usageReports', 'inputTokenReports', 'outputTokenReports', 'completeTokenReports'
    ]
      .forEach((key) => { target[key] += finiteNumber(source[key]); });
    ['inputTokens', 'outputTokens'].forEach((key) => {
      if (Number.isFinite(source[key])) target[key] += source[key];
    });
    Object.entries(source.byOperation || {}).forEach(([operation, usage]) => {
      const current = target.byOperation[operation] || createUsageSummary();
      addUsageSummary(current, usage);
      target.byOperation[operation] = current;
    });
    return target;
  }

  function activateView(views, buttons, viewName) {
    let activated = false;
    views.forEach((view) => {
      const selected = view.id === `view-${viewName}`;
      view.hidden = !selected;
      activated ||= selected;
    });
    if (!activated) return false;
    buttons.forEach((button) => {
      const selected = button.dataset.view === viewName;
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    return true;
  }

  function analysisConfigChanged(previous, current, fallbackFingerprint) {
    if (!previous) return false;
    return previous.model !== current.model ||
      (previous.analysisFingerprint || fallbackFingerprint) !==
        (current.analysisFingerprint || fallbackFingerprint);
  }

  function dependencyPanelState({ selectedId, inScope = false, hasDependencies = false, title = '' }) {
    if (!selectedId) {
      return {
        state: 'unselected',
        title: 'Select a requirement to view its dependencies and supporting evidence.',
        message: ''
      };
    }
    if (!inScope) {
      return {
        state: 'out-of-scope',
        title: `${selectedId} · outside selected scope`,
        message: 'The linked requirement is outside the selected planning scope.'
      };
    }
    return {
      state: hasDependencies ? 'relationships' : 'no-known-dependencies',
      title: `${selectedId} · ${title}`,
      message: hasDependencies
        ? ''
        : 'No known dependency links were found in this scope. This does not confirm independence.'
    };
  }

  function planningOverview(plan, scope, currentRequirementCount) {
    const planned = Boolean(plan);
    const summary = plan?.summary;
    const items = plan?.prioritisation?.items;
    const requirementCount = planned
      ? nonNegativeCount(summary?.requirements)
      : nonNegativeCount(currentRequirementCount);
    const rankedCount = Array.isArray(items)
      ? items.filter((item) => item.rankingStatus === 'RANKED').length
      : null;
    const unrankedCount = Array.isArray(items)
      ? items.filter((item) => item.rankingStatus === 'UNRANKED').length
      : null;
    const unclassifiedCount = Array.isArray(items)
      ? items.length - rankedCount - unrankedCount
      : null;
    const summaryRankedCount = nonNegativeCount(summary?.ranked);
    const summaryUnrankedCount = nonNegativeCount(summary?.unranked);
    const rankingCountsReconcile = Array.isArray(items) && requirementCount !== null
      ? items.length === requirementCount &&
        rankedCount + unrankedCount === requirementCount &&
        unclassifiedCount === 0
      : null;
    const rankingSummaryConsistent = Array.isArray(items) &&
      summaryRankedCount !== null && summaryUnrankedCount !== null
      ? summaryRankedCount === rankedCount && summaryUnrankedCount === unrankedCount
      : null;

    return {
      planned,
      scopeLabel: scope === 'project' ? 'All retrieved requirements' : 'Selected requirements',
      requirementCount,
      explicitLinkCount: nonNegativeCount(summary?.dependencies?.explicit),
      confirmedLinkCount: nonNegativeCount(summary?.confirmedInferredRelationships),
      proposedLinkCount: nonNegativeCount(summary?.proposedRelationships),
      noDocumentedLinksCount: nonNegativeCount(summary?.dependencies?.independent),
      unavailableLinkDataCount: nonNegativeCount(summary?.jiraLinkDataUnavailable),
      rankedCount,
      unrankedCount,
      unclassifiedCount,
      rankingCountsReconcile,
      rankingSummaryConsistent
    };
  }

  function deduplicateQuestions(questions) {
    const groups = new Map();
    questions.forEach((question) => {
      const key = normalizeQuestion(question.question);
      if (!key) return;
      const existing = groups.get(key);
      const sourceNames = question.sources || (question.source ? [question.source] : []);
      if (!existing) {
        groups.set(key, {
          ...question,
          requirementIds: unique(question.requirementIds || []),
          sources: unique(sourceNames),
          associatedGaps: unique(question.associatedGaps || (question.associatedGap ? [question.associatedGap] : [])),
          reasons: unique(question.reasons || (question.reason ? [question.reason] : [])),
          potentialImpacts: unique(question.potentialImpacts || (question.potentialImpact ? [question.potentialImpact] : []))
        });
        return;
      }
      existing.requirementIds = unique([...existing.requirementIds, ...(question.requirementIds || [])]);
      existing.sources = unique([...existing.sources, ...sourceNames]);
      existing.associatedGaps = unique([
        ...existing.associatedGaps,
        ...(question.associatedGaps || (question.associatedGap ? [question.associatedGap] : []))
      ]);
      existing.reasons = unique([
        ...existing.reasons,
        ...(question.reasons || (question.reason ? [question.reason] : []))
      ]);
      existing.potentialImpacts = unique([
        ...existing.potentialImpacts,
        ...(question.potentialImpacts || (question.potentialImpact ? [question.potentialImpact] : []))
      ]);
      existing.blocksTestDesign ||= question.blocksTestDesign === true;
      existing.blocksTestExecution ||= question.blocksTestExecution === true;
      if (priorityRank(question.priority) < priorityRank(existing.priority)) existing.priority = question.priority;
    });
    const results = [...groups.values()];
    return {
      questions: results,
      originalCount: questions.length,
      consolidatedCount: results.length
    };
  }

  function buildCsv(headings, rows) {
    return [headings, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');
  }

  function csvCell(value) {
    const text = String(value ?? '');
    const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  }

  function buildHtmlReport(data) {
    const sections = (data.sections || []).map((section) => `
      <section>
        <h2>${escapeHtml(section.title)}</h2>
        ${(section.items || []).length
          ? (section.items || []).map((item) => `
            <article>
              <h3>${escapeHtml(item.title || 'Item')}</h3>
              <dl>${(item.details || []).map(([label, value]) =>
                `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
              ).join('')}</dl>
            </article>
          `).join('')
          : '<p class="empty">No information is available in the current application session.</p>'}
      </section>
    `).join('');
    const metrics = (data.metrics || []).map(([label, value]) =>
      `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`
    ).join('');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(data.projectName)} (${escapeHtml(data.projectKey)}) quality engineering report</title>
<style>
body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#24324a;max-width:1100px;margin:32px auto;padding:0 24px}
h1{font-size:28px}h2{margin-top:34px;border-bottom:1px solid #dfe4ed;padding-bottom:8px}
h3{font-size:16px;margin:0 0 10px}article{padding:14px 0;border-bottom:1px solid #edf0f5}
.meta,.disclaimer{color:#66748a}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.metric{border:1px solid #e5e9f1;border-radius:8px;padding:12px;display:grid;gap:5px}.metric strong{font-size:22px}
.metric span,dt{color:#67748a;font-size:12px}dl{margin:0}dl div{display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:10px;padding:4px 0}
dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.empty{color:#68758a}
@media print{body{max-width:none;margin:0;padding:0}section{break-inside:avoid}article{break-inside:avoid}}
</style></head><body>
<h1>${escapeHtml(data.productName)} · Quality Engineering Report</h1>
<p class="meta">${escapeHtml(data.fullName)} · ${escapeHtml(data.tagline)}</p>
<p class="meta">Project: ${escapeHtml(data.projectName)} (${escapeHtml(data.projectKey)})<br>
Generated: ${escapeHtml(data.generatedAt)}<br>Requirements in scope: ${escapeHtml(data.scopeCount)}<br>
Scope selection: ${escapeHtml(data.scopeLabel)}<br>
GroqCloud model attribution: ${escapeHtml(data.model || 'Not used for this session report')}</p>
<div class="metrics">${metrics}</div>
${sections}
<p class="disclaimer">${escapeHtml(data.disclaimer)}</p>
</body></html>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function humanReadableEvidence(value) {
    if (typeof value !== 'string' || !value.trim()) return 'No supporting explanation was provided.';
    let text = value.trim();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (/^[\[{]/.test(text)) {
        return 'The relevant information is not clearly stated in the retrieved requirement text.';
      }
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed !== 'string') {
          return 'The relevant information is not clearly stated in the retrieved requirement text.';
        }
        text = parsed.trim();
      } catch {
        return text;
      }
    }
    return /^[\[{]/.test(text)
      ? 'The relevant information is not clearly stated in the retrieved requirement text.'
      : text;
  }

  function normalizeQuestion(value) {
    return String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function priorityRank(value) {
    return { HIGH: 0, MEDIUM: 1, LOW: 2 }[String(value || '').toUpperCase()] ?? 1;
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))].sort();
  }

  function finiteNumber(value) {
    return Number.isFinite(value) ? value : 0;
  }

  function nonNegativeCount(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  return {
    createUsageSummary,
    addUsageSummary,
    analysisCoverage,
    completeTokenTotal,
    activateView,
    analysisConfigChanged,
    dependencyPanelState,
    planningOverview,
    deduplicateQuestions,
    buildCsv,
    csvCell,
    buildHtmlReport,
    escapeHtml,
    humanReadableEvidence
  };
}));
