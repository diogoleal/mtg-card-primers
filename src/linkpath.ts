/** Pure helper (no Obsidian imports) so it can be unit-tested with node:test. */

/** Link target ("Phyrexian Altar") without alias, heading, block ref, folder or extension. */
export function cleanLinkpath(raw: string): string {
	const target = (raw.split('|')[0] ?? '').split('#')[0] ?? '';
	const base = target.split('/').pop() ?? '';
	return base.replace(/\.md$/i, '').trim();
}
