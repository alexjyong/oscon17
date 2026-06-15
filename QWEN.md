# Scene:History — Project Context

## Project Overview

**Scene:History** is a single-page application (SPA) for archiving and presenting high-resolution historical images. It was built as a demo/proof-of-concept for an OSCON 2017 presentation on SPA bootcamp techniques. The canonical live site is at <https://www.scene-history.org>.

The project demonstrates modern web technologies of its era (circa 2016–2017): React, GraphQL, service workers (PWA), web push notifications, and MongoDB.

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Client (React SPA)                              │
│  ── js/Shell.js        # Active entry (BrowserRouter + Switch)
│  ── js/Shell-new.js    # Alternative entry (code-split via System.import)
│  ── js/*.js            # 17 view/presentational components
│  ── public/sw.js       # Service worker (cache + push)
│  ── public/manifest.json # PWA manifest
├─────────────────────────────────────────────────┤
│  Server (Node/Express)                           │
│  ── server-es6.js      # Production HTTPS (port 443)
│  ── server-test.js     # Dev HTTP (8080) + HTTPS (4443)
│  ── js/server-routes.js # SPA fallback, file upload (multer), push API
│  ── graphql/index.js   # GraphQL schema (express-graphql + GraphiQL)
│  ── Middleware: cors, compression, body-parser   │
├─────────────────────────────────────────────────┤
│  Data                                            │
│  ── MongoDB (models: ImageRec, GeoPointRec)      │
│  ── Filesystem: ./public/images/, tiles/, thumbs/│
│  ── ./uploads/       # Raw uploaded files (multer disk storage)
└─────────────────────────────────────────────────┘
```

### Key Technologies

| Layer | Technology |
|---|---|
| Frontend | React 15.4, React Router v4 (react-router-dom v4.0.0-beta.7), neal-react (UI kit), Griddle + LocalPlugin (tables), OpenSeaDragon (zoom), react-dropzone, react-image-gallery, react-select, react-search-bar, whatwg-fetch polyfill |
| Build | Webpack 3.3, Babel 6 (es2015 + stage-0 + react presets), UglifyJS minification, CommonsChunkPlugin (vendor.bundle.js) |
| Backend | Express 4, body-parser, cors, compression, morgan (logging commented out by default) |
| API | GraphQL v0.8 (express-graphql + GraphiQL), Mongoose resolvers with get-projection field selection, mutations use async/await |
| Database | MongoDB via Mongoose (ImageRec, GeoPointRec models) |
| Image Processing | sharp v0.17 (thumbnails 200px JPG, resized 1000px PNG, DZI zoom tiles 256px) |
| File Upload | multer v1.1 (disk storage to ./uploads/) |
| PWA | Service Worker (sw.js), web-push v3.2, manifest.json, push.js (SW registration) |
| Styling | SCSS → CSS via webpack style-loader + css-loader + sass-loader |
| Auth | Firebase 3.9 (CDN scripts in public/libs/ + config in index.html) — email/password active, Google/Facebook in Login.js not wired |

### Directory Structure

```
oscon17/
├── css/                   # SCSS source (compiled by webpack to public/css/)
│   └── main.scss          # Global styles entry point
├── js/                    # React components + server routes
│   ├── Shell.js           # Active app entry, React Router v4 (BrowserRouter)
│   ├── Shell-new.js       # Alternative shell using code-splitting (System.import)
│   ├── App.js             # Root wrapper: Header + neal-react App + Footer
│   ├── client-routes.js   # Code-split route definitions (unused, referenced by Shell-new)
│   ├── Launch.js          # Landing/home page (neal-react themed Hero + testimonials)
│   ├── Browse.js          # Image search/browse (Griddle table + GraphQL + SearchBar)
│   ├── Upload.js          # Multi-step upload with Dropzone + Firebase auth
│   ├── Edit.js            # Edit/delete image records (Firebase-auth gated)
│   ├── Asset.js           # Single image detail view with click-to-zoom
│   ├── Zoom.js            # OpenSeaDragon high-res DZI zoom viewer
│   ├── SlideShow.js       # react-image-gallery slideshow with controls
│   ├── Subscribe.js       # Push notification subscription UI (react-select + web-push)
│   ├── Announce.js        # Announcement page placeholder (topic-param routed)
│   ├── Login.js           # Firebase auth UI (Google/Facebook popup — not wired to nav)
│   ├── Header.js          # Navbar with login/logout + SubscribeBtn for push
│   ├── Footer.js          # Static footer (Palaver Consulting address)
│   ├── InfoFields.js      # Reusable image metadata form (title/desc/source/taglist)
│   ├── Confirmation.js    # Post-upload/edit confirmation page
│   └── server-routes.js   # Express routes: file upload (multer → ./uploads/), push notifications, SPA fallback
├── graphql/               # GraphQL schema layer (graphql v0.8)
│   ├── index.js           # Schema root (query + mutation types)
│   ├── get-projection.js  # Utility: extracts field projections from AST
│   ├── queries/           # image (single, multiple, keywords lookup) + geopoint (single, multiple, all)
│   ├── mutations/         # image (add, update, delete) + geopoint (add only)
│   └── types/             # GraphQL types: ImageRec, Geopoint + inputs (ImageRecInput, ImageRecUpdate, GeopointInput)
├── models/                # Mongoose schemas
│   ├── image-rec.js       # ImageRec: title, description, filename, source, taglist
│   └── geopoint.js        # GeoPointRec: imageId, lat/long/alt, comment
├── public/                # Static assets served to browser
│   ├── js/bundle.js       # Webpack output (NOT in git; generated by `npm run build`)
│   ├── js/vendor.bundle.js # Vendor chunk (react, openseadragon, griddle, etc.)
│   ├── css/               # Compiled CSS (main.css + Bootstrap, Font Awesome, etc.)
│   ├── sw.js              # Service worker (cache + push notifications)
│   ├── manifest.json      # PWA manifest (standalone, portrait)
│   ├── scripts/push.js    # Push notification setup (SW registration + subscribe/unsubscribe)
│   ├── libs/              # CDN libs: Firebase 3.9, jQuery 3.1, Bootstrap min JS
│   ├── fonts/             # Font Awesome web fonts
│   ├── img/               # PWA icons, backgrounds, social proof photos
│   ├── tiles/             # OpenSeaDragon DZI zoom tiles (generated on upload)
│   ├── images/            # Processed/resized images (1000px wide PNG)
│   └── thumbs/            # Thumbnails (200px wide JPG)
├── ops/                   # Operations scripts
│   └── deploy.sh          # Builds webpack -p and deploys public/ to S3 (nealjs.com)
├── server-es6.js          # Production HTTPS server (port 443, requires SSL certs)
├── server-test.js         # Development HTTP (8080) + HTTPS (4443) server
├── index.js               # Production entry (babel-register → server-es6)
├── index-local.js         # Dev entry (babel-register → server-test)
├── webpack.config.js      # Webpack 3 config (babel-loader, SCSS, vendor chunk, Uglify)
├── .babelrc               # Babel presets: react, stage-0, es2015 (modules:false)
└── package.json           # Dependencies and scripts
```

## Building and Running

### Prerequisites

- Node.js (compatible with npm scripts in package.json; era-appropriate version, ~6–8)
- MongoDB running locally on default port (`mongodb://localhost/oscon-test`)
- For production: SSL certificates at `/home/brianc/CERTS/` (referenced in server-es6.js)

### Development

```bash
npm install
npm run serve        # Starts webpack-dev-server on :8080 with hot reload
                     # Proxies /uploadHandler and /graphql to localhost
```

The dev server (`server-test.js`) listens on:
- HTTP port **8080** (for webpack-dev-server + dev API)
- HTTPS port **4443** (for the Node server, requires certs)

### Production Build

```bash
npm run build        # Runs webpack -p (production minification)
                     # Generates public/js/bundle.js and public/js/vendor.bundle.js
npm start            # Starts Express server via index.js → server-es6.js
                     # Listens on HTTPS port 443
```

### Docker (static serving only)

```bash
docker run -p 3000:80 -v "$PWD"/public:/usr/local/apache2/htdocs/ httpd:2.4
# Visit http://<DOCKER_IP>:3000
```

### Linting

```bash
npm run lint         # ESLint on .js/.jsx files
```

## Development Conventions

- **ES6 throughout.** All source is written in ES6 (ES2015) with stage-0 proposals (class properties, etc.), transpiled by Babel.
- **React class components.** Uses `React.createClass` and class syntax mixed; React 15.4 era patterns (context API, PropTypes).
- **React Router v4.** Declarative routing with `<Route>`, `<Switch>`, `<NavLink>`. The active entry is `js/Shell.js` using `BrowserRouter`. An alternative code-splitting approach exists in `Shell-new.js` + `client-routes.js` using `System.import` but is not wired up.
- **GraphQL schema-first.** Types in `graphql/types/`, queries in `graphql/queries/`, mutations in `graphql/mutations/`. GraphiQL playground enabled at `/graphql`. Image queries support single (`imageRec`), multiple (`imageRecs`), and keyword lookup (`lookup` via regex on title/description/source/taglist); geopoint queries support single, multiple, and all. Geopoint mutations only support `add` (no update/delete). All resolvers use `get-projection.js` for field selection. TODO in resolvers: subquery for related geopoint documents is not yet implemented.
- **File upload pipeline.** Uploaded images go through `sharp` to produce:
  1. Thumbnail (200px wide, JPG) → `public/thumbs/`
  2. Resized image (1000px wide, PNG) → `public/images/`
  3. DZI zoom tiles (256px) → `public/tiles/`
- **PWA.** Service worker (`public/sw.js`) caches core assets and handles push notifications. Push setup script at `public/scripts/push.js` registers the SW. VAPID keys are hardcoded in `server-routes.js`, `sw.js`, and `push.js`.
- **Session storage.** The Browse component persists its state (records, current page) in `sessionStorage` across navigations. Asset.js reads from this same storage to look up image data.
- **bundle.js is generated.** The webpack output (`public/js/bundle.js` and `public/js/vendor.bundle.js`) is git-ignored and must be rebuilt after any client-side changes with `npm run build`.
- **Firebase auth.** Used in Upload.js, Edit.js, and Header.js for gating write operations. Firebase 3.9 loaded via CDN script in `public/libs/`. Login.js (Google/Facebook popup auth) exists but is not wired into the navigation.
- **SPA fallback.** `server-routes.js` serves `index.html` for all view routes (`/`, `/home`, `/browse`, `/upload`, `/edit*`, `/zoomer*`, `/slides*`, `/asset*`) to support client-side routing. The `/announce*` route serves `announce.html` instead.
- **Deployment.** `ops/deploy.sh` runs `webpack -p` and uploads `public/` to S3 bucket `s3://www.nealjs.com`.

## Important Notes

- **Age of dependencies.** This project uses packages from ~2016 (React 15, Webpack 3, graphql v0.8). Dependencies are likely incompatible with modern Node.js versions. A major upgrade pass would be needed to run on current tooling.
- **SSL certs are hardcoded.** `server-es6.js` reads certs from `/home/brianc/CERTS/`. Development uses `server-test.js` which also needs certs for HTTPS but can fall back to HTTP on port 8080.
- **Firebase auth.** Firebase 3.9 loaded via CDN scripts in `public/libs/` with config initialized in `public/index.html` (apiKey, authDomain visible). Only email/password auth via Header.js is active. Google/Facebook popup auth exists in `Login.js` but is not wired into the navigation.
- **Push notification VAPID keys** are embedded in source (`server-routes.js`, `sw.js`, and `push.js`). These should be rotated/regenerated for any production use.
- **No automated tests.** `npm test` just exits with error code 1.
- **In-memory subscription store.** Push subscriptions are stored in a module-level `subscriptions` object (lost on restart). The TODO comment in `server-routes.js` notes persistence is not yet implemented.
- **Unused code.** `Shell-new.js` + `client-routes.js` implement a code-splitting approach using `System.import` but are not the active entry point. `Login.js` (Google/Facebook auth) is not wired into the nav.
- **Dead import.** Browse.js imports `react-redux` (`{ connect }`) but it's not in package.json — likely a leftover from an abandoned Redux plan. The import is unused; the component manages state locally via `sessionStorage`.
- **Dead dependency.** `react-input-autosize` is in package.json but not imported by any component.
- **`img-icons` symlink.** Zoom.js references `prefixUrl: "/img-icons/"` for OpenSeaDragon icons — this is a symlink pointing to `node_modules/openseadragon/build/openseadragon/images/`, not a missing directory.
- **Deprecated lifecycle.** Four components use `componentWillMount` (deprecated in React 16+): Header.js, Asset.js, InfoFields.js, Login.js. All use `React.createClass` syntax.
- **Client-side GraphQL.** All GraphQL calls use `fetch` with `POST` and `cache: 'reload'` — no Apollo/Relay, no query caching. 6 call sites across Browse.js, Upload.js, Edit.js (3x), and SlideShow.js.
- **GraphQL API inconsistency.** Image queries call `getProjection(info.fieldNodes[0])` (correct for graphql v0.8) while geopoint queries call `getProjection(options.fieldASTs[0])` (older API). Both work but reflect different eras of the codebase.
- **Unused `async` in mutations.** `graphql/mutations/image/update.js` and `delete.js` declare `async resolve()` but never `await` — they return the Mongoose promise directly.
- **Delete mutation imports wrong type.** `graphql/mutations/image/delete.js` imports `imageRecUpdateType` (unused) instead of the input type it actually needs.
- **Hidden push trigger.** `server-routes.js` exposes a `/sknnzix` route (GET) for triggering push notifications — accepts optional `:type/:msg` params. Used for demo/testing, not wired to any frontend UI.
- **Package name mismatch.** `package.json` says `"name": "oscon16-spa"` (not oscon17).

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
