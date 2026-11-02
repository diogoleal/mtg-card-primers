/**
 * File-name sanitization for primer notes.
 * Pure module (no Obsidian imports) so it can be unit-tested with node:test.
 */

const MAX_LENGTH = 180;

/**
 * Turns a card name into a safe file name (without extension).
 * - Multi-face names keep only the front face.
 * - ":" becomes " -" ("Circle of Protection: Red" -> "Circle of Protection - Red").
 * - Characters invalid on Windows/macOS/Linux or special in Obsidian links are removed.
 * - Accents are kept (NFC-normalized).
 */
export function sanitizeFileName(name: string): string {
	let out = (name.split('//')[0] ?? '').normalize('NFC');
	out = out.replace(/\s*:\s*/g, ' - ');
	// Invalid on some filesystem, or breaks Obsidian links: \ / * ? " < > | # ^ [ ]
	out = out.replace(/[\\/*?"<>|#^[\]]/g, '');
	out = out.replace(/\s+/g, ' ');
	// eslint-disable-next-line no-control-regex -- control characters are exactly what we strip
	out = out.replace(/[\u0000-\u001f\u007f]/g, '').trim();
	// Windows does not allow trailing dots/spaces; a leading dot hides the file.
	out = out.replace(/^[.\s]+|[.\s]+$/g, '');
	if (out.length > MAX_LENGTH) out = out.slice(0, MAX_LENGTH).trim();
	return out || 'Untitled card';
}
