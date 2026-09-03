export function resolveProviderEnvironment({ targetRepository, environments, preferredEnvironmentId = null }) {
  const target = normalizeRepository(targetRepository);
  if (!Array.isArray(environments)) throw new TypeError("provider environments must be an array");

  const normalized = environments.map((environment, index) => normalizeEnvironment(environment, index));
  const matches = normalized.filter((environment) => environment.repository === target);

  if (matches.length === 0) {
    throw providerContextError("unresolved", `no provider environment maps to target repository ${target}`);
  }

  if (preferredEnvironmentId != null) {
    const preferred = requireNonEmptyString(preferredEnvironmentId, "preferred environment id");
    const preferredMatches = matches.filter((environment) => environment.id === preferred);
    if (preferredMatches.length === 1) return preferredMatches[0];
    if (preferredMatches.length > 1) {
      throw providerContextError("ambiguous", `provider environment id ${preferred} is duplicated for target repository ${target}`);
    }
  }

  if (matches.length !== 1) {
    throw providerContextError("ambiguous", `target repository ${target} maps to ${matches.length} provider environments`);
  }
  return matches[0];
}

export function resolveProviderBranch({ targetBranch, branches }) {
  const target = requireNonEmptyString(targetBranch, "target branch");
  if (!Array.isArray(branches)) throw new TypeError("provider branches must be an array");
  const normalized = [...new Set(branches.map((branch, index) => requireNonEmptyString(branch, `provider branch ${index}`)))];
  const matches = normalized.filter((branch) => branch === target);
  if (matches.length === 0) throw providerContextError("unresolved", `provider does not expose target branch ${target}`);
  if (matches.length !== 1) throw providerContextError("ambiguous", `target branch ${target} is ambiguous in provider context`);
  return matches[0];
}

export function resolveProviderContext({ targetRepository, targetBranch, environments, branches, preferredEnvironmentId = null }) {
  const environment = resolveProviderEnvironment({ targetRepository, environments, preferredEnvironmentId });
  const branch = resolveProviderBranch({ targetBranch, branches });
  return deepFreeze({
    repository: environment.repository,
    environment_id: environment.id,
    environment_label: environment.label,
    base_branch: branch,
  });
}

export function normalizeRepository(value) {
  const repository = requireNonEmptyString(value, "repository");
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error("repository must be owner/repo");
  return repository;
}

function normalizeEnvironment(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`provider environment ${index} must be an object`);
  for (const key of Object.keys(value)) {
    if (!["id", "label", "repository"].includes(key)) throw new Error(`provider environment ${index} contains unknown field: ${key}`);
  }
  return deepFreeze({
    id: requireNonEmptyString(value.id, `provider environment ${index} id`),
    label: requireNonEmptyString(value.label, `provider environment ${index} label`),
    repository: normalizeRepository(value.repository),
  });
}

function providerContextError(kind, message) {
  const error = new Error(message);
  error.code = `provider_context_${kind}`;
  return error;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
