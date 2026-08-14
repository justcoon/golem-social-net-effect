import { Schema } from "effect";

export function optTextMatches(
  text: string | null | undefined,
  query: string,
): boolean {
  return (
    query === "*" ||
    (text !== null &&
      text !== undefined &&
      text.toLowerCase().includes(query.toLowerCase()))
  );
}

export function optTextExactMatches(
  text: string | null | undefined,
  query: string,
): boolean {
  return (
    query === "*" || (text !== null && text !== undefined && text === query)
  );
}

export function textMatches(text: string, query: string): boolean {
  return query === "*" || text.toLowerCase().includes(query.toLowerCase());
}

export function textExactMatches(text: string, query: string): boolean {
  return query === "*" || text === query;
}

export function tokenize(query: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const c of query) {
    if (c === " " && !inQuotes) {
      if (current.length > 0) {
        tokens.push(current.trim());
        current = "";
      }
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else {
      current += c;
    }
  }

  if (current.length > 0) {
    tokens.push(current.trim());
  }

  return tokens;
}

export const QuerySchema = Schema.Struct({
  terms: Schema.Array(Schema.String),
  fieldFilters: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
});

export type Query = Schema.Schema.Type<typeof QuerySchema>;

export function parseQuery(query: string): Query {
  const terms: string[] = [];
  const fieldFilters: [string, string][] = [];

  const tokens = tokenize(query);

  for (const part of tokens) {
    const splitIndex = part.indexOf(":");
    if (splitIndex !== -1) {
      const field = part.substring(0, splitIndex).toLowerCase();
      const value = part.substring(splitIndex + 1);
      fieldFilters.push([field, value]);
    } else {
      terms.push(part);
    }
  }

  return { terms, fieldFilters };
}
