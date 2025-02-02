# Folder Markdown Combiner

An Obsidian plugin that allows you to combine markdown files, either from a specific folder or across your entire vault.

## Features

- Right-click on a folder to combine all markdown files within that folder
- Use the ribbon icon or command palette to combine all markdown files from your entire vault
- Option to include directory structure context in combined files
- Flexible filename suffix options:
	- Timestamp with customizable Moment.js format
	- Random string generation with configurable length and character set
- Toggle the ribbon icon visibility in settings
- Creates a new markdown file with contents from all files
- Preserves original file names/paths as headers
- Adds a separator between combined files
- Automatically sorts files for consistent output

## Installation

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/Mike-Bros/folder-file-combiner/releases)
2. Extract the files into your vault's plugins folder: `VaultFolder/.obsidian/plugins/folder-file-combiner/`
3. Enable the plugin in Obsidian settings

## Usage

### Combining Files in a Specific Folder
1. Right-click on any folder in Obsidian
2. Select "Combine Markdown Files"
3. A new file will be created in that folder with a name based on your suffix settings

### Combining All Vault Files
You have two options:
1. Click the ribbon icon (file stack) in the left sidebar
2. Use the command palette (Ctrl/Cmd + P) and search for "Combine All Markdown Files"

The combined vault file will be created in your vault root with a name based on your suffix settings

### Settings

You can configure the plugin in Settings > Folder File Combiner:
- Toggle the ribbon icon visibility
- Include directory structure context in combined files
- Choose filename suffix style:
	- Timestamp: Customize format using Moment.js patterns (e.g., YYYY-MM-DD-HH-mm-ss)
	- Random: Configure length and character set for random string generation
- Live preview of timestamp format

## Development

Requirements:
- Node.js
- npm

Setup:
1. Clone this repository
2. `npm install`
3. `npm run dev` for development builds
4. `npm run build` for production builds

## License

MIT
