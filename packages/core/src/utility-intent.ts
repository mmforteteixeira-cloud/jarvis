import { evaluateExpression, CalculatorError, getCurrentDateTime } from "@jarvis/tools";

export interface UtilityIntentResult {
  kind: "calculator" | "datetime";
  reply: string;
}

/**
 * Instant, deterministic answers that don't need the AI provider at all —
 * they work identically in DEMO mode and REAL mode, and answer faster than
 * a round trip to an LLM would. Deliberately conservative about matching:
 * a calculation must contain an actual operator, never just a bare number,
 * so questions like "what is 2024" don't get misread as arithmetic.
 */
const DATETIME_PATTERN =
  /\b(que horas s[ãa]o|que dia [ée] hoje|qual [ée] a data(?:\s+de\s+hoje)?|what time is it|what'?s today'?s date|current time|current date)\b/i;

const PERCENT_OF_PATTERN = /(\d+(?:[.,]\d+)?)\s*%\s*(?:de|of)\s*(\d+(?:[.,]\d+)?)/i;
// No trailing \b: JS regex treats accented letters like "é" as non-word
// characters, so a boundary assertion right after "quanto é" would never
// match. The operator-presence check above already keeps this safe from
// false positives, so a plain substring match is fine here.
const CALC_TRIGGER = /(quanto [ée]|calcula(?:r)?|calculate|what'?s|what is)/i;
const OPERATOR_PATTERN = /[+\-*/%^]/;
const EXPRESSION_PATTERN = /-?\d+(?:[.,]\d+)?(?:\s*[+\-*/%^]\s*-?\d+(?:[.,]\d+)?)+/;

export function parseUtilityIntent(message: string): UtilityIntentResult | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (DATETIME_PATTERN.test(trimmed)) {
    const info = getCurrentDateTime();
    // info.date already includes the weekday (dateStyle: "full"), so it's
    // not repeated here.
    return { kind: "datetime", reply: `It's ${info.time} on ${info.date} (${info.timezone}).` };
  }

  const percentMatch = PERCENT_OF_PATTERN.exec(trimmed);
  if (percentMatch) {
    const pct = Number(percentMatch[1].replace(",", "."));
    const base = Number(percentMatch[2].replace(",", "."));
    const result = (pct / 100) * base;
    return { kind: "calculator", reply: `${formatNumber(pct)}% of ${formatNumber(base)} = ${formatNumber(result)}` };
  }

  const expressionMatch = EXPRESSION_PATTERN.exec(trimmed.replace(/,/g, "."));
  if (expressionMatch && OPERATOR_PATTERN.test(expressionMatch[0])) {
    const isBareExpression = trimmed.replace(/,/g, ".") === expressionMatch[0];
    if (isBareExpression || CALC_TRIGGER.test(trimmed)) {
      try {
        const result = evaluateExpression(expressionMatch[0]);
        return { kind: "calculator", reply: `${expressionMatch[0]} = ${formatNumber(result)}` };
      } catch (error) {
        if (error instanceof CalculatorError) return null;
        throw error;
      }
    }
  }

  return null;
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
