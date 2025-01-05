import { App, Plugin, TFolder, TFile, Notice, PluginSettingTab, Setting, moment } from 'obsidian';

interface FolderCombinerSettings {
	showRibbonIcon: boolean;
	includeDirectoryContext: boolean;
	filenameSuffix: 'timestamp' | 'random';
	timestampFormat: string;
	randomLength: number;
	randomChars: string;
}

const DEFAULT_SETTINGS: FolderCombinerSettings = {
	showRibbonIcon: true,
	includeDirectoryContext: true,
	filenameSuffix: 'timestamp',
	timestampFormat: 'gggg-MMM-DD-HHmmss',  // Default format
	randomLength: 6,
	randomChars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
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
		const loadedData = await this.loadData();
		this.settings = {
			...DEFAULT_SETTINGS,
			...loadedData,
			// Ensure randomLength is valid
			randomLength: Math.max(1, Math.min(32, Number(loadedData?.randomLength) || DEFAULT_SETTINGS.randomLength)),
			// Ensure randomChars is valid
			randomChars: loadedData?.randomChars?.length > 0
				? loadedData.randomChars
				: DEFAULT_SETTINGS.randomChars
		};
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
		const files = folder.children
			.filter((file): file is TFile => file instanceof TFile && file.extension === 'md');

		const subfolderFiles = await Promise.all(
			folder.children
				.filter((child): child is TFolder => child instanceof TFolder)
				.map(folder => this.getAllMarkdownFiles(folder))
		);

		return [...files, ...subfolderFiles.flat()];
	}

	async generateDirectoryContext(folder: TFolder): Promise<string> {
		const generateTree = (folder: TFolder, prefix: string = ''): string => {
			let tree = '';
			const items = folder.children.sort((a, b) => a.name.localeCompare(b.name));

			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				const isLast = i === items.length - 1;
				const linePrefix = isLast ? '└── ' : '├── ';

				tree += `${prefix}${linePrefix}${item.name}\n`;

				if (item instanceof TFolder) {
					const newPrefix = prefix + (isLast ? '    ' : '│   ');
					tree += generateTree(item, newPrefix);
				}
			}
			return tree;
		};

		return '# Directory Context\n\n```\n' + folder.name + '/\n' + generateTree(folder) + '```\n\n---\n\n';
	}

	private getFileSuffix(baseName: string, savePath: string): string {
		switch (this.settings.filenameSuffix) {
			case 'timestamp': {
				try {
					// Use moment for timestamp formatting and sanitize for filename
					const timestamp = moment().format(this.settings.timestampFormat)
						.replace(/[\\/:*?"<>|]/g, '-'); // Replace invalid filename characters

					return timestamp || moment().format('gggg-MMM-DD-HHmmss');
				} catch (error) {
					console.error('Error formatting timestamp:', error);
					// Fallback to basic ISO format if the format string is invalid
					return moment().format('gggg-MMM-DD-HHmmss');
				}
			}
			case 'random': {
				const chars = this.settings.randomChars || DEFAULT_SETTINGS.randomChars;
				const length = Math.min(32, Math.max(1, this.settings.randomLength || 6));
				let result = '';
				for (let i = 0; i < length; i++) {
					result += chars.charAt(Math.floor(Math.random() * chars.length));
				}
				return result || 'fallback';
			}
			default:
				return new Date().toISOString().replace(/[:.]/g, '-');
		}
	}

	private getOutputFileName(baseName: string, savePath: string): string {
		const suffix = this.getFileSuffix(baseName, savePath);
		return `${baseName}_${suffix}.md`;
	}

	async combineAllMarkdownFiles() {
		try {
			const rootFolder = this.app.vault.getRoot();
			const allMarkdownFiles = await this.getAllMarkdownFiles(rootFolder);

			if (allMarkdownFiles.length === 0) {
				new Notice('No markdown files found in the vault');
				return;
			}

			let combinedContent = '';

			if (this.settings.includeDirectoryContext) {
				combinedContent += await this.generateDirectoryContext(rootFolder);
			}

			allMarkdownFiles.sort((a, b) => a.path.localeCompare(b.path));

			const filesContent = await Promise.all(
				allMarkdownFiles.map(async (file: TFile) => {
					const content = await this.app.vault.read(file);
					return `# ${file.path}\n\n${content}\n\n---\n`;
				})
			);

			combinedContent += filesContent.join('\n');

			const outputFileName = this.getOutputFileName('vault_combined', rootFolder.path);
			await this.app.vault.create(
				`${rootFolder.path}/${outputFileName}`,
				combinedContent
			);

			new Notice(`Combined ${allMarkdownFiles.length} files into ${outputFileName}`);
		} catch (error) {
			new Notice(`Error combining files: ${error.message}`);
			console.error('Error combining files:', error);
		}
	}

	async combineMarkdownInFolder(folder: TFolder) {
		// Use getAllMarkdownFiles instead of just checking immediate children
		const markdownFiles = folder.children
			.filter((file): file is TFile => file instanceof TFile && file.extension === 'md')
			.sort((a, b) => a.name.localeCompare(b.name));

		// If directory context is enabled, create the file even if there are no markdown files
		if (this.settings.includeDirectoryContext) {
			let combinedContent = await this.generateDirectoryContext(folder);

			// Add markdown content if any exists
			if (markdownFiles.length > 0) {
				const filesContent = await Promise.all(
					markdownFiles.map(async (file: TFile) => {
						const content = await this.app.vault.read(file);
						// Use full path relative to the folder for better context
						const relativePath = file.path.replace(folder.path + '/', '');
						return `# ${relativePath}\n\n${content}\n\n---\n`;
					})
				);
				combinedContent += filesContent.join('\n');
			}

			const folderSnakeCase = folder.name.toLowerCase().replace(/\s/g, '_');
			const outputFileName = this.getOutputFileName(folderSnakeCase, folder.path);
			await this.app.vault.create(
				`${folder.path}/${outputFileName}`,
				combinedContent
			);

			new Notice(`Created ${outputFileName}${markdownFiles.length > 0 ? ` with ${markdownFiles.length} files` : ' with directory structure'}`);
			return;
		}

		// Handle case when no markdown files found and directory context is disabled
		if (markdownFiles.length === 0) {
			new Notice('No markdown files found in this folder or its subdirectories');
			return;
		}

		// Rest of the function for when directory context is disabled
		const filesContent = await Promise.all(
			markdownFiles.map(async (file: TFile) => {
				const content = await this.app.vault.read(file);
				const relativePath = file.path.replace(folder.path + '/', '');
				return `# ${relativePath}\n\n${content}\n\n---\n`;
			})
		);

		const savePath = folder.path;
		const folderSnakeCase = folder.name.toLowerCase().replace(/\s/g, '_');
		const outputFileName = this.getOutputFileName(folderSnakeCase, savePath);
		await this.app.vault.create(
			`${savePath}/${outputFileName}`,
			filesContent.join('\n')
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

		new Setting(containerEl)
			.setName('Include Directory Context')
			.setDesc('Add directory structure at the start of combined files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeDirectoryContext)
				.onChange(async (value) => {
					this.plugin.settings.includeDirectoryContext = value;
					await this.plugin.saveSettings();
				}));

		const suffixSetting = new Setting(containerEl)
			.setName('Filename Suffix Style')
			.setDesc('Choose how to generate unique filenames')
			.addDropdown(dropdown => dropdown
				.addOption('timestamp', 'Timestamp')
				.addOption('random', 'Random String')
				.setValue(this.plugin.settings.filenameSuffix)
				.onChange(async (value: FolderCombinerSettings['filenameSuffix']) => {
					this.plugin.settings.filenameSuffix = value;
					await this.plugin.saveSettings();
					// Refresh the settings UI
					this.display();
				}));

		// Conditionally show settings based on selected suffix type
		if (this.plugin.settings.filenameSuffix === 'timestamp') {
			const timestampContainer = containerEl.createDiv('timestamp-settings');
			new Setting(timestampContainer)
				.setName('Timestamp Format')
				.setDesc(createFragment(frag => {
					frag.appendText('Format string for the timestamp. ');
					frag.createEl('a', {
						text: 'Moment.js format reference',
						href: 'https://momentjs.com/docs/#/displaying/format/'
					}).setAttr('target', '_blank');
				}))
				.addText(text => text
					.setPlaceholder('gggg-MMM-DD-HHmmss')
					.setValue(this.plugin.settings.timestampFormat)
					.onChange(async (value) => {
						if (value.length === 0) {
							this.plugin.settings.timestampFormat = DEFAULT_SETTINGS.timestampFormat;
							await this.plugin.saveSettings();
							previewEl.textContent = `Preview: ${this.plugin.getFileSuffix('preview', '')}`;
							return;
						}
						this.plugin.settings.timestampFormat = value;
						await this.plugin.saveSettings();
						previewEl.textContent = `Preview: ${this.plugin.getFileSuffix('preview', '')}`;
					}));

			// Add preview below the setting
			const previewEl = timestampContainer.createDiv('setting-item-description');
			previewEl.textContent = `Preview: ${this.plugin.getFileSuffix('preview', '')}`;
		} else if (this.plugin.settings.filenameSuffix === 'random') {
			const randomContainer = containerEl.createDiv('random-settings');
			new Setting(randomContainer)
				.setName('Random String Length')
				.setDesc('Length of random string suffix (1-32)')
				.addText(text => text
					.setPlaceholder('6')
					.setValue(this.plugin.settings.randomLength.toString())
					.onChange(async (value) => {
						const num = parseInt(value);
						if (!isNaN(num) && num > 0 && num <= 32) {
							this.plugin.settings.randomLength = num;
							await this.plugin.saveSettings();
							// Update the preview using existing method
							previewEl.textContent = `Preview: ${this.plugin.getFileSuffix('preview', '')}`;
						}
					}));

			new Setting(randomContainer)
				.setName('Random String Characters')
				.setDesc('Characters to use for random string generation')
				.addText(text => text
					.setPlaceholder('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
					.setValue(this.plugin.settings.randomChars)
					.onChange(async (value) => {
						if (value.length > 0) {
							this.plugin.settings.randomChars = value;
							await this.plugin.saveSettings();
							// Update the preview using existing method
							previewEl.textContent = `Preview: ${this.plugin.getFileSuffix('preview', '')}`;
						} else {
							this.plugin.settings.randomChars = DEFAULT_SETTINGS.randomChars;
							await this.plugin.saveSettings();
							previewEl.textContent = `Preview: ${this.plugin.getFileSuffix('preview', '')}`;
						}
					}));

			// Add preview below the settings
			const previewEl = randomContainer.createDiv('setting-item-description');
			previewEl.textContent = `Preview: ${this.plugin.getFileSuffix('preview', '')}`;
		}
	}
}
