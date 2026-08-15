import { describe, expect, it, vi, afterEach } from "vitest";
import { getNewsHeadlines } from "./news-tool.js";
import { IntegrationNotConfiguredError } from "@jarvis/shared";

describe("getNewsHeadlines", () => {
  const originalEnv = process.env.NEWS_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.NEWS_API_KEY = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws IntegrationNotConfiguredError without a key", async () => {
    delete process.env.NEWS_API_KEY;
    await expect(getNewsHeadlines("AI")).rejects.toThrow(IntegrationNotConfiguredError);
  });

  it("returns parsed headlines when configured", async () => {
    process.env.NEWS_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        articles: [
          { title: "Big AI News", source: { name: "Example Times" }, url: "https://example.com/1", publishedAt: "2026-01-01T00:00:00Z" },
        ],
      }),
    }) as unknown as typeof fetch;

    const result = await getNewsHeadlines("AI");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Big AI News");
    expect(result[0].source).toBe("Example Times");
  });

  it("returns an empty array when there are no articles", async () => {
    process.env.NEWS_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    const result = await getNewsHeadlines("something obscure");
    expect(result).toEqual([]);
  });
});
