# RAA — Requirement Analysis Assistant

**From requirements to test readiness.**

**Version 1.0.0**

RAA provides read-only Jira Cloud project and story browsing, GroqCloud-backed requirement analysis, acceptance-criteria assessment, test-design readiness, and Product Owner questions. Its planning workspaces add deterministic Jira-link dependency mapping, optional consent-gated AI relationship suggestions, evidence-weighted prioritisation, and dependency-aware sequencing. The responsive dashboard brings these capabilities together with project metrics, safe reports, and session-only usage summaries. All recommendations require human review; Jira remains read-only.

RAA is an assignment-stage assistive workspace, not a production-readiness claim or an autonomous multi-agent system. People review all analysis and planning findings.

## Problem and objectives

Test teams often need to review Jira stories across several separate tasks: understanding requirement clarity, checking acceptance criteria, identifying questions, and organizing test-design work. RAA brings these activities into one read-only workspace so analysts can see the available evidence and its gaps before planning testing.

The objectives are to:

- Retrieve Jira stories without modifying Jira.
- Assess requirement clarity, acceptance-criteria quality, and test-design readiness while preserving missing and unavailable information.
- Surface traceable Product Owner questions and explicit Jira relationships, with optional AI suggestions requiring human review.
- Support evidence-aware prioritisation, work sequencing, and local reports without presenting unsupported scores or recommendations.

## Target users

RAA is intended for Test Analysts, Senior Test Analysts, and Test Leads who review requirements and plan testing.

## Technology stack

- Chrome Extension Manifest V3 with HTML, CSS, vanilla JavaScript, and locally bundled SVG/PNG assets.
- Node.js 18+ and Express for the loopback backend.
- Jira Cloud REST API v3 for read-only project and story retrieval.
- GroqCloud's OpenAI-compatible chat API for consent-gated requirement analysis and optional AI-assisted planning.
- Node.js built-in test runner (`node:test`) with mocked Jira and GroqCloud responses.

The application does not create RAID logs, generate test cases, write to Jira, or integrate Azure DevOps.

## Architecture

- `extension/` contains the Manifest V3 dashboard and vanilla JavaScript UI.
- `extension/app-config.js` centralizes RAA's product name, full name, tagline, and UI version. `extension/assets/raa-logo.svg` is the dashboard brand mark; `extension/assets/module-icons.svg` is the local SVG icon set. PNG toolbar and extension icons are bundled at 16, 32, 48, and 128 pixels.
- `extension/popup.html` is the branded toolbar launcher; its button opens the full dashboard. `extension/workspace-utils.js` contains pure navigation, reporting, export-safety, question-consolidation, and usage-summary helpers.
- `backend/` contains Express routes, Jira integration, requirement normalisation, analysis orchestration, response validation, and GroqCloud integration.
- Jira credentials use `chrome.storage.session`, are sent only to the loopback backend, and are not sent to GroqCloud. Analysis results stay in dashboard memory and are cleared on project change or disconnect (and when the dashboard page is closed/reloaded).
- Before analysis, the user must confirm that selected story content will be sent to GroqCloud. Only the requirement ID, title, description, and explicit acceptance-criteria field retrieval state/value are sent. The backend separately extracts labeled acceptance-criteria sections from the description and computes content availability. Jira credentials, priority, status, issue links, and other metadata are excluded.
- The backend binds to `127.0.0.1`, requires the configured extension origin, restricts Jira requests to fixed HTTPS Jira Cloud API paths, refuses redirects, and does not log credentials or requirement content.
- Jira acceptance-criteria fields are discovered at runtime using Jira field metadata; custom field IDs are not hardcoded. Matching field values are requested with the story search and kept separate from AI findings.
- Groq model selection is checked against the account's models endpoint. The documented strict JSON Schema registry includes `openai/gpt-oss-20b` and `openai/gpt-oss-120b`; missing `supported_parameters` metadata does not override this registry. Other explicitly configured models with unknown capabilities receive a cached synthetic-data probe for strict JSON Schema Mode and then JSON Object Mode. Automatic selection uses available registered models or models that positively advertise `response_format`.
- Phase 3 planning state, relationship reviews, and successful semantic group results exist only in dashboard memory. They are cleared when the project changes, the user disconnects, or the dashboard session ends. No planning content is persisted to disk or browser storage.
- Phase 4 navigation and reports use only data already in the current dashboard session. Switching views does not issue requests. Project changes and disconnect clear project-scoped analysis and planning state. The dashboard does not store requirement text, analysis results, or usage summaries in browser storage.
- Rule-based planning uses Jira issue links only and makes no Groq requests. AI-enhanced planning is a separate, explicit opt-in; it sends scoped requirement descriptions, Jira link labels, and available Phase 2 findings to GroqCloud. Jira credentials are never included. AI-suggested relationships remain provisional until confirmed or edited by a human.
- The RAA shell uses a collapsible dark sidebar, responsive navigation, consistent locally bundled SVG module icons, and the tagline “From requirements to test readiness.” The SVG logo master is `extension/assets/raa-logo.svg`; generated Chrome icon files are 16, 32, 48, and 128 pixels.

## Project structure

```text
.
├── README.md
├── .gitignore
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   ├── src/
│   │   ├── analysis/
│   │   ├── jira/
│   │   ├── planning/
│   │   ├── config.js
│   │   ├── normaliseRequirement.js
│   │   ├── routes.js
│   │   └── server.js
│   └── test/
└── extension/
    ├── assets/
    ├── manifest.json
    ├── app-config.js
    ├── analysis-summary.js
    ├── dashboard.html
    ├── dashboard.js
    ├── popup.html
    ├── popup.js
    ├── styles.css
    └── workspace-utils.js
```

## Requirements

- Node.js 18 or newer
- Google Chrome
- Jira Cloud access and an API token
- A GroqCloud API key with access to at least one supported chat model

## Install and configure

From the project directory:

1. Install backend dependencies:

   ```sh
   cd backend
   npm ci
   ```

2. In Chrome, open `chrome://extensions`, enable **Developer mode**, and click **Load unpacked**. Select the project's `extension/` folder and copy the extension ID shown by Chrome (32 lowercase letters from `a` to `p`).
3. Configure `backend/.env` (create it from `.env.example` if it does not exist). Do not replace an existing `.env` containing local settings. Set:

   ```dotenv
   PORT=3000
   EXTENSION_ID=your_actual_32_character_extension_id
   GROQ_API_KEY=your_groq_api_key
   GROQ_MODEL=
   GROQ_TIMEOUT_MS=30000
   GROQ_MAX_RETRIES=3
   GROQ_CORRECTIVE_RETRIES=2
   GROQ_MAX_OUTPUT_TOKENS=4096
   GROQ_CONCURRENCY=1
   GROQ_MAX_BACKOFF_MS=10000
   GROQ_MAX_RATE_LIMIT_WAIT_MS=60000
   PLANNING_PRIORITY_WEIGHTS='{"businessCriticality":30,"dependencyImpact":25,"jiraPriority":20,"testDesignReadiness":15,"risk":10}'
   JIRA_DEPENDENCY_LINK_TYPES=
   ```

   `GROQ_MODEL` is optional. When blank, the backend queries `https://api.groq.com/openai/v1/models` and selects an available compatible model. The built-in strict JSON Schema registry includes [`openai/gpt-oss-20b`](https://console.groq.com/docs/model/openai/gpt-oss-20b) and `openai/gpt-oss-120b`, as listed in Groq's [Structured Outputs documentation](https://console.groq.com/docs/structured-outputs). For an explicitly configured model, a positive `supported_parameters` entry is honored; if capability metadata is absent, a small synthetic probe verifies strict JSON Schema Mode and then JSON Object Mode. Unavailable models are rejected, but missing metadata alone is not treated as unsupported. Successful probes are cached for one hour.

   `GROQ_MAX_OUTPUT_TOKENS` caps the response budget (default `4096`; the effective limit is also bounded by the model's advertised limits and remaining context). `GROQ_CONCURRENCY` sets concurrent requirements from `1` to `4`, defaulting to sequential processing (`1`). `GROQ_MAX_RETRIES` bounds network, server, and rate-limit retries (`0`–`5`); `GROQ_CORRECTIVE_RETRIES` bounds JSON/schema correction attempts (`0`–`3`). Rate limits honor `Retry-After` or Groq reset headers up to `GROQ_MAX_RATE_LIMIT_WAIT_MS`; absent usable headers, bounded exponential backoff with jitter uses `GROQ_MAX_BACKOFF_MS`. Authentication, unavailable-model, unsupported-format, and invalid-schema errors remain distinct and are not retried as transient failures.

   Model availability and structured-output capability are validated before a batch starts. A failure at this stage is shown once as a configuration error rather than repeated for each selected requirement.

   `PLANNING_PRIORITY_WEIGHTS` is optional JSON with exactly these five non-negative numeric weights, totaling `100`: `businessCriticality`, `dependencyImpact`, `jiraPriority`, `testDesignReadiness`, and `risk`. The defaults shown above weight business criticality and dependency impact most heavily. Unknown values are excluded from a requirement's weighted score; weights are normalized over known factors, and requirements with less than 60% evidence coverage are shown as unranked. Invalid weights stop backend startup with a clear configuration error.

   `JIRA_DEPENDENCY_LINK_TYPES` is an optional comma-separated allowlist of organization-specific Jira issue-link type names. Standard directional phrases such as `blocks`, `is blocked by`, `depends on`, and `requires` are recognized. Non-blocking `relates to`, duplicate, parent, and epic relationships are not treated as prerequisites unless an administrator deliberately configures that link type.

   Jira credentials are entered in the extension's connection form, not in `.env` or source files. For manual setup, use your own Jira Cloud site URL (for example `https://your-site.atlassian.net`), account email (for example `analyst@example.com`), and Jira API token. The token is held in Chrome session storage and is cleared on disconnect or session termination.

4. Start the backend from the `backend/` directory:

   ```sh
   npm start
   ```

5. Click the RAA extension icon, choose **Open workspace**, enter your Jira Cloud base URL, email, and API token, connect, select a project, and retrieve stories.
6. Select one or more stories, confirm the GroqCloud content disclosure, and click **Analyse requirements**. Successful analyses are retained if another item fails; select and retry failed items without resending successful ones.
7. In **Dependencies and work plan**, choose selected requirements or all retrieved project requirements. **Rule-based** mode reads Jira relationship links only and does not contact GroqCloud. **AI-enhanced** mode displays an approximate token/group estimate and requires a separate content-consent checkbox; then click **Build AI-enhanced plan**. Failed groups can be retried while successful groups are reused from the current browser session.
8. Review proposed links in the dependency graph/table. Confirm, edit, or reject each AI suggestion. Only explicit Jira links and human-confirmed suggestions affect the baseline sequence; dashed pending suggestions are shown separately. Review external links, cycles, evidence coverage, unranked items, and questions before using the exported backlog CSV or work sequence.
9. Use the sidebar to move between **Overview**, **Requirements**, **Dependencies**, **Prioritisation**, **Work Plan**, **PO Questions**, **Reports**, and **Settings**. Navigation preserves the current session state and does not fetch data.
10. In **Reports**, choose all retrieved requirements (default) or the currently selected requirements, preview a CSV report (the first ten rows), then download an HTML or CSV file. The HTML report preview shows its scoped summary. Exports are generated locally; HTML content is escaped and CSV cells are protected against spreadsheet formulas.
11. In **Settings**, inspect the active model and session usage. Optionally enter a token threshold for an in-memory warning; it is not saved and is not a provider quota or hard limit.

## Phase 5B interface

The interface groups retrieved, analysed, pending, and failed requirements separately; quality charts use analysed requirements only. Project KPIs use status-tinted cards, the coverage donut scales responsively, and clarity, acceptance-criteria, and readiness charts state their analysed/retrieved scope. Dependency and prioritisation summary cards appear only when a plan exists, and the graph distinguishes explicit Jira links, reviewed suggestions, provisional suggestions, and requirements with no documented Jira relationship. “No Jira links” is not treated as independence. The graph provides zoom, fit, and reset controls. Requirement analysis details use expandable evidence sections; the PO question register and report cards preserve traceability and local export actions. Settings display session usage only and do not imply remaining provider quota.

All interface icons and fonts are local/system-provided; the extension loads no remote scripts, fonts, or CDN assets. Navigation, charts, filtering, planning controls, and report exports consume only current session data, except for explicit user-triggered operations described above.

## Version 1.0.0 scope

The extension and project metadata are versioned `1.0.0`. Implemented functionality includes read-only Jira Cloud story retrieval, session-only credentials, consent-gated GroqCloud requirement analysis, deterministic acceptance-criteria presence checks, evidence-aware dependency planning and prioritisation, work sequencing, question tracking, local reports, and the responsive RAA workspace.

Not implemented in version 1.0.0: Jira writes, automated test-case generation, RAID logs, Azure DevOps integration, and future provider integrations beyond the current GroqCloud connector. These are potential future enhancements, not available capabilities. Known limitations and operational constraints are listed in [Limitations](#limitations).

If Chrome changes the unpacked extension ID, update `EXTENSION_ID` and restart the backend. Keep `.env` private; it is ignored by Git.

## Future enhancements — Agentic AI phase

The Agentic AI phase is future work and is not included in v1.0.0. Potential enhancements may explore coordinated, human-supervised analysis and test-planning assistance, additional work-management connectors such as Azure DevOps, and test-case generation. Any future capability requires separate design, consent, security review, and validation; RAA does not currently run autonomous agents or generate test cases.

## Analysis behavior

- Requirement clarity: `CLEAR`, `PARTIALLY_CLEAR`, or `AMBIGUOUS`, with evidence-based reasoning.
- Acceptance criteria are assessed separately for clarity, completeness, measurability, testability, consistency, and stated positive/negative/boundary coverage. Criteria in labeled description sections are extracted and considered alongside discovered custom fields. Empty retrieved fields with no description criteria are deterministically `MISSING`; unavailable fields with no identified description criteria are deterministically `UNAVAILABLE`. Meaningful criteria from either source are passed to the LLM for quality assessment.
- Gaps include evidence, testing impact, severity, and whether clarification is required. Clarification questions identify their Jira requirement, associated gap, reason, potential impact, priority, and whether they block test design.
- Test design readiness is distinct from execution readiness; execution readiness is explicitly not assessed.
- Batch calls are limited to four stories and UI job progress is tracked per requirement. The UI uses the configured concurrency (default one), displays the selected model, and retains successful results when retrying failed requirements. Repeated submissions for active requirements are rejected.
- Structured JSON responses are schema-validated. Truncated, malformed, and schema-invalid responses get a bounded corrective retry; required fields are not fabricated or relaxed. Safe diagnostics report model, requirement ID, HTTP status, duration, available token usage, finish reason, validation field paths, retry attempts, and rate-limit headers without logging keys, requirement content, or complete responses.
- Registered models use strict JSON Schema Mode (`strict: true`) with a schema that marks every property required and sets `additionalProperties: false` on each object. The backend still validates every response and verifies the returned requirement ID and title. Models verified only for JSON Object Mode use that mode plus the same local validation.
- JSON responses are schema-validated, must match the submitted requirement ID and title, and do not replace or mutate original Jira content.

## Phase 3 planning behavior

- Rule-based planning requires no Groq key or API call. It uses only directional Jira blocking/prerequisite links; `relates to`, duplicates, and parent/epic links are not blocking dependencies by default. Jira's outward and inward relationship labels are retained during normalization. External linked issues remain visible as outside-scope references.
- AI-enhanced planning requires the separate dashboard consent. Requirements are analyzed in groups of at most five to avoid pairwise calls. Groups run with the configured Groq concurrency (default one); approximate input-token and group counts are shown before sending. Relationships between different groups are not assessed, and the dashboard states the resulting coverage gap.
- Semantic dependency responses use strict JSON Schema when supported and are locally validated against the group IDs. Suggestions require cited evidence and are never accepted automatically. Human-confirmed or edited suggestions and explicit Jira links form the baseline graph; pending suggestions form a separate provisional graph. Rejected suggestions are removed from the active graph.
- The graph reports direct and transitive prerequisites/dependents, out-of-scope references, independent items, and dependency cycles. Cyclic requirements are not assigned a valid work sequence until the cycle is resolved. Test-design-only and test-execution-only impacts remain distinct.
- Prioritisation uses the configurable five factors. Known factors are normalized by their available weights; unknown factors are not treated as zero. A score is withheld when known evidence covers less than 60% of configured weight. The dashboard shows factor values, evidence, weights, score coverage, and the reason for ranked or unranked status.
- Work sequencing follows confirmed prerequisites and validated Phase 2 test-design readiness. It flags clarification blockers, external dependencies, cycles, partial-design work, parallel waves, and insufficient evidence. Phase 2 analyses are reused as supplied; planning does not silently reanalyse requirements.
- Open clarification questions combine existing Phase 2 questions, semantic planning questions, relationship-review prompts, and external dependency checks. Duplicate question wording is consolidated across requirements.
- Planning progress is tracked in memory per semantic group. Successful semantic groups are cached by content and analysis fingerprint only in the current dashboard session. Changing scope or requirement/Phase 2 content changes the key; project changes and disconnect clear the cache. Retrying failed groups does not resend valid cached groups.
- The backlog CSV is generated locally in the browser. No Jira write endpoints or Phase 3 external services are used.

## Phase 4 workspace behavior

- The Overview summarizes the current project using retrieved stories, clarity distribution, acceptance-criteria status, open questions, dependencies, prioritisation readiness, and work-plan readiness. Metrics are derived from current session results; absent analysis is not presented as completed analysis.
- Requirements has searchable/filterable stories, analysis summaries, priority/status context, and detailed findings. Dependency and planning views show evidence and human-review state instead of hiding provisional, unavailable, or incomplete information.
- PO Questions consolidates repeated wording while retaining all source categories, requirement IDs, reasons, impacts, and priorities. Distinct question wording remains distinct even when it concerns the same requirement.
- Reports can be previewed, scoped to selected or all retrieved requirements, and exported as HTML or formula-safe CSV. CSV previews show up to ten rows using safe text rendering; the HTML preview shows scoped summary metrics. Export content is escaped and no credentials are included.
- Settings show the configured/active GroqCloud model, concurrency and token-limit information when available, and provider token usage observed during this dashboard session. Counts distinguish inference requests, successful/failed provider responses, retries, and token reports; a total is shown only when every successful provider response includes both input and output token counts.
- Usage accounting aggregates provider-reported input/output tokens for requirement analysis and AI planning, including retries, when returned. It excludes model availability/capability probes and does not imply billing accuracy or include provider-side cached-token price calculations. A user-entered warning threshold is memory-only and does not change request limits.
- All-empty requirements with no usable acceptance criteria are classified locally and deterministically without making Groq requests. This remains true in the workspace; a dashboard must still have a Jira session to retrieve project stories.

## Tests

Run all backend unit tests:

```sh
cd backend
npm test
```

Tests use mocked Jira and GroqCloud responses. Coverage includes Phase 1 Jira pagination and ADF normalization, dynamic acceptance-criteria fields, empty/null/whitespace/ADF values, embedded criteria, deterministic missing/unavailable classification, dashboard summary/filter consistency, all clarity classifications, malformed/truncated JSON, schema correction, documented and probed model capabilities, absent capability metadata, strict-schema compatibility, global configuration failures, rate limits and `Retry-After`, retry exhaustion, sequential/concurrent batch behavior, duplicate job protection, progress states, authentication and network failures, partial batches, and prompt-injection content handling. Phase 3 tests cover Jira link direction, non-blocking link types, custom type configuration, graph relationships and cycles, external dependencies, strict semantic schemas, session-cache invalidation/reuse, sequential groups, partial failures, evidence-aware weighted scoring, requirement sequencing, human review/edit/reject behavior, deduplicated questions, and rule-based operation without Groq calls. Phase 4 utility tests cover analysis-coverage count consistency, complete versus partial usage metadata, view switching, repeated-question provenance, formula-safe CSV and escaped HTML reports, JSON evidence suppression, cache-configuration invalidation, and dependency-panel states.

### Manual workspace checks

The automated suite uses mocked provider responses and does not establish live Jira, GroqCloud, or Chrome Web Store behavior. The following manual checks remain outstanding until performed and recorded against the intended submission environment:

After loading the extension and connecting a test Jira project:

1. Confirm the Overview shows a clear no-project/no-requirements state before retrieval and updates after retrieval. Navigate between views and confirm no duplicate Jira requests are made.
2. Retrieve stories, search and filter them, run analysis on a subset, and confirm counts, findings, and detailed views agree. Switch projects and confirm old project analysis and planning data are removed.
3. Build a rule-based plan and an AI-enhanced plan (only with approved test content and explicit consent); inspect graph, prioritisation, work-plan, and question states. Confirm provisional links do not alter the baseline sequence unless explicitly reviewed.
4. Preview selected-requirement and all-requirement reports. Download and open HTML; verify Jira text renders as text. Open CSV in a spreadsheet and verify cells beginning with formula characters are not executed.
5. In Settings, verify model attribution and session token counts appear only when supplied by the backend, unknown token metadata is identified, and threshold warnings do not prevent analysis.
6. Disconnect and reload the dashboard. Verify credentials are cleared according to session policy and no requirement, report, plan, or usage data returns from browser storage.

## Limitations

- A live GroqCloud key and current model access are required for live analysis. The model endpoint's available models can vary by account and over time.
- The strict-mode registry is intentionally small and follows Groq's published Structured Outputs model list. Probe results for other configured models are cached in memory for one hour; account-specific access and API behavior still require live verification.
- Custom acceptance-criteria fields are discovered by matching Jira field names containing “acceptance criteria”. Other organization-specific field names may not be discovered automatically.
- GroqCloud analysis is probabilistic. Review every finding and clarification question before using it.
- Analysis results are deliberately not persisted; closing or reloading the dashboard clears them.
- Session usage summaries are provider-response estimates and are not persisted. Capability/model probes are not included; token metadata may be omitted by GroqCloud, and no billing-cost estimate or provider quota enforcement is provided.
- Embedded acceptance criteria are extracted from labeled description sections for analysis only; they are never written back to Jira. Unlabeled criteria may not be recognized by the deterministic extractor.
- Semantic dependency analysis can miss relationships whose evidence is not present in the selected group's text, including links across separate groups. Rule-based plans omit unrecognized organization-specific link types unless configured. AI criticality, risk, and relationship suggestions can be incorrect; review evidence and confirm all planning decisions. Cycle paths are graph findings, not Jira changes.
