import { IntegrationNotConfiguredError } from "@jarvis/shared";

export interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

/**
 * Recent headlines via NewsAPI.org's free tier (NEWS_API_KEY). Throws
 * IntegrationNotConfiguredError when no key is set, same pattern as
 * web-search-tool.ts and weather-tool.ts — never fabricates headlines.
 */
export async function getNewsHeadlines(query: string, limit = 5): Promise<NewsHeadline[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    throw new IntegrationNotConfiguredError("news");
  }

  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("language", "en");

  const response = await fetch(url, { headers: { "X-Api-Key": apiKey } });
  if (!response.ok) {
    throw new Error(`News request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    articles?: Array<{ title: string; source: { name: string }; url: string; publishedAt: string }>;
  };

  return (data.articles ?? []).slice(0, limit).map((a) => ({
    title: a.title,
    source: a.source?.name ?? "unknown",
    url: a.url,
    publishedAt: a.publishedAt,
  }));
}
