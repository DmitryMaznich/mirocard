# Login blocked by a local IndexedDB read

Device evidence: Android Lenovo, installed PWA and ordinary Chrome both fail;
incognito password sign-in succeeds. The photo of version 1.0.2680 shows
`read-local-data/Error` after Google sign-in. `completeLogin` reached a successful
server response and matched the local account owner, then one of the reads of
`students`, `sessions`, or `studentTopicLinks` rejected. The exact browser-level
read failure and the affected key are not yet known. Do not claim that the old
database has been repaired, or that this was caused by localization.

The login screen now offers **Войти с данными из облака** only after this specific
failure. Its explanation says that unsynced edits stay in the old copy and that
downloaded topics need to be downloaded again. No automatic data reset occurs.

The action reuses only the server-verified in-memory account/token, reads a fresh
bootstrap and session history, verifies its account ID, and writes a new
`mirocard-recovery-<uuid>` database. The complete snapshot commits in one IDB
transaction. Only after `oncomplete` does `mironium.activeDatabase` in
localStorage select the new database. Reload then uses ordinary boot, as on a
new device. The source database, its unreadable entries, downloaded files,
audio overrides and sync queue are never written to or deleted by recovery.
No source data is uploaded or replayed during this action.

Network, account mismatch, storage quota/commit failure or failure to save the
database selection leave the original active. A late change of login context
also prevents activation. Separate fixed diagnostic stages identify recovery
download, write and activation failures without messages or user data in codes.

The selected database's `recoverySource` record and the localStorage selection
contain the preserved database name. Keep those records: investigating/exporting
unsynced data from the original copy is a separate follow-up. Restoring the
default selection blindly would return the user to the failing database. A
rollback to app versions before this change ignores the database selection;
the recovery copy is still retained but those versions cannot use it.

Tests cover preservation of original students, history, links, topic files and
queued edits; server-account isolation; network and quota failures; abortion
after all requests succeeded but before transaction commit; unavailable
localStorage; and reopening the selected database. Browser verification injects
the device's failing local-read stage into both password and Google sign-in,
then verifies successful login after recovery and page reload. These are
controlled simulations; real-device confirmation is still required.
