export interface InformationIntent {
  kind: "weather" | "news";
  query: string;
}

const WEATHER_PATTERN =
  /(?:que tempo faz|qual [ée] o tempo|previs[ãa]o do tempo(?:\s+para)?|weather(?: like)? in|weather forecast for)\s+(?:em\s+)?([a-zA-ZÀ-ÿ\s,]+?)[?.!]*$/i;

const NEWS_PATTERN = /(?:not[íi]cias (?:sobre|de|acerca de)|news (?:about|on))\s+([a-zA-Z0-9À-ÿ\s,]+?)[?.!]*$/i;

/**
 * Weather and news are the two "real-time information" tools — unlike
 * calculator/datetime (utility-intent.ts) they need a network call, and
 * unlike reminders they don't write anything. Kept as pattern matching only
 * here; the actual fetch + IntegrationNotConfiguredError handling lives in
 * jarvis-core.ts alongside where the reply gets persisted.
 */
export function parseInformationIntent(message: string): InformationIntent | null {
  const trimmed = message.trim();

  const weatherMatch = WEATHER_PATTERN.exec(trimmed);
  if (weatherMatch && weatherMatch[1].trim()) {
    return { kind: "weather", query: weatherMatch[1].trim() };
  }

  const newsMatch = NEWS_PATTERN.exec(trimmed);
  if (newsMatch && newsMatch[1].trim()) {
    return { kind: "news", query: newsMatch[1].trim() };
  }

  return null;
}
