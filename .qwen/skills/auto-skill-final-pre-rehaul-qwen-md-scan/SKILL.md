---
name: final-pre-rehaul-qwen-md-scan
description: Do a focused, non-nitpicky final scan of QWEN.md before a major rehaul — catch only genuinely wrong or missing items
source: auto-skill
extracted_at: '2026-06-15T03:40:38.238Z'
---

## Purpose

When the user says "one final pass before a rehaul" or "don't be nitpicky, just check for genuinely missing or wrong," skip the exhaustive pass-by-pass audit and do a targeted scan focused on accuracy over completeness.

## Procedure

### 1. Quick Structure Verification
- Glob key directories (`js/*.js`, `graphql/**/*.js`, `public/**/*.js`, `models/*.js`) to verify the file count and existence of major components.
- Read `package.json` to check for dependency mismatches, dead deps, or name inconsistencies.

### 2. Spot-Check Key Claims
Read only the files that QWEN.md makes specific claims about:
- Entry points (`Shell.js`, `index.js`, `index-local.js`)
- Server files (`server-es6.js`, `server-test.js`, `server-routes.js`)
- GraphQL schema root and key query/mutation files
- Any file QWEN.md says "doesn't exist" or "is unused" — verify with `ls` or glob

### 3. Grep for Specific Patterns
Run targeted greps to verify or refute documented claims:
- `componentWillMount|UNSAFE_componentWillReceiveProps` — verify deprecated lifecycle usage
- `react-redux` — confirm dead imports
- `sessionStorage` — verify documented persistence patterns
- `System\.import` — confirm code-splitting claims
- `cache:\s*['\"]reload['\"]` — verify GraphQL fetch patterns
- `React\.createClass` — count and confirm class component usage

### 4. Check Symlinks and Special Cases
- Use `ls -la` on paths QWEN.md says "don't exist" — they may be symlinks
- Check if referenced directories are actually symlinks to `node_modules/`

### 5. Only Update What's Genuinely Wrong or Missing
Filter findings through this lens: **would a new developer be misled by the current QWEN.md?**
- ✅ Update if: path is wrong, file doesn't exist (or does), behavior described incorrectly
- ✅ Add if: undocumented feature that affects how the code works (hidden routes, dead imports with consequences)
- ❌ Skip if: minor naming inconsistency (Geopoint vs GeoPoint), cosmetic description improvements
- ❌ Skip if: already documented in a different section

### 6. Apply Changes Concisely
- Replace or append to the "Important Notes" section with corrected/added items
- Keep descriptions factual and specific — include file paths and what the code actually does
- Do NOT restructure or rewrite sections that are already accurate

## Key Principles

- **Trust but verify.** If QWEN.md says a file "doesn't exist," check with `ls -la` — it might be a symlink.
- **Count, don't estimate.** "Several components" → grep and report the exact count.
- **Distinguish wrong from incomplete.** A vague description isn't worth fixing in a final pass. A wrong claim is.
- **Respect the user's scope.** "Don't be nitpicky" means skip version number pedantry, whitespace, and style observations.
- **Report what you found.** Even if nothing changes, tell the user what you checked and why nothing needed updating.
