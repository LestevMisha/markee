const vscode = require('vscode');
const DecorationProvider = require("./providers/decorationProvider");
const PrecedenceDecorationProvider = require("./providers/precedenceDecorationProvider");
const fs = require('fs');
const path = require('path');
let markedFiles = new Map();
let colornameObjects = new Map();
const commandsConfig = [
    { command: 'markee.explorer.commands.markcolor1', when: 'markee.when.markcolor1', colorname: 'markee.colors.color1' },
    { command: 'markee.explorer.commands.markcolor2', when: 'markee.when.markcolor2', colorname: 'markee.colors.color2' },
    { command: 'markee.explorer.commands.markcolor3', when: 'markee.when.markcolor3', colorname: 'markee.colors.color3' },
    { command: 'markee.explorer.commands.markcolor4', when: 'markee.when.markcolor4', colorname: 'markee.colors.color4' },
    { command: 'markee.explorer.commands.markcolor5', when: 'markee.when.markcolor5', colorname: 'markee.colors.color5' },
    { command: 'markee.explorer.commands.unmark', when: 'markee.when.unmark', colorname: null },
    { command: 'markee.explorer.commands.select', when: 'markee.when.select', colorname: null },
];
let decorationProvider = null;
let decorationProviderDisposable = null;

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

    // Register Decoration Provider
    decorationProvider = new DecorationProvider(context);
    decorationProviderDisposable = vscode.window.registerFileDecorationProvider(decorationProvider);
    context.subscriptions.push(decorationProviderDisposable);

    // Restore data from storage
    restoreFromStorage(context);

    // Fetch file with the colornames
    const filePath = path.join(__dirname, 'colors.json');
    fs.promises.readFile(filePath, 'utf8').then((fileContent) => {
        const data = JSON.parse(fileContent);
        const dataKeys = Object.keys(data);


        // Register /select command
        const selectCommand = 'markee.explorer.commands.select';
        const selectCommandWhen = 'markee.when.select';
        setExplorerVisibility(selectCommand, selectCommandWhen);
        const disposableSelect = vscode.commands.registerCommand(selectCommand, async function (uri) {
            // If no URI is passed, check for an active editor
            if (!uri) {
                const editor = vscode.window.activeTextEditor; // Get the active text editor
                if (editor) {
                    uri = editor.document.uri; // Use the URI of the open file
                } else {
                    vscode.window.showInformationMessage('No active editor found.');
                    return; // Exit if there's no active editor
                }
            }
            try {
                const colorname = await vscode.window.showQuickPick(dataKeys, {
                    placeHolder: "choose colorname"
                });
                if (!colorname) return;
                applyColorChange(context, uri, colorname);
            } catch (error) {
                console.error('Markee: Failed to select color:', error);
                vscode.window.showErrorMessage('Markee: Failed to select color.');
            }
        });
        context.subscriptions.push(disposableSelect);


        // Register /editColorSettings command
        const disposableEditColorSettings = vscode.commands.registerCommand('markee.commands.editColorSettings', async () => {
            try {
                const colorname = await vscode.window.showQuickPick(dataKeys, {
                    placeHolder: "choose colorname"
                });
                if (!colorname) return;

                const option = await vscode.window.showQuickPick(["color", "badge", "propagate", "precedence"], {
                    placeHolder: "choose option"
                });
                if (!option) return;

                switch (option) {

                    case "color": {
                        const color = await vscode.window.showInputBox({
                            prompt: "Enter a hex color (e.g., #ff6347) for this file",
                            placeHolder: "#ff6347",
                            validateInput: (input) => /^#[0-9A-F]{6}$/i.test(input) ? null : 'Please enter a valid hex color (e.g., #ff6347)'

                        });
                        if (!color) return;
                        applyColornameColorChange(colorname, color);
                        break;
                    }

                    case "badge": {
                        const badge = await vscode.window.showInputBox({
                            prompt: "Paste or type your emoji or symbol here!",
                            placeHolder: "🔥",
                            validateInput: (input) => {
                                if (!input) return 'Input cannot be empty.';
                                if (input.length > 2) return 'Please enter a valid emoji or symbol (maximum 2 characters).';
                                return null;
                            }
                        });
                        if (!badge) return;
                        applyAndRefreshNewChanges(context, colorname, { badge });
                        break;
                    }

                    case "propagate": {
                        const propagate = await vscode.window.showQuickPick(["on", "off"], {
                            placeHolder: "choose propagation state"
                        });
                        if (!propagate) return;
                        applyAndRefreshNewChanges(context, colorname, { propagate: propagate === "on" });
                        break;
                    }

                    case "precedence": {
                        const precedence = await vscode.window.showQuickPick(["on", "off"], {
                            placeHolder: "choose precedence state"
                        });
                        if (!precedence) return;
                        applyPrecedence(context, colorname, precedence === "on");
                        break;
                    }

                    default:
                        break;
                }

            } catch (error) {
                console.error('Markee: Failed to edit color settings:', error);
                vscode.window.showErrorMessage('Markee: Failed to edit color settings. Please try again.');
            }
        });
        context.subscriptions.push(disposableEditColorSettings);


    }).catch((error) => {
        console.error('Markee: Failed to load colors.json:', error);
        vscode.window.showErrorMessage('Markee: Failed to load colors configuration.');
        throw error;
    });

    // Register quick access commands for the explorer
    commandsConfig.forEach(({ command, when, colorname }) => {
        if (colorname === null) return;
        context.subscriptions.push(
            vscode.commands.registerCommand(command, function (uri) {
                // If no URI is passed, check for an active editor
                if (!uri) {
                    const editor = vscode.window.activeTextEditor; // Get the active text editor
                    if (editor) {
                        uri = editor.document.uri; // Use the URI of the open file
                    } else {
                        vscode.window.showInformationMessage('No active editor found.');
                        return; // Exit if there's no active editor
                    }
                }

                applyColorChange(context, uri, colorname);
            }));
        setExplorerVisibility(command, when);
    });


    // Register file rename event. Updates file's location, name or extension when it is changed
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
                    refresh(colornameObjects.get(colorname)?.provider, newUri, colorname);

                    // Save the updated marked file to storage
                    saveMarkedFileToStorage(context, newUri, colorname);
                    deleteMarkedFileFromStorage(context, oldUri);
                }
            }
        })
    );

    const disposableSetPrecedenceDelayTime = vscode.commands.registerCommand("markee.commands.setPrecedenceDelayTime", async () => {
        const precedenceDelayTime = await vscode.window.showInputBox({
            prompt: "Enter the delay time for precedence marking (in milliseconds; e.g., 1000 = 1 second):",
            placeHolder: "Default time is set to 800 (0.8 sec)",
            validateInput: (input) => {
                if (!input) return 'Input cannot be empty.';
                const parsedValue = Number(input);
                if (isNaN(parsedValue) || parsedValue < 0) return 'Please enter a valid positive number.';
                if (Number(input) < 10) return 'Input is too small. Please enter a larger value.';
                return null; // Valid input
            }
        });

        // Ensure the user provided a valid input before updating the configuration
        if (precedenceDelayTime) {
            const config = vscode.workspace.getConfiguration();
            await config.update("markee.precedenceDelayTime", Number(precedenceDelayTime), vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Precedence delay time is set to ${precedenceDelayTime / 1000} seconds.`);
        }
    });
    context.subscriptions.push(disposableSetPrecedenceDelayTime);

    // Register /unmark command
    const unmarkCommand = 'markee.explorer.commands.unmark';
    const unmarkCommandWhen = 'markee.when.unmark';
    setExplorerVisibility(unmarkCommand, unmarkCommandWhen);
    const disposableUnmark = vscode.commands.registerCommand(unmarkCommand, function (uri) {
        // If no URI is passed, check for an active editor
        if (!uri) {
            const editor = vscode.window.activeTextEditor; // Get the active text editor
            if (editor) {
                uri = editor.document.uri; // Use the URI of the open file
            } else {
                vscode.window.showInformationMessage('No active editor found.');
                return; // Exit if there's no active editor
            }
        }
        const colorname = markedFiles.get(uri.fsPath);
        markedFiles.delete(uri.fsPath);
        deleteMarkedFileFromStorage(context, uri);
        refresh(colornameObjects.get(colorname)?.provider, uri, colorname);
    });
    context.subscriptions.push(disposableUnmark);


    // Register deleteExplorerItem command
    const disposableDeleteExplorerItem = vscode.commands.registerCommand('markee.commands.deleteExplorerItem', async function (uri) {
        try {
            const config = vscode.workspace.getConfiguration();
            const hiddenCommands = config.get('markee.explorer.commands.hidden', []);

            const commandsArray = commandsConfig.map(item => item.command);
            const availableCommandsArray = commandsArray.filter(command => !hiddenCommands.includes(command));
            const selectedCommand = await vscode.window.showQuickPick(availableCommandsArray, {
                placeHolder: "Select command to delete from explorer"
            });
            if (selectedCommand) {
                const selectedItem = commandsConfig.find(item => item.command === selectedCommand);

                // update config
                hiddenCommands.push(selectedCommand);
                config.update("markee.explorer.commands.hidden", hiddenCommands, vscode.ConfigurationTarget.Global);

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
            const config = vscode.workspace.getConfiguration();
            const hiddenCommands = config.get('markee.explorer.commands.hidden', []);

            const commandsArray = commandsConfig.map(item => item.command);
            const availableCommandsArray = commandsArray.filter(command => hiddenCommands.includes(command));
            const selectedCommand = await vscode.window.showQuickPick(availableCommandsArray, {
                placeHolder: "Select command to add to explorer"
            });
            if (selectedCommand) {
                const selectedItem = commandsConfig.find(item => item.command === selectedCommand);

                // update config
                const updatedHiddenCommands = hiddenCommands.filter(command => command !== selectedCommand);
                config.update("markee.explorer.commands.hidden", updatedHiddenCommands, vscode.ConfigurationTarget.Global);

                vscode.commands.executeCommand('setContext', selectedItem.when, true);
            }
        } catch (error) {
            console.error('Markee: Failed to add explorer item:', error);
            vscode.window.showErrorMessage('Markee: Failed to add explorer item.');
        }
    });
    context.subscriptions.push(disposableAddExplorerItem);

    console.log('Markee extension is active.');
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}

// Function to save marked color to storage
function saveMarkedFileToStorage(context, uri, colorname) {
    const markedFilesStorage = context.globalState.get("markee.markedFiles", {});
    markedFilesStorage[uri.fsPath] = colorname;
    context.globalState.update("markee.markedFiles", markedFilesStorage);
}

function saveColornameObjectToStorage(context, colorname, object) {
    const colornameObjectsStorage = context.globalState.get("markee.colornameObjects", {});

    // Clone the object, but exclude non-serializable properties
    const serializableObject = { ...object };
    delete serializableObject.provider;
    delete serializableObject.providerDisposable;

    colornameObjectsStorage[colorname] = serializableObject;
    context.globalState.update("markee.colornameObjects", colornameObjectsStorage);
}

// Function to delete marked color from storage
function deleteMarkedFileFromStorage(context, uri) {
    const markedFilesStorage = context.globalState.get("markee.markedFiles", {});
    delete markedFilesStorage[uri.fsPath];
    context.globalState.update("markee.markedFiles", markedFilesStorage);
}

// Function to restore marked colors from storage
function restoreFromStorage(context) {
    markedFiles = new Map(Object.entries(context.globalState.get("markee.markedFiles", {})));
    colornameObjects = new Map(Object.entries(context.globalState.get("markee.colornameObjects", {})));

    // update all `markedFiles` marked with default provider
    for (const [filePath, colorname] of markedFiles) {
        const colornameObj = colornameObjects.get(colorname);
        if (!colornameObj.precedence) refresh(colornameObjects.get(colorname)?.provider, vscode.Uri.file(filePath), colorname);
    }

    // load the precedence for `colornameObjects`
    const colornameObjectsFiltered = [...colornameObjects].filter(([_, colornameObj]) => colornameObj?.precedence === true);
    for (const [colorname, _] of colornameObjectsFiltered) {
        const config = vscode.workspace.getConfiguration();
        sleep(config.get("markee.precedenceDelayTime")).then(() => {
            applyPrecedence(context, colorname, true);
        });
    }

}

// sleep time expects milliseconds
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

// Handle explorer visibility
function setExplorerVisibility(command, when) {
    const config = vscode.workspace.getConfiguration();
    const hiddenCommands = config.get('markee.explorer.commands.hidden', []);

    if (!hiddenCommands.includes(command)) {
        vscode.commands.executeCommand('setContext', when, true);
    } else {
        vscode.commands.executeCommand('setContext', when, false);
    }
}

// Helper functions for switch
function applyAndRefreshNewChanges(context, colorname, changes, enablePrecedence) {
    const reducedMarkedFiles = [...markedFiles].filter(([_path, _colorname]) => _colorname === colorname);
    applyColornameObject(context, colorname, changes);
    for (const [_path, _colorname] of reducedMarkedFiles) {
        if (enablePrecedence) decorationProvider.refresh(vscode.Uri.file(_path));
        refresh(colornameObjects.get(colorname)?.provider, vscode.Uri.file(_path), colorname);
    }
}
function applyPrecedence(context, colorname, enablePrecedence) {
    if (enablePrecedence) {
        let newDecorationProvider = new PrecedenceDecorationProvider(context);
        let newDecorationProviderDisposable = vscode.window.registerFileDecorationProvider(newDecorationProvider);
        context.subscriptions.push(newDecorationProviderDisposable);

        applyAndRefreshNewChanges(context, colorname, {
            precedence: true,
            provider: newDecorationProvider,
            providerDisposable: newDecorationProviderDisposable,
        }, true);
    } else {
        // clear precedence provider
        const colornameObj = colornameObjects.get(colorname);
        if (colornameObj?.providerDisposable) {
            colornameObj.providerDisposable.dispose();
            colornameObj.providerDisposable = null;
            colornameObj.provider = null;
        }
        applyAndRefreshNewChanges(context, colorname, { precedence: false });
    }
}


// saves & updates path and colorname for the file 
function applyMarkedFile(uri, colorname) {
    markedFiles.set(uri.fsPath, colorname);
}
// saves & updates defined colors
function applyColornameColorChange(colorname, color) {
    const config = vscode.workspace.getConfiguration();
    const colorObjects = config.get("workbench.colorCustomizations", {});
    colorObjects[colorname] = color;
    config.update("workbench.colorCustomizations", colorObjects, vscode.ConfigurationTarget.Global);
}
// save & updates colorname object
function applyColornameObject(context, colorname, options = {}) {
    const colornameObj = colornameObjects.get(colorname) || { badge: null, propagate: false, precedence: false, provider: null, providerDisposable: null };
    const newObject = { ...colornameObj, ...options };
    colornameObjects.set(colorname, newObject);
    // save `colornameObjects` to a global storage
    saveColornameObjectToStorage(context, colorname, newObject);
}
// Refershes file styles
async function refresh(provider, uri, colorname = "") {
    await provider ? provider.refresh(uri, colorname) : decorationProvider.refresh(uri);
}
// handles file color change
function applyColorChange(context, uri, colorname) {
    // previous provider
    const markedFilePrevColorname = markedFiles.get(uri.fsPath) ?? null;
    const markedFilePrevProvider = colornameObjects.get(markedFilePrevColorname)?.provider;
    // if `markedFilePrevProvider` is null we will use default provider since null is always default provider
    const prevProvider = markedFilePrevProvider || decorationProvider;

    // save marked file path and corresponding colorname
    applyMarkedFile(uri, colorname);
    // create colorname object only once
    const colornameObj = colornameObjects.get(colorname) ?? null;
    if (!colornameObj) applyColornameObject(context, colorname);
    // refresh provider that was unlinked from the marked file
    if (prevProvider) prevProvider.refresh(uri, null);
    // refresh provider that was linked to the file
    refresh(colornameObj?.provider, uri, colorname);

    // save `markedFiles` to a global storage
    saveMarkedFileToStorage(context, uri, colorname);
}
