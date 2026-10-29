# LSU recovery

Buddy declares a daily 02:15 UTC backup in `config/cloud.ts`. The dedicated
German host uses PostgreSQL's native `pg_dump`, then the released `ts-backups`
tool uploads authenticated AES-256-GCM encrypted copies to the private
`lastsoulultra-production-backups` bucket in Hetzner's `fsn1` location.
The deploy checks bucket location and public grants before proceeding.

The archive URL, tool version and SHA-256 are pinned in `enterprise/backups.json`.
Provisioning verifies the downloaded package before installation. Storage
credentials and the separate recovery key live in root-only
`/etc/ts-cloud/backups.env`; they are excluded from application and native
build environments. Local plaintext snapshots are root-only, with three retained
copies per source. Offsite copies are retained for 30 days in the project prefix.

The recovery key is also stored in the operator's private credential directory
and encrypted in this installation's `.env.production`. Preserve that key and
the installation's separate environment decryption key outside the server.
Losing both recovery-key copies makes the encrypted backups unrecoverable.

To run an immediate backup, SSH to the owned LSU server and run
`/usr/local/bin/ts-cloud-backup.sh` as root. The runner takes an exclusive lock,
exits unsuccessfully if any required snapshot or offsite upload fails, and writes
`/var/backups/ts-cloud/last-success` only after success. Inspect
`/var/log/ts-cloud-backup.log` for scheduled runs.

For recovery, download the selected object from the project prefix into a
root-only temporary directory. Use `decryptBackupFile` from the pinned
`ts-backups` package with the independent recovery secret. Decryption checks
the authentication tag and removes incomplete plaintext when verification fails.
Never put the key in an argument, URL, command history or an artifact.

Restore a PostgreSQL SQL snapshot with the matching PostgreSQL client's
`psql -v ON_ERROR_STOP=1` into a new, empty recovery database. Verify accounts,
workout counts, constraints and indexes there before any production cutover.
Do not replay a database dump into the live `lsu_training` database as a test.

File snapshots use the tool's own archive format. Use `RestoreManager` or
`ts-backups restore --snapshot ... --only ... --target ...` with an empty staging
directory. Keep the restored runtime environment private: it contains the app
encryption key needed to read stored provider secrets. Restore uploads and the
matching application/database revision before a deliberate cutover.

An uploaded object or successful cron invocation alone does not prove recovery.
Record an actual download, authenticated decryption and isolated database restore
exercise before treating the recovery path as verified.
