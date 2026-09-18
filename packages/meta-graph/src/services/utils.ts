import { CHARACTER_LIMIT } from "../constants.js";

export function errorResult(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return {
    content: [{ type: "text", text: error instanceof Error ? `Error: ${error.message}` : "Error: Unexpected error." }],
    isError: true,
  };
}

export function truncateResponse(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return `${text.slice(0, CHARACTER_LIMIT)}\n\n[Response truncated at ${CHARACTER_LIMIT} characters.]`;
}
