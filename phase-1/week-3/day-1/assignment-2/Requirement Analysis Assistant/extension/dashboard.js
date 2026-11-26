const API_BASE = 'http://127.0.0.1:3000/api';
const APP_NAME = globalThis.REQUIREMENT_ASSISTANT_CONFIG.productName;
const APP_FULL_NAME = globalThis.REQUIREMENT_ASSISTANT_CONFIG.fullName;
const APP_TAGLINE = globalThis.REQUIREMENT_ASSISTANT_CONFIG.tagline;
const APP_VERSION = globalThis.REQUIREMENT_ASSISTANT_CONFIG.version;
const humanReadableEvidence = RequirementWorkspaceUtils.humanReadableEvidence;
const ANALYSIS_CACHE_VERSION = 'analysis-schema-fingerprint-v1';
const CRITERIA_STATUSES = [
  'AVAILABLE_AND_VALID',
  'AVAILABLE_BUT_INCOMPLETE',
  'AVAILABLE_BUT_AMBIGUOUS',
  'AVAILABLE_BUT_NOT_TESTABLE',
  'MISSING',
  'UNAVAILABLE'
];

const form = document.querySelector('#connection-form');
const connectButton = document.querySelector('#connect-button');
const connectionError = document.querySelector('#connection-error');
const connectionStatus = document.querySelector('#connection-status');
const connectionPanel = document.querySelector('#connection-panel');
const workspacePanel = document.querySelector('#workspace-panel');
const projectDisplay = document.querySelector('#project-display');
const disconnectButton = document.querySelector('#disconnect-button');
const projectSelect = document.querySelector('#project-select');
const retrieveButton = document.querySelector('#retrieve-button');
const workspaceError = document.querySelector('#workspace-error');
const dashboard = document.querySelector('#dashboard');
const storyList = document.querySelector('#story-list');
const storySearch = document.querySelector('#story-search');
const storyStatusFilter = document.querySelector('#story-status-filter');
const storyAnalysisFilter = document.querySelector('#story-analysis-filter');
const storyCount = document.querySelector('#story-count');
const selectionCount = document.querySelector('#selection-count');
const selectAll = document.querySelector('#select-all');
const emptyState = document.querySelector('#empty-state');
const emptyMessage = document.querySelector('#empty-message');
const analyzeButton = document.querySelector('#analyze-button');
const groqConsent = document.querySelector('#groq-consent');
const analysisError = document.querySelector('#analysis-error');
const analysisProgress = document.querySelector('#analysis-progress');
const progressCount = document.querySelector('#progress-count');
const progressBar = document.querySelector('#progress-bar');
const progressMessage = document.querySelector('#progress-message');
const progressDetails = document.querySelector('#progress-details');
const activeGroqModel = document.querySelector('#active-groq-model');
const analysisResults = document.querySelector('#analysis-results');
const analysisSummary = document.querySelector('#analysis-summary');
const analysisFailures = document.querySelector('#analysis-failures');
const analysisList = document.querySelector('#analysis-list');
const analysisEmpty = document.querySelector('#analysis-empty');
const clarityFilter = document.querySelector('#clarity-filter');
const criteriaFilter = document.querySelector('#criteria-filter');
const readinessFilter = document.querySelector('#readiness-filter');
const analysisDetail = document.querySelector('#analysis-detail');
const planningSection = document.querySelector('#planning-section');
const dependencyWorkspaceEmpty = document.querySelector('#dependency-workspace-empty');
const planningScope = document.querySelector('#planning-scope');
const planningMode = document.querySelector('#planning-mode');
const planningEstimateButton = document.querySelector('#planning-estimate-button');
const planningRunButton = document.querySelector('#planning-run-button');
const planningEstimate = document.querySelector('#planning-estimate');
const planningConsentRow = document.querySelector('#planning-consent-row');
const planningConsent = document.querySelector('#planning-consent');
const planningError = document.querySelector('#planning-error');
const planningProgress = document.querySelector('#planning-progress');
const planningProgressCount = document.querySelector('#planning-progress-count');
const planningProgressBar = document.querySelector('#planning-progress-bar');
const planningProgressMessage = document.querySelector('#planning-progress-message');
const planningProgressDetails = document.querySelector('#planning-progress-details');
const planningResults = document.querySelector('#planning-results');
const planningModel = document.querySelector('#planning-model');
const planningSummary = document.querySelector('#planning-summary');
const planningWarnings = document.querySelector('#planning-warnings');
const dependencyGraph = document.querySelector('#dependency-graph');
const graphNodeDetail = document.querySelector('#graph-node-detail');
const graphZoomIn = document.querySelector('#graph-zoom-in');
const graphZoomOut = document.querySelector('#graph-zoom-out');
const graphFit = document.querySelector('#graph-fit');
const graphReset = document.querySelector('#graph-reset');
const dependencyList = document.querySelector('#dependency-list');
const dependencyEmpty = document.querySelector('#dependency-empty');
const priorityList = document.querySelector('#priority-list');
const backlogFilter = document.querySelector('#backlog-filter');
const backlogEmpty = document.querySelector('#backlog-empty');
const workSequence = document.querySelector('#work-sequence');
const sequenceEmpty = document.querySelector('#sequence-empty');
const questionRegister = document.querySelector('#question-register');
const questionEmpty = document.querySelector('#question-empty');
const questionCountNote = document.querySelector('#question-count-note');
const questionRequirementFilter = document.querySelector('#question-requirement-filter');
const questionPriorityFilter = document.querySelector('#question-priority-filter');
const questionGapFilter = document.querySelector('#question-gap-filter');
const questionBlockingFilter = document.querySelector('#question-blocking-filter');
const questionSourceFilter = document.querySelector('#question-source-filter');
const overviewMetrics = document.querySelector('#overview-metrics');
const coverageChart = document.querySelector('#coverage-chart');
const coverageCopy = document.querySelector('#coverage-copy');
const clarityChart = document.querySelector('#clarity-chart');
const criteriaChart = document.querySelector('#criteria-chart');
const readinessChart = document.querySelector('#readiness-chart');
const claritySubtitle = document.querySelector('#clarity-subtitle');
const criteriaSubtitle = document.querySelector('#criteria-subtitle');
const readinessSubtitle = document.querySelector('#readiness-subtitle');
const dependencyMetrics = document.querySelector('#dependency-metrics');
const prioritisationSummary = document.querySelector('#prioritisation-summary');
const questionSummary = document.querySelector('#question-summary');
const recommendedActions = document.querySelector('#recommended-actions');
const usageSummary = document.querySelector('#usage-summary');
const reportStatus = document.querySelector('#report-status');
const reportScope = document.querySelector('#report-scope');
const reportPreviewTitle = document.querySelector('#report-preview-title');
const reportPreviewSummary = document.querySelector('#report-preview-summary');
const reportPreviewEmpty = document.querySelector('#report-preview-empty');
const reportPreviewTableWrap = document.querySelector('#report-preview-table-wrap');
const reportPreviewHead = document.querySelector('#report-preview-head');
const reportPreviewBody = document.querySelector('#report-preview-body');
const navButtons = [...document.querySelectorAll('.nav-item')];
const appViews = [...document.querySelectorAll('.app-view')];
const appLayout = document.querySelector('.app-layout');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const state = {
  credentials: null,
  requirements: [],
  selected: new Set(),
  projects: [],
  results: new Map(),
  failures: new Map(),
  runId: 0,
  abortController: null,
  analyzing: false,
  analysisJobId: null,
  analysisConfig: null,
  sessionUsage: RequirementWorkspaceUtils.createUsageSummary(),
  tokenWarningThreshold: null,
  activeView: 'overview',
  activeProjectKey: null,
  reportPreviewType: null,
  questionEntries: [],
  progressSnapshot: null,
  progressRequirementIds: [],
  planning: {
    runId: 0,
    running: false,
    jobId: null,
    progressSnapshot: null,
    estimate: null,
    manifest: [],
    plan: null,
    semanticGroups: [],
    reviewDecisions: {},
    cache: new Map(),
    selectedNodeId: null,
    graphZoom: 1,
    graphDimensions: null
  }
};

document.title = `${APP_NAME} — ${APP_FULL_NAME}`;
document.querySelector('#app-name').textContent = APP_NAME;
document.querySelector('#app-full-name').textContent = APP_FULL_NAME;
document.querySelector('.brand-tagline').textContent = APP_TAGLINE;
document.querySelector('#application-version').textContent = `Version ${APP_VERSION}`;

CRITERIA_STATUSES.forEach((value) => {
  criteriaFilter.add(new Option(label(value), value));
});
form.addEventListener('submit', onConnect);
disconnectButton.addEventListener('click', disconnect);
projectSelect.addEventListener('change', onProjectChange);
retrieveButton.addEventListener('click', retrieveStories);
storySearch.addEventListener('input', renderStories);
storyStatusFilter.addEventListener('change', renderStories);
storyAnalysisFilter.addEventListener('change', renderStories);
document.querySelector('#clear-selection').addEventListener('click', () => {
  state.selected.clear();
  if (planningScope.value === 'selected') invalidatePlanningScope();
  renderStories();
  refreshSelectedReportPreview();
});
groqConsent.addEventListener('change', updateAnalyzeButton);
analyzeButton.addEventListener('click', analyzeSelected);
selectAll.addEventListener('change', () => {
  visibleRequirements().forEach((story) => {
    if (selectAll.checked) state.selected.add(story.id);
    else state.selected.delete(story.id);
  });
  if (planningScope.value === 'selected') invalidatePlanningScope();
  renderStories();
  refreshSelectedReportPreview();
});
[clarityFilter, criteriaFilter, readinessFilter].forEach((filter) => {
  filter.addEventListener('change', renderAnalysisResults);
});
document.querySelector('#copy-all-questions').addEventListener('click', copyAllQuestions);
document.querySelector('#close-detail').addEventListener('click', () => {
  analysisDetail.hidden = true;
});
document.querySelector('#close-story-source').addEventListener('click', () => {
  document.querySelector('#story-source-detail').hidden = true;
});
document.querySelector('#copy-requirement-questions').addEventListener('click', () => {
  const id = analysisDetail.dataset.requirementId;
  const analysis = state.results.get(id);
  if (analysis) copyQuestions([analysis]);
});
planningMode.addEventListener('change', updatePlanningControls);
planningScope.addEventListener('change', () => {
  invalidatePlanningScope();
  updatePlanningControls();
});
planningConsent.addEventListener('change', updatePlanningControls);
planningEstimateButton.addEventListener('click', estimatePlanning);
planningRunButton.addEventListener('click', runPlanning);
backlogFilter.addEventListener('change', renderPriorityList);
document.querySelector('#export-planning-csv').addEventListener('click', exportPlanningCsv);
graphZoomIn.addEventListener('click', () => setGraphZoom(state.planning.graphZoom * 1.25));
graphZoomOut.addEventListener('click', () => setGraphZoom(state.planning.graphZoom / 1.25));
graphFit.addEventListener('click', fitDependencyGraph);
graphReset.addEventListener('click', () => {
  state.planning.selectedNodeId = null;
  fitDependencyGraph();
  if (state.planning.plan) renderDependencyGraph(state.planning.plan);
});
navButtons.forEach((button) => button.addEventListener('click', () => navigateTo(button.dataset.view)));
document.querySelectorAll('.brand, .sidebar-brand').forEach((brand) => brand.addEventListener('click', (event) => {
    event.preventDefault();
    navigateTo('overview');
  }));
sidebarToggle.addEventListener('click', () => {
  const collapsed = appLayout.classList.toggle('is-collapsed');
  sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  sidebarToggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} navigation`);
  sidebarToggle.title = `${collapsed ? 'Expand' : 'Collapse'} navigation`;
});
document.querySelector('#settings-disconnect').addEventListener('click', disconnect);
document.querySelectorAll('[data-report]').forEach((button) =>
  button.addEventListener('click', () => downloadCsvReport(button.dataset.report)));
document.querySelectorAll('[data-preview]').forEach((button) =>
  button.addEventListener('click', () => renderReportPreview(button.dataset.preview)));
reportScope.addEventListener('change', () => {
  if (state.reportPreviewType === 'html') renderHtmlReportPreview();
  else if (state.reportPreviewType) renderReportPreview(state.reportPreviewType);
});
document.querySelector('#export-html-report').addEventListener('click', downloadHtmlReport);
document.querySelector('#preview-html-report').addEventListener('click', renderHtmlReportPreview);
document.querySelector('#copy-filtered-questions').addEventListener('click', copyFilteredQuestions);
[
  questionRequirementFilter,
  questionPriorityFilter,
  questionGapFilter,
  questionBlockingFilter,
  questionSourceFilter
].forEach((filter) => filter.addEventListener('change', renderQuestionRegister));
document.querySelector('#token-warning-threshold').addEventListener('input', (event) => {
  const parsed = Number(event.currentTarget.value);
  state.tokenWarningThreshold = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  renderUsageSummary();
});

restoreSession();

function navigateTo(viewName) {
  if (!RequirementWorkspaceUtils.activateView(appViews, navButtons, viewName)) return;
  state.activeView = viewName;
  renderOverview();
  if (viewName === 'questions') renderQuestionRegister();
  if (viewName === 'settings') renderSettings();
}

async function onConnect(event) {
  event.preventDefault();
  clearError(connectionError);
  if (!globalThis.chrome?.storage?.session) {
    showError(connectionError, 'Open this dashboard from the installed Chrome extension.');
    return;
  }
  setBusy(connectButton, true, 'Connecting…');
  const credentials = {
    instanceUrl: document.querySelector('#instance-url').value.trim(),
    email: document.querySelector('#email').value.trim(),
    apiToken: document.querySelector('#api-token').value
  };
  try {
    const result = await api('/jira/validate', credentials);
    await chrome.storage.session.set({ jiraSession: credentials });
    state.credentials = credentials;
    document.querySelector('#api-token').value = '';
    showWorkspace();
    setConnectionStatus(result.user.displayName ? `Connected as ${result.user.displayName}` : 'Connected');
    await loadProjects();
  } catch (error) {
    showError(connectionError, error.message);
  } finally {
    setBusy(connectButton, false, 'Connect to Jira');
  }
}

async function restoreSession() {
  if (!globalThis.chrome?.storage?.session) {
    showError(connectionError, 'Open this dashboard from the installed Chrome extension.');
    return;
  }
  try {
    const { jiraSession } = await chrome.storage.session.get('jiraSession');
    if (!jiraSession) return;
    state.credentials = jiraSession;
    showWorkspace();
    setConnectionStatus('Connected');
    await loadProjects();
  } catch (error) {
    state.credentials = null;
    showError(connectionError, error.message);
  }
}

async function loadProjects() {
  clearError(workspaceError);
  projectSelect.disabled = true;
  projectSelect.replaceChildren(new Option('Loading accessible projects…', ''));
  try {
    const result = await api('/jira/projects', state.credentials);
    state.projects = Array.isArray(result.projects) ? result.projects : [];
    projectSelect.replaceChildren(new Option('Select a Jira project', ''));
    state.projects.forEach((project) => {
      projectSelect.add(new Option(`${project.name} (${project.key})`, project.key));
    });
    updateProjectDisplay();
    if (state.projects.length === 0) {
      showError(workspaceError, 'No accessible Jira projects were found for this account.');
    }
  } catch (error) {
    projectSelect.replaceChildren(new Option('Select a Jira project', ''));
    showError(workspaceError, error.message);
  } finally {
    projectSelect.disabled = false;
  }
}

function onProjectChange() {
  state.runId += 1;
  if (state.abortController) state.abortController.abort();
  state.abortController = null;
  state.analyzing = false;
  state.analysisJobId = null;
  state.progressSnapshot = null;
  state.progressRequirementIds = [];
  state.activeProjectKey = projectSelect.value || null;
  updateProjectDisplay();
  state.requirements = [];
  state.selected.clear();
  state.results.clear();
  state.failures.clear();
  state.questionEntries = [];
  clearReportPreview();
  [questionRequirementFilter, questionGapFilter, questionSourceFilter].forEach((filter) => { filter.value = ''; });
  storyStatusFilter.value = '';
  storyAnalysisFilter.value = '';
  resetPlanning();
  storySearch.value = '';
  dashboard.hidden = true;
  analysisProgress.hidden = true;
  analysisResults.hidden = true;
  analysisDetail.hidden = true;
  groqConsent.checked = false;
  clearError(analysisError);
  navigateTo('overview');
  updateAnalyzeButton();
  retrieveButton.disabled = !projectSelect.value;
}

async function retrieveStories() {
  if (!state.credentials || !projectSelect.value) return;
  clearError(workspaceError);
  retrieveButton.disabled = true;
  retrieveButton.textContent = 'Loading stories…';
  state.requirements = [];
  state.selected.clear();
  state.results.clear();
  state.failures.clear();
  state.questionEntries = [];
  dashboard.hidden = false;
  resetPlanning();
  planningSection.hidden = true;
  storyList.replaceChildren();
  emptyState.hidden = false;
  emptyMessage.textContent = 'Retrieving user stories from Jira…';
  try {
    const result = await api('/jira/stories', {
      ...state.credentials,
      projectKey: projectSelect.value
    });
    state.requirements = Array.isArray(result.requirements) ? result.requirements : [];
    state.activeProjectKey = projectSelect.value;
    state.selected.clear();
    state.results.clear();
    state.failures.clear();
    resetPlanning();
    clearReportPreview();
    analysisProgress.hidden = true;
    analysisResults.hidden = true;
    renderStories();
    navigateTo('requirements');
  } catch (error) {
    showError(workspaceError, error.message);
    state.requirements = [];
    renderStories();
  } finally {
    retrieveButton.textContent = 'Retrieve stories';
    retrieveButton.disabled = !projectSelect.value;
  }
}

function renderStories() {
  setFilterOptions(storyStatusFilter, 'All statuses',
    uniqueValues(state.requirements.map((requirement) => requirement.status)).map((value) => [value, value]));
  const visible = visibleRequirements();
  storyList.replaceChildren();
  visible.forEach((story) => {
    const row = document.createElement('tr');
    const checkboxCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selected.has(story.id);
    checkbox.setAttribute('aria-label', `Select ${story.id || 'story'}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selected.add(story.id);
      else state.selected.delete(story.id);
      if (planningScope.value === 'selected') invalidatePlanningScope();
      updateSelectionSummary();
      updateSelectAll();
      updateAnalyzeButton();
      refreshSelectedReportPreview();
    });
    checkboxCell.append(checkbox);
    row.append(checkboxCell);
    row.append(textCell(story.id, ''));
    row.append(textCell(story.title, ''));
    row.append(textCell(story.status, 'table-status'));
    row.append(textCell(story.priority, 'priority'));
    const analysisStatus = requirementAnalysisState(story.id);
    const analysisStatusLabel = state.results.get(story.id)?.analysisSource === 'RULE_BASED'
      ? 'Rule-based'
      : label(analysisStatus.toUpperCase().replaceAll('-', '_'));
    row.append(textCell(analysisStatusLabel, `analysis-state ${analysisStatus}`));
    const detailCell = document.createElement('td');
    const detailAction = document.createElement('button');
    detailAction.type = 'button';
    detailAction.className = 'button button-quiet table-action';
    detailAction.textContent = state.results.has(story.id) ? 'View analysis' : 'View story';
    detailAction.addEventListener('click', () => {
      const analysis = state.results.get(story.id);
      if (analysis) {
        showAnalysisDetail(story, analysis);
        navigateTo('requirements');
      } else {
        showRequirementSource(story);
      }
    });
    detailCell.append(detailAction);
    row.append(detailCell);
    storyList.append(row);
  });

  storyCount.textContent = String(state.requirements.length);
  const hasStories = visible.length > 0;
  emptyState.hidden = hasStories;
  if (!hasStories) {
    emptyMessage.textContent = state.requirements.length === 0
      ? 'No user stories were found in this project.'
      : 'Try a different search term.';
  }
  updateSelectionSummary();
  updateSelectAll();
  updateAnalyzeButton();
  renderOverview();
  renderQuestionRegister();
}

function textCell(value, className) {
  const cell = document.createElement('td');
  if (className) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = displayValue(value);
    cell.append(span);
  } else {
    cell.textContent = displayValue(value);
  }
  return cell;
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function visibleRequirements() {
  const query = storySearch.value.trim().toLocaleLowerCase();
  return state.requirements.filter((story) =>
    (!storyStatusFilter.value || story.status === storyStatusFilter.value) &&
    (!storyAnalysisFilter.value || requirementAnalysisState(story.id) === storyAnalysisFilter.value) &&
    (!query || [story.id, story.title, story.status, story.priority]
      .some((value) => value !== null && value !== undefined && String(value).toLocaleLowerCase().includes(query)))
  );
}

function requirementAnalysisState(id) {
  if (state.results.has(id)) return 'analysed';
  return state.failures.has(id) ? 'failed' : 'not-analysed';
}

function updateSelectionSummary() {
  const count = state.selected.size;
  selectionCount.textContent = count === 1 ? '1 story selected' : `${count} stories selected`;
}

function updateSelectAll() {
  const visible = visibleRequirements();
  selectAll.checked = visible.length > 0 && visible.every((story) => state.selected.has(story.id));
  selectAll.indeterminate = visible.some((story) => state.selected.has(story.id)) && !selectAll.checked;
}

function updateAnalyzeButton() {
  const selectedIds = [...state.selected];
  const selectedFailures = selectedIds.some((id) => state.failures.has(id));
  const pending = state.requirements.filter((requirement) =>
    state.selected.has(requirement.id) && !state.results.has(requirement.id));
  const consentRequired = pending.some(hasMeaningfulRequirementContent);
  analyzeButton.disabled = pending.length === 0 || (consentRequired && !groqConsent.checked) ||
    state.analyzing || state.planning.running;
  selectAll.disabled = state.analyzing || state.planning.running;
  storyList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.disabled = state.analyzing || state.planning.running;
  });
  projectSelect.disabled = state.analyzing || state.planning.running;
  retrieveButton.disabled = state.analyzing || state.planning.running || !projectSelect.value;
  analyzeButton.textContent = selectedFailures ? 'Retry failed analysis' : 'Analyse requirements';
  updatePlanningControls();
}

function invalidatePlanningScope() {
  state.planning.runId += 1;
  state.planning.estimate = null;
  state.planning.manifest = [];
  state.planning.plan = null;
  state.planning.semanticGroups = [];
  state.planning.reviewDecisions = {};
  state.planning.selectedNodeId = null;
  planningEstimate.hidden = true;
  planningResults.hidden = true;
  planningConsent.checked = false;
  planningModel.textContent = 'Groq model: not used';
  clearError(planningError);
  clearPlanningViews();
  updatePlanningControls();
  renderQuestionRegister();
  renderOverview();
}

async function analyzeSelected() {
  if (state.analyzing) return;
  let selected = state.requirements.filter((requirement) =>
    state.selected.has(requirement.id) && !state.results.has(requirement.id)
  );
  if (selected.length === 0) {
    showError(analysisError, 'All selected requirements already have successful analyses. Failed requirements can be retried.');
    return;
  }
  clearError(analysisError);
  state.analyzing = true;
  const runId = ++state.runId;
  state.abortController = new AbortController();
  state.progressRequirementIds = selected.map((requirement) => requirement.id);
  state.analysisJobId = null;
  state.progressSnapshot = null;
  const previousFailures = new Map(
    selected
      .filter((requirement) => state.failures.has(requirement.id))
      .map((requirement) => [requirement.id, state.failures.get(requirement.id)])
  );
  const requirementsTotal = state.selected.size;
  analysisProgress.hidden = false;
  analysisResults.hidden = state.results.size === 0 && state.failures.size === 0;
  progressCount.textContent = 'Checking model configuration';
  progressMessage.textContent = 'Validating GroqCloud model support before analysis…';
  progressDetails.replaceChildren();
  updateAnalyzeButton();
  let jobId = null;
  let jobStarted = false;

  try {
    const requiresGroq = selected.some(hasMeaningfulRequirementContent);
    if (requiresGroq) {
      const config = await api('/analysis/config', {}, state.abortController.signal);
      const previousConfig = state.analysisConfig;
      const analysisChanged = RequirementWorkspaceUtils.analysisConfigChanged(
        previousConfig,
        config,
        ANALYSIS_CACHE_VERSION
      );
      if (analysisChanged) {
        state.results.clear();
        state.failures.clear();
        resetPlanning();
        selected = state.requirements.filter((requirement) => state.selected.has(requirement.id));
        state.progressRequirementIds = selected.map((requirement) => requirement.id);
        updateProgress(state.selected.size, runId);
      }
      state.analysisConfig = config;
      activeGroqModel.textContent = `Groq model: ${config.model}`;
      renderSettings();
    } else {
      activeGroqModel.textContent = 'Rule-based analysis · Groq not used';
    }
    jobId = crypto.randomUUID();
    state.analysisJobId = jobId;
    await api('/analysis/jobs', {
      jobId,
      requirementIds: selected.map((requirement) => requirement.id)
    }, state.abortController.signal);
    jobStarted = true;
    selected.forEach((requirement) => state.failures.delete(requirement.id));
    analysisResults.hidden = false;
    analysisResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateProgress(requirementsTotal, runId);

    const poller = pollAnalysisProgress(jobId, runId, requirementsTotal);
    const concurrency = Math.min(Math.max(Number(state.analysisConfig.concurrency) || 1, 1), 4);
    for (let offset = 0; offset < selected.length; offset += concurrency) {
      if (runId !== state.runId) return;
      const batch = selected.slice(offset, offset + concurrency);
      try {
        const response = await api('/analysis/batch', {
          jobId,
          requirements: batch.map(toAnalysisInput)
        }, state.abortController.signal);
        if (response.model) activeGroqModel.textContent = `Groq model: ${response.model}`;
        if (response.usage) {
          RequirementWorkspaceUtils.addUsageSummary(state.sessionUsage, response.usage);
          renderUsageSummary();
        }
        const submittedIds = new Set(batch.map((item) => item.id));
        (response.results || []).forEach((entry) => {
          if (submittedIds.has(entry.requirementId) && entry.analysis?.requirementId === entry.requirementId) {
            state.results.set(entry.requirementId, entry.analysis);
            state.failures.delete(entry.requirementId);
          }
        });
        if ((response.results || []).length) invalidatePlanningScope();
        (response.failures || []).forEach((failure) => {
          if (submittedIds.has(failure.requirementId)) {
            state.failures.set(failure.requirementId, failure.error?.message || 'Analysis failed. Retry this requirement.');
          }
        });
        batch.forEach((item) => {
          if (!state.results.has(item.id) && !state.failures.has(item.id)) {
            state.failures.set(item.id, 'The backend did not return an analysis result for this requirement.');
          }
        });
        renderStories();
      } catch (error) {
        if (runId !== state.runId) return;
        if (error.scope === 'configuration') throw error;
        batch.forEach((item) => state.failures.set(item.id, error.message));
      }
      updateProgress(requirementsTotal, runId);
      renderAnalysisResults();
      renderOverview();
    }

    await api('/analysis/jobs/finish', { jobId });
    await poller;
    if (runId !== state.runId) return;
    updateProgress(requirementsTotal, runId, true);
    renderAnalysisResults();
  } catch (error) {
    if (runId === state.runId) {
      showError(analysisError, error.message);
      if (!jobStarted || error.scope === 'configuration') {
        previousFailures.forEach((message, id) => state.failures.set(id, message));
        analysisProgress.hidden = true;
      } else {
        state.progressRequirementIds.forEach((id) => {
          if (!state.results.has(id) && !state.failures.has(id)) state.failures.set(id, error.message);
        });
        updateProgress(requirementsTotal, runId, true);
      }
      renderAnalysisResults();
    }
  } finally {
    if (jobId && jobStarted) {
      try {
        await api('/analysis/jobs/finish', { jobId });
      } catch {
        if (runId === state.runId) showError(analysisError, 'Could not finalize analysis progress. The server will clear the operation automatically.');
      }
    }
    if (runId === state.runId) {
      state.analyzing = false;
      state.abortController = null;
      updateAnalyzeButton();
      updateProgress(requirementsTotal, runId, true);
    }
  }
}

function toAnalysisInput(requirement) {
  const criteria = requirement.acceptanceCriteria || {};
  return {
    id: requirement.id,
    title: typeof requirement.title === 'string' ? requirement.title : '',
    description: typeof requirement.description === 'string' ? requirement.description : null,
    acceptanceCriteria: {
      fieldRetrieved: criteria.fieldRetrieved === true,
      fieldName: typeof criteria.fieldName === 'string' ? criteria.fieldName : null,
      value: typeof criteria.value === 'string' ? criteria.value : null
    }
  };
}

function hasMeaningfulRequirementContent(requirement) {
  const criteria = requirement.acceptanceCriteria || {};
  return Boolean(
    (typeof requirement.description === 'string' && requirement.description.trim()) ||
    (typeof criteria.value === 'string' && criteria.value.trim()) ||
    (typeof criteria.descriptionCriteria === 'string' && criteria.descriptionCriteria.trim())
  );
}

async function pollAnalysisProgress(jobId, runId, total) {
  while (runId === state.runId && state.analyzing) {
    try {
      state.progressSnapshot = await api('/analysis/progress', { jobId }, state.abortController?.signal);
      updateProgress(total, runId);
    } catch (error) {
      if (runId !== state.runId) return;
      if (error.message !== 'Analysis was cancelled.') showError(analysisError, error.message);
      return;
    }
    if (state.progressSnapshot.succeeded + state.progressSnapshot.failed >= state.progressSnapshot.total) return;
    if (runId !== state.runId || !state.analyzing) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

function updateProgress(total, runId, completed = false) {
  if (runId !== state.runId) return;
  const selectedIds = [...state.selected];
  const successful = selectedIds.filter((id) => state.results.has(id)).length;
  const failed = selectedIds.filter((id) => state.failures.has(id)).length;
  const pending = Math.max(total - successful - failed, 0);
  progressCount.textContent = `${successful} of ${total} analysed`;
  progressBar.max = Math.max(total, 1);
  progressBar.value = successful + failed;
  const items = state.progressSnapshot?.items || [];
  const processing = items.filter((item) => item.status === 'processing').length;
  const retrying = items.filter((item) => item.status === 'retrying').length;
  progressMessage.textContent = completed
    ? failed > 0
      ? `Processing complete: ${successful} successful, ${failed} failed. Successful analyses are retained; retry failed requirements.`
      : `Analysis complete: all ${successful} selected requirements succeeded.`
    : `${successful} successful · ${processing} processing · ${retrying} retrying · ${pending} pending · ${failed} failed`;
  progressDetails.replaceChildren();
  const statusById = new Map(items.map((item) => [item.id, item]));
  state.progressRequirementIds.forEach((id) => {
    const item = statusById.get(id);
    const row = document.createElement('span');
    const status = item?.status || (state.results.has(id) ? 'succeeded' : state.failures.has(id) ? 'failed' : 'pending');
    row.textContent = `${id}: ${status}${item?.retryCount ? ` (${item.retryCount} retries)` : ''}`;
    progressDetails.append(row);
  });
}

function resetPlanning() {
  const planning = state.planning;
  planning.runId += 1;
  if (planning.abortController) planning.abortController.abort();
  planning.running = false;
  planning.jobId = null;
  planning.progressSnapshot = null;
  planning.estimate = null;
  planning.manifest = [];
  planning.plan = null;
  planning.semanticGroups = [];
  planning.reviewDecisions = {};
  planning.cache.clear();
  planning.selectedNodeId = null;
  planning.graphZoom = 1;
  planning.graphDimensions = null;
  planning.abortController = null;
  planningSection.hidden = true;
  planningProgress.hidden = true;
  planningResults.hidden = true;
  planningEstimate.hidden = true;
  planningConsent.checked = false;
  planningModel.textContent = 'Groq model: not used';
  clearError(planningError);
  clearPlanningViews();
  updatePlanningControls();
}

function clearPlanningViews() {
  planningSummary.replaceChildren();
  planningWarnings.replaceChildren();
  dependencyGraph.replaceChildren();
  dependencyList.replaceChildren();
  dependencyEmpty.hidden = false;
  priorityList.replaceChildren();
  backlogEmpty.hidden = false;
  workSequence.replaceChildren();
  sequenceEmpty.hidden = false;
  graphNodeDetail.replaceChildren();
  appendText(graphNodeDetail, 'h4',
    'Select a requirement to view its dependencies and supporting evidence.');
}

function planningScopeRequirements() {
  return planningScope.value === 'project'
    ? state.requirements
    : state.requirements.filter((requirement) => state.selected.has(requirement.id));
}

function planningPhase2Analyses(requirements) {
  const included = new Set(requirements.map((requirement) => requirement.id));
  return [...state.results.entries()]
    .filter(([id]) => included.has(id))
    .map(([, analysis]) => analysis);
}

function planningRequestPayload(requirements = planningScopeRequirements()) {
  return {
    scope: planningScope.value,
    requirements: requirements.map((requirement) => ({
      id: requirement.id,
      title: typeof requirement.title === 'string' ? requirement.title : '',
      description: typeof requirement.description === 'string' ? requirement.description : null,
      priority: typeof requirement.priority === 'string' ? requirement.priority : null,
      dependencies: Array.isArray(requirement.dependencies)
        ? requirement.dependencies.map((link) => ({
          key: link.key,
          type: link.type || null,
          direction: link.direction,
          inward: link.inward || null,
          outward: link.outward || null
        }))
        : null
    })),
    phase2Analyses: planningPhase2Analyses(requirements)
  };
}

function updatePlanningControls() {
  const aiMode = planningMode.value === 'ai-enhanced';
  planningConsentRow.hidden = !aiMode;
  const requirementCount = planningScopeRequirements().length;
  const overLimit = requirementCount > 100;
  if (overLimit) {
    planningEstimate.hidden = false;
    planningEstimate.textContent = 'Planning supports up to 100 requirements per operation. Narrow the scope before continuing.';
  }
  const unavailable = state.planning.running || state.analyzing;
  planningScope.disabled = unavailable;
  planningMode.disabled = unavailable;
  planningConsent.disabled = unavailable;
  planningEstimateButton.disabled = unavailable || requirementCount === 0 || overLimit;
  planningRunButton.disabled = unavailable || requirementCount === 0 || overLimit ||
    (aiMode && !planningConsent.checked);
  planningRunButton.textContent = state.planning.running
    ? 'Planning in progress…'
    : aiMode
      ? state.planning.semanticGroups.some((group) => group.status === 'failed')
        ? 'Retry failed planning groups'
        : 'Build AI-enhanced plan'
      : 'Build rule-based plan';
  planningSection.hidden = state.requirements.length === 0;
  dependencyWorkspaceEmpty.hidden = state.requirements.length > 0;
}

async function estimatePlanning() {
  const requirements = planningScopeRequirements();
  if (!requirements.length) {
    showError(planningError, 'Select one or more requirements, or choose all retrieved requirements.');
    return false;
  }
  clearError(planningError);
  const runId = state.planning.runId;
  const request = planningRequestPayload(requirements);
  planningEstimateButton.disabled = true;
  planningEstimate.textContent = 'Estimating request size locally…';
  planningEstimate.hidden = false;
  try {
    const response = await api('/planning/estimate', request);
    if (runId !== state.planning.runId) return false;
    state.planning.estimate = response.estimate;
    state.planning.manifest = response.groups;
    const cachedCount = response.groups.filter((group) => state.planning.cache.has(group.key)).length;
    planningEstimate.textContent =
      `Local estimate only; no Groq request sent. Approx. ${response.estimate.approximateInputTokens.toLocaleString()} input tokens · ` +
      `${response.estimate.groups} estimated request(s) · ${requirements.length} requirement(s) · ` +
      `${cachedCount} reusable cached group(s). ${response.estimate.note}`;
    return true;
  } catch (error) {
    if (runId !== state.planning.runId) return false;
    showError(planningError, error.message);
    planningEstimate.textContent = 'The analysis estimate could not be calculated.';
    return false;
  } finally {
    updatePlanningControls();
  }
}

async function runPlanning() {
  if (state.planning.running || state.analyzing) return;
  const requirements = planningScopeRequirements();
  if (!requirements.length) {
    showError(planningError, 'Select one or more requirements, or choose all retrieved requirements.');
    return;
  }
  if (planningMode.value === 'ai-enhanced') {
    if (!planningConsent.checked) {
      showError(planningError, 'Confirm the GroqCloud disclosure before requesting AI-enhanced planning.');
      return;
    }
    if (!state.planning.manifest.length && !(await estimatePlanning())) return;
    await runSemanticPlanning(requirements);
    return;
  }

  clearError(planningError);
  planningProgress.hidden = true;
  const runId = ++state.planning.runId;
  state.planning.abortController = new AbortController();
  state.planning.running = true;
  updateAnalyzeButton();
  try {
    const response = await api('/planning/rules', planningRequestPayload(requirements), state.planning.abortController.signal);
    if (runId !== state.planning.runId) return;
    state.planning.plan = response.plan;
    state.planning.semanticGroups = [];
    state.planning.reviewDecisions = {};
    planningModel.textContent = 'Groq model: not used';
    renderPlanning();
  } catch (error) {
    if (runId === state.planning.runId) showError(planningError, error.message);
  } finally {
    if (runId === state.planning.runId) {
      state.planning.running = false;
      state.planning.abortController = null;
      updateAnalyzeButton();
    }
  }
}

async function runSemanticPlanning(requirements) {
  clearError(planningError);
  const runId = ++state.planning.runId;
  const jobId = crypto.randomUUID();
  const manifest = state.planning.manifest;
  state.planning.running = true;
  state.planning.jobId = jobId;
  state.planning.progressSnapshot = null;
  state.planning.abortController = new AbortController();
  planningProgress.hidden = false;
  planningProgressCount.textContent = `0 of ${manifest.length} groups complete`;
  planningProgressBar.max = Math.max(manifest.length, 1);
  planningProgressBar.value = 0;
  planningProgressMessage.textContent = 'Validating GroqCloud configuration, then analysing semantic groups…';
  planningProgressDetails.replaceChildren();
  updatePlanningControls();
  updateAnalyzeButton();
  let jobStarted = false;

  try {
    await api('/planning/jobs', {
      jobId,
      groupIds: manifest.map((group) => group.key)
    }, state.planning.abortController.signal);
    jobStarted = true;
    const poller = pollPlanningProgress(jobId, runId);
    const cachedGroups = manifest
      .filter((group) => state.planning.cache.has(group.key))
      .map((group) => ({ key: group.key, ...state.planning.cache.get(group.key) }));
    const response = await api('/planning/ai', {
      ...planningRequestPayload(requirements),
      jobId,
      consent: true,
      cachedGroups,
      reviewDecisions: state.planning.reviewDecisions
    }, state.planning.abortController.signal);
    if (runId !== state.planning.runId) return;
    if (response.usage) {
      RequirementWorkspaceUtils.addUsageSummary(state.sessionUsage, response.usage);
      renderUsageSummary();
    }
    state.planning.semanticGroups = response.semanticGroups || [];
    state.planning.semanticGroups.forEach((group) => {
      if (group.status === 'succeeded' && group.analysis) {
        state.planning.cache.set(group.cacheKey, {
          result: group.analysis,
          model: response.plan.model || state.analysisConfig?.model || null
        });
      }
    });
    state.planning.plan = response.plan;
    planningModel.textContent = `Groq model: ${response.plan.model || 'configured model'}`;
    await api('/planning/jobs/finish', { jobId });
    await poller;
    if (runId !== state.planning.runId) return;
    updatePlanningProgress(runId, true);
    renderPlanning();
  } catch (error) {
    if (runId === state.planning.runId) {
      if (error.scope === 'configuration') {
        showError(planningError, error.message);
        planningProgressMessage.textContent = 'Planning stopped before requirement analysis because GroqCloud configuration could not be validated.';
      } else {
        showError(planningError, error.message);
      }
      if (jobStarted) updatePlanningProgress(runId, true);
    }
  } finally {
    if (jobStarted) {
      try {
        await api('/planning/jobs/finish', { jobId });
      } catch {
        if (runId === state.planning.runId) {
          showError(planningError, 'Could not finalize planning progress. The server will clear the operation automatically.');
        }
      }
    }
    if (runId === state.planning.runId) {
      state.planning.running = false;
      state.planning.abortController = null;
      updateAnalyzeButton();
      if (state.planning.plan) renderPlanning();
    }
  }
}

async function pollPlanningProgress(jobId, runId) {
  while (runId === state.planning.runId && state.planning.running) {
    try {
      state.planning.progressSnapshot = await api(
        '/planning/progress',
        { jobId },
        state.planning.abortController?.signal
      );
      updatePlanningProgress(runId);
    } catch (error) {
      if (runId !== state.planning.runId) return;
      if (error.message !== 'Analysis was cancelled.') showError(planningError, error.message);
      return;
    }
    const snapshot = state.planning.progressSnapshot;
    if (snapshot.succeeded + snapshot.failed >= snapshot.total) return;
    if (runId !== state.planning.runId || !state.planning.running) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

function updatePlanningProgress(runId, completed = false) {
  if (runId !== state.planning.runId) return;
  const snapshot = state.planning.progressSnapshot;
  if (!snapshot) return;
  const terminal = snapshot.succeeded + snapshot.failed;
  planningProgressCount.textContent = `${terminal} of ${snapshot.total} groups complete`;
  planningProgressBar.max = Math.max(snapshot.total, 1);
  planningProgressBar.value = terminal;
  planningProgressMessage.textContent = completed
    ? snapshot.failed
      ? `Processing complete: ${snapshot.succeeded} group(s) succeeded and ${snapshot.failed} failed. Successful groups are cached; retry only failed groups.`
      : `Processing complete: all ${snapshot.succeeded} semantic group(s) succeeded.`
    : `${snapshot.succeeded} successful · ${snapshot.processing} processing · ${snapshot.retrying} retrying · ${snapshot.pending} pending · ${snapshot.failed} failed`;
  planningProgressDetails.replaceChildren();
  snapshot.items.forEach((item) => {
    const status = document.createElement('span');
    const group = state.planning.manifest.find((entry) => entry.key === item.id);
    const labelText = group ? group.requirementIds.join(', ') : `${item.id.slice(0, 8)}…`;
    status.textContent = `${labelText}: ${item.status}${item.retryCount ? ` (${item.retryCount} retries)` : ''}`;
    planningProgressDetails.append(status);
  });
}

function renderAnalysisResults() {
  const entries = filteredAnalyses();
  analysisResults.hidden = state.results.size === 0 && state.failures.size === 0;
  analysisSummary.replaceChildren();
  analysisFailures.replaceChildren();
  const failedSelected = [...state.failures.entries()]
    .filter(([id]) => state.requirements.some((item) => item.id === id));
  if (failedSelected.length) {
    analysisFailures.hidden = false;
    appendText(analysisFailures, 'h3', 'Requirements needing retry');
    failedSelected.forEach(([id, message]) => {
      const item = document.createElement('p');
      item.textContent = `${id}: ${message}`;
      analysisFailures.append(item);
    });
  } else {
    analysisFailures.hidden = true;
  }
  if (state.results.size > 0) renderSummary();
  else analysisSummary.replaceChildren();
  analysisList.replaceChildren();
  entries.forEach(({ requirement, analysis }) => analysisList.append(renderAnalysisRow(requirement, analysis)));
  analysisEmpty.hidden = entries.length > 0 || state.results.size === 0;
  renderStories();
  renderOverview();
  renderQuestionRegister();
}

function renderPlanning() {
  const plan = state.planning.plan;
  if (!plan) return;
  planningResults.hidden = false;
  planningModel.textContent = plan.mode === 'ai-enhanced'
    ? `Groq model: ${plan.model || 'configured model'}`
    : 'Groq model: not used';
  renderSettings();
  renderPlanningSummary(plan);
  renderPlanningWarnings(plan);
  renderDependencyGraph(plan);
  renderDependencyList(plan);
  renderPriorityList();
  renderWorkSequence(plan);
  renderQuestionRegister();
  renderOverview();
}

function renderPlanningSummary(plan) {
  planningSummary.replaceChildren();
  const cards = [
    ['Requirements in scope', plan.summary.requirements],
    ['Explicit Jira links', plan.summary.dependencies.explicit],
    ['Confirmed AI links', plan.summary.confirmedInferredRelationships],
    ['Suggestions to review', plan.summary.proposedRelationships],
    ['Ranked', plan.summary.ranked],
    ['Need more evidence', plan.summary.unranked],
    ['Dependency cycles', plan.summary.unresolvedCycles],
    ['Open questions', plan.summary.questions]
  ];
  cards.forEach(([title, value]) => {
    const card = document.createElement('article');
    card.className = 'summary-card';
    const number = document.createElement('strong');
    number.textContent = String(value ?? 0);
    const labelText = document.createElement('span');
    labelText.textContent = title;
    card.append(number, labelText);
    planningSummary.append(card);
  });
}

function renderPlanningWarnings(plan) {
  planningWarnings.replaceChildren();
  (plan.warnings || []).forEach((warning) => appendText(planningWarnings, 'p', warning));
  if (plan.semanticAnalysis?.summary?.total) {
    appendText(
      planningWarnings,
      'p',
      `Semantic coverage: ${plan.semanticAnalysis.summary.pairCoverage}% of in-scope pairs assessed within successful groups; ${plan.semanticAnalysis.summary.cached} group(s) reused from this browser session.`
    );
  }
}

function renderDependencyGraph(plan) {
  const graph = plan.provisionalGraph || plan.graph;
  dependencyGraph.replaceChildren();
  dependencyGraph.setAttribute('viewBox', '0 0 860 360');
  dependencyGraph.setAttribute('aria-label',
    `Dependency graph with ${graph.nodes.length} requirements and ${graph.edges.length} active relationships`);
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'dependency-arrow');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('orient', 'auto-start-reverse');
  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  arrow.setAttribute('fill', '#8d98ac');
  marker.append(arrow);
  defs.append(marker);
  dependencyGraph.append(defs);

  const cycleEdges = new Set(plan.graph.cycles.flatMap((cycle) =>
    cycle.path.slice(0, -1).map((id, index) => `${id}|${cycle.path[index + 1]}`)
  ));
  const waveMap = new Map();
  plan.graph.topologicalWaves.forEach((wave, index) =>
    wave.forEach((id) => waveMap.set(id, index)));
  const nodes = [...graph.nodes].sort((left, right) => left.id.localeCompare(right.id));
  const maximumWave = Math.max(0, ...[...waveMap.values()]);
  nodes.filter((node) => !waveMap.has(node.id) && node.inScope).forEach((node) =>
    waveMap.set(node.id, maximumWave + 1));
  nodes.filter((node) => !node.inScope).forEach((node) => waveMap.set(node.id, 0));
  const columns = new Map();
  const externalColumnOffset = nodes.some((node) => !node.inScope) ? 1 : 0;
  const byWave = new Map();
  nodes.forEach((node) => {
    const wave = node.inScope ? (waveMap.get(node.id) || 0) + externalColumnOffset : 0;
    const members = byWave.get(wave) || [];
    byWave.set(wave, [...members, node]);
  });
  const maxColumnRows = 6;
  let nextColumn = 0;
  [...byWave.entries()].sort(([left], [right]) => left - right).forEach(([, members]) => {
    for (let offset = 0; offset < members.length; offset += maxColumnRows) {
      columns.set(nextColumn++, members.slice(offset, offset + maxColumnRows));
    }
  });
  const nodePositions = new Map();
  [...columns.entries()].forEach(([column, members]) => {
    members.forEach((node, row) => {
      nodePositions.set(node.id, {
        x: 45 + column * 205,
        y: 30 + row * 74
      });
    });
  });
  const graphWidth = Math.max(860, (columns.size + 1) * 205);
  const graphHeight = Math.max(360, Math.max(...[...columns.values()].map((members) => members.length), 1) * 74 + 40);
  state.planning.graphDimensions = { width: graphWidth, height: graphHeight };
  applyGraphZoom();

  graph.edges.forEach((edge) => {
    const source = nodePositions.get(edge.prerequisiteId);
    const target = nodePositions.get(edge.dependentId);
    if (!source || !target) return;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(source.x + 150));
    line.setAttribute('y1', String(source.y + 26));
    line.setAttribute('x2', String(target.x));
    line.setAttribute('y2', String(target.y + 26));
    const cycleEdge = cycleEdges.has(`${edge.prerequisiteId}|${edge.dependentId}`);
    line.setAttribute('class', cycleEdge
      ? 'edge edge-cycle'
      : edge.source === 'ai' && edge.status === 'pending'
        ? 'edge edge-ai'
        : edge.status === 'explicit'
          ? 'edge edge-explicit'
          : edge.source === 'ai' && edge.status === 'confirmed'
            ? 'edge edge-confirmed'
            : 'edge');
    line.setAttribute('aria-label', `${edge.prerequisiteId} is a prerequisite for ${edge.dependentId}`);
    dependencyGraph.append(line);
  });

  nodes.forEach((node) => {
    const position = nodePositions.get(node.id);
    const hasJiraDependency = plan.graph.edges.some((edge) =>
      edge.source === 'jira' &&
      (edge.prerequisiteId === node.id || edge.dependentId === node.id)
    );
    const noJiraLinks = node.inScope && !hasJiraDependency;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', `node${node.inScope ? '' : ' external'}${noJiraLinks ? ' no-jira-links' : ''}${state.planning.selectedNodeId === node.id ? ' selected' : ''}`);
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', `${node.id}${node.inScope ? `, ${node.title}` : ', outside selected scope'}`);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(position.x));
    rect.setAttribute('y', String(position.y));
    rect.setAttribute('width', '150');
    rect.setAttribute('height', '52');
    const key = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    key.setAttribute('x', String(position.x + 9));
    key.setAttribute('y', String(position.y + 14));
    key.setAttribute('class', 'node-key');
    key.textContent = node.id;
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', String(position.x + 9));
    title.setAttribute('y', String(position.y + 28));
    title.textContent = truncate(node.inScope ? node.title : 'Outside selected scope', 21);
    group.append(rect, key, title);
    if (noJiraLinks) {
      const noLinksLabel = document.createElementNS(dependencyGraph.namespaceURI, 'text');
      noLinksLabel.setAttribute('x', String(position.x + 9));
      noLinksLabel.setAttribute('y', String(position.y + 43));
      noLinksLabel.setAttribute('class', 'node-state');
      noLinksLabel.textContent = 'No Jira links';
      group.append(noLinksLabel);
    }
    const selectNode = () => showGraphNodeDetail(node.id, plan);
    group.addEventListener('click', selectNode);
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectNode();
      }
    });
    dependencyGraph.append(group);
  });
  renderGraphNodeDetail(state.planning.selectedNodeId, plan);
}

function setGraphZoom(zoom) {
  state.planning.graphZoom = Math.max(0.55, Math.min(2.5, zoom));
  applyGraphZoom();
}

function fitDependencyGraph() {
  state.planning.graphZoom = 1;
  applyGraphZoom();
  document.querySelector('.dependency-graph-wrap').scrollTo({ left: 0, top: 0, behavior: 'smooth' });
}

function applyGraphZoom() {
  const dimensions = state.planning.graphDimensions;
  if (!dimensions) return;
  const zoom = state.planning.graphZoom;
  const width = dimensions.width / zoom;
  const height = dimensions.height / zoom;
  dependencyGraph.setAttribute(
    'viewBox',
    `${(dimensions.width - width) / 2} ${(dimensions.height - height) / 2} ${width} ${height}`
  );
}

function showGraphNodeDetail(id, plan) {
  state.planning.selectedNodeId = id;
  renderDependencyGraph(plan);
}

function renderGraphNodeDetail(id, plan) {
  graphNodeDetail.replaceChildren();
  const requirement = state.requirements.find((item) => item.id === id);
  const graphNode = (plan.provisionalGraph?.nodes || plan.graph.nodes).find((node) => node.id === id);
  const relation = plan.provisionalGraph.relationships.find((item) => item.requirementId === id);
  const panelState = RequirementWorkspaceUtils.dependencyPanelState({
    selectedId: id,
    inScope: Boolean(requirement && graphNode?.inScope),
    hasDependencies: Boolean(relation?.directPrerequisites.length || relation?.directDependents.length),
    title: requirement?.title || ''
  });
  appendText(graphNodeDetail, 'h4', panelState.title);
  if (panelState.state === 'unselected') return;
  if (panelState.state === 'out-of-scope') {
    appendText(graphNodeDetail, 'p', panelState.message);
    return;
  }
  if (panelState.state === 'no-known-dependencies') {
    appendText(graphNodeDetail, 'p', panelState.message);
    return;
  }
  if (!requirement) {
    appendText(graphNodeDetail, 'p', 'The linked requirement is outside the selected planning scope.');
    return;
  }
  const directPrerequisites = relation?.directPrerequisites || [];
  const directDependents = relation?.directDependents || [];
  if (!directPrerequisites.length && !directDependents.length) {
    appendText(graphNodeDetail, 'p', 'No known dependency links were found in this scope. This does not confirm independence.');
  } else {
    appendText(graphNodeDetail, 'p', `Incoming dependencies (prerequisites): ${directPrerequisites.join(', ') || 'None identified'}`);
    appendText(graphNodeDetail, 'p', `Outgoing dependencies (dependents): ${directDependents.join(', ') || 'None identified'}`);
    appendText(graphNodeDetail, 'p', `Transitive prerequisites: ${(relation?.upstream || []).join(', ') || 'None identified'}`);
    appendText(graphNodeDetail, 'p', `Transitive dependents: ${(relation?.downstream || []).join(', ') || 'None identified'}`);
    appendText(graphNodeDetail, 'p', `External prerequisites: ${(relation?.externalPrerequisites || []).join(', ') || 'None identified'}`);
  }
  if (relation?.cycleMember || relation?.blockedByCycle) {
    appendText(graphNodeDetail, 'p', 'This requirement is in or downstream of a dependency cycle.');
  }
  const touchingEdges = new Map(
    [...plan.graph.edges, ...(plan.reviewableRelationships || [])]
      .filter((edge) => edge.prerequisiteId === id || edge.dependentId === id)
      .map((edge) => [edge.id, edge])
  );
  touchingEdges.forEach((edge) => {
      appendText(graphNodeDetail, 'p',
        `${edge.prerequisiteId} → ${edge.dependentId} · ${label(edge.kind || edge.linkType)} · ${edge.source === 'jira' ? 'Explicit Jira' : `AI ${edge.status}`}: ${humanReadableEvidence(edge.evidence || edge.reasoning || '')}`);
      appendText(graphNodeDetail, 'p',
        `Potential testing impact: ${label(edge.impact || 'BOTH')}`);
  });
}

function renderDependencyList(plan) {
  dependencyList.replaceChildren();
  const rows = new Map();
  [...plan.graph.edges, ...(plan.reviewableRelationships || [])].forEach((edge) => rows.set(edge.id, edge));
  dependencyEmpty.hidden = rows.size > 0;
  [...rows.values()].forEach((edge) => {
    const row = document.createElement('tr');
    appendCell(row, edge.prerequisiteId);
    appendCell(row, edge.dependentId);
    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = `status-chip ${edge.status === 'explicit' ? 'explicit' : edge.status}`;
    status.textContent = edge.status === 'explicit'
      ? `Jira · ${edge.linkType || 'dependency'}`
      : `AI · ${edge.status}${edge.confidence ? ` · ${edge.confidence.toLowerCase()} confidence` : ''}`;
    statusCell.append(status);
    row.append(statusCell);
    appendCell(row, humanReadableEvidence(`${edge.evidence || ''}${edge.reasoning ? ` ${edge.reasoning}` : ''}`));
    appendCell(row, label(edge.impact || 'BOTH'));
    const reviewCell = document.createElement('td');
    if (edge.source === 'ai') {
      reviewCell.append(createRelationshipReview(edge));
    } else {
      reviewCell.textContent = 'Read-only Jira link';
    }
    row.append(reviewCell);
    dependencyList.append(row);
  });
}

function createRelationshipReview(edge) {
  const container = document.createElement('div');
  container.className = 'relationship-review';
  if (edge.status !== 'rejected') {
    const prerequisite = createRequirementSelect(edge.prerequisiteId, 'Edit prerequisite');
    const dependent = createRequirementSelect(edge.dependentId, 'Edit dependent');
    const kind = document.createElement('select');
    kind.className = 'review-select';
    kind.setAttribute('aria-label', 'Dependency relationship kind');
    ['BLOCKS', 'REQUIRES', 'ENABLES'].forEach((value) =>
      kind.add(new Option(label(value), value, false, value === edge.kind)));
    const impact = document.createElement('select');
    impact.className = 'review-select';
    impact.setAttribute('aria-label', 'Dependency planning impact');
    ['TEST_DESIGN', 'TEST_EXECUTION', 'BOTH'].forEach((value) =>
      impact.add(new Option(label(value), value, false, value === edge.impact)));
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'button button-quiet';
    edit.textContent = 'Save edited link';
    edit.addEventListener('click', () => {
      if (prerequisite.value === dependent.value) {
        showError(planningError, 'A dependency must connect two different requirements.');
        return;
      }
      state.planning.reviewDecisions[edge.id] = {
        decision: 'confirmed',
        prerequisiteId: prerequisite.value,
        dependentId: dependent.value,
        kind: kind.value,
        impact: impact.value
      };
      recalculatePlanning();
    });
    container.append(prerequisite, dependent, kind, impact, edit);
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'button button-quiet';
    confirm.textContent = edge.status === 'confirmed' ? 'Confirmed' : 'Confirm';
    confirm.disabled = edge.status === 'confirmed';
    confirm.addEventListener('click', () => {
      state.planning.reviewDecisions[edge.id] = 'confirmed';
      recalculatePlanning();
    });
    container.append(confirm);
  } else {
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'button button-quiet';
    restore.textContent = 'Restore suggestion';
    restore.addEventListener('click', () => {
      delete state.planning.reviewDecisions[edge.id];
      recalculatePlanning();
    });
    container.append(restore);
  }
  if (edge.status !== 'rejected') {
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'button button-quiet';
    reject.textContent = 'Reject';
    reject.addEventListener('click', () => {
      state.planning.reviewDecisions[edge.id] = 'rejected';
      recalculatePlanning();
    });
    container.append(reject);
  }
  return container;
}

function createRequirementSelect(selectedId, ariaLabel) {
  const select = document.createElement('select');
  select.className = 'review-select';
  select.setAttribute('aria-label', ariaLabel);
  state.requirements.forEach((requirement) =>
    select.add(new Option(requirement.id, requirement.id, false, requirement.id === selectedId)));
  return select;
}

async function recalculatePlanning() {
  if (!state.planning.plan || state.planning.running) return;
  clearError(planningError);
  try {
    const response = await api('/planning/recalculate', {
      ...planningRequestPayload(),
      semanticGroups: state.planning.semanticGroups,
      reviewDecisions: state.planning.reviewDecisions,
      mode: state.planning.plan.mode,
      model: state.planning.plan.model
    });
    state.planning.plan = response.plan;
    renderPlanning();
  } catch (error) {
    showError(planningError, error.message);
  }
}

function renderPriorityList() {
  const plan = state.planning.plan;
  priorityList.replaceChildren();
  if (!plan) {
    backlogEmpty.hidden = false;
    backlogEmpty.querySelector('h3').textContent = 'No prioritised backlog is available';
    backlogEmpty.querySelector('p').textContent = 'Build a rule-based or AI-assisted plan to calculate evidence-aware scores.';
    return;
  }
  const items = plan.prioritisation.items.filter((item) =>
    !backlogFilter.value || item.rankingStatus === backlogFilter.value
  );
  backlogEmpty.hidden = items.length > 0;
  items.forEach((item) => {
    const row = document.createElement('tr');
    const requirement = state.requirements.find((entry) => entry.id === item.requirementId);
    const analysis = state.results.get(item.requirementId);
    const sequenceItem = plan.workSequence.items.find((entry) => entry.requirementId === item.requirementId);
    appendCell(row, item.rank === null ? '—' : item.rank);
    appendCell(row, `${item.requirementId} · ${requirement?.title || ''}`);
    const jiraPriority = document.createElement('span');
    const priority = displayValue(requirement?.priority);
    jiraPriority.className = `priority-badge ${priorityClass(priority)}`;
    jiraPriority.textContent = priority;
    jiraPriority.setAttribute('aria-label', `Original Jira priority: ${priority}`);
    const priorityCell = document.createElement('td');
    priorityCell.append(jiraPriority);
    row.append(priorityCell);
    appendCell(row, item.score === null ? 'Unranked' : item.score);
    const coverageCell = document.createElement('td');
    const coverage = document.createElement('div');
    coverage.className = 'evidence-meter';
    const coverageLabel = `${item.evidenceCoverage}% evidence coverage`;
    appendText(coverage, 'span', coverageLabel);
    const meter = document.createElement('progress');
    meter.max = 100;
    meter.value = Math.max(0, Math.min(100, Number(item.evidenceCoverage) || 0));
    meter.setAttribute('aria-label', coverageLabel);
    coverage.append(meter);
    coverageCell.append(coverage);
    row.append(coverageCell);
    appendCell(row, label(analysis?.testDesignReadiness || 'NOT_ASSESSED'));
    appendCell(row, sequenceItem ? planningActionLabel(sequenceItem.action) : 'Awaiting work plan');
    const detailsCell = document.createElement('td');
    const details = document.createElement('details');
    details.className = 'priority-details';
    const summary = document.createElement('summary');
    summary.textContent = 'View scoring details';
    const factorList = document.createElement('ul');
    [
      ['Business criticality', 'businessCriticality'],
      ['Dependency impact', 'dependencyImpact'],
      ['Jira priority', 'jiraPriority'],
      ['Test design readiness', 'testDesignReadiness'],
      ['Risk', 'risk']
    ].forEach(([name, key]) => {
      const factor = item.factors[key];
      appendText(factorList, 'li',
        `${name}: ${factor.score === null ? 'Not available' : factor.score} · ${factor.weight}% weight · ${humanReadableEvidence(factor.evidence)}`);
    });
    appendText(factorList, 'li', `Evidence coverage: ${item.evidenceCoverage}%. ${item.reasoning}`);
    appendText(factorList, 'li', 'Missing Jira relationship links are not proof that no dependencies exist.');
    details.append(summary, factorList);
    detailsCell.append(details);
    row.append(detailsCell);
    priorityList.append(row);
  });
}

function renderWorkSequence(plan) {
  workSequence.replaceChildren();
  workSequence.classList.add('work-plan-groups');
  const groups = [
    { type: 'ready', icon: 'check', title: 'Ready to start', items: plan.workSequence.items.filter((item) =>
      item.action === 'START_TEST_DESIGN' && !item.parallelGroup) },
    { type: 'parallel', icon: 'work-plan', title: 'Activities that can proceed in parallel', items: plan.workSequence.items.filter((item) => item.readyForParallelWork && item.parallelGroup) },
    { type: 'blocked', icon: 'dependencies', title: 'Dependency-blocked activities', items: plan.workSequence.items.filter((item) =>
      item.action === 'INVESTIGATE_EXTERNAL_DEPENDENCY' || item.action === 'RESOLVE_DEPENDENCY_CYCLE') },
    { type: 'clarification', icon: 'questions', title: 'Requires Product Owner clarification', items: plan.workSequence.items.filter((item) => item.action === 'CLARIFY_WITH_PRODUCT_OWNER') },
    { type: 'awaiting', icon: 'requirements', title: 'Awaiting requirement analysis', items: plan.workSequence.items.filter((item) =>
      item.action === 'INSUFFICIENT_INFORMATION' && !state.results.has(item.requirementId)) },
    { type: 'other', icon: 'chart', title: 'Requires more prioritisation evidence', items: plan.workSequence.items.filter((item) =>
      item.action === 'INSUFFICIENT_INFORMATION' && state.results.has(item.requirementId)) },
    { type: 'partial', icon: 'target', title: 'Partially ready for test design', items: plan.workSequence.items.filter((item) =>
      item.action === 'START_PARTIAL_DESIGN' && !item.parallelGroup) }
  ].filter((group) => group.items.length > 0);
  groups.forEach((group, index) => {
    const section = document.createElement('details');
    section.className = `work-plan-group ${group.type}`;
    section.open = index === 0;
    const summary = document.createElement('summary');
    summary.append(createIcon(group.icon, 'ui-icon work-plan-icon'), document.createTextNode(group.title));
    appendText(summary, 'span', `${group.items.length} requirement(s)`);
    const members = document.createElement('div');
    members.className = 'sequence-items';
    group.items.forEach((item) => members.append(renderSequenceItem(item)));
    section.append(summary, members);
    workSequence.append(section);
  });
  sequenceEmpty.hidden = groups.length > 0;
}

function renderSequenceItem(item) {
  const article = document.createElement('article');
  article.className = 'sequence-item';
  const requirement = state.requirements.find((entry) => entry.id === item.requirementId);
  appendText(article, 'strong', `${item.requirementId} · ${requirement?.title || ''}`);
  const action = document.createElement('span');
  action.className = `status-chip ${item.action === 'START_TEST_DESIGN' || item.action === 'START_PARTIAL_DESIGN' ? 'confirmed' : 'pending'}`;
  action.textContent = planningActionLabel(item.action);
  article.append(action);
  appendText(article, 'p', item.reason);
  if (item.prerequisites.length) appendText(article, 'p', `Prerequisites: ${item.prerequisites.join(', ')}`);
  if (item.parallelNote) appendText(article, 'p', item.parallelNote);
  if (item.cyclePaths.length) appendText(article, 'p', `Cycle: ${item.cyclePaths[0].join(' → ')}`);
  return article;
}

function renderQuestionRegister() {
  const sourceQuestions = [];
  state.results.forEach((analysis, requirementId) => {
    const requirement = state.requirements.find((item) => item.id === requirementId);
    (analysis.clarificationQuestions || []).forEach((question) => {
      const gap = (analysis.identifiedGaps || []).find((entry) =>
        [entry.category, entry.description].some((value) =>
          String(value || '').toLocaleLowerCase() === String(question.associatedGap || '').toLocaleLowerCase()
        )
      );
      sourceQuestions.push({
        requirementIds: [requirementId],
        requirementTitle: requirement?.title || '',
        question: question.question,
        associatedGap: question.associatedGap,
        gapCategory: gap?.category || question.associatedGap || 'Requirement clarification',
        reason: question.reason,
        potentialImpact: question.potentialImpact,
        priority: String(question.priority || 'MEDIUM').toUpperCase(),
        blocksTestDesign: question.blocksTestDesign === true,
        blocksTestExecution: false,
        source: 'Requirement analysis'
      });
    });
  });
  (state.planning.plan?.questions || []).forEach((question) => {
    const ids = question.requirementIds || [];
    const sources = question.sources || [planningQuestionSource(question.source)];
    const associatedGaps = question.associatedGaps || (question.associatedGap ? [question.associatedGap] : []);
    sourceQuestions.push({
      requirementIds: ids,
      question: question.question,
      associatedGaps,
      gapCategory: associatedGaps.join('; ') || 'Planning clarification',
      reasons: question.reasons || (question.reason ? [question.reason] : []),
      potentialImpacts: question.potentialImpacts || (question.potentialImpact ? [question.potentialImpact] : []),
      priority: String(question.priority || 'MEDIUM').toUpperCase(),
      blocksTestDesign: question.blocksTestDesign === true,
      blocksTestExecution: question.blocksTestExecution === true,
      sources
    });
  });
  const consolidated = RequirementWorkspaceUtils.deduplicateQuestions(sourceQuestions);
  state.questionEntries = consolidated.questions;
  questionCountNote.textContent = consolidated.originalCount === consolidated.consolidatedCount
    ? `${consolidated.originalCount} question(s) from current analysis and planning results. Equivalent questions retain all requirement and source references.`
    : `${consolidated.originalCount} source question(s) consolidated to ${consolidated.consolidatedCount} distinct question(s). Equivalent wording is combined while requirements and sources remain traceable.`;
  updateQuestionFilterOptions();
  const filtered = filteredQuestions();
  questionRegister.replaceChildren();
  questionEmpty.hidden = filtered.length > 0;
  filtered.forEach((question) => {
    const card = document.createElement('article');
    card.className = 'question-card';
    const header = document.createElement('div');
    header.className = 'question-card-head';
    const title = document.createElement('div');
    appendText(title, 'h2', question.question);
    const identifiers = question.requirementIds.map((id) => {
      const requirement = state.requirements.find((item) => item.id === id);
      return requirement ? `${id} · ${requirement.title}` : id;
    });
    appendText(title, 'p', `Requirement${identifiers.length === 1 ? '' : 's'}: ${identifiers.join('; ') || 'Not specified'}`);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'button button-quiet';
    copy.append(createIcon('copy', 'ui-icon'), document.createTextNode('Copy question'));
    copy.addEventListener('click', () => copyQuestionText(formatQuestion(question)));
    header.append(title, copy);
    card.append(header);
    const meta = document.createElement('div');
    meta.className = 'question-meta';
    const priority = appendText(meta, 'span', `${label(question.priority)} priority`);
    priority.classList.add(`question-priority-${String(question.priority).toLocaleLowerCase()}`);
    const gap = appendText(meta, 'span', question.gapCategory);
    gap.classList.add('question-gap');
    const blocking = appendText(meta, 'span',
      question.blocksTestDesign ? 'Blocks test design' : 'Not marked as blocking');
    if (question.blocksTestDesign) blocking.classList.add('question-blocking');
    const source = appendText(meta, 'span', question.sources.join(' · '));
    source.classList.add('question-source');
    card.append(meta);
    question.reasons.forEach((reason) => appendText(card, 'p', `Reason: ${reason}`));
    question.potentialImpacts.forEach((impact) => appendText(card, 'p', `Impact if unanswered: ${impact}`));
    question.requirementIds.forEach((id) => {
      const copyRequirement = document.createElement('button');
      copyRequirement.type = 'button';
      copyRequirement.className = 'button button-quiet';
      copyRequirement.append(createIcon('copy', 'ui-icon'), document.createTextNode(`Copy questions for ${id}`));
      copyRequirement.addEventListener('click', () => {
        const questions = state.questionEntries.filter((entry) => entry.requirementIds.includes(id));
        copyQuestionText(questions.map(formatQuestion).join('\n\n'));
      });
      card.append(copyRequirement);
    });
    questionRegister.append(card);
  });
}

function updateQuestionFilterOptions() {
  setFilterOptions(questionRequirementFilter, 'All requirements',
    state.requirements.map((requirement) => [requirement.id, requirement.id]));
  setFilterOptions(questionGapFilter, 'All gap categories',
    uniqueValues(state.questionEntries.map((question) => question.gapCategory)).map((value) => [value, value]));
  setFilterOptions(questionSourceFilter, 'All sources',
    uniqueValues(state.questionEntries.flatMap((question) => question.sources)).map((value) => [value, value]));
}

function setFilterOptions(select, placeholder, options) {
  const previous = select.value;
  select.replaceChildren(new Option(placeholder, ''));
  options.forEach(([value, name]) => select.add(new Option(name, value)));
  if (options.some(([value]) => value === previous)) select.value = previous;
}

function filteredQuestions() {
  return state.questionEntries.filter((question) =>
    (!questionRequirementFilter.value || question.requirementIds.includes(questionRequirementFilter.value)) &&
    (!questionPriorityFilter.value || question.priority === questionPriorityFilter.value) &&
    (!questionGapFilter.value || question.gapCategory === questionGapFilter.value) &&
    (!questionBlockingFilter.value || question.blocksTestDesign === (questionBlockingFilter.value === 'yes')) &&
    (!questionSourceFilter.value || question.sources.includes(questionSourceFilter.value))
  );
}

function formatQuestion(question) {
  return `${question.requirementIds.join(', ')}: ${question.question}\nGap: ${question.gapCategory}\nReason: ${question.reasons.join('; ')}\nImpact if unanswered: ${question.potentialImpacts.join('; ')}\nPriority: ${label(question.priority)}\nBlocks test design: ${question.blocksTestDesign ? 'Yes' : 'No'}\nSource: ${question.sources.join(', ')}`;
}

async function copyFilteredQuestions() {
  const text = filteredQuestions().map(formatQuestion).join('\n\n');
  if (!text) {
    reportStatus.textContent = 'There are no questions matching the current filters.';
    return;
  }
  await copyQuestionText(text);
}

async function copyQuestionText(text) {
  try {
    await navigator.clipboard.writeText(text);
    reportStatus.textContent = 'Questions copied to the clipboard.';
  } catch {
    reportStatus.textContent = 'Could not copy questions. Check clipboard permissions and try again.';
  }
}

function exportPlanningCsv() {
  downloadCsvReport('prioritisation');
}

function downloadCsvReport(reportType) {
  const report = buildCsvReport(reportType);
  if (!report) return;
  const csv = RequirementWorkspaceUtils.buildCsv(report.headings, report.rows);
  downloadFile(report.filename, csv, 'text/csv;charset=utf-8');
  reportStatus.textContent = `${report.rows.length} row(s) exported from current session state.`;
}

function buildCsvReport(reportType) {
  const requirements = reportRequirements();
  const requirementIds = new Set(requirements.map((requirement) => requirement.id));
  const plan = state.planning.plan;
  const exports = {
    requirements: {
      filename: 'requirement-analysis.csv',
      headings: ['Jira ID', 'Title', 'Jira status', 'Jira priority', 'Analysis status', 'Analysis source', 'Clarity', 'Acceptance criteria', 'Test design readiness', 'Gap count', 'Question count'],
      rows: requirements.map((requirement) => {
        const analysis = state.results.get(requirement.id);
        return [
          requirement.id, requirement.title, requirement.status, requirement.priority,
          analysis ? 'Analysed' : state.failures.has(requirement.id) ? 'Failed' : 'Not analysed',
          analysis?.analysisSource === 'RULE_BASED' ? 'Rule-based' : analysis ? 'GroqCloud' : '',
          analysis ? label(analysis.clarityClassification) : '',
          analysis ? label(analysis.acceptanceCriteriaStatus) : '',
          analysis ? label(analysis.testDesignReadiness) : '',
          analysis?.identifiedGaps.length ?? '',
          analysis?.clarificationQuestions.length ?? ''
        ];
      })
    },
    dependencies: {
      filename: 'dependency-analysis.csv',
      headings: ['Prerequisite', 'Dependent', 'Relationship type', 'Source', 'Review status', 'Testing impact', 'Evidence'],
      rows: reportEdges(requirementIds).map((edge) => [
        edge.prerequisiteId, edge.dependentId, edge.kind || edge.linkType,
        edge.source === 'jira' ? 'Explicit Jira' : 'AI suggestion', edge.status,
        label(edge.impact || 'BOTH'), humanReadableEvidence(edge.evidence || edge.reasoning || '')
      ])
    },
    prioritisation: {
      filename: 'prioritised-backlog.csv',
      headings: ['Rank', 'Jira ID', 'Title', 'Original Jira priority', 'Recommended testing score', 'Ranking status', 'Evidence coverage', 'Recommended action', 'Reasoning'],
      rows: (plan?.prioritisation.items || []).filter((item) => requirementIds.has(item.requirementId)).map((item) => {
        const requirement = requirementById(item.requirementId);
        const sequenceItem = plan.workSequence.items.find((entry) => entry.requirementId === item.requirementId);
        return [
          item.rank ?? '', item.requirementId, requirement?.title || '', requirement?.priority || '',
          item.score ?? '', item.rankingStatus, `${item.evidenceCoverage}%`,
          sequenceItem ? planningActionLabel(sequenceItem.action) : '', item.reasoning
        ];
      })
    },
    'work-plan': {
      filename: 'recommended-work-plan.csv',
      headings: ['Jira ID', 'Title', 'Recommended action', 'Sequence wave', 'Prerequisites', 'Reason'],
      rows: (plan?.workSequence.items || []).filter((item) => requirementIds.has(item.requirementId)).map((item) => [
        item.requirementId, item.title, planningActionLabel(item.action), item.wave ?? '',
        item.prerequisites.join('; '), item.reason
      ])
    },
    questions: {
      filename: 'product-owner-questions.csv',
      headings: ['Jira IDs', 'Requirement titles', 'Question', 'Gap category', 'Reason', 'Impact if unanswered', 'Priority', 'Blocks test design', 'Source'],
      rows: filteredQuestions().filter((question) =>
        question.requirementIds.some((id) => requirementIds.has(id))
      ).map((question) => [
        question.requirementIds.join('; '),
        question.requirementIds.map((id) => requirementById(id)?.title || '').join('; '),
        question.question, question.gapCategory, question.reasons.join('; '),
        question.potentialImpacts.join('; '), label(question.priority),
        question.blocksTestDesign ? 'Yes' : 'No', question.sources.join('; ')
      ])
    }
  };
  return exports[reportType] || null;
}

function renderReportPreview(reportType) {
  const report = buildCsvReport(reportType);
  if (!report) return;
  state.reportPreviewType = reportType;
  const titles = {
    requirements: 'Requirement analysis preview',
    dependencies: 'Dependency analysis preview',
    prioritisation: 'Prioritised backlog preview',
    'work-plan': 'Recommended work plan preview',
    questions: 'Product Owner questions preview'
  };
  reportPreviewTitle.textContent = titles[reportType] || 'Report preview';
  reportPreviewHead.replaceChildren();
  reportPreviewBody.replaceChildren();
  const headerRow = document.createElement('tr');
  report.headings.forEach((heading) => appendText(headerRow, 'th', heading));
  reportPreviewHead.append(headerRow);
  report.rows.slice(0, 10).forEach((values) => {
    const row = document.createElement('tr');
    values.forEach((value) => appendText(row, 'td', displayValue(value)));
    reportPreviewBody.append(row);
  });
  const shown = Math.min(report.rows.length, 10);
  reportPreviewSummary.textContent = `${report.rows.length} row(s) in this preview scope. Showing ${shown}.`;
  reportPreviewTableWrap.hidden = shown === 0;
  reportPreviewEmpty.hidden = shown > 0;
  reportPreviewEmpty.querySelector('h3').textContent = report.rows.length ? 'No preview rows' : 'No report data in scope';
  reportPreviewEmpty.querySelector('p').textContent = report.rows.length
    ? 'No rows are available for this report.'
    : 'Change the report scope or create the corresponding analysis or plan in this session.';
}

function renderHtmlReportPreview() {
  state.reportPreviewType = 'html';
  const requirements = reportRequirements();
  const ids = new Set(requirements.map((requirement) => requirement.id));
  const analyses = requirements.map((requirement) => state.results.get(requirement.id)).filter(Boolean);
  const summary = RequirementAnalysisSummary.summarizeAnalyses(analyses);
  const plan = state.planning.plan;
  const questions = state.questionEntries.filter((question) =>
    question.requirementIds.some((id) => ids.has(id))
  );
  reportPreviewTitle.textContent = 'Consolidated HTML report preview';
  reportPreviewHead.replaceChildren();
  reportPreviewBody.replaceChildren();
  const rows = [
    ['Requirements in scope', requirements.length],
    ['Requirements analysed', analyses.length],
    ['Clear / partially clear / ambiguous', `${summary.clear} / ${summary.partiallyClear} / ${summary.ambiguous}`],
    ['Missing acceptance criteria', analyses.filter((item) => item.acceptanceCriteriaStatus === 'MISSING').length],
    ['Unavailable acceptance criteria', analyses.filter((item) => item.acceptanceCriteriaStatus === 'UNAVAILABLE').length],
    ['Dependency relationships in scope', reportEdges(ids).length],
    ['Prioritised requirements in scope', (plan?.prioritisation.items || []).filter((item) => ids.has(item.requirementId)).length],
    ['Work-plan items in scope', (plan?.workSequence.items || []).filter((item) => ids.has(item.requirementId)).length],
    ['Clarification questions in scope', questions.length]
  ];
  rows.forEach(([heading, value]) => {
    const row = document.createElement('tr');
    appendText(row, 'th', heading);
    appendText(row, 'td', String(value));
    reportPreviewBody.append(row);
  });
  reportPreviewSummary.textContent = `Summary for ${reportScope.value === 'selected' ? 'selected' : 'all retrieved'} requirements. The downloaded report includes source evidence and human-review notes.`;
  reportPreviewTableWrap.hidden = false;
  reportPreviewEmpty.hidden = true;
}

function refreshSelectedReportPreview() {
  if (reportScope.value !== 'selected' || !state.reportPreviewType) return;
  if (state.reportPreviewType === 'html') renderHtmlReportPreview();
  else renderReportPreview(state.reportPreviewType);
}

function clearReportPreview() {
  state.reportPreviewType = null;
  reportPreviewTitle.textContent = 'Report preview';
  reportPreviewSummary.textContent = 'Choose a report to preview current session data.';
  reportPreviewHead.replaceChildren();
  reportPreviewBody.replaceChildren();
  reportPreviewTableWrap.hidden = true;
  reportPreviewEmpty.hidden = false;
  reportPreviewEmpty.querySelector('h3').textContent = 'No preview selected';
  reportPreviewEmpty.querySelector('p').textContent = 'Choose Preview on a report card to inspect its contents before downloading.';
}

function downloadHtmlReport() {
  const project = selectedProject();
  const requirementsInScope = reportRequirements();
  const requirementIds = new Set(requirementsInScope.map((requirement) => requirement.id));
  const analyses = requirementsInScope.map((requirement) => state.results.get(requirement.id)).filter(Boolean);
  const summary = RequirementAnalysisSummary.summarizeAnalyses(analyses);
  const metrics = [
    ['Requirements in scope', requirementsInScope.length],
    ['Requirements analysed', analyses.length],
    ['Unanalysed requirements', Math.max(0, requirementsInScope.length - analyses.length)],
    ['Analysis coverage', requirementsInScope.length
      ? `${Math.round((analyses.length / requirementsInScope.length) * 100)}%`
      : '0%'],
    ['Clear / partially clear / ambiguous', `${summary.clear} / ${summary.partiallyClear} / ${summary.ambiguous}`],
    ['Missing acceptance criteria', analyses.filter((item) => item.acceptanceCriteriaStatus === 'MISSING').length],
    ['Unavailable acceptance criteria', analyses.filter((item) => item.acceptanceCriteriaStatus === 'UNAVAILABLE').length],
    ['Ready / partially ready for test design', `${analyses.filter((item) => item.testDesignReadiness === 'READY_FOR_TEST_DESIGN').length} / ${analyses.filter((item) => item.testDesignReadiness === 'PARTIALLY_READY').length}`],
    ['Consolidated clarification questions', state.questionEntries.filter((question) =>
      question.requirementIds.some((id) => requirementIds.has(id))
    ).length]
  ];
  const requirements = requirementsInScope.map((requirement) => {
    const analysis = state.results.get(requirement.id);
    return {
      title: `${requirement.id} · ${requirement.title}`,
      details: [
        ['Jira status and priority', `${displayValue(requirement.status)} · ${displayValue(requirement.priority)}`],
        ['Original description', requirement.description || 'Description is empty or unavailable.'],
        ['Original acceptance criteria', requirement.acceptanceCriteria?.value || requirement.acceptanceCriteria?.descriptionCriteria || 'No meaningful criteria content available.'],
        ['Analysis status', analysis ? (analysis.analysisSource === 'RULE_BASED' ? 'Rule-based analysis' : 'Analysed') : state.failures.has(requirement.id) ? 'Failed · retry required' : 'Not analysed'],
        ['Clarity', analysis ? `${label(analysis.clarityClassification)} · ${analysis.clarityReasoning}` : 'Not assessed'],
        ['Acceptance criteria assessment', analysis ? `${label(analysis.acceptanceCriteriaStatus)} · ${analysis.acceptanceCriteriaFindings.findings.join(' ')}` : 'Not assessed'],
        ['Requirement gaps', analysis ? analysis.identifiedGaps.map((gap) => `${gap.category}: ${gap.description}`).join('; ') || 'No gaps identified.' : 'Not assessed'],
        ['Test design readiness', analysis ? `${label(analysis.testDesignReadiness)} · ${analysis.testReadinessReasoning}` : 'Not assessed'],
        ['Clarification questions', analysis ? analysis.clarificationQuestions.map((question) => question.question).join('; ') || 'None identified.' : 'Not assessed']
      ]
    };
  });
  const plan = state.planning.plan;
  const backlog = (plan?.prioritisation.items || []).filter((item) => requirementIds.has(item.requirementId)).map((item) => ({
    title: `${item.rank ?? 'Unranked'} · ${item.requirementId} · ${requirementById(item.requirementId)?.title || ''}`,
    details: [
      ['Recommended testing score', item.score ?? 'Unranked'],
      ['Evidence coverage', `${item.evidenceCoverage}%`],
      ['Original Jira priority', requirementById(item.requirementId)?.priority || 'Not available'],
      ['Reasoning', item.reasoning],
      ...Object.entries(item.factors).map(([name, factor]) => [
        dimensionLabel(name), `${factor.score === null ? 'Not available' : factor.score} · ${factor.weight}% weight · ${humanReadableEvidence(factor.evidence)}`
      ])
    ]
  }));
  const workPlan = (plan?.workSequence.items || []).filter((item) => requirementIds.has(item.requirementId)).map((item) => ({
    title: `${item.requirementId} · ${item.title}`,
    details: [
      ['Recommended action', planningActionLabel(item.action)],
      ['Sequence wave', item.wave ?? 'Not sequenced'],
      ['Prerequisites', item.prerequisites.join(', ') || 'No documented prerequisites identified'],
      ['Reason', item.reason]
    ]
  }));
  const questions = state.questionEntries.filter((question) =>
    question.requirementIds.some((id) => requirementIds.has(id))
  ).map((question) => ({
    title: `${question.requirementIds.join(', ')} · ${question.question}`,
    details: [
      ['Gap category', question.gapCategory],
      ['Reason', question.reasons.join('; ')],
      ['Impact if unanswered', question.potentialImpacts.join('; ')],
      ['Priority and test design blocking', `${label(question.priority)} · ${question.blocksTestDesign ? 'Blocking' : 'Not marked as blocking'}`],
      ['Sources', question.sources.join(', ')]
    ]
  }));
  const data = {
    productName: APP_NAME,
    fullName: APP_FULL_NAME,
    tagline: APP_TAGLINE,
    projectName: project?.name || 'No project selected',
    projectKey: project?.key || '',
    generatedAt: new Date().toLocaleString(),
    scopeCount: requirementsInScope.length,
    scopeLabel: reportScope.value === 'selected' ? 'Selected requirements' : 'All retrieved requirements',
    model: plan?.model || state.analysisConfig?.model || null,
    metrics,
    sections: [
      { title: 'Requirement analysis and source content', items: requirements },
      { title: 'Dependency findings', items: reportEdges(requirementIds).map((edge) => ({
        title: `${edge.prerequisiteId} → ${edge.dependentId} · ${label(edge.kind || edge.linkType)}`,
        details: [['Source and review status', `${edge.source === 'jira' ? 'Explicit Jira' : 'AI suggestion'} · ${edge.status}`],
          ['Potential testing impact', label(edge.impact || 'BOTH')],
          ['Evidence', humanReadableEvidence(edge.evidence || edge.reasoning || '')]]
      })) },
      { title: 'Prioritised backlog', items: backlog },
      { title: 'Recommended work plan', items: workPlan },
      { title: 'Product Owner clarification questions', items: questions },
      { title: 'Known limitations', items: [{
        title: 'Coverage and human review',
        details: [
          ['Dependency analysis', 'No documented Jira link is not proof of independence. Semantic analysis uses groups of up to five; cross-group dependencies may be missed.'],
          ['Prioritisation assumptions', 'Weights are configurable product assumptions. Dependency evidence coverage describes documented information, not certainty of discovery.'],
          ['Analysis', 'AI-generated findings are probabilistic and require human review. Test execution readiness is not assessed.'],
          ['Data freshness', 'This report reflects only current dashboard session state and does not trigger a new Jira or GroqCloud request.']
        ]
      }] },
      { title: 'Human review disclaimer', items: [{
        title: 'Review before acting',
        details: [['Disclaimer', 'Use recommendations as decision support only. Verify source evidence and confirm planning decisions with appropriate stakeholders. Jira is read-only.']]
      }] }
    ],
    disclaimer: 'This report is generated from current in-memory application state. It contains no Jira credentials, API tokens, Groq API keys, authorization headers, or sensitive diagnostics.'
  };
  const html = RequirementWorkspaceUtils.buildHtmlReport(data);
  downloadFile('requirement-analysis-report.html', html, 'text/html;charset=utf-8');
  reportStatus.textContent = 'Printable HTML report downloaded from current session state. No upstream request was made.';
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function selectedProject() {
  return state.projects.find((project) => project.key === projectSelect.value) || null;
}

function reportRequirements() {
  if (reportScope.value !== 'selected') return state.requirements;
  return state.requirements.filter((requirement) => state.selected.has(requirement.id));
}

function requirementById(id) {
  return state.requirements.find((requirement) => requirement.id === id) || null;
}

function reportEdges(requirementIds = new Set(reportRequirements().map((requirement) => requirement.id))) {
  const plan = state.planning.plan;
  if (!plan) return [];
  return [...new Map([
    ...(plan.graph.edges || []),
    ...(plan.reviewableRelationships || [])
  ].map((edge) => [edge.id, edge])).values()]
    .filter((edge) => requirementIds.has(edge.prerequisiteId) || requirementIds.has(edge.dependentId));
}

function truncate(value, limit) {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function planningActionLabel(value) {
  const actions = {
    START_TEST_DESIGN: 'Start test design',
    START_PARTIAL_DESIGN: 'Start partial design',
    CLARIFY_WITH_PRODUCT_OWNER: 'Clarify with Product Owner',
    INVESTIGATE_EXTERNAL_DEPENDENCY: 'Check external dependency',
    RESOLVE_DEPENDENCY_CYCLE: 'Resolve dependency cycle',
    INSUFFICIENT_INFORMATION: 'Insufficient information'
  };
  return actions[value] || label(value);
}

function planningQuestionSource(value) {
  const sources = {
    'requirement-analysis': 'Requirement analysis',
    'dependency-analysis': 'Dependency analysis',
    'dependency-review': 'Relationship review',
    'external-dependency': 'External dependency',
    combined: 'Multiple analysis sources'
  };
  return sources[value] || 'Planning';
}

function renderSummary() {
  const analyses = [...state.results.values()];
  const summary = RequirementAnalysisSummary.summarizeAnalyses(analyses);
  const cards = [
    ['Requirements analysed', summary.total],
    ['Clear', summary.clear],
    ['Partially clear', summary.partiallyClear],
    ['Ambiguous', summary.ambiguous],
    ['Missing / unavailable criteria', summary.missingOrUnavailableCriteria],
    ['Ready for test design', summary.readyForTestDesign],
    ['Requiring clarification', summary.requiringClarification],
    ['Clarification questions', summary.clarificationQuestions]
  ];
  cards.forEach(([title, value]) => {
    const card = document.createElement('article');
    card.className = 'summary-card';
    const number = document.createElement('strong');
    number.textContent = String(value);
    const labelText = document.createElement('span');
    labelText.textContent = title;
    card.append(number, labelText);
    analysisSummary.append(card);
  });
}

function renderOverview() {
  const analyses = [...state.results.values()];
  const summary = RequirementAnalysisSummary.summarizeAnalyses(analyses);
  const countStatus = (status) => analyses.filter((analysis) => analysis.acceptanceCriteriaStatus === status).length;
  const readinessCount = (status) => analyses.filter((analysis) => analysis.testDesignReadiness === status).length;
  const plan = state.planning.plan;
  const planSummary = plan?.summary;
  const requirementNoun = state.requirements.length === 1 ? 'requirement' : 'requirements';
  const chartSubtitle = `Based on ${analyses.length} of ${state.requirements.length} retrieved ${requirementNoun} analysed.`;
  [claritySubtitle, criteriaSubtitle, readinessSubtitle].forEach((subtitle) => {
    subtitle.textContent = chartSubtitle;
  });
  const analysisProgressState = RequirementWorkspaceUtils.analysisCoverage(
    state.requirements.length,
    analyses.length,
    state.failures.size
  );
  renderKpiCards(overviewMetrics, [
    { value: state.requirements.length, label: 'Retrieved requirements', icon: 'requirements', color: '#2563EB', tint: '#EFF6FF', tooltip: 'Stories retrieved from the selected Jira project.' },
    { value: analyses.length, label: 'Analysed', icon: 'target', color: '#4F46E5', tint: '#EEF2FF', tooltip: 'Requirements with a completed analysis in this session.' },
    { value: analysisProgressState.pending, label: 'Pending analysis', icon: 'chart', color: '#D97706', tint: '#FFFBEB', tooltip: 'Retrieved requirements not yet analysed. Failures are counted separately.' },
    { value: analysisProgressState.failed, label: 'Failed · retry needed', icon: 'sparkles', color: '#DC2626', tint: '#FEF2F2', tooltip: 'Requirement analyses that failed and can be retried.' }
  ]);
  const { total, analysed: analyzed, failed, pending: unanalysed } = analysisProgressState;
  coverageCopy.textContent = total
    ? `${analyzed} of ${total} retrieved requirements analysed (${Math.round((analyzed / total) * 100)}%); ${failed} failed and ${unanalysed} are pending or not yet analysed.`
    : 'Retrieve requirements to see analysis coverage.';
  renderDonutChart(coverageChart, [
    ['Analysed', analyzed, 'analysed'],
    ['Failed', failed, 'failed'],
    ['Pending', unanalysed, 'pending']
  ], total, analyzed);
  renderBarChart(clarityChart, [
    ['Clear', summary.clear, 'success'],
    ['Partially clear', summary.partiallyClear, 'warning'],
    ['Ambiguous', summary.ambiguous, 'danger']
  ], analyses.length);
  renderBarChart(criteriaChart, [
    ['Available and valid', countStatus('AVAILABLE_AND_VALID'), 'success'],
    ['Available but incomplete', countStatus('AVAILABLE_BUT_INCOMPLETE'), 'warning'],
    ['Available but ambiguous', countStatus('AVAILABLE_BUT_AMBIGUOUS'), 'purple'],
    ['Available but not testable', countStatus('AVAILABLE_BUT_NOT_TESTABLE'), 'danger'],
    ['Missing', countStatus('MISSING'), 'danger'],
    ['Unavailable', countStatus('UNAVAILABLE'), 'blue']
  ], analyses.length);
  renderBarChart(readinessChart, [
    ['Ready for test design', readinessCount('READY_FOR_TEST_DESIGN'), 'success'],
    ['Partially ready', readinessCount('PARTIALLY_READY'), 'warning'],
    ['Not ready', readinessCount('NOT_READY'), 'danger']
  ], analyses.length);
  renderDependencyInsights(dependencyMetrics, plan);
  renderPrioritisationInsights(prioritisationSummary, plan);
  renderQuestionInsights(questionSummary, plan);

  recommendedActions.replaceChildren();
  const actions = [];
  if (!state.requirements.length) actions.push(['Retrieve Jira stories', 'requirements']);
  else if (state.failures.size) actions.push(['Retry failed requirement analyses', 'requirements']);
  else if (state.requirements.some((requirement) => !state.results.has(requirement.id))) {
    actions.push(['Analyze selected requirements', 'requirements']);
  }
  if (state.questionEntries.length) actions.push(['Review Product Owner questions', 'questions']);
  if (planSummary?.proposedRelationships) actions.push(['Review provisional dependencies', 'dependencies']);
  if (!plan) actions.push(['Build a rule-based dependency plan', 'dependencies']);
  if (!actions.length) actions.push(['Review the current work plan and reports', 'work-plan']);
  actions.forEach(([text, view]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-link';
    button.append(document.createTextNode(text), createIcon('arrow-right', 'ui-icon'));
    button.addEventListener('click', () => navigateTo(view));
    recommendedActions.append(button);
  });
}

function renderKpiCards(container, entries) {
  container.replaceChildren();
  entries.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'kpi-card';
    card.title = entry.tooltip;
    card.setAttribute('aria-label', `${entry.label}: ${entry.value}. ${entry.tooltip}`);
    card.style.setProperty('--kpi-color', entry.color);
    card.style.setProperty('--kpi-tint', entry.tint);
    const icon = document.createElement('span');
    icon.className = 'kpi-icon';
    icon.append(createIcon(entry.icon, 'ui-icon'));
    const content = document.createElement('span');
    const value = document.createElement('strong');
    value.className = 'kpi-value';
    value.textContent = String(entry.value);
    const labelText = document.createElement('span');
    labelText.className = 'kpi-label';
    labelText.textContent = entry.label;
    content.className = 'kpi-content';
    content.append(value, labelText);
    card.append(icon, content);
    container.append(card);
  });
}

function renderDonutChart(container, entries, total, analysed) {
  container.replaceChildren();
  if (!total) {
    appendText(container, 'p', 'No retrieved requirements. Select a Jira project and retrieve its stories to see coverage.');
    container.classList.add('chart-empty');
    return;
  }
  container.classList.remove('chart-empty');
  const layout = document.createElement('div');
  layout.className = 'donut-layout';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('donut-svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('role', 'img');
  const percent = Math.round((analysed / total) * 100);
  svg.setAttribute('aria-label', `Analysis coverage: ${analysed} of ${total} requirements analysed, ${percent} percent.`);
  const title = document.createElementNS(svg.namespaceURI, 'title');
  title.textContent = `Analysis coverage: ${analysed} of ${total} requirements analysed`;
  svg.append(title);
  const circle = (className) => {
    const node = document.createElementNS(svg.namespaceURI, 'circle');
    node.setAttribute('cx', '60');
    node.setAttribute('cy', '60');
    node.setAttribute('r', '38');
    node.setAttribute('class', className);
    return node;
  };
  svg.append(circle('donut-track'));
  const circumference = 2 * Math.PI * 38;
  let offset = 0;
  entries.forEach(([, count, className]) => {
    if (!count) return;
    const length = (count / total) * circumference;
    const segment = circle(`donut-segment ${className}`);
    segment.setAttribute('stroke-dasharray', `${length} ${circumference - length}`);
    segment.setAttribute('stroke-dashoffset', String(-offset));
    svg.append(segment);
    offset += length;
  });
  const percentText = document.createElementNS(svg.namespaceURI, 'text');
  percentText.setAttribute('x', '60');
  percentText.setAttribute('y', '57');
  percentText.setAttribute('class', 'donut-percent');
  percentText.textContent = `${percent}%`;
  const caption = document.createElementNS(svg.namespaceURI, 'text');
  caption.setAttribute('x', '60');
  caption.setAttribute('y', '72');
  caption.setAttribute('class', 'donut-caption');
  caption.textContent = 'analysed';
  svg.append(percentText, caption);
  const legend = document.createElement('div');
  legend.className = 'donut-legend';
  entries.forEach(([labelText, count, className]) => {
    const row = document.createElement('div');
    row.className = 'donut-legend-row';
    row.setAttribute('aria-label', `${labelText}: ${count}`);
    const dot = document.createElement('span');
    dot.className = `legend-dot ${className}`;
    appendText(row, 'span', labelText);
    row.prepend(dot);
    appendText(row, 'strong', String(count));
    legend.append(row);
  });
  layout.append(svg, legend);
  container.append(layout);
}

function renderBarChart(container, entries, total) {
  container.replaceChildren();
  if (!total) {
    const message = document.createElement('p');
    message.className = 'chart-empty';
    message.textContent = 'No analysed requirements yet. Quality findings will appear after analysis.';
    container.append(message);
    return;
  }
  entries.forEach(([name, count, color]) => {
    const row = document.createElement('div');
    row.className = 'chart-row';
    row.setAttribute('aria-label', `${name}: ${count} of ${total} analysed requirements (${Math.round((count / total) * 100)} percent)`);
    appendText(row, 'span', name);
    const track = document.createElement('div');
    track.className = 'chart-track';
    const fill = document.createElement('div');
    fill.className = `chart-fill ${color}`;
    fill.style.width = `${Math.max(0, Math.min(100, (count / total) * 100))}%`;
    fill.setAttribute('aria-hidden', 'true');
    track.append(fill);
    row.append(track);
    appendText(row, 'strong', String(count));
    container.append(row);
  });
}

function renderDependencyInsights(container, plan) {
  const overview = RequirementWorkspaceUtils.planningOverview(
    plan,
    planningScope.value,
    planningScopeRequirements().length
  );
  if (!overview.planned) {
    renderInsightState(container, 'Not planned. Build a plan to view dependency metrics.');
    appendPlanningOverviewNote(container, overview);
    return;
  }
  renderInsightCards(container, [
    ['Explicit Jira links', metricValue(overview.explicitLinkCount), 'Read from Jira relationship fields.', '#2563EB', '#EFF6FF'],
    ['Human-confirmed AI links', metricValue(overview.confirmedLinkCount), 'Reviewed suggestions in the baseline.', '#16A34A', '#F0FDF4'],
    ['Suggestions to review', metricValue(overview.proposedLinkCount), 'Provisional links do not change the baseline.', '#9333EA', '#FAF5FF'],
    ['No documented links', metricValue(overview.noDocumentedLinksCount), 'Absence of a Jira link is not proof of independence.', '#D97706', '#FFFBEB'],
    ['Jira link data unavailable', metricValue(overview.unavailableLinkDataCount), 'Requirements whose Jira relationship fields could not be retrieved; this is not a zero-link finding.', '#64748B', '#F1F5F9']
  ]);
  appendPlanningOverviewNote(container, overview);
}

function renderPrioritisationInsights(container, plan) {
  const overview = RequirementWorkspaceUtils.planningOverview(
    plan,
    planningScope.value,
    planningScopeRequirements().length
  );
  if (!plan) {
    renderInsightState(container, 'Not planned. No rankings are shown until a plan is built.');
    appendPlanningOverviewNote(container, overview);
    return;
  }
  renderInsightCards(container, [
    ['Ranked', metricValue(overview.rankedCount), 'Requirements with sufficient evidence for a score.', '#D97706', '#FFFBEB'],
    ['Need more evidence', metricValue(overview.unrankedCount), 'No score is fabricated below the evidence threshold.', '#64748B', '#F1F5F9'],
    ['Unclassified', metricValue(overview.unclassifiedCount), 'Planning items without a recognised ranking status.', '#9333EA', '#FAF5FF']
  ]);
  appendPlanningOverviewNote(container, overview, true);
}

function metricValue(value) {
  return value === null ? 'Unavailable' : String(value);
}

function appendPlanningOverviewNote(container, overview, includeRankingNotes = false) {
  const count = overview.requirementCount;
  const countText = count === null
    ? 'requirement count unavailable'
    : `${count} ${count === 1 ? 'requirement' : 'requirements'}`;
  const note = document.createElement('p');
  note.className = 'scope-note planning-overview-note';
  note.textContent = overview.planned
    ? `Planning scope: ${overview.scopeLabel} · ${countText}.`
    : `Not planned · Current scope: ${overview.scopeLabel} · ${countText}.`;
  container.append(note);

  if (!includeRankingNotes) return;
  if (overview.rankingCountsReconcile === false) {
    appendText(container, 'p',
      'Ranked, needs-more-evidence, and unclassified items do not reconcile with the planning population.')
      .className = 'insight-state planning-consistency-warning';
  }
  if (overview.rankingSummaryConsistent === false) {
    appendText(container, 'p',
      'Displayed ranking counts use the detailed planning items because the stored summary counts differ.')
      .className = 'insight-state planning-consistency-warning';
  }
}

function renderQuestionInsights(container, plan) {
  if (!state.requirements.length) {
    renderInsightState(container, 'Retrieve Jira stories to begin requirement assessment.');
    return;
  }
  if (!state.results.size && !plan) {
    renderInsightState(container, 'Product Owner questions have not been assessed yet.');
    return;
  }
  const blocking = state.questionEntries.filter((question) => question.blocksTestDesign).length;
  renderInsightCards(container, [
    ['Distinct questions', state.questionEntries.length, 'Equivalent wording is consolidated with traceability.', '#DB2777', '#FDF2F8'],
    ['Blocking test design', blocking, 'Questions explicitly marked as design blockers.', '#DC2626', '#FEF2F2']
  ]);
  if (!state.questionEntries.length && (state.results.size > 0 || plan)) {
    const note = document.createElement('p');
    note.className = 'insight-state question-empty-note';
    note.textContent = 'No clarification questions were identified in the completed analyses.';
    container.append(note);
  }
}

function renderInsightCards(container, entries) {
  container.replaceChildren();
  entries.forEach(([title, value, note, color, tint]) => {
    const card = document.createElement('article');
    card.className = 'insight-card';
    card.title = note;
    card.style.setProperty('--insight-color', color);
    card.style.setProperty('--insight-tint', tint);
    appendText(card, 'strong', String(value));
    appendText(card, 'span', title);
    appendText(card, 'small', note);
    container.append(card);
  });
}

function renderInsightState(container, message) {
  container.replaceChildren();
  appendText(container, 'p', message);
  container.firstElementChild.className = 'insight-state';
}

function createIcon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(svg.namespaceURI, 'use');
  use.setAttribute('href', `assets/module-icons.svg#icon-${name}`);
  svg.append(use);
  return svg;
}

function updateProjectDisplay() {
  const project = state.projects.find((item) => item.key === projectSelect.value);
  projectDisplay.textContent = project ? `${project.name} · ${project.key}` : 'No project selected';
  projectDisplay.hidden = !state.credentials;
  document.querySelector('#overview-project-key').textContent = project?.key || 'No project';
  renderSettings();
}

function renderSettings() {
  const settingsUrl = document.querySelector('#settings-jira-url');
  settingsUrl.textContent = state.credentials?.instanceUrl
    ? `Jira site: ${state.credentials.instanceUrl}`
    : 'Not connected';
  document.querySelector('#settings-account').textContent =
    state.credentials ? 'Session credentials are active but are not displayed.' : 'Credentials are not shown.';
  document.querySelector('#settings-model').textContent =
    state.planning.plan?.model || state.analysisConfig?.model || 'Not selected';
  const config = state.analysisConfig;
  document.querySelector('#settings-config').textContent = config
    ? `Concurrency ${config.concurrency ?? 'not reported'} · output-token cap ${config.maxOutputTokens ?? 'not reported'} · structured output ${config.structuredOutputMode ?? 'not reported'}`
    : 'Model configuration appears after a GroqCloud analysis request.';
  renderUsageSummary();
}

function renderUsageSummary() {
  const usage = state.sessionUsage;
  const totalTokens = RequirementWorkspaceUtils.completeTokenTotal(usage);
  usageSummary.replaceChildren();
  const metrics = [
    ['Inference requests', usage.inferenceRequests, 'Total requests made from this dashboard session.'],
    ['Successful responses', usage.successfulRequests, 'Provider responses received successfully.'],
    ['Failed requests', usage.failedRequests, 'Requests that did not complete successfully.'],
    ['Retry attempts', usage.retryAttempts, 'Additional attempts made after an initial request.'],
    ['Input tokens', usage.inputTokenReports ? usage.inputTokens.toLocaleString() : 'Unavailable', 'Reported prompt tokens; not an account quota.'],
    ['Output tokens', usage.outputTokenReports ? usage.outputTokens.toLocaleString() : 'Unavailable', 'Reported response tokens; not an account quota.'],
    ['Total reported tokens', totalTokens === null ? 'Unavailable' : totalTokens.toLocaleString(), 'Shown only when complete token counts are available.'],
    ['Usage metadata', `${usage.usageReports} of ${usage.successfulRequests}`, 'Successful responses that included usage metadata.'],
    ['Complete token reports', `${usage.completeTokenReports} of ${usage.successfulRequests}`, 'Responses reporting both input and output tokens.']
  ];
  const tokenTotal = usage.inputTokens + usage.outputTokens;
  const canShowTokenMix = usage.inputTokenReports && usage.outputTokenReports && tokenTotal > 0;
  metrics.forEach(([name, value, note]) => {
    const card = document.createElement('article');
    card.className = 'usage-metric';
    card.title = note;
    appendText(card, 'span', name);
    appendText(card, 'strong', String(value));
    appendText(card, 'small', note);
    if (canShowTokenMix && name === 'Input tokens') {
      const bar = document.createElement('div');
      bar.className = 'token-mix-bar';
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label',
        `Session token distribution: ${Math.round((usage.inputTokens / tokenTotal) * 100)} percent input and ${Math.round((usage.outputTokens / tokenTotal) * 100)} percent output.`);
      const inputShare = document.createElement('span');
      inputShare.style.width = `${(usage.inputTokens / tokenTotal) * 100}%`;
      const outputShare = document.createElement('span');
      outputShare.style.width = `${(usage.outputTokens / tokenTotal) * 100}%`;
      bar.append(inputShare, outputShare);
      card.append(bar);
    }
    usageSummary.append(card);
  });
  Object.entries(usage.byOperation).forEach(([operation, detail]) => {
    const total = RequirementWorkspaceUtils.completeTokenTotal(detail);
    const totalText = total === null ? 'Incomplete' : total.toLocaleString();
    const card = document.createElement('article');
    card.className = 'usage-metric usage-operation';
    appendText(card, 'span', label(operation));
    appendText(card, 'strong', `${detail.inferenceRequests} request(s)`);
    appendText(card, 'small', `${totalText} complete tokens in this operation`);
    usageSummary.append(card);
  });
  const warning = document.querySelector('#usage-warning');
  warning.textContent = state.tokenWarningThreshold && totalTokens !== null && totalTokens >= state.tokenWarningThreshold
    ? `Session usage has reached the configured warning threshold of ${state.tokenWarningThreshold.toLocaleString()} tokens.`
    : 'Usage shown here covers only this dashboard session and does not indicate account quota or remaining daily limit.';
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right)));
}

function filteredAnalyses() {
  return [...state.results.entries()]
    .map(([id, analysis]) => ({
      requirement: state.requirements.find((item) => item.id === id),
      analysis
    }))
    .filter(({ requirement }) => Boolean(requirement))
    .filter(({ analysis }) => RequirementAnalysisSummary.matchesAnalysisFilters(analysis, {
      clarity: clarityFilter.value,
      acceptanceCriteriaStatus: criteriaFilter.value,
      testDesignReadiness: readinessFilter.value
    }));
}

function renderAnalysisRow(requirement, analysis) {
  const row = document.createElement('tr');
  appendCell(row, requirement.id);
  appendCell(row, requirement.title);
  appendCell(row, requirement.priority);
  appendCell(row, analysis.analysisSource === 'RULE_BASED' ? 'Rule-based · no AI call' : 'GroqCloud');
  appendBadgeCell(row, analysis.clarityClassification, `clarity-${analysis.clarityClassification.toLowerCase()}`);
  appendCell(row, label(analysis.acceptanceCriteriaStatus));
  appendCell(row, label(analysis.testDesignReadiness));
  appendCell(row, analysis.identifiedGaps.length);
  appendCell(row, analysis.clarificationQuestions.length);
  const actionCell = document.createElement('td');
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'button button-quiet table-action';
  action.textContent = 'View analysis';
  action.addEventListener('click', () => showAnalysisDetail(requirement, analysis));
  actionCell.append(action);
  row.append(actionCell);
  return row;
}

function appendCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = displayValue(value);
  row.append(cell);
}

function appendBadgeCell(row, value, className) {
  const cell = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `analysis-badge ${className}`;
  badge.textContent = label(value);
  cell.append(badge);
  row.append(cell);
}

function showAnalysisDetail(requirement, analysis) {
  document.querySelector('#story-source-detail').hidden = true;
  analysisDetail.dataset.requirementId = requirement.id;
  document.querySelector('#detail-source').textContent = analysis.analysisSource === 'RULE_BASED'
    ? 'Rule-based safeguard · no GroqCloud request was made for this empty requirement.'
    : 'GroqCloud analysis · generated recommendations require human review.';
  document.querySelector('#detail-title').textContent = `${requirement.id} · ${displayValue(requirement.title)}`;
  document.querySelector('#detail-original-title').textContent = displayValue(requirement.title);
  document.querySelector('#detail-original-description').textContent = requirement.description === null
    ? 'Description is unavailable.'
    : requirement.description === ''
      ? 'Description is empty.'
      : requirement.description;
  const criteria = requirement.acceptanceCriteria || {};
  const sourceDetails = [];
  sourceDetails.push(criteria.fieldRetrieved
    ? `Jira acceptance criteria (${criteria.fieldName || 'custom field'}): ${criteria.value && criteria.value.trim() ? criteria.value : 'Field was retrieved but is empty.'}`
    : 'Jira acceptance-criteria field was not retrieved.');
  sourceDetails.push(criteria.descriptionCriteria
    ? `Acceptance criteria identified in description:\n${criteria.descriptionCriteria}`
    : 'No labeled acceptance-criteria section was identified in the description.');
  document.querySelector('#detail-original-criteria').textContent = sourceDetails.join('\n\n');

  document.querySelector('#detail-clarity').textContent = label(analysis.clarityClassification);
  document.querySelector('#detail-clarity-reasoning').textContent = analysis.clarityReasoning;
  const dimensions = document.querySelector('#detail-dimensions');
  dimensions.replaceChildren();
  appendText(dimensions, 'h4', 'Requirement dimensions');
  const dimensionList = document.createElement('ul');
  Object.entries(analysis.clarityDimensionFindings).forEach(([name, finding]) => {
    appendText(dimensionList, 'li', `${dimensionLabel(name)}: ${finding}`);
  });
  dimensions.append(dimensionList);
  document.querySelector('#detail-readiness').textContent = label(analysis.testDesignReadiness);
  document.querySelector('#detail-readiness-reasoning').textContent = analysis.testReadinessReasoning;
  document.querySelector('#detail-execution-readiness').textContent = analysis.testExecutionReadiness === 'NOT_ASSESSED'
    ? 'Not assessed. Test execution readiness requires separate environment and test-data confirmation.'
    : label(analysis.testExecutionReadiness);
  document.querySelector('#detail-next-action').textContent = `Recommended next action: ${analysis.recommendedNextAction}`;
  document.querySelector('#detail-ac-status').textContent = `Status: ${label(analysis.acceptanceCriteriaStatus)}`;
  document.querySelector('#detail-ac-consistency').textContent = analysis.acceptanceCriteriaFindings.consistency;
  const acFindings = document.querySelector('#detail-ac-findings');
  acFindings.replaceChildren();
  appendText(acFindings, 'p', `Clarity: ${analysis.acceptanceCriteriaFindings.clarity}`);
  appendText(acFindings, 'p', `Completeness: ${analysis.acceptanceCriteriaFindings.completeness}`);
  appendText(acFindings, 'p', `Measurability: ${analysis.acceptanceCriteriaFindings.measurability}`);
  appendText(acFindings, 'p', `Testability: ${analysis.acceptanceCriteriaFindings.testability}`);
  addLabeledList(acFindings, 'Findings', analysis.acceptanceCriteriaFindings.findings);
  addLabeledList(acFindings, 'Positive scenarios in criteria', analysis.acceptanceCriteriaFindings.positiveScenarios);
  addLabeledList(acFindings, 'Negative scenarios in criteria', analysis.acceptanceCriteriaFindings.negativeScenarios);
  addLabeledList(acFindings, 'Boundary conditions in criteria', analysis.acceptanceCriteriaFindings.boundaryConditions);
  const gaps = document.querySelector('#detail-gaps');
  gaps.replaceChildren();
  analysis.identifiedGaps.forEach((gap) => {
    const article = document.createElement('article');
    article.className = 'detail-item';
    appendText(article, 'strong', `${gap.category} · ${gap.severity}`);
    appendText(article, 'p', gap.description);
    appendText(article, 'p', `Evidence: ${humanReadableEvidence(gap.evidence)}`);
    appendText(article, 'p', `Testing impact: ${gap.testingImpact}`);
    appendText(article, 'p', `Clarification required: ${gap.clarificationRequired ? 'Yes' : 'No'}`);
    gaps.append(article);
  });
  if (!analysis.identifiedGaps.length) gaps.textContent = 'No specific requirement gaps identified.';
  const questions = document.querySelector('#detail-questions');
  questions.replaceChildren();
  analysis.clarificationQuestions.forEach((question) => {
    const article = document.createElement('article');
    article.className = 'detail-item';
    appendText(article, 'strong', `${question.requirementId} · ${question.priority} priority`);
    appendText(article, 'p', question.question);
    appendText(article, 'p', `Associated gap: ${question.associatedGap}`);
    appendText(article, 'p', `Reason: ${question.reason}`);
    appendText(article, 'p', `Impact if unanswered: ${question.potentialImpact}`);
    appendText(article, 'p', `Blocks test design: ${question.blocksTestDesign ? 'Yes' : 'No'}`);
    questions.append(article);
  });
  if (!analysis.clarificationQuestions.length) questions.textContent = 'No clarification questions identified.';
  analysisDetail.hidden = false;
  analysisDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showRequirementSource(requirement) {
  analysisDetail.hidden = true;
  document.querySelector('#story-source-title').textContent =
    `${requirement.id} · ${displayValue(requirement.title)}`;
  document.querySelector('#story-source-description').textContent =
    requirement.description === null ? 'Description is unavailable.' :
      requirement.description === '' ? 'Description is empty.' : requirement.description;
  const criteria = requirement.acceptanceCriteria || {};
  const summary = criteria.fieldRetrieved
    ? `Jira acceptance criteria (${criteria.fieldName || 'custom field'}): ${criteria.value?.trim() || 'The retrieved field is empty.'}`
    : 'Jira acceptance-criteria field was not retrieved.';
  document.querySelector('#story-source-criteria').textContent =
    `${summary}\n\n${criteria.descriptionCriteria || 'No labeled acceptance-criteria section was identified in the description.'}`;
  const panel = document.querySelector('#story-source-detail');
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addLabeledList(parent, title, values) {
  const section = document.createElement('div');
  appendText(section, 'h4', title);
  if (!values.length) {
    appendText(section, 'p', 'None identified from the available requirement data.');
  } else {
    const list = document.createElement('ul');
    values.forEach((value) => appendText(list, 'li', value));
    section.append(list);
  }
  parent.append(section);
}

function appendText(parent, tag, value) {
  const element = document.createElement(tag);
  element.textContent = value;
  parent.append(element);
  return element;
}

function dimensionLabel(value) {
  const names = {
    businessCriticality: 'Business criticality',
    dependencyImpact: 'Dependency impact',
    jiraPriority: 'Jira priority',
    testDesignReadiness: 'Test design readiness',
    risk: 'Risk',
    businessObjective: 'Business objective',
    userRole: 'User role',
    functionalCompleteness: 'Functional completeness',
    businessRules: 'Business rules',
    preconditions: 'Preconditions',
    expectedOutcomes: 'Expected outcomes',
    validationRules: 'Validation rules',
    exceptionHandling: 'Exception and error handling',
    scopeBoundaries: 'Scope and boundaries',
    consistency: 'Consistency',
    testability: 'Testability',
    nonFunctionalRequirements: 'Non-functional requirements'
  };
  return names[value] || value;
}

async function copyAllQuestions() {
  await copyQuestionText(state.questionEntries.map(formatQuestion).join('\n\n'));
}

async function copyQuestions(analyses) {
  const text = analyses.flatMap((analysis) =>
    analysis.clarificationQuestions.map((question) =>
      `${question.requirementId}: ${question.question}\nAssociated gap: ${question.associatedGap}\nReason: ${question.reason}\nImpact if unanswered: ${question.potentialImpact}\nPriority: ${question.priority}\nBlocks test design: ${question.blocksTestDesign ? 'Yes' : 'No'}`
    )
  ).join('\n\n');
  if (!text) {
    showError(analysisError, 'There are no clarification questions to copy.');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    clearError(analysisError);
    progressMessage.textContent = 'Clarification questions copied to the clipboard.';
  } catch {
    showError(analysisError, 'Could not copy questions. Check clipboard permissions and try again.');
  }
}

function label(value) {
  const labels = {
    CLEAR: 'Clear',
    PARTIALLY_CLEAR: 'Partially clear',
    AMBIGUOUS: 'Ambiguous',
    NOT_ASSESSED: 'Not assessed',
    AVAILABLE_AND_VALID: 'Available and valid',
    AVAILABLE_BUT_INCOMPLETE: 'Available but incomplete',
    AVAILABLE_BUT_AMBIGUOUS: 'Available but ambiguous',
    AVAILABLE_BUT_NOT_TESTABLE: 'Available but not testable',
    MISSING: 'Missing',
    UNAVAILABLE: 'Unavailable',
    READY_FOR_TEST_DESIGN: 'Ready for test design',
    PARTIALLY_READY: 'Partially ready',
    NOT_READY: 'Not ready',
    BLOCKS: 'Blocks',
    REQUIRES: 'Requires',
    ENABLES: 'Enables',
    BOTH: 'Test design and execution',
    TEST_DESIGN: 'Test design',
    TEST_EXECUTION: 'Test execution',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
    UNKNOWN: 'Unknown',
    RANKED: 'Ranked',
    UNRANKED: 'Needs more evidence',
    NOT_ANALYSED: 'Not analysed',
    FAILED: 'Failed'
  };
  return labels[value] || String(value || '—').replaceAll('_', ' ');
}

function priorityClass(value) {
  const normalized = String(value || '').toLocaleLowerCase();
  if (normalized.includes('highest') || normalized.includes('high') || normalized.includes('critical')) return 'high';
  if (normalized.includes('medium') || normalized.includes('normal')) return 'medium';
  if (normalized.includes('low')) return 'low';
  return '';
}

async function api(path, body, signal) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Analysis was cancelled.');
    throw new Error('Could not connect to the local backend. Start it and check that it is listening on 127.0.0.1:3000.');
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The local backend returned an invalid response.');
  }
  if (!response.ok) {
    const error = new Error(result.error || 'The request could not be completed.');
    error.code = result.code;
    error.scope = result.scope;
    throw error;
  }
  return result;
}

async function disconnect() {
  state.runId += 1;
  if (state.abortController) state.abortController.abort();
  state.abortController = null;
  state.credentials = null;
  state.projects = [];
  state.requirements = [];
  state.selected.clear();
  state.results.clear();
  state.failures.clear();
  state.questionEntries = [];
  clearReportPreview();
  resetPlanning();
  state.analyzing = false;
  state.analysisJobId = null;
  state.progressSnapshot = null;
  state.progressRequirementIds = [];
  form.reset();
  projectSelect.replaceChildren(new Option('Select a Jira project', ''));
  storyList.replaceChildren();
  dashboard.hidden = true;
  analysisProgress.hidden = true;
  analysisResults.hidden = true;
  workspacePanel.hidden = true;
  connectionPanel.hidden = false;
  disconnectButton.hidden = true;
  setConnectionStatus('Not connected');
  updateProjectDisplay();
  clearError(connectionError);
  clearError(workspaceError);
  clearError(analysisError);
  try {
    await chrome.storage.session.remove('jiraSession');
  } catch {
    showError(connectionError, 'Could not clear the stored Jira session. Close the browser session to ensure its credentials are removed.');
  }
}

function showWorkspace() {
  connectionPanel.hidden = true;
  workspacePanel.hidden = false;
  updateProjectDisplay();
  navigateTo(state.activeView || 'overview');
}

function setConnectionStatus(text) {
  document.querySelector('#connection-status-label').textContent = text;
  connectionStatus.classList.toggle('connected', text !== 'Not connected');
  renderSettings();
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function clearError(element) {
  element.textContent = '';
  element.hidden = true;
}

function setBusy(button, busy, labelText) {
  button.disabled = busy;
  button.textContent = labelText;
}
