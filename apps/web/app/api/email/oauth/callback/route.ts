import { NextResponse } from "next/server";
import { runAdHocAgentTask } from "@/lib/server/adhoc";

/** Gmail redirects here with ?code=... after the user grants consent. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const base = process.env.JARVIS_BASE_URL ?? url.origin;

  if (!code) {
    return NextResponse.redirect(`${base}/integrations?email=error&reason=missing_code`);
  }

  try {
    const task = await runAdHocAgentTask({
      agentType: "EMAIL",
      description: "Complete Gmail OAuth",
      input: { op: "exchangeCode", code },
    });
    const ok = task.state === "COMPLETED";
    return NextResponse.redirect(`${base}/integrations?email=${ok ? "connected" : "error"}`);
  } catch {
    return NextResponse.redirect(`${base}/integrations?email=error`);
  }
}
