/**
 * PickleMatch -> Google Sheets
 * ----------------------------
 * Paste this into Apps Script on the spreadsheet you want sessions saved to,
 * set SECRET below, deploy it as a Web App, and give PickleMatch the URL.
 * Setup steps are in sheets/README.md.
 *
 * It appends to two tabs, creating them with headers on first use:
 *   Sessions - one row each time a session is saved
 *   Players  - one row per player, per save
 *
 * Saving the same session twice replaces its earlier rows rather than
 * duplicating them, so you can save as you go and keep one row per session.
 */

// Change this to any phrase you like, then put the same phrase in PickleMatch.
// The web app has to be readable by anyone for a browser to reach it, so this
// is what stops a stranger who finds the URL from writing to your sheet.
var SECRET = 'change-me';

var SESSION_HEADERS = ['Saved at', 'Session', 'Date', 'Players', 'Matches played',
  'Courts', 'Games per player', 'Top 1', 'Top 2', 'Top 3'];
var PLAYER_HEADERS = ['Saved at', 'Session', 'Date', 'Rank', 'Player', 'Score',
  'Games', 'Wins', 'Losses', 'Point diff', 'Rating', 'Starting rating'];

function doGet() {
  return json({ ok: true, service: 'PickleMatch sheet', note: 'Send a POST to save a session.' });
}

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

    // Saving a session again should update it, not pile up duplicates.
    var replaced = removeRows(sessions, body.session) + removeRows(players, body.session);

    var savedAt = body.savedAt || new Date().toISOString();
    var top = body.top || [];
    sessions.appendRow([savedAt, body.session, body.date || '', body.playerCount || 0,
      body.matchesPlayed || 0, body.courts || '', body.gamesPerPlayer || '',
      nameAt(top, 0), nameAt(top, 1), nameAt(top, 2)]);

    var rows = (body.players || []).map(function (p) {
      return [savedAt, body.session, body.date || '', p.rank === null ? '' : p.rank, p.name,
        p.score === null ? '' : p.score, p.games, p.wins, p.losses, p.pointDiff,
        p.rating, p.startingRating];
    });
    if (rows.length) {
      players.getRange(players.getLastRow() + 1, 1, rows.length, PLAYER_HEADERS.length)
        .setValues(rows);
    }

    return json({
      ok: true, session: body.session, playersSaved: rows.length,
      replacedRows: replaced, sheet: ss.getName()
    });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ---------- helpers ---------- */

function sheetFor(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Deletes every row whose Session column matches, bottom up so the row
// numbers below the one being removed stay valid.
function removeRows(sheet, session) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var values = sheet.getRange(2, 2, last - 1, 1).getValues();  // column B = Session
  var removed = 0;
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(session)) {
      sheet.deleteRow(i + 2);
      removed++;
    }
  }
  return removed;
}

function nameAt(list, i) {
  return list[i] && list[i].name ? list[i].name : '';
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
