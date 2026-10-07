// Multipart form encoding converts LF to CRLF. Normalize before applying text limits.
export function normalizeGraphicText(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : value;
}
