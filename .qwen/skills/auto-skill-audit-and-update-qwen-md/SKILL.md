---
name: audit-and-update-qwen-md
description: Systematically audit and update a QWEN.md project context file by cross-referencing the actual codebase
source: auto-skill
extracted_at: '2026-06-15T02:58:15.273Z'
---

## Purpose

When asked to make a QWEN.md file "up to date" or "two more passes," follow this systematic audit procedure to ensure the project context file accurately reflects the actual codebase.

## Procedure

### Pass 1: Initial Read + Structure Verification

1. **Read the existing QWEN.md** to understand what's currently documented.
2. **List all directories** at the top level and in key subdirectories (`js/`, `graphql/`, `public/`, `models/`, `ops/`).
3. **Cross-reference the directory structure** in QWEN.md against actual files on disk:
   - Check for missing files/directories not mentioned in QWEN.md
   - Check for stale entries (files that no longer exist)
   - Verify file descriptions match actual content

### Pass 2: Deep File Verification

4. **Read key files** that QWEN.md describes to verify accuracy:
   - Entry points (`index.js`, `index-local.js`, `Shell.js`)
   - Server files (`server-es6.js`, `server-test.js`, `server-routes.js`)
   - Build config (`webpack.config.js`, `.babelrc`)
   - GraphQL schema (`graphql/index.js`, query/mutation/type subdirs)
   - Models, components, and public assets
5. **Check for discrepancies** such as:
   - Wrong file paths (e.g., `public/css/main.scss` vs actual `css/main.scss`)
   - Outdated technology versions (e.g., Webpack 2 vs 3)
   - Missing files not documented
   - Incorrect descriptions of what files do

### Pass 3: Convention and Note Verification

6. **Read remaining components** to verify development conventions are accurate:
   - Check if all documented patterns actually exist in the code
   - Identify undocumented patterns (e.g., SPA fallback routes, code-splitting alternative)
   - Verify Firebase auth usage across components
   - Check PWA/service worker files for VAPID key locations
7. **Update the QWEN.md** with:
   - Expanded directory structure (every file, not just summaries)
   - Corrected paths and descriptions
   - New conventions discovered during reading
   - Notes about unused/dead code
   - Deployment and operations details

## Key Principles

- **Never trust a summary.** List every file explicitly rather than using `*.js` shorthand.
- **Verify paths.** Source files vs compiled output paths are often confused (e.g., `css/main.scss` is in project root, not `public/css/`).
- **Document dead code.** Files that exist but are not wired up (like `Shell-new.js`, `Login.js`) should be noted as unused.
- **Cross-reference multiple files.** A convention mentioned in one file may be contradicted or expanded by another.
- **Check git history** for recent changes that may have altered the codebase since the QWEN.md was last updated.

## Output Format

When updating QWEN.md, maintain the existing structure but expand:
- **Directory Structure** — list every file with a brief description of its purpose
- **Development Conventions** — add any new patterns discovered, clarify ambiguous ones
- **Important Notes** — add notes about dead code, deployment, and other operational details
