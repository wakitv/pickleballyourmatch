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

Press **Save this session** in Match settings, or **📊 Save to Sheet** in the top bar,
which appears once a sheet is connected. You get:

- **Sessions** — one row per session: when it was saved, the session id, the date,
  how many players and matches, courts, games per player, and the top three names.
- **Players** — one row per player: rank, name, score, games, wins, losses, point
  difference, rating and starting rating.

Saving the same session again **replaces its earlier rows** rather than duplicating
them, so you can save as you go and still end up with one row per session. A session's
id is a fingerprint of its finished results, so it changes as more matches are played —
saving mid-session and again at the end will leave you with a row for each stage. Save
once at the end if you want exactly one row per session.

## If it does not work

| What you see | Usually means |
|---|---|
| *Could not reach the script* | The URL is wrong, or the deployment is not set to **Anyone** |
| *Wrong secret phrase* | The phrase here and in `Code.gs` differ |
| *replied with something other than JSON* | The URL points at the editor, not the deployment — make sure it ends in `/exec` |

After editing `Code.gs` you must **Deploy → Manage deployments → Edit → Version: New
version**, or the old code keeps running.
