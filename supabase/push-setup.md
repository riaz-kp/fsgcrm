# Push notifications: putting them live

Notifications reach the notification panel on Windows, macOS, Android, iPhone and iPad. Each person
turns them on for each device from the account menu (their name at the bottom of the sidebar) →
**Notifications → Turn on**, then taps **Test**.

## What gets sent

| When | Who hears |
| --- | --- |
| A task is created for someone, or passed to them | The assignee, unless they did it themselves |
| A task is marked ready for review | Whoever assigned it |
| A task under review is approved or sent back | The assignee |
| A remark is added to a task | The assignee and the assigner, except whoever wrote it |
| 9:00 AM IST on working days (not Sundays or off days) | Each person: their tasks due today and overdue, and reminders that start or fall due (catching up after a weekend or holiday) |

One change sends one notification: a reassignment or a send-back with a remark puts the remark in
the same notification.

## Setup (once, in this order)

Steps 1–3 were done on the live project `ibektwkpgpybuixadqcl` on 19 Nov 2026 (migration
`push_notifications`, Vault keys, function `push` version 1). They are here for a new project.

The database part must be live before the app that uses it is deployed, as with every migration.

1. **Migration.** Supabase → SQL Editor: run
   `migrations/20261119000000_push_notifications.sql`. It turns on the `pg_net` and `pg_cron`
   extensions (both come with every Supabase project) and schedules the morning digest.
2. **Keys.** In the SQL Editor, run `push-keys.secret.sql`. It is only on the computer it was
   made on and is kept out of git, because it holds the private key. It puts the VAPID keys, a
   shared secret and the function's address into Vault. If the file is lost, make new keys with
   `npx web-push generate-vapid-keys` and write the same four `vault.create_secret` lines by hand
   (the secret can be any long random text).
3. **Function.** Supabase → Edge Functions → Deploy a new function → name it `push`, paste
   `functions/push/index.ts`, and **turn off "Verify JWT"** (the database has no sign-in; the
   function checks the shared secret or the person's sign-in itself). With the Supabase CLI:
   `supabase functions deploy push --no-verify-jwt`.
4. **App.** Deploy the app (push to `main`; Vercel builds it).
5. **Try it.** In the app: account menu → Notifications → Turn on → Test. Then assign yourself a
   task from someone else's login, or ask a colleague to.

## Devices

- **Windows, Mac, Android:** works in Chrome and Edge, in a tab or installed. Firefox works on
  Windows and Mac. Safari on a Mac needs macOS 13 or later.
- **iPhone and iPad:** iOS/iPadOS 16.4 or later, and only from the app on the Home Screen (Share →
  Add to Home Screen, then open it from the Home Screen). A Safari tab cannot get notifications;
  the menu says so there.
- If someone pressed "Block", only the browser can undo it: the site's settings (padlock icon in the
  address bar) → Notifications → Allow. On iPhone: Settings → Notifications → FSG.
- Signing out turns notifications off on that device, so a shared computer doesn't keep showing
  the last person's work.

## When something does not arrive

- **Test says "not set up on the server yet":** step 2 has not been run.
- **Test fails with an error from the push function:** Supabase → Edge Functions → `push` →
  Logs.
- **Task notifications don't come but Test does:** check `select * from net._http_response order
  by created desc limit 20;` in the SQL Editor for the function's replies, and that the
  `push_function_url` secret ends in `/functions/v1/push`.
- **No morning digest:** `select * from cron.job_run_details order by start_time desc limit 5;`.
  You can run it by hand with `select private.push_digest();`.
- Windows: Focus Assist / Do Not Disturb hides notifications; Mac: Focus modes and System
  Settings → Notifications → the browser; Android: battery saver can delay them.
