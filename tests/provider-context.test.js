import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRepository,
  resolveProviderBranch,
  resolveProviderContext,
  resolveProviderEnvironment,
} from "../src/provider-context.js";

const environments = [
  { id: "env-target", label: "Target environment", repository: "owner/target" },
  { id: "env-other", label: "Other environment", repository: "owner/other" },
];

test("provider environment resolves by canonical repository identity", () => {
  assert.deepEqual(resolveProviderEnvironment({ targetRepository: "owner/target", environments }), environments[0]);
});

test("persisted environment id is only decisive when its live repository mapping still matches", () => {
  assert.deepEqual(resolveProviderEnvironment({
    targetRepository: "owner/target",
    environments: [
      { id: "env-a", label: "A", repository: "owner/target" },
      { id: "env-b", label: "B", repository: "owner/target" },
    ],
    preferredEnvironmentId: "env-b",
  }), { id: "env-b", label: "B", repository: "owner/target" });

  // A stale persisted id is only a hint. If live discovery now exposes exactly
  // one environment for the target repository, that unique live mapping wins.
  assert.deepEqual(resolveProviderEnvironment({
    targetRepository: "owner/target",
    environments,
    preferredEnvironmentId: "env-other",
  }), environments[0]);
});

test("zero or multiple live repository mappings fail closed", () => {
  assert.throws(() => resolveProviderEnvironment({ targetRepository: "owner/missing", environments }),
    (error) => error.code === "provider_context_unresolved");
  assert.throws(() => resolveProviderEnvironment({
    targetRepository: "owner/target",
    environments: [
      { id: "env-a", label: "A", repository: "owner/target" },
      { id: "env-b", label: "B", repository: "owner/target" },
    ],
  }), (error) => error.code === "provider_context_ambiguous");
});

test("provider branch must expose the exact Crossdock target branch", () => {
  assert.equal(resolveProviderBranch({ targetBranch: "main", branches: ["dev", "main"] }), "main");
  assert.throws(() => resolveProviderBranch({ targetBranch: "release", branches: ["main"] }),
    (error) => error.code === "provider_context_unresolved");
});

test("complete provider context freezes environment and branch identity", () => {
  const context = resolveProviderContext({
    targetRepository: "owner/target",
    targetBranch: "main",
    environments,
    branches: ["main", "dev"],
  });
  assert.deepEqual(context, {
    repository: "owner/target",
    environment_id: "env-target",
    environment_label: "Target environment",
    base_branch: "main",
  });
  assert.ok(Object.isFrozen(context));
});

test("repository identity requires exact owner/repo form", () => {
  assert.equal(normalizeRepository(" owner/target "), "owner/target");
  for (const value of ["target", "owner/target/extra", "owner /target", "owner/ target", ""]) {
    assert.throws(() => normalizeRepository(value));
  }
});
