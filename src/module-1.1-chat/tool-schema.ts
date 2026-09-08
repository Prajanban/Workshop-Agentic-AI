const ALLOWED = new Set(['type', 'description', 'properties', 'required', 'items', 'enum', 'format', 'nullable']);

export function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!ALLOWED.has(key)) continue;
    if (key === 'type' && typeof value === 'string') output[key] = value.toUpperCase();
    else if (key === 'properties' && value && typeof value === 'object') {
      output[key] = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, toGeminiSchema(child as Record<string, unknown>)]));
    } else if (key === 'items' && value && typeof value === 'object') output[key] = toGeminiSchema(value as Record<string, unknown>);
    else output[key] = value;
  }
  return output;
}