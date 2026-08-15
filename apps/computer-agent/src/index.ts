import { mkdirSync } from "node:fs";
import { createLogger } from "@jarvis/shared";
import { loadConfig } from "./config.js";
import { loadOrCreateDeviceIdentity, AGENT_VERSION } from "./device-identity.js";
import { JarvisServerClient } from "./client.js";
import { Poller } from "./poller.js";
import { sendHeartbeat } from "./heartbeat.js";
import { startLocalServer } from "./server.js";
import { daemonState } from "./daemon-state.js";

const logger = createLogger("computer-agent");

async function main() {
  const config = loadConfig();

  if (!config.enabled) {
    logger.error("COMPUTER_AGENT_ENABLED is not \"true\" — refusing to start. Set it in .env to run this daemon.");
    process.exit(1);
  }
  if (!config.token) {
    logger.error("COMPUTER_AGENT_TOKEN is not set — refusing to start without an authentication secret.");
    process.exit(1);
  }

  mkdirSync(config.workspaceRoot, { recursive: true });

  const identity = loadOrCreateDeviceIdentity();
  logger.info("jarvis-computer starting", {
    version: AGENT_VERSION,
    platform: identity.platform,
    architecture: identity.architecture,
    workspace: config.workspaceRoot,
    server: config.serverUrl,
  });

  const client = new JarvisServerClient(config, identity);
  const poller = new Poller(client, config.workspaceRoot);
  const localServer = startLocalServer(config, identity);

  daemonState.setState("CONNECTING");
  try {
    const { deviceId, status } = await client.register();
    logger.info("Registered with JARVIS server", { deviceId, status });
    daemonState.setState("ONLINE");
  } catch (error) {
    daemonState.setState("ERROR", (error as Error).message);
    logger.error("Initial registration failed — will keep retrying via heartbeat", { error: (error as Error).message });
  }

  let stopped = false;

  const pollTimer = setInterval(() => {
    if (stopped) return;
    poller.tick().catch((error) => logger.error("Poll tick threw unexpectedly", { error: (error as Error).message }));
  }, config.pollIntervalMs);

  const heartbeatTimer = setInterval(() => {
    if (stopped) return;
    sendHeartbeat(client).catch(() => {
      // sendHeartbeat already logs and updates daemonState on failure.
    });
  }, config.heartbeatIntervalMs);

  // First heartbeat immediately, in case registration itself failed but
  // the server comes back up shortly after — heartbeat also re-confirms liveness.
  await sendHeartbeat(client).catch(() => {});

  function shutdown(signal: string) {
    if (stopped) return;
    stopped = true;
    logger.info("Shutting down", { signal });
    daemonState.setState("OFFLINE");
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
    poller.stop();
    localServer.close();
    client
      .announceOffline()
      .catch(() => {})
      .finally(() => process.exit(0));
    // Don't hang forever waiting on a network call during shutdown.
    setTimeout(() => process.exit(0), 3000).unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error("jarvis-computer crashed on startup", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
