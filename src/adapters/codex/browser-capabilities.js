import { AGENT_CAPABILITIES_SCHEMA, validateAgentCapabilities } from "../../agent-capabilities.js";

/**
 * Capabilities Crossdock currently implements through its experimental
 * ChatGPT/Codex Cloud browser adapter.
 *
 * This is intentionally narrower than the full Codex product capability set.
 * A provider feature is not a supported Crossdock adapter capability until
 * Crossdock has the corresponding state, provenance, retry, and validation
 * behavior implemented and tested.
 */
export const CODEX_BROWSER_CAPABILITIES = validateAgentCapabilities({
  schema: AGENT_CAPABILITIES_SCHEMA,
  adapter: "codex-cloud-browser",
  provider: "codex",
  surface: "browser-cloud",
  intents: ["implement"],
  features: ["branch-mutation", "result-report"],
});
