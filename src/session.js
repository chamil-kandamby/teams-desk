'use strict';

const { app } = require('electron');
const links = require('./links');
const { displayMediaHandler } = require('./screen-share');

// Permissions granted to Teams/Microsoft origins only.
const GRANTED = new Set([
  'media',
  'display-capture',
  'notifications',
  'clipboard-read',
  'clipboard-sanitized-write',
  'fullscreen',
  'idle-detection',
  'speaker-selection',
  'storage-access',
  'top-level-storage-access',
]);

// isPrimary(webContents) tells whether the contents belong to the main window;
// only that window may raise notifications so extra windows don't duplicate them.
function setupSession(ses, { isPrimary }) {
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (permission === 'notifications' && !isPrimary(wc)) return callback(false);
    const origin = details.requestingUrl || (wc && wc.getURL());
    callback(GRANTED.has(permission) && links.isTrusted(origin));
  });

  ses.setPermissionCheckHandler((wc, permission, requestingOrigin) => {
    if (permission === 'notifications' && wc && !isPrimary(wc)) return false;
    return GRANTED.has(permission) && links.isTrusted(requestingOrigin);
  });

  ses.setDisplayMediaRequestHandler(displayMediaHandler(links.isTrusted));

  const wanted = app.getPreferredSystemLanguages();
  const available = new Set(ses.availableSpellCheckerLanguages);
  const languages = wanted.filter((l) => available.has(l));
  ses.setSpellCheckerLanguages(languages.length ? languages : ['en-US']);
}

module.exports = { setupSession };
