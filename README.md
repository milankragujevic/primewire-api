# Primewire API

[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)

Simple API written in Node with Express and in-memory caching for accessing the content on a popular movie website, Primewire.

If you have content you wish to be removed, please contact primewire.ag, at their email: admin@primewire.ag, and **not me**.

Copyright © 2018 Milan Kragujević and contributors

By using this API you may be committing copyright infringement. I am not responsible for the contents of the API.

## How to run

```
git clone https://github.com/milankragujevic/primewire-api
cd primewire-api
npm install
node app.js
```

## Documentation

Coming soon, for now look in `app.js` and follow the code...

## Running as a service

Create `primewire.service` in `/etc/systemd/system` with the following contents (replace `[APPJS_PATH]` with the full path to `primewire-api`):

```
[Unit]
Description=Primewire API

[Service]
ExecStart=[APPJS_PATH]/app.js
Restart=always
User=nobody
Group=nogroup 
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
WorkingDirectory=[APPJS_PATH]/

[Install]
WantedBy=multi-user.target
```

Enable the service with `systemctl enable primewire.service` and start it with `systemctl start primewire.service`. 
You can view the logs with `journalctl -u primewire`.

If you get permission errors, please run `chmod +x /the/location/to/app.js`.
