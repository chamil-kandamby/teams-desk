'use strict';

// URL classification for navigation, popups and permission grants.

const START_URL = 'https://teams.cloud.microsoft/';

const TEAMS_HOSTS = ['teams.microsoft.com', 'teams.cloud.microsoft', 'teams.live.com'];

// Hosts (and their subdomains) the Teams web app and Microsoft sign-in live on.
const TRUSTED_DOMAINS = [
  'teams.microsoft.com',
  'teams.cloud.microsoft',
  'teams.live.com',
  'cloud.microsoft',
  'microsoft.com',
  'microsoftonline.com',
  'live.com',
  'office.com',
  'office.net',
  'skype.com',
  'sharepoint.com',
  'msauth.net',
  'msftauth.net',
  'windows.net',
];

const AUTH_DOMAINS = [
  'login.microsoftonline.com',
  'login.microsoft.com',
  'login.live.com',
  'login.windows.net',
  'account.live.com',
  'device.login.microsoftonline.com',
];

function parse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function hostMatches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function isHttps(u) {
  return u && u.protocol === 'https:';
}

function isTrusted(url) {
  const u = parse(url);
  return Boolean(isHttps(u) && TRUSTED_DOMAINS.some((d) => hostMatches(u.hostname, d)));
}

function isTeams(url) {
  const u = parse(url);
  return Boolean(isHttps(u) && TEAMS_HOSTS.some((d) => hostMatches(u.hostname, d)));
}

function isAuth(url) {
  const u = parse(url);
  return Boolean(isHttps(u) && AUTH_DOMAINS.some((d) => hostMatches(u.hostname, d)));
}

function isMeeting(url) {
  const u = parse(url);
  if (!isTeams(url)) return false;
  return /^\/(l\/meetup-join|meet)\//.test(u.pathname) || /^#\/l\/meetup-join\//.test(u.hash);
}

// Turns msteams: deep links and bare Teams https links into a loadable https URL.
// Returns null for anything that is not a Teams link.
function toTeamsUrl(link) {
  if (typeof link !== 'string') return null;
  const trimmed = link.trim();
  if (/^msteams:/i.test(trimmed)) {
    let rest = trimmed.replace(/^msteams:/i, '');
    if (rest.startsWith('//')) rest = rest.replace(/^\/\/[^/]+/, '');
    if (!rest.startsWith('/')) rest = `/${rest}`;
    return `https://teams.microsoft.com${rest}`;
  }
  return isTeams(trimmed) ? parse(trimmed).toString() : null;
}

// Finds the first Teams link in a block of text (e.g. a meeting invite pasted
// from an email).
function findTeamsLink(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/(msteams:[^\s<>"']+|https:\/\/teams\.(?:microsoft\.com|cloud\.microsoft|live\.com)\/[^\s<>"']+)/i);
  return match ? toTeamsUrl(match[1]) : null;
}

module.exports = {
  START_URL,
  isTrusted,
  isTeams,
  isAuth,
  isMeeting,
  toTeamsUrl,
  findTeamsLink,
};
