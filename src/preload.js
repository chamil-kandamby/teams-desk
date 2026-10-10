'use strict';

const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('teamsDesk', {
  focus: () => ipcRenderer.send('teams-desk:focus'),
});

// Runs in the page's world: clicking a desktop notification brings the window
// forward (Electron does not do this by itself when the window is hidden).
function wrapNotification() {
  const Native = window.Notification;
  if (!Native || Native.teamsDeskWrapped) return;
  class DeskNotification extends Native {
    constructor(title, options) {
      super(title, options);
      this.addEventListener('click', () => window.teamsDesk.focus());
    }
    static get permission() {
      return Native.permission;
    }
    static requestPermission(...args) {
      return Native.requestPermission(...args);
    }
  }
  DeskNotification.teamsDeskWrapped = true;
  window.Notification = DeskNotification;
}

webFrame.executeJavaScript(`(${wrapNotification.toString()})();`).catch(() => {});
