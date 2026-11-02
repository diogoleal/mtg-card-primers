import { App, PluginSettingTab, Setting } from 'obsidian';
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

export class MtgCardPrimersSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: MtgCardPrimersPlugin,
	) {
		super(app, plugin);
	}

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
			.setDesc(
				'Path of a note used as the initial body (e.g. Templates/Primer.md). ' +
					'Supports {{name}}, {{front_name}} and {{oracle_id}}. Empty = default template.',
			)
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
			.setDesc(
				'Which printing goes into the frontmatter and the image. "As given" uses the set/number from the line ' +
					'(or Scryfall\'s default printing when only a name is given). "Latest" uses the most recent paper printing.',
			)
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
			.setDesc('Shows the card image when hovering over a link to it.')
			.addToggle((t) =>
				t.setValue(this.plugin.settings.hoverPopup).onChange(async (value) => {
					this.plugin.settings.hoverPopup = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Mana symbols')
			.setDesc('Shows {1}, {B}, {T}, {Q}, {PW}, hybrids etc., loyalty shields [+1] [−2] [0], level bands [LEVEL 1-4], set symbols {set:dsc:m} and Commander brackets [BRACKET 3] as symbols. Notes already open in reading view update when reopened.')
			.addToggle((t) =>
				t.setValue(this.plugin.settings.manaSymbols).onChange(async (value) => {
					this.plugin.settings.manaSymbols = value;
					await this.plugin.saveSettings();
					this.app.workspace.updateOptions();
				}),
			);
	}
}
