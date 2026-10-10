'use strict';

const path = require('path');
const { BrowserWindow, Menu, clipboard, dialog, shell } = require('electron');
const links = require('./links');

const PARTITION = 'persist:teams';
const ICON = path.join(__dirname, '..', 'assets', 'icon-256.png');
const PRELOAD = path.join(__dirname, 'preload.js');
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

// Owns the main Teams window plus any number of extra windows (meetings,
// additional Teams windows, sign-in popups). All share one signed-in session.
class WindowManager {
  constructor({ settings, canHideToTray, onTitle, onChange, onQuitRequest }) {
    this.settings = settings;
    this.canHideToTray = canHideToTray;
    this.onTitle = onTitle;
    this.onChange = onChange;
    this.onQuitRequest = onQuitRequest;
    this.main = null;
    this.extras = new Set();
    this.quitting = false;
  }

  isPrimary(webContents) {
    return Boolean(webContents && this.main && webContents === this.main.webContents);
  }

  // Meeting and secondary Teams windows (not sign-in popups).
  extraWindows() {
    return [...this.extras].filter((w) => !w.isDestroyed());
  }

  createMain({ url, show }) {
    const size = this.settings.get('main');
    const win = new BrowserWindow({
      ...baseOptions(this.settings.get('zoom')),
      width: size.width,
      height: size.height,
      title: 'Teams Desk',
      show: false,
    });
    this.main = win;
    if (size.maximized) win.maximize();
    if (show) win.once('ready-to-show', () => this.show(win));

    win.on('close', (event) => {
      if (this.quitting) return;
      event.preventDefault();
      if (this.canHideToTray()) win.hide();
      else win.minimize();
    });
    const saveSize = () => {
      if (win.isDestroyed()) return;
      const maximized = win.isMaximized();
      const bounds = maximized ? this.settings.get('main') : { ...win.getBounds(), maximized: false };
      this.settings.set('main', { width: bounds.width, height: bounds.height, maximized });
    };
    win.on('resize', saveSize);
    win.on('maximize', saveSize);
    win.on('unmaximize', saveSize);
    win.on('show', () => this.onChange());
    win.on('hide', () => this.onChange());
    win.webContents.on('page-title-updated', (_e, title) => this.onTitle(title));

    this.attach(win, { kind: 'main' });
    win.loadURL(url || links.START_URL);
    return win;
  }

  // kind: 'call' for meeting links, 'window' for an extra Teams window.
  openWindow(url, kind = 'window') {
    const size = this.settings.get('call');
    const win = new BrowserWindow({
      ...baseOptions(this.settings.get('zoom')),
      width: size.width,
      height: size.height,
      title: kind === 'call' ? 'Teams meeting' : 'Teams',
    });
    this.track(win, kind);
    win.loadURL(url || links.START_URL);
    win.once('ready-to-show', () => this.show(win));
    return win;
  }

  track(win, kind) {
    this.extras.add(win);
    win.on('page-title-updated', () => this.onChange());
    win.on('resize', () => {
      if (!win.isMaximized() && !win.isDestroyed()) {
        const { width, height } = win.getBounds();
        this.settings.set('call', { width, height });
      }
    });
    win.on('closed', () => {
      this.extras.delete(win);
      this.onChange();
    });
    this.attach(win, { kind });
    this.onChange();
  }

  show(win = this.main) {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    // Wayland ignores focus() on an already-mapped window without an activation
    // token; GNOME does focus a freshly mapped one, so re-map it.
    if (win.isVisible() && !win.isFocused()) win.hide();
    win.show();
    win.focus();
  }

  toggleMain() {
    if (this.main.isVisible() && this.main.isFocused()) this.main.hide();
    else this.show(this.main);
  }

  setZoom(factor) {
    this.settings.set('zoom', factor);
    for (const w of BrowserWindow.getAllWindows()) w.webContents.setZoomFactor(factor);
  }

  stepZoom(direction) {
    const current = this.settings.get('zoom');
    const idx = ZOOM_STEPS.findIndex((z) => z >= current - 0.001);
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (idx < 0 ? 5 : idx) + direction))];
    this.setZoom(next);
  }

  // Behaviour shared by every Teams window.
  attach(win, { kind }) {
    const wc = win.webContents;

    wc.setWindowOpenHandler(({ url }) => {
      if (links.isMeeting(url)) {
        this.openWindow(url, 'call');
        return { action: 'deny' };
      }
      if (url === 'about:blank' || links.isAuth(url) || links.isTeams(url)) {
        return { action: 'allow', overrideBrowserWindowOptions: { ...baseOptions(this.settings.get('zoom')), width: 1000, height: 720 } };
      }
      openExternal(url);
      return { action: 'deny' };
    });

    wc.on('did-create-window', (child, { url }) => {
      if (links.isTeams(url)) this.track(child, 'window');
      else this.attachPopup(child, url);
    });

    wc.on('will-navigate', (event, url) => {
      if (/^https?:/i.test(url)) return; // full-page sign-in redirects (incl. federated IdPs)
      event.preventDefault();
      const teamsUrl = links.toTeamsUrl(url);
      if (teamsUrl && links.isMeeting(teamsUrl) && kind !== 'call') this.openWindow(teamsUrl, 'call');
      else if (/^mailto:/i.test(url)) openExternal(url);
      // other schemes (including msteams: from the meeting launcher page) are dropped
    });

    // Teams sets beforeunload while in a meeting.
    wc.on('will-prevent-unload', (event) => {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Leave', 'Stay'],
        defaultId: 1,
        cancelId: 1,
        title: 'Leave Teams?',
        message: 'Teams is asking to stay open.',
        detail: 'You may be in a call or have unsent changes. Leaving will end the call in this window.',
      });
      if (choice === 0) event.preventDefault();
      else this.quitting = false;
    });

    wc.on('render-process-gone', (_e, details) => {
      console.error(`[window:${kind}] renderer gone: ${details.reason}`);
      if (details.reason !== 'clean-exit' && !win.isDestroyed()) setTimeout(() => !win.isDestroyed() && wc.reload(), 2000);
    });
    wc.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
      if (!isMainFrame || code === -3) return; // -3: aborted by a redirect
      console.error(`[window:${kind}] load failed (${description}), retrying`);
      setTimeout(() => !win.isDestroyed() && wc.loadURL(url), 5000);
    });

    wc.on('context-menu', (_e, params) => {
      const menu = contextMenu(wc, params, (url) => this.openWindow(url, 'call'));
      if (menu) menu.popup({ window: win });
    });

    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const action = shortcut(input);
      if (!action) return;
      event.preventDefault();
      switch (action) {
        case 'quit': this.onQuitRequest(); break;
        case 'close': win.close(); break;
        case 'new-window': this.openWindow(null, 'window'); break;
        case 'zoom-in': this.stepZoom(1); break;
        case 'zoom-out': this.stepZoom(-1); break;
        case 'zoom-reset': this.setZoom(1); break;
        case 'reload': wc.reload(); break;
        case 'hard-reload': wc.reloadIgnoringCache(); break;
        case 'devtools': wc.toggleDevTools(); break;
        case 'fullscreen': win.setFullScreen(!win.isFullScreen()); break;
      }
    });
  }

  // Sign-in (or about:blank) popups. Popups that turn out not to be a sign-in
  // flow and leave Microsoft are handed to the browser instead.
  attachPopup(child, firstUrl) {
    let signingIn = links.isAuth(firstUrl);
    child.webContents.on('will-navigate', (event, url) => {
      if (links.isAuth(url)) signingIn = true;
      if (signingIn || links.isTrusted(url)) return;
      event.preventDefault();
      openExternal(url);
      child.close();
    });
    child.webContents.setWindowOpenHandler(({ url }) => {
      openExternal(url);
      return { action: 'deny' };
    });
  }
}

function baseOptions(zoom) {
  return {
    icon: ICON,
    minWidth: 480,
    minHeight: 400,
    autoHideMenuBar: true,
    backgroundColor: '#1f1f1f',
    webPreferences: {
      preload: PRELOAD,
      partition: PARTITION,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false,
      zoomFactor: zoom,
    },
  };
}

function openExternal(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
}

function shortcut(input) {
  const ctrl = input.control || input.meta;
  const key = input.key.toLowerCase();
  if (input.key === 'F5') return input.shift ? 'hard-reload' : 'reload';
  if (input.key === 'F11') return 'fullscreen';
  if (input.key === 'F12') return 'devtools';
  if (!ctrl || input.alt) return null;
  if (input.shift) {
    if (key === 'n') return 'new-window';
    if (key === 'r') return 'hard-reload';
    if (key === 'i') return 'devtools';
    if (input.code === 'Equal') return 'zoom-in';
    return null;
  }
  if (key === 'q') return 'quit';
  if (key === 'w') return 'close';
  if (key === 'r') return 'reload';
  if (input.code === 'Equal' || input.code === 'NumpadAdd') return 'zoom-in';
  if (input.code === 'Minus' || input.code === 'NumpadSubtract') return 'zoom-out';
  if (input.code === 'Digit0' || input.code === 'Numpad0') return 'zoom-reset';
  return null;
}

function contextMenu(wc, p, openCall) {
  const sections = [];
  if (p.misspelledWord) {
    sections.push([
      ...p.dictionarySuggestions.slice(0, 5).map((s) => ({ label: s, click: () => wc.replaceMisspelling(s) })),
      { label: 'Add to dictionary', click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) },
    ]);
  }
  if (/^https?:/i.test(p.linkURL)) {
    const link = [];
    if (links.isMeeting(p.linkURL)) link.push({ label: 'Join meeting in new window', click: () => openCall(p.linkURL) });
    link.push(
      { label: 'Open link in browser', click: () => shell.openExternal(p.linkURL) },
      { label: 'Copy link', click: () => clipboard.writeText(p.linkURL) },
    );
    sections.push(link);
  }
  if (p.mediaType === 'image') {
    sections.push([{ label: 'Copy image', click: () => wc.copyImageAt(p.x, p.y) }]);
  }
  if (p.isEditable) {
    sections.push([
      { role: 'cut', enabled: p.editFlags.canCut },
      { role: 'copy', enabled: p.editFlags.canCopy },
      { role: 'paste', enabled: p.editFlags.canPaste },
      { role: 'selectAll' },
    ]);
  } else if (p.selectionText) {
    sections.push([{ role: 'copy' }]);
  }
  if (!sections.length) return null;
  const template = sections.flatMap((s, i) => (i ? [{ type: 'separator' }, ...s] : s));
  return Menu.buildFromTemplate(template);
}

module.exports = { WindowManager, PARTITION, shortcut };
