'use strict';

const { contextBridge, ipcRenderer } = require('electron');

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

// Electron has no WebAuthn UI on Linux (Windows has Windows Hello), so passkey /
// security-key prompts ("Face, fingerprint, PIN or security key") wait forever.
// Report WebAuthn as unsupported so Microsoft sign-in offers other methods.
function hideWebAuthn() {
  delete window.PublicKeyCredential;
  const creds = navigator.credentials;
  if (!creds) return;
  const unsupported = () => Promise.reject(new DOMException('WebAuthn is not available in this app', 'NotSupportedError'));
  const get = creds.get.bind(creds);
  const create = creds.create.bind(creds);
  creds.get = (options) => (options && options.publicKey ? unsupported() : get(options));
  creds.create = (options) => (options && options.publicKey ? unsupported() : create(options));
}

// Synchronous, so both are in place before any page script runs.
if (process.platform === 'linux') contextBridge.executeInMainWorld({ func: hideWebAuthn });
contextBridge.executeInMainWorld({ func: wrapNotification });
