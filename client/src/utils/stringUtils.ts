/**
 * Decode HTML entities in a string
 * @param str - Input string with HTML entities (e.g. &amp;)
 * @returns Decoded string (e.g. &)
 */
export function decodeHtml(str: string | undefined | null): string {
  if (!str) return '';

  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`');
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
