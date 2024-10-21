const vscode = require('vscode'); // Import vscode module

class DecorationProvider {
    constructor(context) {
        this._onDidChangeFileDecorations = new vscode.EventEmitter();
        this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
        this.context = context;  // Store context for later use
    }

    // This function is called to provide decorations for files
    provideFileDecoration(uri) {
        const markedFiles = new Map(Object.entries(this.context.globalState.get("markee.markedFiles", {})));
        const colornameObjects = new Map(Object.entries(this.context.globalState.get("markee.colornameObjects", {})));
        
        // Default decoration logic when precedence is not active
        const colorname = markedFiles.get(uri.fsPath);
        if (colorname && !colornameObjects.get(colorname)?.precedence) {
            return this._createFileDecoration(uri, markedFiles, colornameObjects);
        }

        return null;
    }

    _createFileDecoration(uri, markedFiles, colornameObjects) {
        const colorname = markedFiles.get(uri.fsPath);
        const colornameObj = colornameObjects.get(colorname);

        return {
            color: new vscode.ThemeColor(colorname),
            badge: colornameObj.badge ?? vscode.workspace.getConfiguration().get('markee.badge', 'M'),
            tooltip: colorname,
            propagate: colornameObj.propagate,
        }
    }

    refresh(uri) {
        this._onDidChangeFileDecorations.fire(uri);
    }

    refreshAll() {
        this._onDidChangeFileDecorations.fire();
    }
}

module.exports = DecorationProvider;