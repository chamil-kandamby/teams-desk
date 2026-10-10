'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const FILE = path.join(os.homedir(), '.config', 'autostart', 'teams-desk.desktop');

function isEnabled() {
  return fs.existsSync(FILE);
}

// launcher: absolute path of bin/teams-desk.
function setEnabled(enabled, launcher) {
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
    `Exec="${launcher}" --hidden`,
    'Icon=teams-desk',
    'X-GNOME-Autostart-enabled=true',
    'NoDisplay=true',
    '',
  ].join('\n'));
}

module.exports = { isEnabled, setEnabled };
