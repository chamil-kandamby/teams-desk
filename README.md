# Teams Desk

A small Electron wrapper around the Microsoft Teams web app, built for GNOME on
Wayland (Fedora). Unofficial and not affiliated with Microsoft.

## Why

`teams-for-linux` loses its tray icon after the first screen lock. GNOME disables
the AppIndicator extension while the screen is locked, which takes the
`org.kde.StatusNotifierWatcher` D-Bus service down with it; Electron's tray then
falls back to an X11 tray that GNOME never shows, and it never re-registers.

Teams Desk watches the watcher (`NameOwnerChanged`) and rebuilds its tray icon
every time it comes back, so the icon survives locks, unlocks and Shell restarts.

## Features

- Tray icon with unread count badge (from the Teams page title), left-click to
  show/hide, menu with window list.
- **Separate meeting windows**: meeting links (`msteams:` deep links,
  `https://teams.microsoft.com/l/meetup-join/...`, `.../meet/...`) open in their
  own window on the same signed-in session, so chat stays usable in the main
  window during a call. Also: *Join meeting from clipboard link* in the tray menu,
  and *Join meeting in new window* on a right-clicked meeting link.
- Extra Teams windows: `Ctrl+Shift+N`, tray menu, or the desktop file's
  *New Window* action. Only the main window raises notifications and drives the
  badge, so nothing is duplicated.
- Native notifications; clicking one brings its window forward.
- Unity launcher count for docks that show it (Dash to Dock, Ubuntu Dock).
- Camera, microphone and screen sharing (PipeWire / xdg-desktop-portal picker).
- Asks before closing a window that is in a call.
- Close to tray (falls back to minimise when no tray is available).
- Start on login, hidden in the tray (tray menu toggle).
- Spellcheck with suggestions, context menu, zoom, remembered window size.
- Renderer crash and failed-load recovery.
- External links open in your default browser; Microsoft sign-in (including
  federated SSO) stays in-app.

## Install

Requires Node.js 22+.

```bash
scripts/install.sh                    # npm ci, fetch Electron, desktop entry + icons
scripts/install.sh --default-handler  # also open msteams: links in Teams Desk
scripts/install.sh --uninstall
```

Then start **Teams Desk** from the app grid. App data lives in `~/.config/teams-desk`.

GNOME needs the *AppIndicator and KStatusNotifierItem Support* extension for any
tray icon (Fedora ships it as `gnome-shell-extension-appindicator`).

## Shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl+Shift+N` | New Teams window |
| `Ctrl+W` | Close window (main window goes to the tray) |
| `Ctrl+Q` | Quit |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset |
| `F5` / `Ctrl+R` | Reload (`Shift` for a hard reload) |
| `F11` | Full screen |
| `F12` / `Ctrl+Shift+I` | Developer tools |

Teams' own shortcuts (e.g. `Ctrl+Shift+M` to mute) work as usual.

## Limits

- A call can't be moved between windows once it has started; it stays in the
  window where you joined. Use a meeting link (or the clipboard action) to join
  in a separate window from the start.
- Teams' meeting launcher page may ask how to join; choose *Continue on this
  browser*.
- System audio sharing isn't available on Linux.

## Development

```bash
npm ci && node node_modules/electron/install.js
npm start          # run from the source tree
npm test           # unit tests (URL handling, unread parsing)
npm run icons      # regenerate assets/ (needs Pillow)
```

## License

MIT
