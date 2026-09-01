export const DEFAULT_PUBLICATION_POLICY = Object.freeze({
  change_description: "link",
  change_comment: "link",
  committed_file: null,
});

const SUPPORTED_PRESENTATIONS = new Set(["link", "none"]);

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
  if (value.committed_file != null) throw new Error("committed-file publication is not supported by the current browser adapter");

  return Object.freeze({
    change_description: value.change_description,
    change_comment: value.change_comment,
    committed_file: null,
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

  return {
    taskState: { ...taskState, publication: normalizeBrowserPublicationPolicy(taskState.publication) },
    changed: false,
  };
}
