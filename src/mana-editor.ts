import { RangeSetBuilder, type Text } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import { appendSymbol, isManaSymbol } from './mana';
import { scanSymbols, type SymbolKind, type SymbolMatch } from './mana-scan';

class SymbolWidget extends WidgetType {
	constructor(
		readonly kind: SymbolKind,
		readonly value: string,
	) {
		super();
	}
	eq(other: SymbolWidget): boolean {
		return other.kind === this.kind && other.value === this.value;
	}
	toDOM(): HTMLElement {
		const wrap = createSpan({ cls: 'mtg-symbol-widget' });
		appendSymbol(wrap, this);
		return wrap;
	}
	ignoreEvent(): boolean {
		return false;
	}
}

/**
 * Live Preview: shows {B}, [+1] and [LEVEL 1-4] as symbols, except where the cursor/selection touches it
 * (so it can still be edited). Source mode is left alone.
 */
export function manaLivePreview(isEnabled: () => boolean) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			private scannedDoc: Text | null = null;
			private matches: SymbolMatch[] = [];

			constructor(view: EditorView) {
				this.decorations = this.build(view);
			}

			update(u: ViewUpdate) {
				const modeChanged =
					u.startState.field(editorLivePreviewField, false) !== u.state.field(editorLivePreviewField, false);
				if (u.docChanged || u.viewportChanged || u.selectionSet || modeChanged) {
					this.decorations = this.build(u.view);
				}
			}

			private build(view: EditorView): DecorationSet {
				if (!isEnabled() || !view.state.field(editorLivePreviewField, false)) return Decoration.none;
				const doc = view.state.doc;
				if (doc !== this.scannedDoc) {
					this.matches = scanSymbols(doc.toString(), isManaSymbol);
					this.scannedDoc = doc;
				}
				const selection = view.state.selection.ranges;
				const builder = new RangeSetBuilder<Decoration>();
				for (const { from, to } of view.visibleRanges) {
					for (const m of this.matches) {
						if (m.to <= from) continue;
						if (m.from >= to) break;
						if (selection.some((r) => r.from <= m.to && r.to >= m.from)) continue;
						builder.add(m.from, m.to, Decoration.replace({ widget: new SymbolWidget(m.kind, m.value) }));
					}
				}
				return builder.finish();
			}
		},
		{ decorations: (v) => v.decorations },
	);
}
