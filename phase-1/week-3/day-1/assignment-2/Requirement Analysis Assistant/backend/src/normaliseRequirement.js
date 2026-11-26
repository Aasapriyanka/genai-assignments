const { extractAcceptanceCriteria } = require('./analysis/acceptanceCriteria');

function adfToPlainText(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value.type !== 'doc' || !Array.isArray(value.content)) return '';
  return renderNodes(value.content).trim();
}

function renderNodes(nodes) {
  return nodes.map((node) => {
    if (!node || typeof node !== 'object') return '';
    const content = Array.isArray(node.content) ? renderNodes(node.content) : '';

    switch (node.type) {
      case 'text':
        return typeof node.text === 'string' ? node.text : '';
      case 'hardBreak':
        return '\n';
      case 'paragraph':
      case 'heading':
      case 'blockquote':
      case 'codeBlock':
        return content ? `${content}\n` : '';
      case 'bulletList':
      case 'orderedList':
        return content;
      case 'listItem':
        return content ? `- ${content.trim()}\n` : '';
      default:
        return content;
    }
  }).join('');
}

function normaliseRequirement(issue) {
  const fields = issue && issue.fields && typeof issue.fields === 'object' ? issue.fields : {};
  const criteriaFields = Array.isArray(issue && issue.acceptanceCriteriaFields)
    ? issue.acceptanceCriteriaFields
    : [];
  const presentCriteriaFields = criteriaFields.filter((field) => hasOwn(fields, field.id));
  const acceptanceCriteriaText = presentCriteriaFields
    .map((field) => ({
      name: field.name,
      value: plainTextValue(fields[field.id])
    }))
    .filter((field) => field.value !== null && field.value.trim() !== '')
    .map((field) => `${criteriaFields.length > 1 ? `${field.name}: ` : ''}${field.value}`);
  const description = hasOwn(fields, 'description') ? adfToPlainText(fields.description) : null;
  const descriptionCriteria = extractAcceptanceCriteria(description);
  const fieldValue = acceptanceCriteriaText.join('\n') || (presentCriteriaFields.length > 0 ? '' : null);
  const links = Array.isArray(fields.issuelinks)
    ? fields.issuelinks.map(normaliseLink).filter(Boolean)
    : null;

  return {
    id: hasOwn(issue, 'key') ? issue.key : null,
    title: hasOwn(fields, 'summary') ? fields.summary : null,
    description,
    priority: hasOwn(fields, 'priority')
      ? (fields.priority && hasOwn(fields.priority, 'name') ? fields.priority.name : null)
      : null,
    status: hasOwn(fields, 'status')
      ? (fields.status && hasOwn(fields.status, 'name') ? fields.status.name : null)
      : null,
    acceptanceCriteria: {
      fieldRetrieved: presentCriteriaFields.length > 0,
      fieldName: presentCriteriaFields.map((field) => field.name).join(', ') || null,
      value: fieldValue,
      descriptionCriteria,
      contentAvailable: Boolean((fieldValue || '').trim() || descriptionCriteria)
    },
    dependencies: links,
    parent: hasOwn(fields, 'parent')
      ? (fields.parent && hasOwn(fields.parent, 'key') ? fields.parent.key : null)
      : null,
    availability: {
      id: hasOwn(issue, 'key'),
      title: hasOwn(fields, 'summary'),
      description: hasOwn(fields, 'description'),
      priority: hasOwn(fields, 'priority'),
      status: hasOwn(fields, 'status'),
      acceptanceCriteria: presentCriteriaFields.length > 0,
      dependencies: hasOwn(fields, 'issuelinks'),
      parent: hasOwn(fields, 'parent')
    }
  };
}

function plainTextValue(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && value.type === 'doc') return adfToPlainText(value);
  if (value && typeof value === 'object' && typeof value.value === 'string') return value.value;
  if (Array.isArray(value)) {
    return value.map((item) => plainTextValue(item)).filter((item) => item !== null).join('\n');
  }
  return value === null || value === undefined ? null : '';
}

function normaliseLink(link) {
  if (!link || typeof link !== 'object') return null;
  const type = link.type && typeof link.type === 'object' ? link.type : {};
  const typeName = typeof type.name === 'string' ? type.name : null;
  const relatedIssue = link.outwardIssue || link.inwardIssue;
  const key = relatedIssue && typeof relatedIssue.key === 'string' ? relatedIssue.key : null;
  if (!key) return null;

  return {
    key,
    type: typeName,
    direction: link.outwardIssue ? 'outward' : 'inward',
    outward: typeof type.outward === 'string' ? type.outward : null,
    inward: typeof type.inward === 'string' ? type.inward : null
  };
}

function hasOwn(value, key) {
  return value !== null && typeof value === 'object' && Object.hasOwn(value, key);
}

module.exports = { normaliseRequirement, adfToPlainText };

