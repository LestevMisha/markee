const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let colorMap = new Map();
let decorationProvider = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	console.log('Extension "markee" is now active.');

	// Register the FileDecorationProvider only once
	decorationProvider = new MarkeeFileDecorationProvider();
	vscode.window.registerFileDecorationProvider(decorationProvider);

	// Load stored colors from the global storage
	loadStoredColors(context);

	// Helper function to show dropdown
	async function displayOptions($placeholder) {
		const colorKeys = await getColorCustomizationsKeys("colors.json");

		if (!colorKeys || colorKeys.length === 0) {
			vscode.window.showErrorMessage("No color keys found.");
			return;
		}

		const selectedColorKey = await vscode.window.showQuickPick(colorKeys, {
			placeHolder: $placeholder
		});

		return selectedColorKey;
	}

	// Register edit command
	const disposableMarkeeEdit = vscode.commands.registerCommand('markee.markeeEdit', async function (uri) {
		const selectedColorKey = await displayOptions("Edit specific color");

		// Ask the user to input a hex color
		const userColor = await vscode.window.showInputBox({
			prompt: "Enter a hex color (e.g., #ff6347) for this file",
			placeHolder: "#ff6347",
			validateInput: (input) => {
				return /^#[0-9A-F]{6}$/i.test(input) ? null : 'Please enter a valid hex color (e.g., #ff6347)';
			}
		});

		if (userColor) {
			const config = vscode.workspace.getConfiguration();
			const currentCustomizations = config.get('workbench.colorCustomizations') || {};
			currentCustomizations[selectedColorKey] = userColor;
			await config.update('workbench.colorCustomizations', currentCustomizations, vscode.ConfigurationTarget.Global);
			return;
		}
	});

	// Register select command
	const disposableMarkeeSelect = vscode.commands.registerCommand('markee.markeeSelect', async function (uri) {
		const selectedColorKey = await displayOptions("Select color to apply");

		// Store the color in the map for this URI
		colorMap.set(uri.fsPath, selectedColorKey);
		saveColorToStorage(context, uri.fsPath, selectedColorKey);

		// Trigger the refresh of the FileDecorationProvider
		decorationProvider.refresh(uri);
	});

	// Register unselect command (return to default)
	const disposableMarkeeUnselect = vscode.commands.registerCommand('markee.markeeRemove', (uri) => {
		// Remove the file's color from the map
		colorMap.delete(uri.fsPath);
		removeColorFromStorage(context, uri.fsPath);
		decorationProvider.refresh(uri);
	});

	// Register the first command
	const disposableMarkee1 = vscode.commands.registerCommand('markee.markeeColor1', (uri) => {
		changeColor(context, uri, "markee.color1");
	});

	// Register the second command
	const disposableMarkee2 = vscode.commands.registerCommand('markee.markeeColor2', (uri) => {
		changeColor(context, uri, "markee.color2");
	});

	// Register the third command
	const disposableMarkee3 = vscode.commands.registerCommand('markee.markeeColor3', (uri) => {
		changeColor(context, uri, "markee.color3");
	});

	context.subscriptions.push(disposableMarkeeEdit);
	context.subscriptions.push(disposableMarkeeSelect);
	context.subscriptions.push(disposableMarkee1);
	context.subscriptions.push(disposableMarkee2);
	context.subscriptions.push(disposableMarkee3);
}



class MarkeeFileDecorationProvider {
	constructor() {
		this._onDidChangeFileDecorations = new vscode.EventEmitter();
		this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
	}

	// This function is called to provide decorations for files
	provideFileDecoration(uri) {
		const color = colorMap.get(uri.fsPath);
		if (color) {
			return {
				propagate: false,
				color: new vscode.ThemeColor(color),
				tooltip: `This file is marked with color ${color}`,
				badge: '■' // Optional badge to show next to the file name
			};
		}
		return null;
	}

	// Method to refresh decorations for a specific URI
	refresh(uri) {
		this._onDidChangeFileDecorations.fire(uri);
	}
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}


/* ----------------— HELPER FUNCS ----------------— */

function changeColor(context, uri, color) {
	colorMap.set(uri.fsPath, color);
	saveColorToStorage(context, uri.fsPath, color);
	decorationProvider.refresh(uri);
}

// This function reads the workbench color customization keys from the JSON file
async function getColorCustomizationsKeys(filename) {
	try {
		const filePath = path.join(__dirname, filename);
		const fileContent = await fs.promises.readFile(filePath, 'utf8');
		const colorCustomizations = JSON.parse(fileContent);
		return Object.keys(colorCustomizations);
	} catch (error) {
		console.error('Error reading the workbench color customizations file:', error);
		return [];
	}
}

// Function to load stored colors from global storage
function loadStoredColors(context) {
	const storedColors = context.globalState.get('markedFileColors', {});
	console.log('Loaded colors:', storedColors);

	for (const [filePath, color] of Object.entries(storedColors)) {
		colorMap.set(filePath, color);

		// Refresh the decoration for the file after loading its color
		const uri = vscode.Uri.file(filePath);
		decorationProvider.refresh(uri);
	}
}


// Function to save a color to global storage
function saveColorToStorage(context, filePath, color) {
	const storedColors = context.globalState.get('markedFileColors', {});

	// Update the storage with the new color
	storedColors[filePath] = color;
	context.globalState.update('markedFileColors', storedColors);
}

// Function to remove a color from global storage
function removeColorFromStorage(context, filePath) {
	const storedColors = context.globalState.get('markedFileColors', {});

	// Delete the color entry for the file
	delete storedColors[filePath];
	context.globalState.update('markedFileColors', storedColors);
}