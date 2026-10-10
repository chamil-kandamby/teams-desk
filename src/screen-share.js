'use strict';

const path = require('path');
const { BrowserWindow, desktopCapturer, ipcMain } = require('electron');

const PICKER_DIR = path.join(__dirname, 'picker');
let pickerOpen = false;

// Resolves to the chosen DesktopCapturerSource, or null if cancelled.
//
// On Linux (Wayland), getSources() itself opens the xdg-desktop-portal picker
// and returns only the source the user chose. Elsewhere it returns every
// screen and window, so the user picks in our own window.
async function chooseSource(parent) {
  if (process.platform === 'linux') {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    return sources[0] || null;
  }
  if (pickerOpen) return null;
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
  });
  return pick(sources, parent);
}

function pick(sources, parent) {
  pickerOpen = true;
  const items = sources.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.id.startsWith('screen:') ? 'screen' : 'window',
    thumbnail: s.thumbnail.toDataURL(),
  }));
  const win = new BrowserWindow({
    parent: parent || undefined,
    modal: Boolean(parent),
    width: 780,
    height: 560,
    title: 'Share your screen',
    autoHideMenuBar: true,
    backgroundColor: '#1f1f1f',
    webPreferences: {
      preload: path.join(PICKER_DIR, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  return new Promise((resolve) => {
    let done = false;
    const finish = (id) => {
      if (done) return;
      done = true;
      pickerOpen = false;
      ipcMain.removeHandler('picker:sources');
      ipcMain.removeAllListeners('picker:choose');
      if (!win.isDestroyed()) win.close();
      resolve(sources.find((s) => s.id === id) || null);
    };
    ipcMain.handle('picker:sources', (event) => (event.sender === win.webContents ? items : []));
    ipcMain.on('picker:choose', (event, id) => {
      if (event.sender === win.webContents) finish(id);
    });
    win.on('closed', () => finish(null));
    win.loadFile(path.join(PICKER_DIR, 'picker.html'));
  });
}

// Handler for session.setDisplayMediaRequestHandler.
function displayMediaHandler(isTrusted) {
  return (request, callback) => {
    if (!isTrusted(request.securityOrigin)) return callback({});
    chooseSource(BrowserWindow.getFocusedWindow())
      .then((source) => {
        if (!source) return callback({});
        const shareAudio = process.platform === 'win32' && request.audioRequested && source.id.startsWith('screen:');
        callback(shareAudio ? { video: source, audio: 'loopback' } : { video: source });
      })
      .catch((err) => {
        console.error('[share] screen picker failed:', err.message);
        callback({});
      });
  };
}

module.exports = { displayMediaHandler, pick };
