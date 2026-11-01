# Saving sessions to a Google Sheet

PickleMatch can append each session's standings to a spreadsheet you own. It takes
about five minutes to set up, once.

## 1. Make the spreadsheet

Create a new Google Sheet. You do not need to add any tabs or headings — the script
creates a **Sessions** tab and a **Players** tab the first time it runs.

## 2. Add the script

In that sheet: **Extensions → Apps Script**. Delete whatever is in the editor, paste
in the whole of [`Code.gs`](Code.gs), and change one line near the top:

```javascript
var SECRET = 'change-me';
```

Put any phrase you like there. It is what stops a stranger who finds your URL from
writing to your sheet, so pick something no one would guess. Save the project.

## 3. Deploy it as a Web App

**Deploy → New deployment**, pick **Web app** as the type, then set:

| Setting | Value |
|---|---|
| Execute as | **Me** |
| Who has access | **Anyone** |

Both matter. *Execute as Me* is what lets the script write to your sheet; *Anyone* is
what lets a browser reach it at all. "Anyone" means anyone with the URL can send a
request — the secret phrase is what decides whether that request is accepted.

Google will ask you to authorise the script the first time. Approve it, then copy the
**Web app URL**. It looks like:

```
https://script.google.com/macros/s/AKfy.../exec
```

## 4. Connect PickleMatch

Open **Match settings → Google Sheet**, paste the URL and the same secret phrase, and
press **Test connection**. It should name your spreadsheet back.

The URL and phrase are kept in that browser's local storage only. They are never
committed to the repository and never sent anywhere except Google. Anyone who has both
can append rows to your sheet, so treat the pair like a password — and set them up
again on each device you use.

## Saving

**A session is written once, when it ends.** Nothing is sent while you are playing;
pressing **Reset** saves the finished session and only then clears it, so the sheet
gets one row per session with its final figures and never writes the same session
twice. **Save now** is there if you want to send a session without resetting.

**If the save fails, Reset does not clear anything.** You are told what went wrong and
asked whether to drop the session anyway — because with no file export, the sheet is
the only copy. Fix the problem and press Reset again.

Each session's rows are tinted their own colour in both tabs, so you can see at a
glance where one session ends and the next begins. You get:

- **Sessions** — one row per session: when it was saved, the session id, the date,
  how many players and matches, courts, games per player, and the top three names.
- **Players** — one row per player: rank, name, score, games, wins, losses, point
  difference, rating and starting rating.

Should a session ever be sent twice, the script **replaces its earlier rows** rather
than duplicating them, so a session can only ever be one row.

**The sheet is a record, not a backup you can load.** Nothing reads it back into the
app: Reset still clears the session from the browser for good, and there is no way to
reopen an old session from the spreadsheet. If that matters, say so and it can be added.

## Showing the winners on the Top List

The Top List page can read straight from this sheet, so a finished session appears
there as soon as it is saved — no publishing, no commit. It lists **everyone who
played**, with the top three carrying their medal and badge code and the rest below
them, and gives every batch its own colour.

Open [`toplist/source.js`](../toplist/source.js) and paste the same Web App URL:

```javascript
window.TOPLIST_SOURCE = {
  url: "https://script.google.com/macros/s/AKfy.../exec"
};
```

Commit that once and the page is live from then on. It refreshes when opened, when
**↻ Refresh** is pressed, and every couple of minutes while it is on screen.

**This puts the URL in a public file, and that is the intended trade.** Reading the
winners is meant to be public, and reading needs no secret. Writing still needs the
secret phrase, which lives only in the organiser's browser and never appears here. The
one thing a stranger could do with the URL alone is read your winners, or send enough
requests to eat into Google's daily quota for the script.

If the URL is left empty, or the sheet cannot be reached, the page falls back to the
committed `toplist/toplist.json` and says so in the heading.

## If it does not work

| What you see | Usually means |
|---|---|
| *Could not reach the script* | The URL is wrong, or the deployment is not set to **Anyone** |
| *Wrong secret phrase* | The phrase here and in `Code.gs` differ |
| *replied with something other than JSON* | The URL points at the editor, not the deployment — make sure it ends in `/exec` |
| Top List says *could not reach the spreadsheet* | The URL in `toplist/source.js` is wrong, or the deployment is not set to **Anyone** |

After editing `Code.gs` you must **Deploy → Manage deployments → Edit → Version: New
version**, or the old code keeps running.
