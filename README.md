# Teams Desk

A small Electron wrapper around the Microsoft Teams web app, built for GNOME on
Wayland (Fedora), with a Windows build too. Unofficial and not affiliated with
Microsoft.

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
- Unread count on the launcher: Unity launcher count on Linux docks that show it
  (Dash to Dock, Ubuntu Dock), taskbar overlay badge on Windows.
- Camera, microphone and screen sharing: the GNOME/portal picker on Linux, a
  built-in screen/window picker on Windows (with system audio when Teams asks
  for it).
- Asks before closing a window that is in a call.
- Close to tray (falls back to minimise when no tray is available).
- Start on login, hidden in the tray (tray menu toggle).
- Spellcheck with suggestions, context menu, zoom, remembered window size.
- Renderer crash and failed-load recovery.
- External links open in your default browser; Microsoft sign-in (including
  federated SSO) stays in-app.

## Install

Download from [Releases](https://github.com/chamil-kandamby/teams-desk/releases/latest)
(`SHA256SUMS` lists the checksums).

| System | File | Install |
| --- | --- | --- |
| Fedora / RHEL | `teams-desk-*-x86_64.rpm` | `sudo dnf install ./teams-desk-*.rpm` |
| Debian / Ubuntu | `teams-desk-*-amd64.deb` | `sudo apt install ./teams-desk-*.deb` |
| Any Linux | `teams-desk-*-x86_64.AppImage` | `chmod +x` and run (needs `libfuse.so.2`: `sudo dnf install fuse-libs`, or run with `--appimage-extract-and-run`) |
| Any Linux | `teams-desk-*-x64.tar.gz` | Extract and run `teams-desk` |
| Windows 10/11 | `teams-desk-*-win-setup-x64.exe` | Run the installer |
| Windows (portable) | `teams-desk-*-win-x64.zip` | Extract and run `TeamsDesk.exe` |

The Windows builds are not code-signed, so SmartScreen will warn on first run
(*More info → Run anyway*).

GNOME needs the *AppIndicator and KStatusNotifierItem Support* extension for any
tray icon (Fedora ships it as `gnome-shell-extension-appindicator`).

App data lives in `~/.config/teams-desk` (Linux) or `%APPDATA%\teams-desk` (Windows).

### From source (Linux)

Requires Node.js 22+.

```bash
scripts/install.sh                    # npm ci, fetch Electron, desktop entry + icons
scripts/install.sh --default-handler  # also open msteams: links in Teams Desk
scripts/install.sh --uninstall
```

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
- On Linux, passkeys / security keys can't be used to sign in (Electron has no
  WebAuthn UI there). The app reports WebAuthn as unsupported so Microsoft
  offers other methods instead (Authenticator approval, code, password).
  Windows uses Windows Hello as normal.
- On Windows, `msteams:` links are not registered (they belong to the official
  Teams app if it is installed).

## Development

```bash
npm ci && node node_modules/electron/install.js
npm start          # run from the source tree
npm test           # unit tests (URL handling, unread parsing)
npm run icons      # regenerate assets/ (needs Pillow)
npm run dist       # Linux packages into dist/ (dist:win for Windows)
```

Pushing a `v*` tag builds Linux and Windows packages in GitHub Actions and
attaches them to a draft release.

## License

MIT
