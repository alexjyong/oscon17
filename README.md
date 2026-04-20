# Scene:History

This software is all about keeping track of high-resolution historical images.
It is also a sample program that implements a number of newer web technologies,
including GraphQL and service workers.  It is written entirely in ES6 (ES2015)

The canonical site incarnate is at https://www.scene-history.org

Link to OSCON presentation slides: https://slides.com/capouch/spa-bootcamp/

## Develop locally

First:

```bash
git clone https://github.com/capouch/oscon17.git
cd oscon17
npm install
```


### Production Version

Transpile the Javascript using Babel:

```bash
npm run build
(You must be root to run the next command)
npm start
```
```bash
http://localhost
```
Note the bundle.js file, which webpack creates and is sent to the client is
*not* kept in the repo and needs to be generated after checkout with
`npm run build`. After changing the client-side codebase, `npm run build` must be
executed to freshen up the bundle


### Development Version

Run with webpack, hot reload is included so there is no need for refreshing the client:

```bash
npm run serve
```
```bash
http://127.0.0.1:8080
```


### Docker (recommended)

Requires Docker and Docker Compose. Runs the app and MongoDB together with no
other local dependencies needed.

```bash
docker compose up -d
```

- HTTP: `http://localhost:8080`
- HTTPS: `https://localhost:4443` (self-signed cert -- your browser will warn you, that's expected)

View logs:

```bash
docker compose logs -f app
```

Stop and remove containers:

```bash
docker compose down
```

To also remove the database volume (wipes all stored data):

```bash
docker compose down -v
```

Rebuild after code changes:

```bash
docker compose build && docker compose up -d
```

#### Environment variables

Copy `.env.example` to `.env` and fill in values before starting if you want
to override defaults (VAPID push notification keys, custom TLS cert paths, CORS
origins, etc.):

```bash
cp .env.example .env
# edit .env, then:
docker compose up -d
```

The VAPID private key has no default -- push notifications will fail silently
until `VAPID_PRIVATE_KEY` is set.

#### Authentication

Authentication uses [Passport.js](https://www.passportjs.org/) with a local email/password strategy. Sessions are persisted to MongoDB via `connect-mongo`.

**Creating the first user**

Option 1 — seed script (recommended for local dev):

```bash
node scripts/seed-user.js admin@example.com mypassword "Admin User"
# or with Docker:
docker compose exec app node scripts/seed-user.js admin@example.com mypassword "Admin User"
```

Option 2 — HTTP endpoint (useful in CI or staging):

```bash
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"email":"admin@example.com","password":"mypassword","displayName":"Admin User"}'
```

**Required environment variables**

| Variable | Purpose | Default |
|---|---|---|
| `SESSION_SECRET` | Signs session cookies — set a long random string | none (required) |
| `ADMIN_SECRET` | Guards the `POST /register` endpoint | none (required) |

Set these in `.env` (copy from `.env.example`) or in `docker-compose.yml` before starting.

#### Push notification subscriptions

Push subscriptions are persisted to MongoDB, so they survive server restarts.
The `mongo-data` Docker volume retains all subscription data across `docker compose down`/`up` cycles.
To wipe subscriptions along with all other stored data, use `docker compose down -v`.
