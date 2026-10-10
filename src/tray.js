'use strict';

const path = require('path');
const { Tray, nativeImage } = require('electron');

const TRAY_DIR = path.join(__dirname, '..', 'assets', 'tray');

// A tray icon that is torn down and rebuilt whenever the StatusNotifierWatcher
// restarts, so it survives screen locks and GNOME Shell restarts.
class ResilientTray {
  constructor({ tooltip, buildMenu, onClick }) {
    this.tooltip = tooltip;
    this.buildMenu = buildMenu;
    this.onClick = onClick;
    this.tray = null;
    this.count = 0;
    this.rebuildTimer = null;
  }

  get available() {
    return this.tray !== null;
  }

  // Called with the watcher state; also usable without D-Bus (pass true).
  setWatcherPresent(present) {
    clearTimeout(this.rebuildTimer);
    if (!present) {
      this.destroy();
      return;
    }
    // Give the AppIndicator extension a moment to finish setting up its host.
    this.rebuildTimer = setTimeout(() => this.create(), 750);
  }

  create() {
    this.destroy();
    this.tray = new Tray(this.image());
    this.tray.setToolTip(this.tooltip);
    this.tray.on('click', () => this.onClick());
    this.refreshMenu();
    console.log('[tray] registered');
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      console.log('[tray] removed');
    }
  }

  setCount(count) {
    if (count === this.count) return;
    this.count = count;
    if (this.tray) {
      this.tray.setImage(this.image());
      this.tray.setToolTip(count ? `${this.tooltip} (${count} unread)` : this.tooltip);
      this.refreshMenu();
    }
  }

  refreshMenu() {
    if (this.tray) this.tray.setContextMenu(this.buildMenu());
  }

  image() {
    const n = Math.min(this.count, 10);
    return nativeImage.createFromPath(path.join(TRAY_DIR, `tray-${n}.png`));
  }
}

module.exports = { ResilientTray };
