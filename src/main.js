'use strict';

const path = require('path');
const { app, BrowserWindow, Menu, Notification, clipboard, ipcMain, nativeImage, session } = require('electron');
const links = require('./links');
const autostart = require('./autostart');
const { parseUnread } = require('./unread');
const { Settings } = require('./settings');
const { DesktopBus } = require('./desktop-bus');
const { ResilientTray } = require('./tray');
const { WindowManager, PARTITION } = require('./windows');
const { setupSession } = require('./session');

const APP_ID = 'teams-desk';
const DESKTOP_ID = `${APP_ID}.desktop`;
const WINDOWS_APP_ID = 'io.github.chamil_kandamby.teams_desk'; // = build.appId; toasts need it
const LAUNCHER = path.resolve(__dirname, '..', 'bin', 'teams-desk');

// TEAMS_DESK_DATA_DIR runs a separate, isolated instance (e.g. to try a build
// while the normal one keeps running).
app.setPath('userData', process.env.TEAMS_DESK_DATA_DIR || path.join(app.getPath('appData'), APP_ID));

// Present as plain Chrome; Teams degrades features for browsers it doesn't recognise.
const chromeMajor = process.versions.chrome.split('.')[0];
const uaPlatform = process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64' : 'X11; Linux x86_64';
app.userAgentFallback = `Mozilla/5.0 (${uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
if (process.platform === 'win32') app.setAppUserModelId(WINDOWS_APP_ID);

const startHidden = process.argv.includes('--hidden');

let settings;
let windows;
let tray;
let bus = null;

// What "Start on login" runs: the AppImage, the installed binary, or the
// source-tree launcher.
function launchCommand() {
  if (process.env.APPIMAGE) return process.env.APPIMAGE;
  return app.isPackaged ? process.execPath : LAUNCHER;
}

function linkFromArgs(argv) {
  return argv.slice(1).map(links.toTeamsUrl).find(Boolean) || null;
}

function openLink(url) {
  if (links.isMeeting(url)) {
    windows.openWindow(url, 'call');
  } else {
    windows.main.loadURL(url);
    windows.show();
  }
}

function notify(body) {
  new Notification({ title: 'Teams Desk', body, icon: path.join(__dirname, '..', 'assets', 'icon-128.png') }).show();
}

function joinFromClipboard() {
  const url = links.findTeamsLink(clipboard.readText());
  if (url && links.isMeeting(url)) windows.openWindow(url, 'call');
  else notify('No Teams meeting link found on the clipboard.');
}

function shorten(text, max = 48) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function buildTrayMenu() {
  const extra = windows.extraWindows();
  return Menu.buildFromTemplate([
    { label: windows.main.isVisible() ? 'Show Teams' : 'Open Teams', click: () => windows.show() },
    ...(tray.count ? [{ label: `${tray.count} unread`, enabled: false }] : []),
    { type: 'separator' },
    { label: 'New Teams window', click: () => windows.openWindow(null, 'window') },
    { label: 'Join meeting from clipboard link', click: joinFromClipboard },
    ...(extra.length
      ? [{ type: 'separator' }, ...extra.map((w) => ({ label: shorten(w.getTitle() || 'Teams'), click: () => windows.show(w) }))]
      : []),
    { type: 'separator' },
    {
      label: 'Start on login',
      type: 'checkbox',
      checked: autostart.isEnabled(),
      click: (item) => autostart.setEnabled(item.checked, launchCommand()),
    },
    { label: 'Reload Teams', click: () => windows.main.reload() },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function onTitle(title) {
  const count = parseUnread(title);
  if (count === tray.count) return;
  tray.setCount(count);
  if (bus) bus.setLauncherCount(count);
  if (process.platform === 'win32') {
    const badge = count ? nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'badge', `badge-${Math.min(count, 10)}.png`)) : null;
    windows.main.setOverlayIcon(badge, count ? `${count} unread` : '');
  }
}

// Linux only: the tray watcher and the Unity launcher count live on D-Bus.
async function connectBus() {
  if (process.platform !== 'linux') {
    tray.setWatcherPresent(true);
    return;
  }
  bus = new DesktopBus(DESKTOP_ID);
  bus.on('watcher', (present) => {
    console.log(`[tray] StatusNotifierWatcher ${present ? 'appeared' : 'went away'}`);
    tray.setWatcherPresent(present);
  });
  try {
    tray.setWatcherPresent(await bus.connect());
  } catch (err) {
    console.error('[dbus] unavailable, tray will not self-heal:', err.message);
    bus = null;
    tray.setWatcherPresent(true);
  }
}

async function start() {
  Menu.setApplicationMenu(null);
  settings = new Settings(path.join(app.getPath('userData'), 'settings.json'), {
    main: { width: 1280, height: 860, maximized: false },
    call: { width: 1100, height: 760 },
    zoom: 1,
  });

  windows = new WindowManager({
    settings,
    canHideToTray: () => tray.available,
    onTitle,
    onChange: () => tray.refreshMenu(),
    onQuitRequest: () => app.quit(),
  });
  tray = new ResilientTray({ tooltip: 'Teams Desk', buildMenu: buildTrayMenu, onClick: () => windows.toggleMain() });

  setupSession(session.fromPartition(PARTITION), { isPrimary: (wc) => windows.isPrimary(wc) });

  ipcMain.on('teams-desk:focus', (event) => windows.show(BrowserWindow.fromWebContents(event.sender)));

  const link = linkFromArgs(process.argv);
  windows.createMain({ url: link && !links.isMeeting(link) ? link : links.START_URL, show: !startHidden });
  if (link && links.isMeeting(link)) windows.openWindow(link, 'call');

  await connectBus();

  // Started hidden but no tray ever showed up: don't leave the user with nothing.
  if (startHidden) setTimeout(() => !tray.available && windows.show(), 15000);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (!windows) return;
    const link = linkFromArgs(argv);
    if (link) openLink(link);
    else if (argv.includes('--new-window')) windows.openWindow(null, 'window');
    else windows.show();
  });
  app.on('before-quit', () => {
    if (windows) windows.quitting = true;
    if (settings) settings.flush();
  });
  app.whenReady().then(start);
}
