# Using Partyfinder

[Back to README](../README.md)

## What it does

- Browse volumes, folders, and files with breadcrumbs, parent navigation, browser back/forward, and recent folders.
- Search just the current directory, or include all its descendants (the default).
- Match a literal phrase anywhere in a filename. No query syntax or quoting required. `foo bar` means those adjacent words; `%`, `_`, quotes, and stars are treated literally.
- Keep strict directory boundaries: `/movies` never includes `/movies-old`.
- Switch list/grid views, sort by name/size/date, filter files/folders, and load more results.
- Choose System, Light, or Dark appearance; System follows OS changes automatically. The preference persists in this browser and also applies to sign-in.
- Right-click a file or folder (or use its **…** button) for permission-aware rename and delete actions. Folder deletion requires operator opt-in; see [deletion safety](#rename-and-delete).
- Open the current folder or individual files in Copyparty, or download through the authenticated proxy, including HTTP Range support.
- Sign in with a Copyparty password or browse anonymously when allowed. No uploads, cross-directory moves, rescans, or administrative operations are exposed.

## How search behaves

**Include subfolders off:** fetch the current directory's complete listing and match immediate files **and folders**. This works without an index.

**Include subfolders on:** query Copyparty's existing index for matching **files** in the current directory and descendants. Standalone folder matches, empty folders, unindexed files, and document contents are not indexed file-search results. Enable `e2dsa` in Copyparty and keep its index up to date. Dotfiles follow Copyparty's listing/search policies.

Matching ignores ASCII letter case, consistently with Copyparty's default search. Non-ASCII characters are matched literally; Partyfinder does not promise broader Unicode case folding even if the server enables it.

Copyparty has no offset-based search pagination. “Load more results” reruns the query with a larger candidate limit, starting at 250 and stopping at 8,000. The server also has its own limit (`--srch-hits`, normally 7,999), which may be lower. Its API can report `trunc: false` when that hard limit is reached, so counts are **results returned**, never a guaranteed total. Narrow the phrase or enter a deeper directory if necessary. Queries containing SQL wildcard characters retrieve broader candidates and are filtered literally afterward, so their candidate limits may be reached sooner.

Search URLs preserve the directory, phrase, and recursion choice. Opening a result's parent folder exits search; browser Back restores the search.

## Keyboard

The file listing is a single tab stop, like a real file manager: Tab reaches it once, then the arrow keys move within it. Press **?** — or **Keyboard shortcuts** at the bottom of the sidebar — to see this list in the app.

| Keys                    | What they do                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                     | Focus the search box.                                                                                                                                                  |
| `Esc`                   | Clear the search when it is focused or showing results; close an open menu or dialog.                                                                                  |
| `Alt`+`↑`               | Open the parent folder.                                                                                                                                                |
| `?`                     | Open the keyboard shortcuts dialog.                                                                                                                                    |
| `↑` `↓`                 | Move to the previous/next row. In grid view they move by a whole row of cards.                                                                                         |
| `←` `→`                 | List view: step through the focused row's own controls (download, open, **…**) and back out to the row. Grid view: move one card left or right.                        |
| `Enter`                 | Open the focused entry — folders open in place, files open in Copyparty.                                                                                               |
| `Space`                 | Select or deselect the focused row.                                                                                                                                    |
| `Home` `End`            | First or last row.                                                                                                                                                     |
| `PageUp` `PageDown`     | Move ten rows.                                                                                                                                                         |
| `Shift`+`F10`, menu key | Open the entry menu for the focused row.                                                                                                                               |
| Letters                 | Type-ahead: jump to the next entry whose name starts with what you type. Case- and accent-insensitive, so `o` finds `Ölfilter`. The buffer clears after a short pause. |

A **Skip to file list** link is the first thing Tab reaches on every page. Sort headers stay in the tab order, so the table can be re-sorted from the keyboard alone. Inside the entry menu and the rename/delete dialogs, focus is trapped until you close them, and it returns to the row you came from — including after a rename.

## Rename and delete

Right-click a row/card, use its **…** button (including on mobile), or focus an item and press **Shift+F10**. Arrow keys navigate the menu, first letters jump between its items, and Escape dismisses it. Permissions are checked for the selected item's actual location, including recursive-search results, then rechecked server-side before each operation. Copyparty remains the final authority and can deny actions through its configuration or hooks.

Rename stays in the same directory and requires read/move permissions plus write permission on the destination. Existing names are rejected, including case-only renames. Names cannot contain slashes, backslashes, control characters, or exceed 255 UTF-8 bytes. Root and top-level locations are protected. Copyparty also rejects moving mountpoints and folders containing mounted volumes. Directory renames are **not transactional**: another client can change the destination after the preflight check; upstream failure can leave partial changes. Refresh and inspect before retrying.

File deletion requires read/delete permissions and an explicit confirmation. **Deletion is permanent; Partyfinder has no undo or recycle bin.** The app re-lists the parent to verify disappearance rather than treating every HTTP 200 as a completed deletion. Verification errors or upstream failures can follow partial changes; inspect the directory before retrying.

Folder deletion is off by default because Copyparty can recursively delete hidden files and traverse nested mounted volumes, and its listing API does not reliably identify every mountpoint. To accept that behavior, set `ALLOW_FOLDER_DELETE=true` in your Portainer stack environment and update the stack, or change `.env` and run `docker compose up -d`. The confirmation requires typing the exact folder name and warns about hidden contents and nested volumes. Top-level locations remain blocked; do not treat this as complete nested-volume protection. Keep backups and restrict Copyparty delete permissions accordingly.
