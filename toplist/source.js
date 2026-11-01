/*
  Where the Top List gets its winners.

  Paste your Apps Script Web App URL between the quotes and the page reads
  live from your spreadsheet, so winners appear as soon as a session saves --
  no commit, no publishing step. Leave it empty and the page falls back to the
  toplist.json committed next to it.

  This file is public, so the URL in it is public too. That is fine: reading
  the winners is the whole point, and writing to the sheet needs the secret
  phrase, which lives only in the organiser's browser and is never here.
*/
window.TOPLIST_SOURCE = {
  url: ""
};
