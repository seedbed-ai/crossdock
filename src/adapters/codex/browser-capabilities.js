import { AGENT_CAPABILITIES_SCHEMA, validateAgentCapabilities } from "../../agent-capabilities.js";

/**
 * Capabilities currently implemented by the experimental ChatGPT/Codex Cloud
 * browser adapter.
 *
 * The implementation intent remains experimental until dated authenticated
 * live testing establishes compatibility with the current provider surfaces.
 * Ordinary capability routing therefore rejects it unless the caller opts in
 * to experimental capabilities explicitly.
 */
export const CODEX_BROWSER_CAPABILITIES = validateAgentCapabilities({
  schema: AGENT_CAPABILITIES_SCHEMA,
  adapter: "codex-cloud-browser",
  provider: "codex",
  surface: "browser-cloud",
  intents: {
    implement: {
      status: "experimental",
      features: ["branch-mutation", "result-report"],
    },
  },
});
