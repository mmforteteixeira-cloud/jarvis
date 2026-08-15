#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { arch, homedir, platform, release, tmpdir } from "node:os";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import http from "node:http";
import https from "node:https";

const execFileAsync = promisify(execFile);

/**
 * `pnpm computer:doctor` — read-only diagnostics for running the Computer
 * Agent daemon on this machine, especially macOS.
 *
 * Deliberately has ZERO imports from @jarvis/* packages: a diagnostic tool
 * that itself depends on the thing it's diagnosing being buildable isn't
 * much of a diagnostic tool. Every check here only reads state (env vars,
 * filesystem, running processes, network reachability) — nothing is
 * installed, no macOS permission is changed, no destructive action is
 * taken. Where a real macOS permission prompt is the only way to find out
 * whether access is granted (Screen Recording), that is stated explicitly
 * before it happens.
 */

type Status = "PASS" | "WARN" | "FAIL" | "SKIP";

interface CheckResult {
  status: Status;
  message: string;
  detail?: string;
}

const results: Array<{ section: string; result: CheckResult }> = [];

function record(section: string, result: CheckResult) {
  results.push({ section, result });
  const icon = { PASS: "✓", WARN: "!", FAIL: "✗", SKIP: "-" }[result.status];
  const color = { PASS: "\x1b[32m", WARN: "\x1b[33m", FAIL: "\x1b[31m", SKIP: "\x1b[90m" }[result.status];
  const reset = "\x1b[0m";
  console.log(`${color}${icon} [${result.status}]${reset} ${section}: ${result.message}`);
  if (result.detail) {
    for (const line of result.detail.split("\n")) console.log(`      ${line}`);
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync(platform() === "win32" ? "where" : "which", [cmd]);
    return true;
  } catch {
    return false;
  }
}

function httpGet(url: string, timeoutMs = 3000): Promise<{ ok: boolean; status?: number; error?: string }> {
  return new Promise((resolvePromise) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolvePromise({ ok: (res.statusCode ?? 0) < 500, status: res.statusCode });
    });
    req.on("timeout", () => {
      req.destroy();
      resolvePromise({ ok: false, error: "timed out" });
    });
    req.on("error", (err) => resolvePromise({ ok: false, error: err.message }));
  });
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
  return path;
}

const PROTECTED_FOLDER_NAMES = ["Desktop", "Documents", "Downloads", "Pictures", "Movies", "Music"];

async function main() {
  console.log("JARVIS Computer Agent — diagnostic\n");

  // ---- 1. macOS -------------------------------------------------------
  const plat = platform();
  if (plat === "darwin") {
    try {
      const { stdout: version } = await execFileAsync("sw_vers", ["-productVersion"]);
      const { stdout: buildName } = await execFileAsync("sw_vers", ["-productName"]).catch(() => ({ stdout: "macOS" }));
      record("macOS", {
        status: "PASS",
        message: `${buildName.trim()} ${version.trim()}, ${arch() === "arm64" ? "Apple Silicon (arm64)" : "Intel (x64)"}`,
      });
    } catch {
      record("macOS", { status: "WARN", message: "darwin detected but sw_vers failed — unusual, continuing anyway." });
    }
  } else {
    record("macOS", {
      status: "WARN",
      message: `Running on "${plat}", not "darwin". The Computer Agent's macOS commands (open, screencapture) won't be used here.`,
      detail: `This is expected in a dev/CI sandbox. On your actual Mac this check should say PASS.`,
    });
  }

  // ---- 2. Node ----------------------------------------------------------
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  record("Node.js", {
    status: nodeMajor >= 20 ? "PASS" : "FAIL",
    message: `v${process.versions.node}${nodeMajor >= 20 ? "" : " — JARVIS requires Node 20+"}`,
  });

  // ---- 3. pnpm ------------------------------------------------------------
  try {
    const { stdout } = await execFileAsync("pnpm", ["--version"]);
    record("pnpm", { status: "PASS", message: `v${stdout.trim()}` });
  } catch {
    record("pnpm", {
      status: "FAIL",
      message: "pnpm not found on PATH.",
      detail: "Install with: corepack enable   (or: npm install -g pnpm)",
    });
  }

  // ---- 4. Xcode Command Line Tools (macOS only, informational) ----------
  if (plat === "darwin") {
    try {
      await execFileAsync("xcode-select", ["-p"]);
      record("Xcode CLI Tools", { status: "PASS", message: "installed." });
    } catch {
      record("Xcode CLI Tools", {
        status: "WARN",
        message: "not detected.",
        detail:
          "Only needed if `pnpm install` has to compile better-sqlite3's native module from source " +
          "(it usually downloads a prebuilt binary instead, in which case this doesn't matter). " +
          "If `pnpm install` fails on better-sqlite3, run: xcode-select --install",
      });
    }
  } else {
    record("Xcode CLI Tools", { status: "SKIP", message: "macOS-only check." });
  }

  // ---- 5. Daemon configuration -------------------------------------------
  const enabled = (process.env.COMPUTER_AGENT_ENABLED ?? "false").toLowerCase() === "true";
  record("Daemon: COMPUTER_AGENT_ENABLED", {
    status: enabled ? "PASS" : "WARN",
    message: enabled ? "true" : "not set to true — the daemon refuses to start without this.",
  });

  const token = process.env.COMPUTER_AGENT_TOKEN;
  record("Daemon: COMPUTER_AGENT_TOKEN", {
    status: token ? "PASS" : "FAIL",
    message: token ? `set (${token.slice(0, 4)}...${token.slice(-4)}, ${token.length} chars)` : "not set.",
    detail: token
      ? undefined
      : "Generate one with: openssl rand -hex 32 — and put the SAME value in both apps/computer-agent/.env and the root .env.",
  });

  const port = Number(process.env.COMPUTER_AGENT_PORT ?? 8787);
  record("Daemon: COMPUTER_AGENT_PORT", {
    status: Number.isInteger(port) && port > 0 && port < 65536 ? "PASS" : "FAIL",
    message: String(port),
  });

  // ---- 6. Workspace -------------------------------------------------------
  const workspaceRaw = process.env.COMPUTER_AGENT_WORKSPACE ?? "~/JARVIS/workspace";
  const workspaceRoot = resolve(expandHome(workspaceRaw));
  const existedBefore = existsSync(workspaceRoot);
  try {
    mkdirSync(workspaceRoot, { recursive: true });
    const marker = resolve(workspaceRoot, ".jarvis-doctor-check");
    await writeFile(marker, "ok");
    await unlink(marker);
    record("Workspace", {
      status: "PASS",
      message: `${workspaceRoot} ${existedBefore ? "(existing, writable)" : "(created, writable)"}`,
    });
  } catch (error) {
    record("Workspace", {
      status: "FAIL",
      message: `${workspaceRoot} is not writable.`,
      detail: (error as Error).message,
    });
  }

  if (plat === "darwin" && PROTECTED_FOLDER_NAMES.some((name) => workspaceRoot.includes(`/${name}/`) || workspaceRoot.endsWith(`/${name}`))) {
    record("Workspace: protected folder", {
      status: "WARN",
      message: `Workspace is under ${PROTECTED_FOLDER_NAMES.find((n) => workspaceRoot.includes(n))} — macOS will prompt whichever app runs the daemon (Terminal, iTerm, VS Code, ...) for folder access the first time.`,
      detail: "This is a normal macOS consent prompt, not an error — just approve it when it appears. The default ~/JARVIS/workspace avoids this entirely.",
    });
  }

  // ---- 7. macOS permissions ------------------------------------------------
  if (plat === "darwin") {
    console.log("\n  Checking Screen Recording permission — this takes one real (throwaway) screenshot to");
    console.log("  find out, because macOS provides no other reliable way to query this from a script.");
    console.log("  The file is deleted immediately after. This does NOT change any permission itself —");
    console.log("  it only reveals whether the OS already granted it.\n");

    const tmpPath = resolve(tmpdir(), `jarvis-doctor-screencheck-${Date.now()}.png`);
    try {
      await execFileAsync("screencapture", ["-x", tmpPath]);
      const buf = await readFile(tmpPath);
      const ok = buf.length > 0;
      record("Permission: Screen Recording", {
        status: ok ? "PASS" : "FAIL",
        message: ok ? "granted." : "screencapture ran but produced an empty file — permission likely not granted.",
        detail: ok
          ? undefined
          : "Grant it: System Settings → Privacy & Security → Screen Recording → enable for the app you " +
            "run the daemon from (Terminal, iTerm2, VS Code, ...), then restart that app.",
      });
    } catch (error) {
      record("Permission: Screen Recording", {
        status: "FAIL",
        message: "screencapture failed to run.",
        detail:
          "Grant it: System Settings → Privacy & Security → Screen Recording → enable for the app you run " +
          `the daemon from (Terminal, iTerm2, VS Code, ...), then restart that app.\n(${(error as Error).message})`,
      });
    } finally {
      await unlink(tmpPath).catch(() => {});
    }

    record("Permission: Automation / Accessibility", {
      status: "PASS",
      message: "not required for any currently-implemented command.",
      detail:
        "OPEN_APPLICATION uses `open -a` (LaunchServices) and never needs it. It would only become relevant " +
        "for a future click/type UI-scripting feature, which does not exist yet — see AGENTS.md.",
    });

    record("Permission: Full Disk Access", {
      status: "PASS",
      message: "not required for the default workspace (~/JARVIS/workspace).",
      detail: "Only relevant if COMPUTER_AGENT_WORKSPACE is set under a protected folder — see the Workspace check above.",
    });
  } else {
    record("Permissions", { status: "SKIP", message: "macOS-only checks." });
  }

  // ---- 8. Communication with JARVIS ---------------------------------------
  const serverUrl = (process.env.JARVIS_SERVER_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const reach = await httpGet(`${serverUrl}/api/system/status`);
  record("Communication with JARVIS server", {
    status: reach.ok ? "PASS" : "FAIL",
    message: reach.ok ? `reachable at ${serverUrl} (HTTP ${reach.status})` : `unreachable at ${serverUrl}`,
    detail: reach.ok
      ? undefined
      : `${reach.error ?? "connection failed"} — is the web app running? (pnpm dev in apps/web)\n` +
        "Token validity (COMPUTER_AGENT_TOKEN matching the server's) is only confirmed once the daemon actually registers.",
  });

  // ---- 9. Commands supported on this platform -----------------------------
  console.log("\n  Command support on this platform:");
  const openBin = plat === "darwin" ? "open" : "xdg-open";
  const hasOpen = await commandExists(openBin);
  console.log(`    OPEN_APPLICATION / OPEN_URL : ${hasOpen ? "available" : "unavailable"} (${openBin})`);

  if (plat === "darwin") {
    const hasScreencapture = await commandExists("screencapture");
    console.log(`    SCREENSHOT                  : ${hasScreencapture ? "available" : "unavailable"} (screencapture)`);
  } else {
    const shot = (await Promise.all(["scrot", "import", "gnome-screenshot"].map(async (c) => ((await commandExists(c)) ? c : null)))).find(
      Boolean,
    );
    console.log(`    SCREENSHOT                  : ${shot ? `available (${shot})` : "unavailable (no scrot/import/gnome-screenshot)"}`);
  }
  console.log("    SYSTEM_INFO                 : always available");
  console.log("    LIST_DIRECTORY / READ_FILE  : always available (sandboxed)");
  console.log("    WRITE_FILE / CREATE_DIRECTORY: always available (sandboxed)");
  console.log("    RUN_COMMAND                  : available (risk-classified per command — see computer-policy.ts)");

  // ---- Summary -------------------------------------------------------------
  const counts = { PASS: 0, WARN: 0, FAIL: 0, SKIP: 0 };
  for (const { result } of results) counts[result.status]++;

  console.log("\n" + "─".repeat(60));
  console.log(`Summary: ${counts.PASS} passed, ${counts.WARN} warnings, ${counts.FAIL} failed, ${counts.SKIP} skipped`);
  if (counts.FAIL > 0) {
    console.log("Fix the FAILed checks above before starting the daemon.");
    process.exitCode = 1;
  } else if (counts.WARN > 0) {
    console.log("No blocking issues — review the warnings above.");
  } else {
    console.log("All checks passed. Start the daemon with: pnpm dev");
  }
}

main().catch((error) => {
  console.error("Doctor script crashed:", error);
  process.exitCode = 1;
});
