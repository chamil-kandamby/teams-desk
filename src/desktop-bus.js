'use strict';

const { EventEmitter } = require('events');
const dbus = require('dbus-next');

const { Message, MessageType, Variant } = dbus;

const WATCHER = 'org.kde.StatusNotifierWatcher';
const DBUS = { destination: 'org.freedesktop.DBus', path: '/org/freedesktop/DBus', interface: 'org.freedesktop.DBus' };
const LAUNCHER_PATH = '/com/canonical/unity/launcherentry/teams_desk';

// Session-bus helper.
//
// Emits 'watcher' (boolean) whenever the StatusNotifierWatcher appears or
// disappears. GNOME's AppIndicator extension is disabled while the screen is
// locked, which drops the watcher; Electron then falls back to a dead X11 tray
// and never re-registers, so the owner of the tray has to rebuild it.
class DesktopBus extends EventEmitter {
  constructor(desktopId) {
    super();
    this.appUri = `application://${desktopId}`;
    this.bus = null;
  }

  // Resolves to whether the watcher is currently present.
  async connect() {
    this.bus = dbus.sessionBus();
    this.bus.on('error', (err) => console.error('[dbus]', err.message));
    this.bus.on('message', (msg) => {
      if (
        msg.type === MessageType.SIGNAL &&
        msg.interface === DBUS.interface &&
        msg.member === 'NameOwnerChanged' &&
        msg.body[0] === WATCHER
      ) {
        this.emit('watcher', Boolean(msg.body[2]));
      }
    });
    await this.bus.call(new Message({
      ...DBUS,
      member: 'AddMatch',
      signature: 's',
      body: [`type='signal',sender='org.freedesktop.DBus',interface='org.freedesktop.DBus',member='NameOwnerChanged',arg0='${WATCHER}'`],
    }));
    const reply = await this.bus.call(new Message({ ...DBUS, member: 'NameHasOwner', signature: 's', body: [WATCHER] }));
    return Boolean(reply.body[0]);
  }

  // Unity LauncherEntry badge, shown by Dash to Dock / Ubuntu Dock / KDE.
  setLauncherCount(count) {
    if (!this.bus) return;
    this.bus.send(new Message({
      type: MessageType.SIGNAL,
      path: LAUNCHER_PATH,
      interface: 'com.canonical.Unity.LauncherEntry',
      member: 'Update',
      signature: 'sa{sv}',
      body: [this.appUri, { count: new Variant('x', count), 'count-visible': new Variant('b', count > 0) }],
    }));
  }
}

module.exports = { DesktopBus };
