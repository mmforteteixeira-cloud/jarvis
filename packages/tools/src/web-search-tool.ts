import { IntegrationNotConfiguredError } from "@jarvis/shared";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Research Agent's web search tool. Uses Brave Search's free-tier API
 * (SEARCH_API_KEY) when configured. Throws IntegrationNotConfiguredError
 * otherwise — callers must surface that clearly rather than fabricating
 * results.
 */
export async function webSearch(query: string, limit = 5): Promise<WebSearchResult[]> {
  const apiKey = process.env.SEARCH_API_KEY;
  const provider = process.env.SEARCH_PROVIDER ?? "brave";

  if (!apiKey) {
    throw new IntegrationNotConfiguredError("search");
  }

  if (provider === "brave") {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(limit));

    const response = await fetch(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    });
    if (!response.ok) {
      throw new Error(`Brave Search request failed: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as {
      web?: { results?: Array<{ title: string; url: string; description: string }> };
    };
    return (data.web?.results ?? []).slice(0, limit).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));
  }

  throw new Error(`Unsupported SEARCH_PROVIDER: ${provider}`);
}
