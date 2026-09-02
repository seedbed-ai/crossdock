export const DEFAULT_PUBLICATION_POLICY = Object.freeze({
  change_description: "link",
  change_comment: "link",
  committed_file: null,
});

const SUPPORTED_PRESENTATIONS = new Set(["link", "none"]);
const COMMITTED_FILE_PRESENTATIONS = new Set(["link", "reference"]);

/**
 * Normalize only publication modes the current browser/service path can honor.
 * The shared config model also knows about future modes such as `summary`, but
 * the dashboard must not offer or silently coerce a mode the live handoff path
 * cannot execute yet.
 */
export function normalizeBrowserPublicationPolicy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("publication policy must be an object");
  const allowed = new Set(["change_description", "change_comment", "committed_file"]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`publication policy contains unknown field: ${key}`);

  for (const field of ["change_description", "change_comment"]) {
    if (!SUPPORTED_PRESENTATIONS.has(value[field])) throw new Error(`${field} publication must be link or none in the current browser adapter`);
  }
  const committedFile = normalizeCommittedFile(value.committed_file);

  return Object.freeze({
    change_description: value.change_description,
    change_comment: value.change_comment,
    committed_file: committedFile,
  });
}

function normalizeCommittedFile(value) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("committed_file must be an object or null");
  const allowed = new Set(["presentation", "adapter", "repository", "branch", "path_template"]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`committed_file contains unknown field: ${key}`);
  if (!COMMITTED_FILE_PRESENTATIONS.has(value.presentation)) throw new Error("committed_file.presentation must be link or reference");
  if (value.adapter !== "github") throw new Error(`committed_file.adapter is unsupported: ${value.adapter}`);
  if (typeof value.repository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(value.repository)) throw new Error("committed_file.repository must be owner/repo");
  if (typeof value.branch !== "string" || !value.branch.trim()) throw new Error("committed_file.branch is required");
  if (typeof value.path_template !== "string" || !value.path_template.trim()) throw new Error("committed_file.path_template is required");

  const pathTemplate = value.path_template.trim();
  const segments = pathTemplate.split("/");
  if (pathTemplate.startsWith("/") || pathTemplate.endsWith("/") || pathTemplate.includes("\\") || pathTemplate.includes("\0") || pathTemplate.replaceAll("{task_id}", "").includes("{") || pathTemplate.replaceAll("{task_id}", "").includes("}") || segments.some((part) => !part || part === "." || part === "..")) {
    throw new Error("committed_file.path_template must be a safe repository-relative path without unresolved placeholders");
  }
  if (!pathTemplate.includes("{task_id}")) throw new Error("committed_file.path_template must include {task_id}");
  return Object.freeze({
    presentation: value.presentation,
    adapter: "github",
    repository: value.repository,
    branch: value.branch.trim(),
    path_template: pathTemplate,
  });
}

export function migrateActiveTaskPublication(taskState) {
  if (taskState == null) return { taskState: null, changed: false };
  if (typeof taskState !== "object" || Array.isArray(taskState)) throw new TypeError("active task state must be an object");

  if (!Object.hasOwn(taskState, "publication")) {
    return {
      taskState: { ...taskState, publication: { ...DEFAULT_PUBLICATION_POLICY } },
      changed: true,
    };
  }

  const legacyPublication = !Object.hasOwn(taskState.publication ?? {}, "committed_file")
    ? { ...taskState.publication, committed_file: null }
    : taskState.publication;
  return {
    taskState: { ...taskState, publication: normalizeBrowserPublicationPolicy(legacyPublication) },
    changed: legacyPublication !== taskState.publication,
  };
}
