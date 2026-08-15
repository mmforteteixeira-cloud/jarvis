import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, __resetRateLimitsForTests } from "./rate-limit.js";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("key-a", 3, 1000).allowed).toBe(true);
    }
  });

  it("blocks requests once the limit is exceeded within the window", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("key-b", 3, 1000);
    const result = checkRateLimit("key-b", 3, 1000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("keeps separate buckets per key", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("key-c", 3, 1000);
    expect(checkRateLimit("key-c", 3, 1000).allowed).toBe(false);
    expect(checkRateLimit("key-d", 3, 1000).allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) checkRateLimit("key-e", 3, 1000);
    expect(checkRateLimit("key-e", 3, 1000).allowed).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(checkRateLimit("key-e", 3, 1000).allowed).toBe(true);
  });
});
