const ISSUE_FIELDS = [
  'summary',
  'description',
  'priority',
  'status',
  'issuelinks',
  'issuetype',
  'parent'
];

class JiraApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'JiraApiError';
    this.statusCode = statusCode;
  }
}

class JiraConnector {
  constructor(fetchImplementation = globalThis.fetch) {
    this.fetch = fetchImplementation;
  }

  async validateCredentials(credentials) {
    const response = await this.request(credentials, '/rest/api/3/myself');
    const user = await this.readJson(response);
    return {
      displayName: typeof user.displayName === 'string' ? user.displayName : null,
      accountId: typeof user.accountId === 'string' ? user.accountId : null
    };
  }

  async getProjects(credentials) {
    const projects = [];
    let startAt = 0;

    while (true) {
      const query = new URLSearchParams({ startAt: String(startAt), maxResults: '100' });
      const response = await this.request(credentials, `/rest/api/3/project/search?${query}`);
      const page = await this.readJson(response);
      const values = Array.isArray(page.values) ? page.values : [];
      projects.push(...values
        .filter((project) => typeof project.key === 'string' && typeof project.name === 'string')
        .map(({ key, name }) => ({ key, name })));

      if (page.isLast === true || values.length === 0) {
        return projects;
      }

      startAt += values.length;
    }
  }

  async getAcceptanceCriteriaFields(credentials) {
    const response = await this.request(credentials, '/rest/api/3/field');
    const fields = await this.readJson(response);
    if (!Array.isArray(fields)) return [];
    return fields
      .filter((field) => field && typeof field.id === 'string' && typeof field.name === 'string')
      .filter((field) => /acceptance\s*criteria/i.test(field.name))
      .map(({ id, name }) => ({ id, name }));
  }

  async getStories(credentials, projectKey) {
    if (typeof projectKey !== 'string' || !/^[A-Z][A-Z0-9_]{0,254}$/.test(projectKey)) {
      throw new JiraApiError('Select a valid Jira project key.', 400);
    }

    const acceptanceCriteriaFields = await this.getAcceptanceCriteriaFields(credentials);
    const requestedFields = [...ISSUE_FIELDS, ...acceptanceCriteriaFields.map((field) => field.id)];
    const issues = [];
    let nextPageToken;
    const seenTokens = new Set();

    while (true) {
      const query = new URLSearchParams({
        jql: `project = ${projectKey} AND issuetype = Story ORDER BY key ASC`,
        fields: requestedFields.join(','),
        maxResults: '100'
      });
      if (nextPageToken) query.set('nextPageToken', nextPageToken);

      const response = await this.request(credentials, `/rest/api/3/search/jql?${query}`);
      const page = await this.readJson(response);
      if (Array.isArray(page.issues)) {
        issues.push(...page.issues.map((issue) => ({
          ...issue,
          acceptanceCriteriaFields
        })));
      }

      if (page.isLast === true) return issues;

      const token = page.nextPageToken;
      if (typeof token !== 'string' || token.length === 0 || seenTokens.has(token)) {
        throw new JiraApiError('Jira returned an invalid pagination response.', 502);
      }
      seenTokens.add(token);
      nextPageToken = token;
    }
  }

  async request(credentials, path) {
    const baseUrl = validateJiraCloudUrl(credentials.instanceUrl);
    const authorization = Buffer.from(`${credentials.email}:${credentials.apiToken}`, 'utf8').toString('base64');
    let response;

    try {
      response = await this.fetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${authorization}`
        },
        redirect: 'manual'
      });
    } catch {
      throw new JiraApiError('Could not reach Jira. Check the network connection and Jira URL.', 503);
    }

    if (response.status >= 300 && response.status < 400) {
      throw new JiraApiError('Jira redirected the request. Verify the Jira Cloud instance URL.', 502);
    }
    if (!response.ok) {
      if (response.status === 401) {
        throw new JiraApiError('Jira rejected these credentials. Check the email and API token.', 401);
      }
      if (response.status === 403) {
        throw new JiraApiError('Jira denied access. Check your account permissions for this resource.', 403);
      }
      if (response.status === 404) {
        throw new JiraApiError('Jira could not find this resource. Check the instance URL and project access.', 404);
      }
      if (response.status === 429) {
        throw new JiraApiError('Jira is rate limiting requests. Please wait and try again.', 429);
      }
      throw new JiraApiError('Jira returned an unexpected API error. Please try again later.', 502);
    }

    return response;
  }

  async readJson(response) {
    try {
      return await response.json();
    } catch {
      throw new JiraApiError('Jira returned an invalid response.', 502);
    }
  }
}

function validateJiraCloudUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new JiraApiError('Enter a valid Jira Cloud instance URL, such as https://example.atlassian.net.', 400);
  }

  if (
    url.protocol !== 'https:' ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.atlassian\.net$/.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new JiraApiError('Use the HTTPS base URL of a Jira Cloud site ending in .atlassian.net.', 400);
  }
  return `https://${url.hostname}`;
}

module.exports = { JiraConnector, JiraApiError, validateJiraCloudUrl, ISSUE_FIELDS };
