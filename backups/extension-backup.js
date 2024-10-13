// optimized
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const markedFiles = new Map();
let decorationProvider = null;
let colorsObj = null;


const COMMANDS = {
    MARK_COLOR_1: 'markee.explorer.commands.markcolor1',
    MARK_COLOR_2: 'markee.explorer.commands.markcolor2',
    MARK_COLOR_3: 'markee.explorer.commands.markcolor3',
    MARK_COLOR_4: 'markee.explorer.commands.markcolor4',
    MARK_COLOR_5: 'markee.explorer.commands.markcolor5',
    UNMARK: 'markee.explorer.commands.unmark',
    SELECT: 'markee.explorer.commands.select',
    DELETE_EXPLORER_ITEM: 'markee.commands.deleteExplorerItem',
    ADD_EXPLORER_ITEM: 'markee.commands.addExplorerItem',
};

const commandsConfig = [
    { command: COMMANDS.MARK_COLOR_1, when: 'markee.when.markcolor1', color: 'markee.colors.color1' },
    { command: COMMANDS.MARK_COLOR_2, when: 'markee.when.markcolor2', color: 'markee.colors.color2' },
    { command: COMMANDS.MARK_COLOR_3, when: 'markee.when.markcolor3', color: 'markee.colors.color3' },
    { command: COMMANDS.MARK_COLOR_4, when: 'markee.when.markcolor4', color: 'markee.colors.color4' },
    { command: COMMANDS.MARK_COLOR_5, when: 'markee.when.markcolor5', color: 'markee.colors.color5' },
    { command: COMMANDS.UNMARK, when: 'markee.when.unmark', color: null },
    { command: COMMANDS.SELECT, when: 'markee.when.select', color: null },
];
/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

    try {
        await preloadColors();
    } catch {
        return; // Exit activation if colors fail to load
    }

    registerDecorationProvider(context);
    restoreMarkedColorFromStorage(context);

    const hiddenCommands = getHiddenCommands();

    registerColorCommands(context, hiddenCommands);
    registerOperationalCommands(context, hiddenCommands);

    console.log('Markee extension is active.');
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}

class DecorationProvider {
    constructor() {
        this._onDidChangeFileDecorations = new vscode.EventEmitter();
        this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
    }

    // This function is called to provide decorations for files
    provideFileDecoration(uri) {
        if (markedFiles.has(uri.fsPath)) {
            const colorname = markedFiles.get(uri.fsPath);
            // Set empty label but add a tooltip or subtle badge
            return new vscode.FileDecoration('●', colorname, new vscode.ThemeColor(colorname));
        }
        return null;
    }

    refresh(uri) {
        this._onDidChangeFileDecorations.fire(uri);
    }
}

// Function to save marked color to storage
function saveMarkedColorToStorage(context, uri, colorname) {
    const markedFilesStorage = context.globalState.get("markedFiles", {});
    markedFilesStorage[uri.fsPath] = colorname;
    context.globalState.update("markedFiles", markedFilesStorage);
}

// Function to delete marked color from storage
function deleteMarkedColorFromStorage(context, uri) {
    const markedFilesStorage = context.globalState.get("markedFiles", {});
    delete markedFilesStorage[uri.fsPath];
    context.globalState.update("markedFiles", markedFilesStorage);
}

// Function to restore marked colors from storage
function restoreMarkedColorFromStorage(context) {
    const markedFilesStorage = context.globalState.get("markedFiles", {});

    for (const [filePath, colorname] of Object.entries(markedFilesStorage)) {
        markedFiles.set(filePath, colorname);
        updateWorkspaceVariable("workbench.colorCustomizations", {}, colorname, colorsObj[colorname]);
        decorationProvider.refresh(vscode.Uri.file(filePath));
    }
}

// Function to mark files with the specified color and save to storage
function applyMark(context, uri, colorname) {
    markedFiles.set(uri.fsPath, colorname);
    saveMarkedColorToStorage(context, uri, colorname);
    decorationProvider.refresh(uri);
}

// Update workspace variable
function updateWorkspaceVariable(variableToUpdate, defaultVariableValue, new_key, new_value, action = "add") {
    const config = vscode.workspace.getConfiguration();
    let newVariable = config.get(variableToUpdate) || defaultVariableValue;

    if (new_key) {
        // if Object
        if (action === "add") {
            newVariable[new_key] = new_value;
        } else if (action === "delete") {
            delete newVariable[new_key];
        }
    } else {
        // if Array
        if (action === "add") {
            newVariable.push(new_value);
        } else if (action === "delete") {
            newVariable = newVariable.filter(item => item !== new_value);
        }
    }

    config.update(variableToUpdate, newVariable, vscode.ConfigurationTarget.Global);
}

async function getSelectedColor($placeholder) {
    const colorKeys = Object.keys(colorsObj);
    if (!colorKeys || colorKeys.length === 0) {
        vscode.window.showErrorMessage("No color keys found.");
        return;
    }
    const selectedColorKey = await vscode.window.showQuickPick(colorKeys, {
        placeHolder: $placeholder
    });
    return selectedColorKey;
}

async function preloadColors() {
    try {
        const filePath = path.join(__dirname, "colors.json");
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        colorsObj = JSON.parse(fileContent);
        console.log('Markee: Colors configuration loaded successfully.');
    } catch (error) {
        console.error('Markee: Failed to load colors.json:', error);
        vscode.window.showErrorMessage('Markee: Failed to load colors configuration.');
        throw error;
    }
}

function registerDecorationProvider(context) {
    decorationProvider = new DecorationProvider();
    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(decorationProvider),
    );
}

function getHiddenCommands() {
    const config = vscode.workspace.getConfiguration('markee.explorer.commands');
    return config.get('hidden', []);
}

function registerColorCommands(context, hiddenCommands) {
    commandsConfig.forEach(({ command, when, color }) => {
        if (color) {
            if (!hiddenCommands.includes(command)) {
                context.subscriptions.push(
                    vscode.commands.registerCommand(command, (uri) => applyMark(context, uri, color))
                );
                vscode.commands.executeCommand('setContext', when, true);
            } else {
                vscode.commands.executeCommand('setContext', when, false);
            }
        }
    });
}

function contextHandler(command, when, hiddenCommands) {
    if (!hiddenCommands.includes(command)) {
        // show explorer unmark
        vscode.commands.executeCommand('setContext', when, true);
    } else {
        // hide explorer unmark
        vscode.commands.executeCommand('setContext', when, false);
    }
}

function registerOperationalCommands(context, hiddenCommands) {
    // Register Unmark Command
    contextHandler(COMMANDS.UNMARK, commandsConfig.find(item => COMMANDS.UNMARK === item.command).when, hiddenCommands)
    const disposableUnmark = vscode.commands.registerCommand(COMMANDS.UNMARK, (uri) => {
        markedFiles.delete(uri.fsPath);
        deleteMarkedColorFromStorage(context, uri);
        decorationProvider.refresh(uri);
    });
    context.subscriptions.push(disposableUnmark);

    // Register Select Command
    contextHandler(COMMANDS.SELECT, commandsConfig.find(item => COMMANDS.SELECT === item.command).when, hiddenCommands)
    const disposableSelect = vscode.commands.registerCommand(COMMANDS.SELECT, async (uri) => {
        try {
            const selectedColorKey = await getSelectedColor("Select color to apply");
            if (selectedColorKey) {
                applyMark(context, uri, selectedColorKey);
            }
        } catch (error) {
            console.error('Markee: Failed to select color:', error);
            vscode.window.showErrorMessage('Markee: Failed to select color.');
        }
    });
    context.subscriptions.push(disposableSelect);

    // Register Delete Explorer Item Command
    const disposableDeleteExplorerItem = vscode.commands.registerCommand(COMMANDS.DELETE_EXPLORER_ITEM, async () => {
        try {
            const selectedCommand = await vscode.window.showQuickPick(commandsConfig.map(item => item.command), {
                placeHolder: "Select command to delete from explorer"
            });
            if (selectedCommand) {
                const selectedItem = commandsConfig.find(item => item.command === selectedCommand);
                updateWorkspaceVariable("markee.explorer.commands.hidden", [], null, selectedCommand, "add");
                vscode.commands.executeCommand('setContext', selectedItem.when, false);
            }
        } catch (error) {
            console.error('Markee: Failed to delete explorer item:', error);
            vscode.window.showErrorMessage('Markee: Failed to delete explorer item.');
        }
    });
    context.subscriptions.push(disposableDeleteExplorerItem);

    // Register Add Explorer Item Command
    const disposableAddExplorerItem = vscode.commands.registerCommand(COMMANDS.ADD_EXPLORER_ITEM, async () => {
        try {
            const selectedCommand = await vscode.window.showQuickPick(commandsConfig.map(item => item.command), {
                placeHolder: "Select command to add to explorer"
            });
            if (selectedCommand) {
                const selectedItem = commandsConfig.find(item => item.command === selectedCommand);
                updateWorkspaceVariable("markee.explorer.commands.hidden", [], null, selectedCommand, "delete");
                vscode.commands.executeCommand('setContext', selectedItem.when, true);
            }
        } catch (error) {
            console.error('Markee: Failed to add explorer item:', error);
            vscode.window.showErrorMessage('Markee: Failed to add explorer item.');
        }
    });
    context.subscriptions.push(disposableAddExplorerItem);
}
