/**
 * BuenasxPickle <-> Google Sheets
 * -----------------------------
 * Paste this into Apps Script on the spreadsheet you want sessions kept in,
 * set SECRET below, deploy it as a Web App, and give BuenasxPickle the URL.
 * Setup steps are in sheets/README.md.
 *
 * It does two jobs:
 *
 *   POST  - BuenasxPickle sends a session; this appends to three tabs, creating
 *           them with headings on first use:
 *             Sessions - one row each time a session is saved
 *             Players  - one row per player, per save
 *             Badges   - one row per Top 3 badge, with its code and batch
 *           Re-saving a session replaces its earlier rows, so a session stays
 *           one row however many times it is sent.
 *
 *   GET   - the public Top List page asks for the winners; this returns every
 *           session's players and every minted badge as JSON. No secret is
 *           needed to read, because that is the point of a published list.
 *           Writing still needs the secret.
 *
 * The Badges tab is the record of who holds a badge. Nothing is kept in a
 * committed file any more: the spreadsheet is the only store, and the batch
 * number is assigned here, because only this sheet knows how many sessions
 * came before.
 *
 * Columns are matched by heading, not by position, so adding a column by hand
 * or picking up a sheet from an older version will not shift the data.
 */

// Change this to any phrase you like, then put the same phrase in BuenasxPickle.
// The web app has to be reachable by anyone for a browser to use it, so this
// is what stops a stranger who finds the URL from writing to your sheet.
var SECRET = 'change-me';

// One colour per session, so a glance at the sheet shows where a session
// starts and ends. Picked from the session id, so the same session always
// gets the same colour.
var ROW_COLOURS = ['#e8f0fe', '#e6f4ea', '#fef7e0', '#fce8e6', '#f3e8fd',
                   '#e4f7fb', '#fff0e6', '#eef3e2', '#fdeaf4', '#eaeef6'];

function colourFor(session) {
  var sum = 0;
  var text = String(session);
  for (var i = 0; i < text.length; i++) sum = (sum * 31 + text.charCodeAt(i)) % 100000;
  return ROW_COLOURS[sum % ROW_COLOURS.length];
}

// Paints the rows that belong to one session, from `from` to the last row.
function paintRows(sheet, from, colour) {
  var last = sheet.getLastRow();
  if (last < from) return;
  sheet.getRange(from, 1, last - from + 1, Math.max(1, sheet.getLastColumn()))
    .setBackground(colour);
}

var SESSION_HEADERS = ['Saved at', 'Session', 'Date', 'Started at', 'Players',
  'Matches played', 'Courts', 'Games per player', 'Top 1', 'Top 2', 'Top 3'];
var PLAYER_HEADERS = ['Saved at', 'Session', 'Date', 'Rank', 'Player', 'Score',
  'Games', 'Wins', 'Losses', 'Point diff', 'Rating', 'Starting rating'];
var BADGE_HEADERS = ['Saved at', 'Session', 'Batch', 'Rank', 'Player', 'Wins',
  'Losses', 'Day', 'Code', 'Badge id', 'Fingerprint'];

// The batch number for a session: the one it already has if it has been saved
// before, otherwise the next one up. Read this before removing the session's
// old rows, or its number goes with them.
function batchFor(sheet, session) {
  var mine = 0, highest = 0;
  readRows(sheet).forEach(function (row) {
    var n = Number(row['Batch']) || 0;
    if (n > highest) highest = n;
    if (String(row['Session']) === String(session) && n) mine = n;
  });
  return mine || highest + 1;
}

/* ---------- read: the published winners ---------- */

function doGet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var players = ss.getSheetByName('Players');
    var sessions = ss.getSheetByName('Sessions');

    // The badges, and with them each session's batch number.
    var badgeSheet = ss.getSheetByName('Badges');
    var badges = [], batchOf = {};
    if (badgeSheet && badgeSheet.getLastRow() > 1) {
      readRows(badgeSheet).forEach(function (row) {
        var id = String(row['Session']);
        var batch = Number(row['Batch']) || 0;
        if (batch) batchOf[id] = batch;
        badges.push({
          session: id, batch: batch, rank: Number(row['Rank']) || 0,
          name: String(row['Player']), wins: Number(row['Wins']) || 0,
          losses: Number(row['Losses']) || 0, day: asDay(row['Day']),
          code: String(row['Code']), id: String(row['Badge id']),
          fingerprint: String(row['Fingerprint'])
        });
      });
    }

    if (!players || players.getLastRow() < 2) {
      return json({ ok: true, sessions: [], badges: badges, sheet: ss.getName() });
    }

    // When each session began, so the Top List can number them in order.
    var startedBy = {};
    if (sessions && sessions.getLastRow() > 1) {
      readRows(sessions).forEach(function (row) {
        startedBy[row['Session']] = row['Started at'] || row['Saved at'] || '';
      });
    }

    var bySession = {};
    readRows(players).forEach(function (row) {
      var rank = Number(row['Rank']);
      if (!(rank >= 1)) return;                      // skip anyone who did not play
      var id = String(row['Session']);
      if (!bySession[id]) {
        bySession[id] = {
          session: id,
          day: asDay(row['Date']),
          startedAt: String(startedBy[id] || ''),
          savedAt: String(row['Saved at'] || ''),
          winners: []
        };
      }
      bySession[id].winners.push({
        rank: rank,
        name: String(row['Player']),
        wins: Number(row['Wins']) || 0,
        losses: Number(row['Losses']) || 0,
        games: Number(row['Games']) || 0,
        score: row['Score'] === '' ? null : Number(row['Score'])
      });
    });

    var out = Object.keys(bySession).map(function (k) { return bySession[k]; });
    out.forEach(function (s) {
      s.winners.sort(function (a, b) { return a.rank - b.rank; });
      s.batch = batchOf[s.session] || 0;
    });
    // Oldest first, so the Top List can number batches 1, 2, 3...
    out.sort(function (a, b) {
      return String(a.startedAt || a.savedAt).localeCompare(String(b.startedAt || b.savedAt));
    });

    return json({
      ok: true, sheet: ss.getName(), updated: new Date().toISOString(),
      sessions: out, badges: badges
    });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ---------- write: a session from BuenasxPickle ---------- */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'No data was sent.' });
    }
    var body = JSON.parse(e.postData.contents);

    if (String(body.token || '') !== String(SECRET)) {
      return json({ ok: false, error: 'Wrong secret phrase.' });
    }
    if (body.ping) {
      return json({ ok: true, pong: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName() });
    }
    if (!body.session) {
      return json({ ok: false, error: 'No session id in the data.' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sessions = sheetFor(ss, 'Sessions', SESSION_HEADERS);
    var players = sheetFor(ss, 'Players', PLAYER_HEADERS);
    var badgeSheet = sheetFor(ss, 'Badges', BADGE_HEADERS);

    // Before anything is removed, while this session's old batch number is
    // still on the sheet.
    var batch = batchFor(badgeSheet, body.session);

    var replaced = removeRows(sessions, body.session) + removeRows(players, body.session)
      + removeRows(badgeSheet, body.session);

    var savedAt = body.savedAt || new Date().toISOString();
    var top = body.top || [];
    var colour = colourFor(body.session);
    var sessionsFrom = sessions.getLastRow() + 1;
    var playersFrom = players.getLastRow() + 1;
    appendByHeader(sessions, {
      'Saved at': savedAt, 'Session': body.session, 'Date': body.date || '',
      'Started at': body.startedAt || '', 'Players': body.playerCount || 0,
      'Matches played': body.matchesPlayed || 0, 'Courts': body.courts || '',
      'Games per player': body.gamesPerPlayer || '',
      'Top 1': nameAt(top, 0), 'Top 2': nameAt(top, 1), 'Top 3': nameAt(top, 2)
    });

    var rows = (body.players || []).map(function (p) {
      return {
        'Saved at': savedAt, 'Session': body.session, 'Date': body.date || '',
        'Rank': p.rank === null ? '' : p.rank, 'Player': p.name,
        'Score': p.score === null ? '' : p.score, 'Games': p.games, 'Wins': p.wins,
        'Losses': p.losses, 'Point diff': p.pointDiff, 'Rating': p.rating,
        'Starting rating': p.startingRating
      };
    });
    rows.forEach(function (r) { appendByHeader(players, r); });

    // The Top 3 badges, exactly as the app minted them. The code and the
    // fingerprint come from the app so a scanned badge can be matched against
    // this row without recomputing anything the app did not do.
    var badgesFrom = badgeSheet.getLastRow() + 1;
    var badges = body.badges || [];
    badges.forEach(function (b) {
      appendByHeader(badgeSheet, {
        'Saved at': savedAt, 'Session': body.session, 'Batch': batch,
        'Rank': b.rank, 'Player': b.name, 'Wins': b.wins, 'Losses': b.losses,
        'Day': b.day || body.date || '', 'Code': b.code, 'Badge id': b.id,
        'Fingerprint': b.fingerprint || ''
      });
    });

    paintRows(sessions, sessionsFrom, colour);
    paintRows(players, playersFrom, colour);
    paintRows(badgeSheet, badgesFrom, colour);

    return json({
      ok: true, session: body.session, playersSaved: rows.length,
      badgesSaved: badges.length, batch: batch,
      replacedRows: replaced, sheet: ss.getName()
    });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ---------- helpers ---------- */

function sheetFor(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  // A sheet from an older version may be missing newer columns; add them on
  // the end rather than shifting anything that is already there.
  var have = headerRow(sheet);
  headers.forEach(function (h) {
    if (have.indexOf(h) === -1) {
      sheet.getRange(1, have.length + 1).setValue(h).setFontWeight('bold');
      have.push(h);
    }
  });
  return sheet;
}

function headerRow(sheet) {
  var width = Math.max(1, sheet.getLastColumn());
  return sheet.getRange(1, 1, 1, width).getValues()[0].map(String);
}

function appendByHeader(sheet, values) {
  var head = headerRow(sheet);
  var row = head.map(function (h) {
    return Object.prototype.hasOwnProperty.call(values, h) ? values[h] : '';
  });
  sheet.appendRow(row);
}

function readRows(sheet) {
  var head = headerRow(sheet);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, head.length).getValues().map(function (r) {
    var obj = {};
    head.forEach(function (h, i) { obj[h] = r[i]; });
    return obj;
  });
}

// Deletes every row whose Session cell matches, bottom up so the row numbers
// below the one being removed stay valid.
function removeRows(sheet, session) {
  var head = headerRow(sheet);
  var col = head.indexOf('Session') + 1;
  var last = sheet.getLastRow();
  if (col < 1 || last < 2) return 0;
  var values = sheet.getRange(2, col, last - 1, 1).getValues();
  var removed = 0;
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(session)) {
      sheet.deleteRow(i + 2);
      removed++;
    }
  }
  return removed;
}

// Sheets may hand back a Date object for a date-looking cell; the Top List
// wants the plain yyyy-mm-dd it was given.
function asDay(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value || '');
}

function nameAt(list, i) {
  return list[i] && list[i].name ? list[i].name : '';
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
