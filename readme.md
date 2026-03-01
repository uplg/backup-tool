# backup-tool

Automated backup tool that dumps databases and archives files on a cron schedule, sends them to remote providers (SFTP, FTP/FTPES), and cleans up old backups. Built for low-memory servers (2GB RAM) -- all operations are streamed.

## Features

- **MySQL** -- `mysqldump` with `execFile` (no shell injection)
- **PostgreSQL in Docker** -- `docker exec pg_dump`, streamed to disk
- **Host directories** -- `tar -czf` with `nice`/`ionice` (ionice on Linux only)
- **Docker named volumes** -- `docker cp` to temp dir, then tar.gz, then cleanup
- **SFTP and FTP/FTPES providers** -- upload archives, delete backups older than `maxFileAge` days
- **Streaming everywhere** -- gzip via `pipeline()`, archives via system tar, no large buffers
- **Temp file isolation** -- all temp files prefixed `bkt-`, cleanup only touches those

## Requirements

- [Bun](https://bun.sh/) >= 1.x
- `mysqldump` on `$PATH` if backing up MySQL databases
- `docker` on `$PATH` if backing up Docker containers or volumes
- `tar`, `nice` on `$PATH` (standard on Linux/macOS)

## Configuration

Create a `config.json` at the project root:

```jsonc
{
  "settings": {
    // Run a backup immediately when the process starts
    "backupOnInit": false,
    // Cron expression -- see https://crontab.guru/
    "scheduleExpression": "0 3 * * *",
    // Backups older than this (in days) are deleted from providers
    "maxFileAge": 7,
    // Accept self-signed TLS certificates (not recommended)
    "allowSelfSigned": false,
  },
  "dbs": [
    {
      "type": "mysql",
      "host": "localhost",
      "user": "myuser",
      "password": "mypassword",
      "name": "mydb",
    },
    {
      "type": "docker-postgres",
      "container": "my-postgres",
      "user": "pguser",
      "name": "mydb",
    },
  ],
  "files": [
    {
      "name": "my-files",
      "source": "/path/to/directory",
      "exclude": ["*/cache/*", "*.log"],
    },
    {
      "type": "docker-volume",
      "name": "my-uploads",
      "container": "my-app",
      "containerPath": "/app/uploads",
    },
  ],
  "providers": [
    {
      "name": "my-sftp-server",
      "type": "sftp",
      "destination": "/remote/backup/path",
      "connection": {
        "host": "192.168.1.100",
        "port": 22,
        "username": "backup",
        "password": "secret",
      },
    },
    {
      "name": "my-ftp-server",
      "type": "ftpes",
      "destination": "/remote/backup/path",
      "connection": {
        "host": "ftp.example.com",
        "port": 21,
        "user": "backup",
        "password": "secret",
        "secure": true,
      },
    },
  ],
}
```

### Database types

| Type              | Description                                    | Required fields                    |
| ----------------- | ---------------------------------------------- | ---------------------------------- |
| `mysql`           | Host MySQL via `mysqldump`                     | `host`, `user`, `password`, `name` |
| `docker-postgres` | PostgreSQL in a Docker container via `pg_dump` | `container`, `user`, `name`        |

### File types

| Type            | Description                                          | Required fields                      |
| --------------- | ---------------------------------------------------- | ------------------------------------ |
| (default)       | Host directory, archived with `tar -czf`             | `name`, `source`                     |
| `docker-volume` | Named volume from a Docker container via `docker cp` | `name`, `container`, `containerPath` |

Both file types support an optional `exclude` array of glob patterns passed to `tar --exclude`.

### Provider types

| Type            | Description                        | Connection ref                                                         |
| --------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `sftp`          | SFTP via ssh2                      | [ssh2 ConnectConfig](https://github.com/mscdex/ssh2#client-methods)    |
| `ftp` / `ftpes` | FTP or explicit FTPS via basic-ftp | [basic-ftp access options](https://github.com/patrickjuchli/basic-ftp) |

## Usage

```sh
bun install
```

Development (runs immediately):

```sh
bun run dev
```

Production -- use a process manager like [pm2](https://pm2.keymetrics.io/):

```sh
pm2 start src/index.ts --interpreter bun
```

## Backup flow

1. For each database: dump, gzip (streamed), send to all providers, delete local archive
2. For each file entry: tar.gz (or docker cp + tar.gz), send to all providers, delete local archive
3. Remote cleanup: delete backups older than `maxFileAge` days on each provider
4. Local cleanup: delete any remaining `bkt-*` temp files

Progress is logged as `[1/N] Step description` with a summary at the end.

## Scripts

| Command             | Description                            |
| ------------------- | -------------------------------------- |
| `bun run dev`       | Run the backup tool                    |
| `bun run start`     | Same as dev                            |
| `bun test`          | Run test suite                         |
| `bun run lint`      | Lint with oxlint                       |
| `bun run fmt`       | Format with oxfmt                      |
| `bun run fmt:check` | Check formatting                       |
| `bun run check`     | Format check + lint                    |
| `bun run typecheck` | TypeScript type check (`tsc --noEmit`) |

## License

[MIT](./LICENSE)
