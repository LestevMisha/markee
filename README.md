# Markee VS Code Extension

**Markee** is a Visual Studio Code extension that allows you to visually mark and highlight files with custom colors. Files can be marked with different colors, and the marked files are highlighted with badges and tooltips in the Explorer view. 

> Extension was made for quick identification, workspace organization and projects efficiency.

## Features

- Mark files with up to 50 customizable colors.
- Quick access to 5 primary colors from the Explorer.
- Customizable color palette for file marking.
- Persist file marks across sessions using global storage.
- Display badges and tooltips for marked files.
- Customizable badge symbols.
  
### Commands

Feature 1. Mark or unmark files
> Commands used in the video:
- `>markee /markcolor1`
- `>markee /markcolor2`
- `>markee /markcolor3`
- `>markee /markcolor4`
- `>markee /markcolor5`
- `>markee /unmark`

> [!IMPORTANT]  
> If you initialize a Git repository, you will have to reload VS Code due to the complexities we currently experience with this issue (note that in some cases even reload won't help). Hopefully, we will solve it in the future. Please refer to the details [here](#contributions-and-complexities).

![Mark or unmark files](materials/1-mark-unmark-files.gif)

Feature 2. Change file's badge
> Commands used in the video:
- `>markee /changeBadge`

![Change file's badge](materials/2-change-files-badge.gif)

Feature 3. Add or remove exlorer items
> Commands used in the video:
- `>markee /deleteExplorerItem`
- `>markee /addExplorerItem`

![Add or remove exlorer items](materials/3-add-remove-explorer-items.gif)

Feature 4. Select dropdown colors
> Commands used in the video:
- `>markee /select`

![Select dropdown colors](materials/4-select-dropdown-colors.gif)

Feature 5. Change hex colors
> Commands used in the video:
- `>markee /editColors`

![Change hex colors](materials/5-change-hex-colors.gif)

### Overall Commands:

- **Explorer Context Menu**:
  - `>markee /markcolor1`
  - `>markee /markcolor2`
  - `>markee /markcolor3`
  - `>markee /markcolor4`
  - `>markee /markcolor5`
  - `>markee /unmark`
  - `>markee /select`
  
- **Command Palette** (`Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on macOS):
  - `>markee /editColors`
  - `>markee /deleteExplorerItem`
  - `>markee /addExplorerItem`
  - `>markee /changeBadge`

## Contributions and Complexities

There are certain aspects I would love to work on, but they turned out to be very complex in nature. Here are the specific areas of the project I have struggled with:

1. **Visibility of Markees**  
   When a Git repository is initialized, markees are not visible; although the badges appear, the colors do not display properly due to Git's default color settings (modified, added, etc.). The only workaround currently is to reload Visual Studio Code, which is not ideal.

2. **Default Colors for Warnings and Errors**  
   I did not find the way around with the default colors for warnings, errors, etc. These colors take precedence and are displayed regardless of user settings.

3. **FINAL - Custom Settings for Markees**  
   If the above issues can be resolved, I propose adding four custom settings for each markee when the command `>markee /editColors` is used:
   - **Priority Parameter**: Add a `priority` field (ranging from 0 to 5).
   - **Propagate Parameter**: Introduce a `propagate` field (true/false) to control color propagation to parent folders.
   - **Custom Badge Selection**: Allow users to choose a custom badge.
   - **Default Color Hex Input**: Retain the default color hex input as it is.

If we can do it, that will be a great good for others!
> [!NOTE]  
> "Therefore, whatever you want men to do to you, do also to them, for this is the Law and the Prophets."


## Requirements

No external dependencies.

## For more information
My email is lestev.mi@gmail.com

## To Support
There's no greater support than to read this [book](https://m.egwwritings.org/en/book/130.4), thank you.