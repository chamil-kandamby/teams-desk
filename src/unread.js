'use strict';

// Teams puts the unread count at the front of the page title, e.g.
// "(6) Chat | Some chat | Microsoft Teams" or "(99+) Activity | ...".
function parseUnread(title) {
  const match = /^\((\d+)\+?\)/.exec(title || '');
  return match ? Number(match[1]) : 0;
}

module.exports = { parseUnread };
