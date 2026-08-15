import { IntegrationNotConfiguredError } from "@jarvis/shared";

export interface WeatherResult {
  location: string;
  temperatureC: number;
  feelsLikeC: number;
  condition: string;
  humidityPercent: number;
  windKph: number;
}

/**
 * Current weather via OpenWeatherMap's free tier (WEATHER_API_KEY). Throws
 * IntegrationNotConfiguredError when no key is set — callers must surface
 * that honestly rather than letting an LLM guess at real-time weather.
 */
export async function getCurrentWeather(location: string): Promise<WeatherResult> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    throw new IntegrationNotConfiguredError("weather");
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", location);
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");

  const response = await fetch(url);
  if (response.status === 404) {
    throw new Error(`Unknown location: "${location}"`);
  }
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    name: string;
    main: { temp: number; feels_like: number; humidity: number };
    weather: Array<{ description: string }>;
    wind: { speed: number };
  };

  return {
    location: data.name || location,
    temperatureC: Math.round(data.main.temp),
    feelsLikeC: Math.round(data.main.feels_like),
    condition: data.weather[0]?.description ?? "unknown",
    humidityPercent: data.main.humidity,
    windKph: Math.round(data.wind.speed * 3.6),
  };
}
