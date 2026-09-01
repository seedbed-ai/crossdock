import { GitHubClient } from "./src/github-client.js";
import { createHandoffServer } from "./src/http-server.js";
import { parseServicePort } from "./src/service-endpoint.js";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}

let port;
try {
  port = parseServicePort(process.env.PORT ?? 3210);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const github = new GitHubClient({ token });
const server = createHandoffServer({ github });

server.listen(port, "127.0.0.1", () => {
  console.log(`Crossdock service listening on http://127.0.0.1:${port}`);
});
