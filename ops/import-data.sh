#!/usr/bin/env bash
#
# import-data.sh — Restore a MongoDB dump archive into the running oscon17 app.
#
# Usage:
#   ./ops/import-data.sh oscon-test.tar.bz2          # explicit file
#   ./ops/import-data.sh                              # auto-detects .tar.bz2 in project root
#   ./ops/import-data.sh /path/to/dump.tar.gz         # any tar archive
#
# What it does:
#   1. Finds the running mongo container (by docker-compose project name)
#   2. Extracts the archive into a temp directory
#   3. Copies the extracted data into the mongo container
#   4. Runs mongorestore into the oscon-test database
#   5. Verifies document counts
#   6. Cleans up temp files
#
# Important: This only restores MongoDB metadata (image records, geopoints).
# Actual image files live on separate Docker volumes and are NOT included.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- helpers ---

log()  { echo "[import-data] $*"; }
warn() { echo "[import-data] WARNING: $*" >&2; }
die()  { echo "[import-data] ERROR: $*" >&2; exit 1; }

# --- detect mongo container ---

detect_mongo_container() {
  # Try docker compose first (modern), fall back to docker-compose
  local compose_cmd=""
  if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    compose_cmd="docker compose"
  elif command -v docker-compose &>/dev/null; then
    compose_cmd="docker-compose"
  else
    die "Neither 'docker compose' nor 'docker-compose' found. Is Docker installed?"
  fi

  # Get the project name from docker-compose.yml (defaults to directory basename)
  local project
  project="$($compose_cmd config --project-name 2>/dev/null | head -1)" || true
  if [ -z "$project" ]; then
    project="$(basename "$(pwd)")"
  fi

  local container
  container=$($compose_cmd ps --format "{{.Name}}" mongo 2>/dev/null | grep -v "^time=" | head -1) || true

  if [ -z "$container" ]; then
    # Fallback: look for any running container with "mongo" in the name
    container=$(docker ps --format "{{.Names}}" | grep -i mongo | head -1) || true
  fi

  if [ -z "$container" ]; then
    die "No running mongo container found. Is the app up? Run 'docker compose up -d' first."
  fi

  echo "$container"
}

# --- detect archive file ---

detect_archive() {
  local target="${1:-}"

  if [ -n "$target" ]; then
    if [ ! -f "$target" ]; then
      die "File not found: $target"
    fi
    echo "$target"
    return
  fi

  # Auto-detect: look for .tar.bz2, .tar.gz, .tgz in project root
  local found=()
  for ext in *.tar.bz2 *.tbz2 *.tar.gz *.tgz; do
    [ -f "$ext" ] && found+=("$PROJECT_ROOT/$ext")
  done

  if [ ${#found[@]} -eq 0 ]; then
    die "No archive file found. Pass a path or place a .tar.bz2/.tar.gz in $PROJECT_ROOT"
  fi

  if [ ${#found[@]} -gt 1 ]; then
    die "Multiple archives found, be specific: ${found[*]}"
  fi

  echo "${found[0]}"
}

# --- main ---

main() {
  local archive
  archive="$(detect_archive "${1:-}")"

  local mongo_container
  mongo_container="$(detect_mongo_container)"

  log "Archive:    $archive"
  log "Mongo DB:   $mongo_container"

  # Extract to a temp directory (use archive basename without extension as dir name)
  local archive_name
  archive_name="$(basename "$archive")"
  local extract_dir
  extract_dir="$(mktemp -d)"

  log "Extracting to temp dir..."
  case "$archive" in
    *.tar.bz2|*.tbz2) tar xjf "$archive" -C "$extract_dir" ;;
    *.tar.gz|*.tgz)   tar xzf "$archive" -C "$extract_dir" ;;
    *)                die "Unsupported archive format: $archive (use .tar.bz2 or .tar.gz)" ;;
  esac

  # Find the extracted directory (should be a single top-level dir)
  local extracted_dirs=()
  for d in "$extract_dir"/*/; do
    [ -d "$d" ] && extracted_dirs+=("$d")
  done

  if [ ${#extracted_dirs[@]} -eq 0 ]; then
    # Maybe the archive is flat (no top-level directory) — use extract_dir itself
    if ls "$extract_dir"/*.bson &>/dev/null; then
      dump_dir="$extract_dir"
      dump_name="dump"
    else
      die "No directories found in archive. Is this a valid mongodump?"
    fi
  elif [ ${#extracted_dirs[@]} -eq 1 ]; then
    dump_dir="${extracted_dirs[0]}"
    dump_name="$(basename "$dump_dir")"
  else
    die "Multiple top-level directories in archive. Expected a single mongodump directory."
  fi

  # Verify it looks like a mongodump (check for .bson files)
  if ! ls "$dump_dir"/*.bson &>/dev/null; then
    warn "No .bson files found in archive. This may not be a mongodump."
  fi

  log "Copying into mongo container..."
  docker cp "$dump_dir" "$mongo_container:/tmp/$dump_name"

  log "Running mongorestore..."
  local restore_output
  local drop_flag=""
  if [ "${IMPORT_DATA_DROP:-false}" = "true" ]; then
    drop_flag="--drop"
    log "Using --drop mode (will delete existing collections first)"
  fi
  restore_output=$(docker exec "$mongo_container" mongorestore $drop_flag --db oscon-test "/tmp/$dump_name/" 2>&1) || {
    echo "$restore_output"
    die "mongorestore failed. Check the output above."
  }

  echo "$restore_output" | grep -E "(restoring|finished|document)" || true

  # Verify
  log "Verifying restore..."
  local verify_output
  verify_output=$(docker exec "$mongo_container" mongo oscon-test --quiet --eval \
    "db.getCollectionNames().forEach(function(c) { print(c + ': ' + db.getCollection(c).count()) })" 2>&1)

  echo "$verify_output"
  log "Restore complete."

  # Cleanup
  log "Cleaning up..."
  docker exec "$mongo_container" rm -rf "/tmp/$dump_name"
  rm -rf "$extract_dir"

  log "Done."
}

main "$@"
