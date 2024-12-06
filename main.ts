import { App, Plugin, TFolder, TFile, Notice } from 'obsidian';

module.exports = class FolderMarkdownCombinerPlugin extends Plugin {
	app: App;

	async onload() {
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: any, folder: TFolder) => {
				if (folder instanceof TFolder) {
					menu.addItem((item: any) => {
						item
							.setTitle('Combine Markdown Files')
							.setIcon('files')
							.onClick(async () => {
								await this.combineMarkdownInFolder(folder);
							});
					});
				}
			})
		);
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
				// Add a header to each file
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
};
