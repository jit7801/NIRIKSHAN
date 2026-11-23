/**
 * Utility for robust, RFC 4180 compliant CSV generation and download.
 *
 * Guarantees:
 * 1. Safe Blob-based downloads instead of truncated/malformed data: URIs.
 * 2. Full preservation of '#' and other URL fragment characters.
 * 3. Proper RFC 4180 escaping for double quotes, commas, and newlines.
 * 4. UTF-8 Byte Order Mark (BOM) inclusion for flawless Excel rendering.
 */

/**
 * Escapes an individual field value according to RFC 4180.
 * - Null/undefined values become empty string.
 * - Double quotes are escaped by doubling them (" -> "").
 * - Encloses all string values in double quotes to safely preserve commas, newlines, and '#'.
 * - Numbers and booleans are preserved without quotes unless they contain special characters.
 */
export function escapeCSVField(val) {
  if (val === null || val === undefined) {
    return '""';
  }

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return '""';
    return String(val);
  }

  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }

  const str = String(val);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Formats an array of rows and headers into a CSV string with a UTF-8 BOM.
 * @param {string[]} headers - Column header names
 * @param {Array<Array<any>>} rows - Matrix of cell values
 * @returns {string} Clean RFC 4180 CSV text with UTF-8 BOM
 */
export function generateCSVContent(headers, rows) {
  const headerLine = headers.map((h) => escapeCSVField(h)).join(',');
  const rowLines = rows.map((row) => row.map((cell) => escapeCSVField(cell)).join(','));
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Triggers a browser download using a temporary Blob and Object URL.
 * Automatically cleans up DOM elements and revokes the Blob URL.
 * @param {string} filename - Target download filename (e.g., 'works.csv')
 * @param {string} csvContent - CSV string (from generateCSVContent)
 */
export function downloadCSVBlob(filename, csvContent) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', objectUrl);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  link.style.position = 'absolute';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke object URL to prevent memory leaks
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}
