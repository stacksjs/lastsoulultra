# Website database

This directory holds the website's migrations and local database files. It is separate from the training installation's PostgreSQL database, `lsu_training`. Training schema and seed behavior come from the pinned platform kit; see [enterprise deployment](../enterprise/README.md).

## Apply and generate migrations

From the repository root:

```sh
./buddy generate:migrations
./buddy migrate --diff
./buddy migrate
```

`generate:migrations` compares models with the configured database and writes migration SQL. Review that SQL first. `migrate --diff` previews the pending SQL; `migrate` applies it. Running `migrate` does not scaffold a new migration file.

Describe application schema in `app/Models/` with `defineModel()`. Read the repository's model and migration skills before changing it. A manual migration can be scaffolded with `./buddy make:migration <name>` when needed.

`./buddy seed` runs the configured seed workflow. Check the active database and environment before migrating or seeding. Database files are machine-local state and are not an exchange format for production training records.

See [project conventions](../AGENTS.md) and [local verification](../README.md#verify-changes).
