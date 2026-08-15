export class CalculatorError extends Error {}

/**
 * Safe recursive-descent arithmetic evaluator — deliberately not eval() or
 * Function(), since this parses untrusted user input. Supports
 * + - * / % ^ (), decimals, and unary +/-.
 */
export function evaluateExpression(input: string): number {
  const normalized = input.replace(/,/g, ".").trim();
  if (!/^[\d\s+\-*/%^().]+$/.test(normalized)) {
    throw new CalculatorError(`Expression contains unsupported characters: "${input}"`);
  }

  const tokens = normalized.match(/\d+(?:\.\d+)?|[+\-*/%^()]/g);
  if (!tokens || tokens.length === 0) {
    throw new CalculatorError("No valid expression found");
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpression(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      value = op === "+" ? value + parseTerm() : value - parseTerm();
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = consume();
      const rhs = parseUnary();
      if ((op === "/" || op === "%") && rhs === 0) throw new CalculatorError("Division by zero");
      value = op === "*" ? value * rhs : op === "/" ? value / rhs : value % rhs;
    }
    return value;
  }

  function parseUnary(): number {
    if (peek() === "-") {
      consume();
      return -parseUnary();
    }
    if (peek() === "+") {
      consume();
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower(): number {
    const base = parsePrimary();
    if (peek() === "^") {
      consume();
      return Math.pow(base, parseUnary());
    }
    return base;
  }

  function parsePrimary(): number {
    const token = consume();
    if (token === undefined) throw new CalculatorError("Unexpected end of expression");
    if (token === "(") {
      const value = parseExpression();
      if (consume() !== ")") throw new CalculatorError("Missing closing parenthesis");
      return value;
    }
    const num = Number(token);
    if (Number.isNaN(num)) throw new CalculatorError(`Unexpected token "${token}"`);
    return num;
  }

  const result = parseExpression();
  if (pos !== tokens.length) throw new CalculatorError(`Unexpected trailing input near "${tokens[pos]}"`);
  if (!Number.isFinite(result)) throw new CalculatorError("Result is not a finite number");
  return result;
}
