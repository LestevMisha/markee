const vscode = require('vscode'); // Import vscode module

class DecorationProvider {
    constructor(context) {
        this._onDidChangeFileDecorations = new vscode.EventEmitter();
        this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
        this.context = context;
    }

    // This function is called to provide decorations for files
    provideFileDecoration(uri) {
        const markedFiles = new Map(Object.entries(this.context.globalState.get("markee.markedFiles", {})));
        const colornameObjects = new Map(Object.entries(this.context.globalState.get("markee.colornameObjects", {})));
        

        if (markedFiles.get(uri.fsPath) !== this.colorname) return;
        if (markedFiles.has(uri.fsPath)) {

            const colornameObj = colornameObjects.get(this.colorname);
            return {
                color: new vscode.ThemeColor(this.colorname),
                badge: colornameObj.badge ?? vscode.workspace.getConfiguration().get('markee.badge', 'M'),
                tooltip: this.colorname,
                propagate: colornameObj.propagate,
            }
        }
        return null;
    }

    refresh(uri, colorname = "") {
        this.colorname = colorname;
        this._onDidChangeFileDecorations.fire(uri);
    }

    refreshAll() {
        this._onDidChangeFileDecorations.fire();
    }
}

module.exports = DecorationProvider;
module.exports = DecorationProvider;