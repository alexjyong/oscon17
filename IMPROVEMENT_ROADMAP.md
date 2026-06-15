# Scene:History — Improvement Roadmap

> Generated: 2026-06-15
> Context: Ancient SPA (circa 2016–2017), React 15, Webpack 3, GraphQL v0.8, Express 4, Mongoose 4
> Prior rehaul commit: `47689e06` ("First pass at security fixes and rehaul") — Docker files added but server code not fully updated to use env vars; changes were stashed/abandoned on `take-two-rehaul` branch.

---

## Executive Summary

This project is a historically significant SPA demo that has accumulated **significant technical debt** across three dimensions:

1. **Security**: Hardcoded secrets, missing auth on server routes, ReDoS vulnerability, unrestricted file uploads
2. **Functionality**: Tags stored as plain strings with no dedicated search; no tag-based filtering
3. **Modernization**: Dependencies from 2016, deprecated React patterns, callback-based upload pipeline

The prior rehaul attempt (`47689e06`) added Docker scaffolding but did not complete the server-side migration to environment variables or fix the core security issues. It was abandoned mid-stream.

**Recommended approach**: Tackle improvements in phases, starting with Docker (easiest, highest ROI for local development), then security hardening, then tag search, then the dependency upgrade pass. Each phase should be independently deployable and testable.

---

## Phase 0: Docker Support (Quick Win)

**Effort**: Low | **Impact**: High (enables all other work)

### Current State
- No `Dockerfile` or `docker-compose.yml` on disk (they existed in commit `47689e06` but were lost when changes were stashed)
- QWEN.md mentions a manual Apache static-serving workaround only
- The prior Dockerfile used `node:8` (EOL) and hardcoded cert paths that won't work in containers

### Recommended Path

#### 0.1: Create a modern Dockerfile
```dockerfile
# Use a maintained Node LTS base (20.x) with Babel compatibility
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

# sharp needs build tools on Alpine
RUN apk add --no-cache python3 make g++ libvips-dev

COPY . .
RUN npm run build

# Production stage — minimal image
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache libvips

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/public ./public
COPY --from=builder /app/js/server-routes.js ./js/
COPY --from=builder /app/graphql ./graphql
COPY --from=builder /app/models ./models
COPY --from=builder /app/server-es6.js .
COPY --from=builder /app/index.js .

# Generate self-signed certs at build time for dev
RUN mkdir -p /certs && \
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout /certs/server.key \
      -out /certs/server.crt \
      -subj "/CN=localhost"

ENV TLS_KEY_PATH=/certs/server.key
ENV TLS_CERT_PATH=/certs/server.crt

EXPOSE 8080 4443
CMD ["node", "index-local.js"]
```

#### 0.2: Create docker-compose.yml
```yaml
version: '3.8'

services:
  mongo:
    image: mongo:6
    volumes:
      - mongo-data:/data/db
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: oscon-test

  app:
    build: .
    ports:
      - "8080:8080"
      - "4443:4443"
    depends_on:
      - mongo
    environment:
      - MONGO_HOST=mongo
      - MONGO_PORT=27017
      - MONGO_DB=oscon-test
    volumes:
      - uploads-data:/app/uploads
      - thumbs-data:/app/public/thumbs
      - images-data:/app/public/images
      - tiles-data:/app/public/tiles

volumes:
  mongo-data:
  uploads-data:
  thumbs-data:
  images-data:
  tiles-data:
```

#### 0.3: Create .dockerignore
```
node_modules
public/js
public/css
uploads
.git
.gitignore
*.md
.qwen
.specify
```

#### 0.4: Update server code to read env vars (see Phase 1)
The Dockerfile sets `TLS_KEY_PATH`, `TLS_CERT_PATH`, `MONGO_HOST` as env vars. Server code must be updated to read these (Phase 1, item 1.3).

### Success Criteria
- `docker compose up` starts the full stack (app + MongoDB)
- App is accessible at `http://localhost:8080`
- Image upload pipeline works inside container
- Uploaded files persist across container restarts (named volumes)

---

## Phase 1: Security Hardening

**Effort**: Medium | **Impact**: Critical (this is the open issue)

### 1.1: Move all secrets to environment variables

**Current problem**: Zero `.env` files exist. All secrets hardcoded in source across 6+ files.

**Action items**:
1. Create `.env.example` with placeholder values for:
   - `TLS_KEY_PATH`, `TLS_CERT_PATH` (SSL certs)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (push notifications)
   - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN` (Firebase auth)
   - `MONGO_HOST`, `MONGO_PORT`, `MONGO_DB` (MongoDB connection)
   - `CORS_ORIGINS` (comma-separated allowed origins)
   - `NODE_ENV`

2. Create `.env` (gitignored) with actual values for local dev

3. Install `dotenv` and load it at the top of `server-es6.js` and `server-test.js`:
   ```javascript
   require('dotenv').config();
   ```

4. Replace all hardcoded values with `process.env.*` references:
   - `server-es6.js`: SSL cert paths, MongoDB URI, CORS origins
   - `server-test.js`: Same
   - `js/server-routes.js`: VAPID keys, MongoDB connection
   - `public/index.html`: Firebase config (note: API key is not secret by design for Firebase, but authDomain should be env-driven)

**Why**: Hardcoded secrets in source code are a critical vulnerability. Anyone with repo access can extract keys. CI/CD pipelines and container deployments require env-based config.

### 1.2: Add authentication middleware to server routes

**Current problem**: `/uploadHandler` and GraphQL mutations have **zero server-side auth**. Firebase auth is only checked client-side (trivially bypassable).

**Action items**:
1. Replace Firebase 3.9 CDN auth with a proper JWT-based flow:
   - Firebase ID tokens are JWTs — the server can verify them directly without Firebase SDK
   - Add an Express middleware that extracts `Authorization: Bearer <token>` from requests
   - Use `firebase-admin` SDK (or pure JWT verification) to verify tokens on the server
   - Apply this middleware to `/uploadHandler`, `/graphql` (mutations only), and `/save-subscription/`

2. For the GraphQL layer, add resolvers that receive the authenticated user from context:
   ```javascript
   // server-routes.js or graphql/index.js
   const schema = makeExecutableSchema({
     typeDefs,
     resolvers,
   });
   // Add auth context to GraphQL resolvers
   ```

3. Alternatively, for a minimal fix: verify Firebase ID tokens on the server using `admin.initializeApp()` with a service account key (loaded from env).

**Why**: Without server-side auth, anyone can upload files, delete images, or modify records by calling the API directly.

### 1.3: Fix file upload security

**Current problem**: No MIME validation, no size limits, no filename sanitization, no auth.

**Action items**:
1. Add multer limits:
   ```javascript
   const upload = multer({
     dest: './uploads/',
     limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
     fileFilter: (req, file, cb) => {
       const allowed = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp'];
       if (allowed.includes(file.mimetype)) {
         cb(null, true);
       } else {
         cb(new Error('Invalid file type. Only JPEG, PNG, TIFF, WebP allowed.'));
       }
     }
   });
   ```

2. Sanitize filenames — never use `file.originalname` directly:
   ```javascript
   const crypto = require('crypto');
   const storedFilename = crypto.randomUUID() + path.extname(file.originalname).toLowerCase();
   ```

3. Validate image dimensions after upload (the code already has a TODO comment about this):
   ```javascript
   const sharp = require('sharp');
   const metadata = await sharp(filePath).metadata();
   if (metadata.width > 16000 || metadata.height > 16000) {
     throw new Error('Image dimensions exceed maximum');
   }
   ```

4. Convert the callback-based upload handler to promise/async:
   ```javascript
   // Current: callback with fire-and-forget sharp processing
   // New: async function that awaits all image processing before responding
   ```

**Why**: Unrestricted file uploads are the #1 server compromise vector. No size limit enables DoS. No MIME validation allows uploading executables. Using `originalname` enables path traversal.

### 1.4: Fix ReDoS vulnerability in keyword search

**Current problem**: `graphql/queries/image/keywords.js` passes user input directly to `new RegExp()`:
```javascript
const searchRegex = new RegExp(params.keywords, "i");
```

**Action items**:
1. Escape special regex characters in user input:
   ```javascript
   function escapeRegex(string) {
     return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
   }
   const searchRegex = new RegExp(escapeRegex(params.keywords), "i");
   ```

2. Add a maximum query length (e.g., 100 characters):
   ```javascript
   if (params.keywords.length > 100) {
     throw new Error('Search query too long');
   }
   ```

3. Consider replacing regex search with MongoDB text indexes or `$regex` with anchored word boundaries for better performance and safety.

**Why**: A crafted regex like `^(a+)+$` can cause catastrophic backtracking and hang the Node.js event loop, taking down the entire server.

### 1.5: Restrict CORS

**Current problem**: `app.use(cors())` with no options = `Access-Control-Allow-Origin: *` everywhere.

**Action items**:
1. Replace with origin-whitelisted CORS:
   ```javascript
   const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
   app.use(cors({
     origin: function(origin, callback) {
       if (!origin || allowedOrigins.includes(origin)) {
         callback(null, true);
       } else {
         callback(new Error('Not allowed by CORS'));
       }
     },
     credentials: true
   }));
   ```

2. Add rate limiting to `/uploadHandler` and `/graphql`:
   ```javascript
   const rateLimit = require('express-rate-limit');
   const uploadLimiter = rateLimit({ windowMs: 60*1000, max: 10 });
   app.post('/uploadHandler', uploadLimiter, upload.single('file'));
   ```

### 1.6: Remove or protect the push notification trigger route

**Current problem**: `/sknnzix/:type/:msg` (GET) triggers push notifications to all subscribers with arbitrary content. Publicly accessible.

**Action items**:
1. Add authentication check (same Firebase JWT middleware as 1.2)
2. Or better: remove it entirely — it's a demo feature with no frontend UI and no business value
3. If keeping for dev: require an API key from env (`SKNNZIX_API_KEY`)

### 1.7: Add body size limits

**Current problem**: `bodyParser.json()` with no `limit` option accepts arbitrarily large JSON bodies.

**Action items**:
```javascript
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
```

---

## Phase 2: Tag Search

**Effort**: Medium | **Impact**: High (requested feature, currently impossible)

### 2.1: Restructure tag storage

**Current problem**: `taglist` is a single `String` field in the Mongoose schema. Tags are presumably stored as comma-separated text with no structure.

**Action items**:
1. Change the Mongoose schema:
   ```javascript
   // models/image-rec.js
   taglist: {
     type: [String],  // Array of strings, not a single string
     index: true,      // Add MongoDB index for efficient querying
     validate: [arraySizeLimit, 'Too many tags']
   }

   function arraySizeLimit(v) {
     return v && v.length <= 20;
   }
   ```

2. Update GraphQL types:
   ```javascript
   // graphql/types/image.js
   taglist: { type: new GraphQLList(GraphQLString) }

   // graphql/types/image-input.js
   taglist: { type: new GraphQLList(GraphQLString) }

   // graphql/types/image-update.js
   taglist: { type: new GraphQLList(GraphQLString) }
   ```

3. Update frontend components to handle tag arrays:
   - `InfoFields.js`: Change the tag input to support adding/removing individual tags (tag input widget)
   - `Upload.js`: Pass tag array to mutation
   - `Edit.js`: Display tags as individual chips/badges, allow adding/removing

### 2.2: Add dedicated tag-based GraphQL queries

**Action items**:
1. Create `graphql/queries/image/byTag.js`:
   ```javascript
   module.exports = {
     type: require('../../types/image').default,
     args: { tag: { type: GraphQLString } },
     resolve(root, params, info) {
       const projection = getProjection(info.fieldNodes[0]);
       return ImageRecModel.find({ taglist: params.tag })
         .select(projection)
         .exec();
     }
   };
   ```

2. Create `graphql/queries/image/byTags.js` (multi-tag search):
   ```javascript
   module.exports = {
     type: require('../../types/image').default,
     args: { tags: { type: new GraphQLList(GraphQLString) } },
     resolve(root, params, info) {
       const projection = getProjection(info.fieldNodes[0]);
       return ImageRecModel.find({ taglist: { $in: params.tags } })
         .select(projection)
         .exec();
     }
   };
   ```

3. Register new queries in `graphql/queries/image/index.js` and `graphql/index.js`.

### 2.3: Add tag autocomplete/suggestions

**Action items**:
1. Create `graphql/queries/image/tags.js`:
   ```javascript
   module.exports = {
     type: new GraphQLList(GraphQLString),
     args: { search: { type: GraphQLString } },
     resolve(root, params, info) {
       const query = params.search ? { taglist: new RegExp(params.search, 'i') } : {};
       return ImageRecModel.distinct('taglist', query).limit(20);
     }
   };
   ```

2. Add a tag autocomplete component to `InfoFields.js` using `react-select` (already a dependency).

### 2.4: Add tag filtering to Browse view

**Action items**:
1. Add a tag filter dropdown to `Browse.js` (above the Griddle table)
2. When a tag is selected, call `imageRecsByTag(tag: "...")` instead of `imageRecs`
3. Support multi-tag filtering with `$and` semantics

---

## Phase 3: Dependency Upgrade Pass

**Effort**: High | **Impact**: High (enables everything else, but risky)

### Current Dependency Age

| Package | Current Version | Era | Modern Equivalent |
|---|---|---|---|
| react | 15.4.2 | 2016 | 18.x (hooks, concurrent features) |
| react-dom | 15.4.2 | 2016 | 18.x |
| react-router-dom | 4.0.0-beta.7 | 2016 | 6.x (major API change) or 5.3.x (compatible) |
| webpack | 3.3.0 | 2017 | 5.x (major config changes) |
| babel | 6.x | 2016 | 7.x (different preset names) |
| graphql | 0.8.1 | 2016 | 16.x (major API changes) |
| express-graphql | 0.5.4 | 2016 | **deprecated** — use `@graphql-tools` + Apollo or `mercurius` |
| Mongoose | 4.6.7 | 2016 | 8.x (major API changes) |
| sharp | 0.17.0 | 2017 | 0.33.x (API changes, native deps) |
| multer | 1.1.0 | 2016 | 1.4.5 (stable, minor changes) |
| web-push | 3.2.2 | 2017 | 3.6.x (minor changes) |
| neal-react | 0.2.5 | 2016 | **abandoned** — no modern equivalent |
| griddle-react | 1.5.0 | 2016 | **abandoned** — use `@tanstack/react-table` |
| openseadragon | 2.2.1 | 2016 | 4.x (API changes) |
| react-dropzone | via component | 2016 | 14.x (hooks-based) |
| react-image-gallery | 0.7.13 | 2016 | 1.2.x (minor changes) |
| react-select | 1.0.0-rc.3 | 2016 | 5.x (major API change) |

### Recommended Upgrade Strategy

**Do NOT attempt a single massive upgrade.** The prior rehaul (`47689e06`) and the `react-migrate` branch both attempted this and failed. The dependency graph is too interdependent.

#### 3.1: Node.js version compatibility first
- Current deps likely won't install on Node 14+ (node-gyp, deprecated npm packages)
- Test with Node 18 LTS first — some packages may need `--legacy-peer-deps`
- Consider a two-stage Docker build: build on Node 18, run on Node 20

#### 3.2: Babel 6 → 7 migration
```json
// Before (Babel 6)
"presets": ["es2015", "stage-0", "react"]

// After (Babel 7)
"presets": [
  ["@babel/preset-env", { "modules": false }],
  "@babel/preset-react",
  "@babel/preset-stage-0"
]
```

#### 3.3: Webpack 3 → 5 migration
- `loaders` → `rules` (already partially done)
- `CommonsChunkPlugin` → `optimization.splitChunks`
- `UglifyJsPlugin` → `TerserPlugin` (built into webpack 5)
- `new webpack.LoaderOptionsPlugin({...})` → `optimization` or `module.rules` options
- `publicPath` may need `/` suffix for dev server

#### 3.4: React 15 → 18 migration (largest effort)
- Convert all `React.createClass` to ES6 class components or functional components with hooks
- Replace `componentWillMount` with `componentDidMount` (4 sites)
- Replace `React.PropTypes` with runtime validation or TypeScript
- React Router v4 beta → v5.3 (compatible) or v6 (breaking changes)
- `react-dropzone-component` wrapper → direct `react-dropzone` hooks usage

#### 3.5: GraphQL stack modernization
- `express-graphql` is **deprecated** as of GraphQL v16
- Options:
  - **Apollo Server** (most popular, full-featured)
  - **Mercurius** (if switching to Fastify)
  - **@graphql-tools/schema** + `graphql-http` (minimal)
- Migrate schema from `GraphQLObjectType` to SDL (`gql` tagged template strings) — cleaner, more maintainable

#### 3.6: Replace abandoned packages
| Abandoned | Replacement | Effort |
|---|---|---|
| griddle-react | `@tanstack/react-table` or `ag-grid-react` | High — table rendering throughout Browse.js |
| neal-react | Build custom components or use `@mantine/core` / `chakra-ui` | High — entire UI kit |
| react-input-autosize | `react-textarea-autosize` | Low — drop-in replacement |

### Recommended: Phased dependency upgrades
1. **First**: Babel 7 + Webpack 5 (build tooling, no runtime changes)
2. **Second**: Mongoose 8 + graphql v16 + Apollo Server (backend API layer)
3. **Third**: React 18 + React Router v6 (frontend, largest surface area)
4. **Fourth**: Replace abandoned packages (griddle, neal-react)

Each phase should be a separate PR with its own test coverage.

---

## Phase 4: Code Quality & Modernization

**Effort**: Medium | **Impact**: Medium (maintenance, readability)

### 4.1: Standardize async/await patterns

**Current problem**: Inconsistent promise handling across the codebase.

**Action items**:
1. Remove `async` keyword from mutations that don't use `await` (`update.js`, `delete.js`)
2. Convert callback-based file upload handler to async/await (also fixes fire-and-forget bug)
3. Remove unnecessary `new Promise()` wrapper in `saveSubscriptionToDatabase`
4. Add error handling to fire-and-forget sharp callbacks (log + cleanup orphaned files)

### 4.2: Fix GraphQL resolver inconsistencies

**Current problem**: Geopoint queries use deprecated `fieldASTs` API; image queries use correct `fieldNodes`.

**Action items**:
1. Standardize all resolvers to use `info.fieldNodes[0]` (graphql v0.8+ API)
2. Fix `delete.js` import: change `imageRecUpdateType` to `imageRecInputType`
3. Consider migrating from `get-projection.js` to explicit field lists (cleaner, no AST parsing)

### 4.3: Clean up dead code

**Action items**:
1. Remove `Shell-new.js` and `client-routes.js` (unused code-splitting approach)
2. Remove `Login.js` or wire it into navigation (Google/Facebook auth not functional)
3. Remove `react-input-autosize` from package.json (unused dependency)
4. Remove `react-redux` import from `Browse.js` (dead import, not in package.json)
5. Rename package from `oscon16-spa` to `scene-history` (or appropriate name)

### 4.4: Add basic test infrastructure

**Current problem**: `npm test` exits with error code 1. No tests exist.

**Action items**:
1. Add Jest (works with Babel 7, no config needed for React)
2. Start with unit tests for:
   - `get-projection.js` utility
   - GraphQL resolvers (mock Mongoose)
   - Image processing pipeline (mock sharp)
3. Add integration tests for:
   - File upload endpoint (test with supertest)
   - GraphQL query/mutation endpoints
4. Add E2E tests with Playwright (optional, long-term)

### 4.5: Add proper logging

**Current problem**: `morgan` is installed but commented out. Errors are logged to console with no structure.

**Action items**:
1. Enable morgan with JSON format for containerized logging:
   ```javascript
   app.use(morgan('combined'));
   ```
2. Add a structured logger (pino or winston) for application-level logging
3. Log upload events, auth failures, and GraphQL errors with context

---

## Phase 5: Infrastructure & Operations

**Effort**: Low-Medium | **Impact**: Medium (reliability, observability)

### 5.1: Push notification persistence

**Current problem**: Subscriptions stored in module-level object, lost on restart.

**Action items**:
1. Store subscriptions in MongoDB (create `PushSubscription` model)
2. Add cleanup job for expired/bounced subscriptions
3. Consider migrating from web-push to a proper notification service (Firebase Cloud Messaging, OneSignal)

### 5.2: Geopoint subqueries

**Current problem**: TODO in resolvers notes that geopoint subqueries are not implemented.

**Action items**:
1. Add `$lookup` aggregation in image queries to include related geopoints
2. Or: add a `geoPoints` field resolver on `ImageRec` type that fetches geopoints by `imageId`

### 5.3: Database migration strategy

**Current problem**: Changing `taglist` from String to `[String]` will break existing data.

**Action items**:
1. Write a migration script that runs on startup (one-time):
   ```javascript
   // Migrate existing taglist strings to arrays
   ImageRec.find({ taglist: { $not: { $type: 'array' } } }).then(images => {
     images.forEach(img => {
       img.taglist = img.taglist.split(',').map(t => t.trim()).filter(Boolean);
       img.save();
     });
   });
   ```
2. Add a `schemaVersion` field to track migration state

### 5.4: Deployment pipeline

**Current problem**: `ops/deploy.sh` builds webpack and uploads to S3. No CI/CD.

**Action items**:
1. Add GitHub Actions workflow:
   - Lint + build on every PR
   - Run tests on push to main
   - Build Docker image and push to registry
2. Update deployment to use Docker Compose or Kubernetes
3. Add health check endpoint (`/health`) for load balancer

---

## Recommended Execution Order

```
Phase 0: Docker Support          ← START HERE (enables everything)
    ↓
Phase 1: Security Hardening      ← Critical, blocks deployment
    ↓
Phase 2: Tag Search              ← Feature work, builds on security fixes
    ↓
Phase 3: Dependency Upgrade      ← Large effort, do after stabilizing
    ↓
Phase 4: Code Quality            ← Ongoing maintenance
    ↓
Phase 5: Infrastructure          ← Long-term reliability
```

### Why this order?
1. **Docker first** — every developer can run the app locally without SSL cert setup, MongoDB installation, or Node version matching. Unblocks all other work.
2. **Security second** — the open issue. Must be fixed before any deployment. Many security fixes (env vars, auth middleware) are prerequisites for a clean dependency upgrade.
3. **Tag search third** — concrete feature work that benefits from the security foundation (proper DB connection, input validation).
4. **Dependency upgrade last** — highest risk, highest effort. Only attempt after the codebase is secure, tested, and running in Docker. The prior rehaul failed because it tried to do everything at once.

---

## Risk Assessment

| Phase | Risk Level | Mitigation |
|---|---|---|
| 0: Docker | Low | Well-understood patterns; can start with simple single-container setup |
| 1: Security | Medium | Env var migration is straightforward; auth middleware needs Firebase JWT knowledge |
| 2: Tag Search | Low-Medium | Schema change requires data migration; query additions are isolated |
| 3: Dependencies | **High** | Major API changes across React, Webpack, GraphQL; test coverage essential before starting |
| 4: Code Quality | Low | Incremental changes, each independently reviewable |
| 5: Infrastructure | Low-Medium | Mostly additive work, no breaking changes |

---

## Quick Wins (Can be done in <1 hour each)

These can be completed immediately without planning:

1. **Remove dead imports**: `react-redux` from Browse.js, `react-input-autosize` from package.json
2. **Fix delete.js import**: Change `imageRecUpdateType` → `imageRecInputType`
3. **Remove unused async**: Clean up `update.js` and `delete.js` resolve signatures
4. **Add .env.example**: Document all required env vars (Phase 1, item 1.1)
5. **Escape regex in keywords.js**: One-line fix for ReDoS (Phase 1, item 1.4)
6. **Add body size limit**: One-line config change (Phase 1, item 1.7)

---

## Notes on the Prior Rehaul (commit 47689e06)

The prior attempt added:
- Dockerfile and docker-compose.yml (good, but used `node:8` and `mongo:4.4`)
- `.env.example` (good, but server code wasn't updated to read env vars)
- Partial Browse.js, Edit.js, SlideShow.js, Upload.js refactors (unclear what changed)
- Partial server-routes.js rewrite (183 lines changed — unclear scope)

**What went wrong**: The Docker scaffolding was added but the server code wasn't fully migrated to use environment variables. The commit was then stashed/abandoned on the `take-two-rehaul` branch. The Docker files no longer exist on disk.

**What to reuse**: The Dockerfile and docker-compose.yml structure from that commit is a good starting point, but needs updating to modern base images (`node:20`, `mongo:6`) and the server code migration that was started needs to be completed.
