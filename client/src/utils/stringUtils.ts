/**
 * Decode HTML entities in a string
 * @param str - Input string with HTML entities (e.g. &amp;)
 * @returns Decoded string (e.g. &)
 */
export function decodeHtml(str: string | undefined | null): string {
  if (!str) return '';

  // Legacy records may hold several encoding layers ("&amp;amp;amp;") because
  // the value was re-escaped on every save. Decode repeatedly until the value
  // stops changing, bounded to 5 passes so this can never loop unexpectedly.
  // Only the entities the server sanitizer produced are decoded, and the result
  // is returned as plain text (never interpreted as HTML).
  const MAX_PASSES = 5;
  let value = str;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const decoded = value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#x60;/g, '`')
      // &amp; is decoded last so "&amp;lt;" resolves in the next pass rather
      // than collapsing into a tag-like sequence within a single pass.
      .replace(/&amp;/g, '&');

    if (decoded === value) break; // idempotent: nothing left to decode
    value = decoded;
  }

  return value;
}

/**
 * Processes Google Drive URLs to convert them into direct image links.
 * Returns the URL as-is if it's not a Google Drive link.
 * If url is empty/null/undefined, returns empty string.
 * @param url - The input URL
 * @returns The formatted URL
 */
export function formatGoogleDriveUrl(url?: string | null): string {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    const idMatch = url.match(/\/d\/([^/]+)/);
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
    }
  }
  return url;
}
