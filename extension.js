const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const markedFiles = new Map();
let decorationProvider = null;
let colorsObj = null;

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

    // Preload colors.json file for select menu
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

    // Register decoration provider
    decorationProvider = new DecorationProvider();
    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(decorationProvider),
    );

    // Restore Global Markees (marked files)
    restoreMarkedColorFromStorage(context);


    /* -------------- Register Color Commands -------------- */
    const commandsConfig = [
        { command: 'markee.explorer.commands.markcolor1', when: 'markee.when.markcolor1', color: 'markee.colors.color1' },
        { command: 'markee.explorer.commands.markcolor2', when: 'markee.when.markcolor2', color: 'markee.colors.color2' },
        { command: 'markee.explorer.commands.markcolor3', when: 'markee.when.markcolor3', color: 'markee.colors.color3' },
        { command: 'markee.explorer.commands.markcolor4', when: 'markee.when.markcolor4', color: 'markee.colors.color4' },
        { command: 'markee.explorer.commands.markcolor5', when: 'markee.when.markcolor5', color: 'markee.colors.color5' },
        { command: 'markee.explorer.commands.unmark', when: 'markee.when.unmark', color: null },
        { command: 'markee.explorer.commands.select', when: 'markee.when.select', color: null },
    ];

    commandsConfig.forEach(({ command, when, color }) => {
        if (color === null) return;
        context.subscriptions.push(
            vscode.commands.registerCommand(command, function (uri) {
                applyMark(context, uri, color);
            }));
        contextHandler(command, when);
    });


    /* -------------- Register File Rename Event -------------- */
    context.subscriptions.push(
        vscode.workspace.onDidRenameFiles(async (renameEvent) => {
            if (renameEvent.files.length === 0) {
                return;
            }

            // Iterate over each renamed file
            for (const file of renameEvent.files) {
                const oldUri = file.oldUri;
                const newUri = file.newUri;

                // Check if the old file path was marked
                if (markedFiles.has(oldUri.fsPath)) {
                    const colorname = markedFiles.get(oldUri.fsPath);

                    // Remove the old file path and add the new file path with the same color
                    markedFiles.delete(oldUri.fsPath);
                    markedFiles.set(newUri.fsPath, colorname);

                    // Save the updated marked file to storage
                    saveMarkedColorToStorage(context, newUri, colorname);
                    deleteMarkedColorFromStorage(context, oldUri);
                }

                // Refresh decorations for the new file location
                /* NOTE!:
                    It would be more efficient to make it inside the if statement,
                    but because VS Code sometimes caches it even when the statement if false
                    we want to update it every time to avoid the cached color to appear again
                    or vice versa.
                */
                decorationProvider.refresh(newUri);
            }
        })
    );



    /* -------------- Register Operational Commands -------------- */
    // Register unmark command
    const unmarkCommand = 'markee.explorer.commands.unmark';
    const unmarkCommandWhen = 'markee.when.unmark';
    contextHandler(unmarkCommand, unmarkCommandWhen);
    const disposableUnmark = vscode.commands.registerCommand(unmarkCommand, function (uri) {
        markedFiles.delete(uri.fsPath);
        deleteMarkedColorFromStorage(context, uri);
        decorationProvider.refresh(uri);
    });
    context.subscriptions.push(disposableUnmark);

    // Register select command
    const selectCommand = 'markee.explorer.commands.select';
    const selectCommandWhen = 'markee.when.select';
    contextHandler(selectCommand, selectCommandWhen);
    const disposableSelect = vscode.commands.registerCommand(selectCommand, async function (uri) {
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

    // Register deleteExplorerItem command
    const disposableDeleteExplorerItem = vscode.commands.registerCommand('markee.commands.deleteExplorerItem', async function (uri) {
        try {
            const commandsArray = commandsConfig.map(item => item.command);
            const availableCommandsArray = commandsArray.filter(command => !getHiddenCommands().includes(command));
            const selectedCommand = await vscode.window.showQuickPick(availableCommandsArray, {
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

    // Register addExplorerItem command
    const disposableAddExplorerItem = vscode.commands.registerCommand('markee.commands.addExplorerItem', async function (uri) {
        try {
            const commandsArray = commandsConfig.map(item => item.command);
            const availableCommandsArray = commandsArray.filter(command => getHiddenCommands().includes(command));
            const selectedCommand = await vscode.window.showQuickPick(availableCommandsArray, {
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

    // Register changeBadge command
    const disposableChangeBadge = vscode.commands.registerCommand('markee.commands.changeBadge', async function (uri) {
        try {
            const userBadge = await vscode.window.showInputBox({
                prompt: "Paste or type your emoji or symbol here!",
                placeHolder: "🔥",
                validateInput: (input) => {
                    // Check if input is empty or longer than 2 characters
                    if (!input) {
                        return 'Input cannot be empty.';
                    }
                    if (input.length > 2) {
                        return 'Please enter a valid emoji or symbol (maximum 2 characters).';
                    }
                    return null; // Input is valid
                }
            });
            if (userBadge) {
                const config = vscode.workspace.getConfiguration();
                config.update("markee.badge", userBadge, vscode.ConfigurationTarget.Global);
                decorationProvider.refreshAll();
            }
        } catch (error) {
            console.error('Markee: Failed to change the badge:', error);
            vscode.window.showErrorMessage('Markee: Failed to change the badge.');
        }
    });
    context.subscriptions.push(disposableChangeBadge);


    // Register editColors command
    const disposableEditColors = vscode.commands.registerCommand('markee.commands.editColors', async function (uri) {
        try {
            const selectedColorKey = await getSelectedColor("Edit specific color");

            // Ask the user to input a hex color
            const userColor = await vscode.window.showInputBox({
                prompt: "Enter a hex color (e.g., #ff6347) for this file",
                placeHolder: "#ff6347",
                validateInput: (input) => {
                    return /^#[0-9A-F]{6}$/i.test(input) ? null : 'Please enter a valid hex color (e.g., #ff6347)';
                }
            });

            if (userColor) {
                updateWorkspaceVariable("workbench.colorCustomizations", {}, selectedColorKey, userColor, "add");
            }
        } catch (error) {
            console.error('Markee: Failed to change the color:', error);
            vscode.window.showErrorMessage('Markee: Failed to change the color.');
        }
    });
    context.subscriptions.push(disposableEditColors);


    console.log('Markee extension is active.');
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
    const colorCustomizations = vscode.workspace.getConfiguration().get("workbench.colorCustomizations", {});

    for (const [filePath, colorname] of Object.entries(markedFilesStorage)) {
        if (colorsObj && colorsObj[colorname]) {
            markedFiles.set(filePath, colorname);
            colorCustomizations[colorname] = colorsObj[colorname];
        }
    }

    vscode.workspace.getConfiguration().update("workbench.colorCustomizations", colorCustomizations, vscode.ConfigurationTarget.Global);
    decorationProvider.refreshAll();
}

// Function to mark files with the specified color and save to storage
function applyMark(context, uri, colorname) {
    markedFiles.set(uri.fsPath, colorname);
    saveMarkedColorToStorage(context, uri, colorname);

    // Disable Git decorations for this file by modifying workspace settings
    const gitDecorations = vscode.workspace.getConfiguration().get("git.decorations.enabled", true);
    if (gitDecorations) {
        updateWorkspaceVariable("git.decorations", {}, "enabled", false, "add");
    }

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

// Get selected dropdown menu
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

// Handle explorer visibility
function contextHandler(command, when) {
    if (!getHiddenCommands().includes(command)) {
        vscode.commands.executeCommand('setContext', when, true);
    } else {
        vscode.commands.executeCommand('setContext', when, false);
    }
}

// get current hidden commands array
function getHiddenCommands() {
    const config = vscode.workspace.getConfiguration();
    return config.get('markee.explorer.commands.hidden', []);

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
            // set badge
            const config = vscode.workspace.getConfiguration();
            const badge = config.get('markee.badge', 'M');

            // Set empty label but add a tooltip or subtle badge
            return new vscode.FileDecoration(badge, colorname, new vscode.ThemeColor(colorname));
        }
        return null;
    }

    refresh(uri) {
        this._onDidChangeFileDecorations.fire(uri);
    }

    refreshAll() {
        this._onDidChangeFileDecorations.fire();
    }
}
