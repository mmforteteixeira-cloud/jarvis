import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getCurrentWeather } from "./weather-tool.js";
import { IntegrationNotConfiguredError } from "@jarvis/shared";

describe("getCurrentWeather", () => {
  const originalEnv = process.env.WEATHER_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.WEATHER_API_KEY = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws IntegrationNotConfiguredError without a key", async () => {
    delete process.env.WEATHER_API_KEY;
    await expect(getCurrentWeather("Lisbon")).rejects.toThrow(IntegrationNotConfiguredError);
  });

  it("returns parsed weather data when configured", async () => {
    process.env.WEATHER_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        name: "Lisbon",
        main: { temp: 21.4, feels_like: 20.9, humidity: 60 },
        weather: [{ description: "clear sky" }],
        wind: { speed: 3 },
      }),
    }) as unknown as typeof fetch;

    const result = await getCurrentWeather("Lisbon");
    expect(result.location).toBe("Lisbon");
    expect(result.temperatureC).toBe(21);
    expect(result.condition).toBe("clear sky");
    expect(result.windKph).toBe(11);
  });

  it("throws a clear error for an unknown location", async () => {
    process.env.WEATHER_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }) as unknown as typeof fetch;

    await expect(getCurrentWeather("Nowhereville")).rejects.toThrow(/Unknown location/);
  });
});
