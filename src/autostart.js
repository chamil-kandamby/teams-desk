'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');

// Linux: an XDG autostart entry. Windows/macOS: the OS login item.
const FILE = path.join(os.homedir(), '.config', 'autostart', 'teams-desk.desktop');
const ARGS = ['--hidden'];

function isEnabled() {
  if (process.platform !== 'linux') return app.getLoginItemSettings({ args: ARGS }).openAtLogin;
  return fs.existsSync(FILE);
}

// launcher: command that starts the app (only used on Linux).
function setEnabled(enabled, launcher) {
  if (process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: enabled, args: ARGS });
    return;
  }
  if (!enabled) {
    fs.rmSync(FILE, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Teams Desk',
    'Comment=Start Teams Desk in the tray',
    `Exec="${launcher}" ${ARGS.join(' ')}`,
    'Icon=teams-desk',
    'X-GNOME-Autostart-enabled=true',
    'NoDisplay=true',
    '',
  ].join('\n'));
}

module.exports = { isEnabled, setEnabled };
