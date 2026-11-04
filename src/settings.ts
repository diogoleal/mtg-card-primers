import { App, PluginSettingTab, Setting, type SettingDefinitionItem } from 'obsidian';
import type MtgCardPrimersPlugin from './main';

export type PreferredPrint = 'given' | 'latest';

export interface MtgCardPrimersSettings {
	folder: string;
	templatePath: string;
	preferredPrint: PreferredPrint;
	hoverPopup: boolean;
	manaSymbols: boolean;
}

export const DEFAULT_SETTINGS: MtgCardPrimersSettings = {
	folder: 'MTG/Primers',
	templatePath: '',
	preferredPrint: 'given',
	hoverPopup: true,
	manaSymbols: true,
};

const TEMPLATE_DESC =
	'Path of a note used as the initial body (e.g. Templates/Primer.md). ' +
	'Supports {{name}}, {{front_name}} and {{oracle_id}}. Empty = default template.';
const PRINTING_DESC =
	'Which printing goes into the frontmatter and the image. "As given" uses the set/number from the line ' +
	"(or Scryfall's default printing when only a name is given). \"Latest\" uses the most recent paper printing.";
const HOVER_DESC = 'Shows the card image when hovering over a link to it.';
const SYMBOLS_DESC =
	'Shows {1}, {B}, {T}, {Q}, {PW}, hybrids etc., loyalty shields [+1] [−2] [0], level bands [LEVEL 1-4], ' +
	'set symbols {set:dsc:m} and Commander brackets [BRACKET 3] as symbols. Notes already open in reading view update when reopened.';

export class MtgCardPrimersSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: MtgCardPrimersPlugin,
	) {
		super(app, plugin);
	}

	/** Obsidian 1.13+: settings rendered from these definitions (and found by the settings search). */
	getSettingDefinitions(): SettingDefinitionItem<keyof MtgCardPrimersSettings>[] {
		return [
			{
				name: 'Primers folder',
				desc: 'Where new primer notes are created.',
				control: { type: 'folder', key: 'folder', placeholder: DEFAULT_SETTINGS.folder, includeRoot: true },
			},
			{
				name: 'Template',
				desc: TEMPLATE_DESC,
				control: { type: 'file', key: 'templatePath', placeholder: 'Templates/primer.md', filter: (f) => f.extension === 'md' },
			},
			{
				name: 'Reference printing',
				desc: PRINTING_DESC,
				control: { type: 'dropdown', key: 'preferredPrint', options: { given: 'As given', latest: 'Latest' } },
			},
			{
				name: 'Hover popup',
				desc: HOVER_DESC,
				control: { type: 'toggle', key: 'hoverPopup' },
			},
			{
				name: 'Mana symbols',
				desc: SYMBOLS_DESC,
				aliases: ['loyalty', 'set symbols', 'brackets'],
				control: { type: 'toggle', key: 'manaSymbols' },
			},
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof MtgCardPrimersSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (!(key in DEFAULT_SETTINGS)) return;
		const settings = this.plugin.settings as unknown as Record<string, unknown>;
		settings[key] = typeof value === 'string' ? value.trim() : value;
		await this.plugin.saveSettings();
		if (key === 'manaSymbols') this.app.workspace.updateOptions();
	}

	/** Obsidian older than 1.13 (not called when getSettingDefinitions() is used). */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Primers folder')
			.setDesc('Where new primer notes are created.')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.folder)
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Template')
			.setDesc(TEMPLATE_DESC)
			.addText((text) =>
				text
					.setPlaceholder('Templates/primer.md')
					.setValue(this.plugin.settings.templatePath)
					.onChange(async (value) => {
						this.plugin.settings.templatePath = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Reference printing')
			.setDesc(PRINTING_DESC)
			.addDropdown((dd) =>
				dd
					.addOption('given', 'As given')
					.addOption('latest', 'Latest')
					.setValue(this.plugin.settings.preferredPrint)
					.onChange(async (value) => {
						this.plugin.settings.preferredPrint = value as PreferredPrint;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Hover popup')
			.setDesc(HOVER_DESC)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.hoverPopup).onChange(async (value) => {
					this.plugin.settings.hoverPopup = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Mana symbols')
			.setDesc(SYMBOLS_DESC)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.manaSymbols).onChange(async (value) => {
					this.plugin.settings.manaSymbols = value;
					await this.plugin.saveSettings();
					this.app.workspace.updateOptions();
				}),
			);
	}
}
