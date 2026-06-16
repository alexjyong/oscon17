# Importing MongoDB Data into the Running Application

## What is this?

MongoDB dump archives (`.tar.bz2` or `.tar.gz`) contain **image metadata only** — records for `imagerecs` and `geopointrecs` collections. The actual image files (thumbnails, 1K images, deep zoom tiles) are stored as regular files on separate Docker volumes (`uploads/`, `thumbs/`, `images/`, `tiles/`) and are **not** included in any MongoDB dump.

If those volume files don't exist (e.g., fresh `docker compose up`), images will appear in the UI listing but won't display.

---

## Recommended: Use the import script

The project includes `ops/import-data.sh` which handles everything automatically — detecting the mongo container, extracting the archive, running mongorestore, verifying counts, and cleaning up.

### Usage

```bash
# Auto-detect archive (finds .tar.bz2 or .tar.gz in project root)
./ops/import-data.sh

# Specify a particular file
./ops/import-data.sh oscon-test.tar.bz2

# Restore from an absolute path
./ops/import-data.sh /path/to/dump.tar.gz

# Drop existing collections before restoring (full replacement)
IMPORT_DATA_DROP=true ./ops/import-data.sh dump.tar.bz2
```

### What it does

1. Detects the running mongo container (works with `docker compose` or `docker-compose`)
2. Extracts the archive to a temp directory
3. Copies data into the mongo container via `docker cp`
4. Runs `mongorestore --db oscon-test`
5. Verifies document counts
6. Cleans up temp files and container temp data

### Supported formats

| Format | Extension |
|---|---|
| bzip2 tar | `.tar.bz2`, `.tbz2` |
| gzip tar | `.tar.gz`, `.tgz` |

---

## Manual steps (for reference)

Use these if you can't use the script or want to understand what it does.

### 1. Extract the archive

```bash
tar xjf oscon-test.tar.bz2
# or for gzip:
tar xzf dump.tar.gz
```

This creates a directory (e.g., `oscon-test/`) with `.bson` and `.metadata.json` files.

### 2. Find the mongo container

```bash
docker compose ps --format "{{.Name}}" | grep mongo
# or: docker ps --format "{{.Names}}" | grep mongo
```

### 3. Copy into the container

```bash
docker cp oscon-test <mongo-container>:/tmp/oscon-test
```

> **Why not mount the volume directly?** The host filesystem path doesn't exist inside the container. `docker cp` is the simplest way to get files in.

### 4. Run mongorestore

```bash
docker exec <mongo-container> mongorestore --db oscon-test /tmp/oscon-test/
```

Expected output:
```
restoring oscon-test.geopointrecs from /tmp/oscon-test/geopointrecs.bson
restoring oscon-test.imagerecs from /tmp/oscon-test/imagerecs.bson
119 document(s) restored successfully. 0 failures
```

### 5. Verify

```bash
docker exec <mongo-container> mongo oscon-test --eval \
  "db.getCollectionNames().forEach(function(c) { print(c + ': ' + db.getCollection(c).count()) })"
```

Expected:
```
geopointrecs: 2
imagerecs: 117
```

### 6. Clean up

```bash
rm -rf oscon-test
docker exec <mongo-container> rm -rf /tmp/oscon-test
```

---

## Troubleshooting

### "no such file or directory" on mongorestore
The host path doesn't exist inside the container. Use `docker cp` to copy files in first (step 3 above).

### "stream or file does not appear to be a mongodump archive"
Don't pipe the tar directly into `mongorestore --archive`. That flag expects mongodump's binary format, not a plain tar. Extract first, then restore.

### "restoring to existing collection without dropping" / duplicate documents
mongorestore won't overwrite existing docs by default. Use `IMPORT_DATA_DROP=true ./ops/import-data.sh file.tar.bz2` to drop collections first, or manually add `--drop` to the mongorestore command.

### Container name is different
The script auto-detects it, but you can always find it with:
```bash
docker compose ps --format "table {{.Names}}\t{{.Image}}" | grep mongo
```

### Images show but don't display
The archive only contains metadata, not image files. The actual images live on the `uploads/`, `thumbs/`, `images/`, and `tiles/` Docker volumes. If those volumes are empty (fresh docker-compose up), you'll need to re-upload images through the UI at `/upload`.
