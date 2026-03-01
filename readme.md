# Backup tool

Simple Backup tool in NodeJS (using node-cron)

Backup a local database or/and files, compress, send to defined providers in config.
Also perform a cleanup task on providers. (Keep only X days of backups.)

At the root, create a `config.json` file with :

```jsonc
{
  "settings": {
    // Start backup on script startup
    "backupOnInit": true,
    // every day at 02:00. @see: https://crontab.guru/
    "scheduleExpression": "0 2 * * *",
    "maxFileAge": 2,
    "allowSelfSigned": false,
  },
  // uses mysqldump with exec, make sure to have it
  "dbs": [
    {
      "host": "localhost",
      "user": "xxx",
      "password": "xxx",
      "name": "xxx",
    },
  ],
  "files": [
    {
      "name": "example-project",
      "source": "/local-path",
    },
  ],
  "providers": [
    {
      "name": "siteA",
      "type": "sftp",
      "destination": "/remote-path",
      // @see: https://github.com/mscdex/ssh2#client-methods
      "connection": {
        "host": "remote-sftp-host",
        "port": 22,
        "username": "xxx",
        "password": "xxx",
      },
    },
    {
      "name": "siteB",
      "type": "ftpes", // or ftp
      "destination": "/remote-path",
      // @see: https://github.com/lumphe/ftp-ts#ftpconnectoptions
      "connection": {
        "host": "remote-ftpes-host",
        "port": 21,
        "user": "xxx",
        "password": "xxx",
        "secure": true,
        "connTimeout": 10000,
        "pasvTimeout": 10000,
        "dataTimeout": 10000,
        "aliveTimeout": 10000,
        "secureOptions": {},
      },
    },
  ],
}
```

## Usage

```sh
$ pnpm install
$ pnpm run dev
```

Build to `dist` folder :

```sh
$ pnpm run build
```

For production usage, use [pm2](https://pm2.keymetrics.io/) or similar.

```sh
pm2 start dist/src/index.js
```

## License

[MIT License](./LICENSE)
