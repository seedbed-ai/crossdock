export class GitHubClient {
  constructor({ token, fetchImpl = globalThis.fetch, apiBase = "https://api.github.com" } = {}) {
    if (!token) throw new Error("GitHub token is required");
    if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.apiBase = apiBase.replace(/\/$/, "");
  }

  async request(method, path, body) {
    const response = await this.fetchImpl(`${this.apiBase}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(`GitHub ${method} ${path} failed: ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  createFile(repository, path, content, message, branch) {
    const [owner, repo] = repository.split("/");
    return this.request("PUT", `/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      ...(branch ? { branch } : {}),
    });
  }

  getFile(repository, path, ref) {
    const [owner, repo] = repository.split("/");
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return this.request("GET", `/repos/${owner}/${repo}/contents/${encodePath(path)}${query}`);
  }

  async getLatestCommitForPath(repository, path, ref) {
    const [owner, repo] = repository.split("/");
    const params = new URLSearchParams({ path, per_page: "1" });
    if (ref) params.set("sha", ref);
    const commits = await this.request("GET", `/repos/${owner}/${repo}/commits?${params}`);
    if (!Array.isArray(commits) || !commits[0]?.sha) throw new Error("GitHub did not return a commit for the task-record path");
    return commits[0];
  }

  createPullRequest(repository, { title, body, head, base, draft = false }) {
    const [owner, repo] = repository.split("/");
    return this.request("POST", `/repos/${owner}/${repo}/pulls`, { title, body, head, base, draft });
  }

  updatePullRequest(repository, number, { title, body, state, base }) {
    const [owner, repo] = repository.split("/");
    return this.request("PATCH", `/repos/${owner}/${repo}/pulls/${number}`, compact({ title, body, state, base }));
  }

  getPullRequest(repository, number) {
    const [owner, repo] = repository.split("/");
    return this.request("GET", `/repos/${owner}/${repo}/pulls/${number}`);
  }

  addIssueComment(repository, number, body) {
    const [owner, repo] = repository.split("/");
    return this.request("POST", `/repos/${owner}/${repo}/issues/${number}/comments`, { body });
  }

  getIssueComments(repository, number) {
    const [owner, repo] = repository.split("/");
    return this.request("GET", `/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`);
  }
}

export function decodeGitHubFileContent(file, context = "GitHub file read") {
  if (!file || typeof file.content !== "string" || (file.encoding != null && file.encoding !== "base64")) throw new Error(`${context} failed: remote file missing base64 content`);
  const encoded = file.content.replace(/\s/g, "");
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new Error(`${context} failed: remote file contains malformed base64 content`);
  return Buffer.from(encoded, "base64");
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
