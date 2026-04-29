// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

const PLACEHOLDER_PATTERN = /\{([\w$]+(?:\.[\w$]+)*)\}/g;
const SIMPLE_IDENTIFIER = /^[\w$]+$/;

/**
 * Extracts parameter names from a function via `Function.prototype.toString()`.
 * Handles class methods (`method(a, b) {}`), async (`async method(a, b) {}`),
 * and arrow / function-expression forms. Default values, rest spread, and TS
 * type annotations are stripped. Destructured patterns (`{ id }`, `[a, b]`)
 * resolve to no name and are filtered out.
 */
export const extractParamNames = (fn: AnyFunction): string[] => {
  const stripped = fn
    .toString()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  const match = /\(([^)]*)\)/.exec(stripped);
  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => {
      const noRest = raw.replace(/^\.\.\./, '');
      const noDefault = noRest.split('=')[0].trim();
      const noType = noDefault.split(':')[0].trim();
      return noType;
    })
    .filter((name) => SIMPLE_IDENTIFIER.test(name));
};

type Segment =
  | { kind: 'literal'; value: string }
  | { kind: 'param'; index: number; path: string[]; expression: string };

export type KeyResolver = (args: unknown[]) => string;

/**
 * Compiles a key template into a resolver function. Placeholders take the
 * form `{name}` or `{name.path.to.value}`. The leading segment is matched
 * against the supplied parameter names; any remaining segments traverse
 * properties on the resolved argument via dot notation, e.g. `{query.page}`
 * pulls `args[queryIndex].page`. At decoration time we fail fast if the head
 * placeholder doesn't correspond to any method parameter, since that is
 * always a bug.
 */
export const compileKeyTemplate = (template: string, paramNames: string[]): KeyResolver => {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    const expression = match[1];
    const [head, ...path] = expression.split('.');
    const index = paramNames.indexOf(head);
    if (index === -1) {
      throw new Error(
        `[@jdevel/nest-better-cache] cache key placeholder "{${expression}}" ` +
          `does not match any method parameter ` +
          `(parameters: ${paramNames.length > 0 ? paramNames.join(', ') : '<none>'}).`,
      );
    }
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      segments.push({
        kind: 'literal',
        value: template.slice(lastIndex, matchIndex),
      });
    }
    segments.push({ kind: 'param', index, path, expression });
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < template.length) {
    segments.push({ kind: 'literal', value: template.slice(lastIndex) });
  }

  return (args: unknown[]): string =>
    segments
      .map((seg) => {
        if (seg.kind === 'literal') {
          return seg.value;
        }
        let value: unknown = args[seg.index];
        for (const key of seg.path) {
          if (value === undefined || value === null) {
            throw new Error(
              `[@jdevel/nest-better-cache] cache key placeholder "{${seg.expression}}" ` +
                `received ${value === undefined ? 'undefined' : 'null'} at runtime.`,
            );
          }
          if (typeof value !== 'object') {
            throw new Error(
              `[@jdevel/nest-better-cache] cache key placeholder "{${seg.expression}}" ` +
                `cannot read "${key}" on ${typeof value}.`,
            );
          }
          value = (value as Record<string, unknown>)[key];
        }
        if (value === undefined || value === null) {
          throw new Error(
            `[@jdevel/nest-better-cache] cache key placeholder "{${seg.expression}}" ` +
              `received ${value === undefined ? 'undefined' : 'null'} at runtime.`,
          );
        }
        if (
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean' &&
          typeof value !== 'bigint'
        ) {
          throw new Error(
            `[@jdevel/nest-better-cache] cache key placeholder "{${seg.expression}}" ` +
              `must be a string, number, boolean, or bigint, got ${typeof value}.`,
          );
        }
        return String(value);
      })
      .join('');
};
