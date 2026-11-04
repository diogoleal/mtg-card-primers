/**
 * Inline SVG helpers. Shapes and set symbols are drawn with SVG instead of CSS clip-path and mask,
 * which older Obsidian versions support only partially.
 */

const NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(doc: Document, tag: K): SVGElementTagNameMap[K] {
	return doc.createElementNS(NS, tag);
}

/**
 * A filled polygon behind the element's text (loyalty shields, level bands).
 * points use a 0–100 box that stretches to the element's size.
 */
export function appendShape(parent: HTMLElement, points: string): void {
	const doc = parent.ownerDocument;
	const svg = svgEl(doc, 'svg');
	svg.setAttribute('class', 'mtg-shape');
	svg.setAttribute('viewBox', '0 0 100 100');
	svg.setAttribute('preserveAspectRatio', 'none');
	svg.setAttribute('aria-hidden', 'true');
	const polygon = svgEl(doc, 'polygon');
	polygon.setAttribute('points', points);
	svg.appendChild(polygon);
	parent.prepend(svg);
}

// Only drawing elements and geometry attributes are copied from downloaded SVG files:
// no scripts, styles, links, event handlers or embedded content.
const ALLOWED_TAGS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line']);
const ALLOWED_ATTRS = new Set([
	'd',
	'points',
	'cx',
	'cy',
	'r',
	'rx',
	'ry',
	'x',
	'y',
	'x1',
	'y1',
	'x2',
	'y2',
	'width',
	'height',
	'transform',
	'fill-rule',
	'clip-rule',
]);

/**
 * Rebuilds a set symbol SVG (from Scryfall) with only safe drawing elements, without its own colours,
 * so CSS can fill it with the rarity colour. null when the text isn't a usable SVG.
 */
export function safeSvg(doc: Document, text: string): SVGSVGElement | null {
	const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
	const source = parsed.documentElement;
	if (source.nodeName !== 'svg' || parsed.getElementsByTagName('parsererror').length > 0) return null;

	const copy = (from: Element, to: Element) => {
		for (const child of Array.from(from.children)) {
			const tag = child.nodeName;
			if (!ALLOWED_TAGS.has(tag) || tag === 'svg') continue;
			const el = doc.createElementNS(NS, tag);
			for (const attr of Array.from(child.attributes)) {
				if (ALLOWED_ATTRS.has(attr.name)) el.setAttribute(attr.name, attr.value);
			}
			copy(child, el);
			to.appendChild(el);
		}
	};

	const svg = svgEl(doc, 'svg');
	const viewBox = source.getAttribute('viewBox');
	const width = parseFloat(source.getAttribute('width') ?? '');
	const height = parseFloat(source.getAttribute('height') ?? '');
	if (viewBox && /^[\d.\s,-]+$/.test(viewBox)) svg.setAttribute('viewBox', viewBox);
	else if (width > 0 && height > 0) svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
	else return null;
	svg.setAttribute('aria-hidden', 'true');
	copy(source, svg);
	return svg.childElementCount > 0 ? svg : null;
}

/** Rarity colours as SVG gradients, referenced from CSS as fill: url(#mtg-rarity-r). */
const RARITY_GRADIENTS: Record<string, [string, string, string]> = {
	u: ['#d9e4ea', '#8a9aa4', '#5e6b73'],
	r: ['#f3dd8a', '#c9a43a', '#8a6b1c'],
	m: ['#fbb15a', '#e8601c', '#b5321a'],
	s: ['#d4b3f0', '#9b67d4', '#6a3fa0'],
};
const DEFS_CLASS = 'mtg-svg-defs';

/** Adds the rarity gradients to this document once (each popout window has its own document). */
export function ensureRarityGradients(doc: Document): void {
	if (doc.body.querySelector(`:scope > svg.${DEFS_CLASS}`)) return;
	const svg = svgEl(doc, 'svg');
	svg.setAttribute('class', DEFS_CLASS);
	svg.setAttribute('width', '0');
	svg.setAttribute('height', '0');
	svg.setAttribute('aria-hidden', 'true');
	const defs = svgEl(doc, 'defs');
	for (const [rarity, [from, middle, to]] of Object.entries(RARITY_GRADIENTS)) {
		const gradient = svgEl(doc, 'linearGradient');
		gradient.setAttribute('id', `mtg-rarity-${rarity}`);
		gradient.setAttribute('x1', '0');
		gradient.setAttribute('y1', '0');
		gradient.setAttribute('x2', '1');
		gradient.setAttribute('y2', '1');
		[
			['0', from],
			['0.55', middle],
			['1', to],
		].forEach(([offset, color]) => {
			const stop = svgEl(doc, 'stop');
			stop.setAttribute('offset', offset!);
			stop.setAttribute('stop-color', color!);
			gradient.appendChild(stop);
		});
		defs.appendChild(gradient);
	}
	svg.appendChild(defs);
	doc.body.appendChild(svg);
}

/** Plugin unload: removes the gradients added to this document. */
export function removeRarityGradients(doc: Document): void {
	doc.body.querySelectorAll(`:scope > svg.${DEFS_CLASS}`).forEach((el) => el.remove());
}
