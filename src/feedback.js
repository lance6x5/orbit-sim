/**
 * feedback.js - builds pre-filled GitHub "new issue" URLs.
 * The app is static: no tokens, no API calls. The user submits the issue
 * with their own GitHub account. No scenario/user data is ever included.
 */
export const REPO_URL = 'https://github.com/lance6x5/orbit-sim';

const TEMPLATES = {
  bug: { template: 'bug_report.yml', title: '[Bug]: ' },
  feature: { template: 'feature_request.yml', title: '[Feature]: ' },
};

/**
 * @param {'bug'|'feature'} kind
 * @param {{ version?: string, userAgent?: string }} info
 */
export function buildIssueUrl(kind, { version = '', userAgent = '' } = {}) {
  const t = TEMPLATES[kind];
  if (!t) throw new Error(`Unknown feedback kind: ${kind}`);
  const params = new URLSearchParams({ template: t.template, title: t.title });
  if (version) params.set('version', version);
  if (kind === 'bug' && userAgent) params.set('environment', userAgent.slice(0, 160));
  return `${REPO_URL}/issues/new?${params.toString()}`;
}
