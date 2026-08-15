import { createServer, type Server } from "node:http";
import { createLogger } from "@jarvis/shared";
import type { DaemonConfig } from "./config.js";
import type { DeviceIdentity } from "./device-identity.js";
import { daemonState } from "./daemon-state.js";
import { AGENT_VERSION } from "./device-identity.js";

const logger = createLogger("computer-agent:server");

/**
 * Local-only diagnostic server — not part of the JARVIS protocol, never
 * exposed to JARVIS Core. Just lets you `curl localhost:PORT/status` to
 * confirm the daemon is alive without needing the dashboard open.
 */
export function startLocalServer(config: DaemonConfig, identity: DeviceIdentity): Server {
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.url === "/status") {
      const snapshot = daemonState.get();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ...snapshot,
          agentVersion: AGENT_VERSION,
          platform: identity.platform,
          architecture: identity.architecture,
          workspaceRoot: config.workspaceRoot,
          serverUrl: config.serverUrl,
        }),
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(config.port, "127.0.0.1", () => {
    logger.info(`Local diagnostic server listening`, { port: config.port });
  });

  return server;
}
