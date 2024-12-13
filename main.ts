import { App, Plugin, TFolder, TFile, Notice, PluginSettingTab, Setting } from 'obsidian';

interface FolderCombinerSettings {
	showRibbonIcon: boolean;
}

const DEFAULT_SETTINGS: FolderCombinerSettings = {
	showRibbonIcon: true
}

module.exports = class FolderMarkdownCombinerPlugin extends Plugin {
	settings: FolderCombinerSettings;
	ribbonIcon: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new FolderCombinerSettingTab(this.app, this));

		// Initialize ribbon icon based on settings
		if (this.settings.showRibbonIcon) {
			this.addRibbonIconToSidebar();
		}

		// Add command for root combination
		this.addCommand({
			id: 'combine-all-markdown-files',
			name: 'Combine All Markdown Files',
			callback: async () => {
				await this.combineAllMarkdownFiles();
			}
		});

		// Existing folder context menu
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: any, folder: TFolder) => {
				menu.addItem((item: any) => {
					item
						.setTitle('Combine Markdown Files')
						.setIcon('files')
						.onClick(async () => {
							await this.combineMarkdownInFolder(folder);
						});
				});
			})
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	addRibbonIconToSidebar() {
		this.ribbonIcon = this.addRibbonIcon('files', 'Combine All Markdown Files', async () => {
			await this.combineAllMarkdownFiles();
		});
	}

	removeRibbonIcon() {
		if (this.ribbonIcon) {
			this.ribbonIcon.remove();
			this.ribbonIcon = null;
		}
	}

	toggleRibbonIcon(showIcon: boolean) {
		if (showIcon && !this.ribbonIcon) {
			this.addRibbonIconToSidebar();
		} else if (!showIcon && this.ribbonIcon) {
			this.removeRibbonIcon();
		}
		this.settings.showRibbonIcon = showIcon;
		this.saveSettings();
	}

	async getAllMarkdownFiles(folder: TFolder): Promise<TFile[]> {
		let files: TFile[] = [];

		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === 'md') {
				files.push(child);
			} else if (child instanceof TFolder) {
				files = files.concat(await this.getAllMarkdownFiles(child));
			}
		}

		return files;
	}

	async combineAllMarkdownFiles() {
		try {
			const rootFolder = this.app.vault.getRoot();
			const allMarkdownFiles = await this.getAllMarkdownFiles(rootFolder);

			if (allMarkdownFiles.length === 0) {
				new Notice('No markdown files found in the vault');
				return;
			}

			allMarkdownFiles.sort((a, b) => a.path.localeCompare(b.path));

			const combinedContent = await Promise.all(
				allMarkdownFiles.map(async (file: TFile) => {
					const content = await this.app.vault.read(file);
					return `# ${file.path}\n\n${content}\n\n---\n`;
				})
			);

			const outputFileName = `vault_combined_${this.getTimestamp()}.md`;
			await this.app.vault.create(
				outputFileName,
				combinedContent.join('\n')
			);

			new Notice(`Combined ${allMarkdownFiles.length} files into ${outputFileName}`);
		} catch (error) {
			new Notice(`Error combining files: ${error.message}`);
			console.error('Error combining files:', error);
		}
	}

	async combineMarkdownInFolder(folder: TFolder) {
		const markdownFiles = folder.children
			.filter((file: any) => file instanceof TFile && file.extension === 'md')
			.sort((a: any, b: any) => a.name.localeCompare(b.name)) as TFile[];

		if (markdownFiles.length === 0) {
			new Notice('No markdown files found in this folder');
			return;
		}

		const combinedContent = await Promise.all(
			markdownFiles.map(async (file: TFile) => {
				const content = await this.app.vault.read(file);
				return `# ${file.basename}\n\n${content}\n\n---\n`;
			})
		);

		const outputFileName = `${folder.name}_combined.md`;
		await this.app.vault.create(
			`${folder.path}/${outputFileName}`,
			combinedContent.join('\n')
		);

		new Notice(`Combined ${markdownFiles.length} files into ${outputFileName}`);
	}

	private getTimestamp(): string {
		return new Date().toISOString().replace(/[:.]/g, '-');
	}
};

class FolderCombinerSettingTab extends PluginSettingTab {
	// @ts-ignore
	plugin: FolderMarkdownCombinerPlugin;

	// @ts-ignore
	constructor(app: App, plugin: FolderMarkdownCombinerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Show Ribbon Icon')
			.setDesc('Toggle the ribbon icon in the left sidebar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRibbonIcon)
				.onChange(async (value) => {
					this.plugin.toggleRibbonIcon(value);
				}));
	}
}
