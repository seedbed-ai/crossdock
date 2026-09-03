export function canonicalGitHubPrUrl(value) {
  if (typeof value !== "string") throw new Error("PR URL must be a string");
  const parsed = new URL(value);
  if (parsed.origin !== "https://github.com") throw new Error("PR URL must use github.com");
  const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
  if (!match) throw new Error("PR URL must identify a GitHub pull request");
  return `https://github.com/${match[1]}/${match[2]}/pull/${match[3]}`;
}

export function repositoryFromGitHubPrUrl(value) {
  const canonical = canonicalGitHubPrUrl(value);
  const parsed = new URL(canonical);
  const [, owner, repo] = parsed.pathname.split("/");
  return `${owner}/${repo}`;
}

export function classifyNewPrUrls({ before = [], current = [], targetRepository }) {
  if (typeof targetRepository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(targetRepository)) {
    throw new Error("target repository must be owner/repo");
  }

  const baseline = new Set(before.map(canonicalGitHubPrUrl));
  const fresh = [...new Set(current.map(canonicalGitHubPrUrl))].filter((url) => !baseline.has(url));
  const target = [];
  const wrongRepository = [];

  for (const url of fresh) {
    if (repositoryFromGitHubPrUrl(url) === targetRepository) target.push(url);
    else wrongRepository.push(url);
  }

  return Object.freeze({ target: Object.freeze(target), wrongRepository: Object.freeze(wrongRepository) });
}
