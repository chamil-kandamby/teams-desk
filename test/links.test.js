'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const links = require('../src/links');
const { parseUnread } = require('../src/unread');

const MEETING = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%22Tid%22%3a%22x%22%7d';

test('trusted origins', () => {
  assert.ok(links.isTrusted('https://teams.cloud.microsoft/'));
  assert.ok(links.isTrusted('https://login.microsoftonline.com/common/oauth2'));
  assert.ok(links.isTrusted('https://contoso.sharepoint.com/sites/x'));
  assert.ok(!links.isTrusted('http://teams.microsoft.com/'));
  assert.ok(!links.isTrusted('https://evil-microsoft.com/'));
  assert.ok(!links.isTrusted('https://microsoft.com.evil.net/'));
  assert.ok(!links.isTrusted('not a url'));
  assert.ok(!links.isTrusted(undefined));
});

test('teams and auth hosts', () => {
  assert.ok(links.isTeams('https://teams.microsoft.com/v2/'));
  assert.ok(links.isTeams('https://teams.live.com/'));
  assert.ok(!links.isTeams('https://outlook.office.com/'));
  assert.ok(links.isAuth('https://login.live.com/oauth20_authorize.srf'));
  assert.ok(!links.isAuth('https://teams.microsoft.com/'));
});

test('meeting links', () => {
  assert.ok(links.isMeeting(MEETING));
  assert.ok(links.isMeeting('https://teams.microsoft.com/meet/2541234567?p=abc'));
  assert.ok(links.isMeeting('https://teams.microsoft.com/_#/l/meetup-join/19:meeting_abc@thread.v2/0'));
  assert.ok(!links.isMeeting('https://teams.microsoft.com/l/chat/0/0?users=a@b.com'));
  assert.ok(!links.isMeeting('https://example.com/l/meetup-join/x'));
});

test('msteams deep links become https', () => {
  assert.equal(links.toTeamsUrl('msteams:/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=x'),
    'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=x');
  assert.equal(links.toTeamsUrl('msteams://teams.microsoft.com/l/chat/0/0?users=a'),
    'https://teams.microsoft.com/l/chat/0/0?users=a');
  assert.equal(links.toTeamsUrl('MSTEAMS:l/meetup-join/x'), 'https://teams.microsoft.com/l/meetup-join/x');
  assert.equal(links.toTeamsUrl(MEETING), MEETING);
  assert.equal(links.toTeamsUrl('--hidden'), null);
  assert.equal(links.toTeamsUrl('/home/user/teams-desk'), null);
  assert.equal(links.toTeamsUrl('https://example.com/'), null);
});

test('finds a meeting link inside invite text', () => {
  const invite = `Microsoft Teams meeting\nJoin on your computer: <${MEETING}>\nMeeting ID: 123`;
  assert.equal(links.findTeamsLink(invite), MEETING);
  assert.equal(links.findTeamsLink('nothing here'), null);
  assert.equal(links.findTeamsLink(''), null);
});

test('unread count from title', () => {
  assert.equal(parseUnread('(6) Chat | CS7050NM_A1_Individual_Report | Microsoft Teams'), 6);
  assert.equal(parseUnread('(99+) Activity | Microsoft Teams'), 99);
  assert.equal(parseUnread('Chat | Microsoft Teams'), 0);
  assert.equal(parseUnread('Meeting (2) | Microsoft Teams'), 0);
  assert.equal(parseUnread(''), 0);
  assert.equal(parseUnread(undefined), 0);
});
