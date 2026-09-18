#!/usr/bin/env bash
# ------------------------------------------------------------------
# Unzip the fixed physics project and push it to the "main" branch.
# Run this INSIDE your Codespace terminal, from the folder where you
# uploaded physics-main-fixed.zip (e.g. the repo root or ~/workspace).
# ------------------------------------------------------------------
set -euo pipefail

ZIP_FILE="physics-main-fixed.zip"
REPO_DIR="."                # path to the repo root (default: current directory)
COMMIT_MSG="fix: resolve tsc build errors (CodeEditor types, ReactNode union, missing @types/node)"

if [ ! -f "$ZIP_FILE" ]; then
  echo "❌ $ZIP_FILE not found in $(pwd). Upload it here first."
  exit 1
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "❌ $REPO_DIR is not a git repo. Edit REPO_DIR in this script to point at your clone."
  exit 1
fi

echo "▶ Unzipping $ZIP_FILE ..."
TMP_DIR="$(mktemp -d)"
unzip -oq "$ZIP_FILE" -d "$TMP_DIR"

# The zip contains a top-level "physics-main" folder; copy its contents
# over the existing repo, but never touch .git itself.
SRC_DIR="$TMP_DIR/physics-main"
if [ ! -d "$SRC_DIR" ]; then
  echo "❌ Expected folder physics-main/ inside the zip, but didn't find it."
  exit 1
fi

echo "▶ Syncing files into $REPO_DIR ..."
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'src/content/catalogue.json' \
  --exclude "$ZIP_FILE" \
  --exclude "$(basename "$0")" \
  "$SRC_DIR/" "$REPO_DIR/"

cd "$REPO_DIR"

echo "▶ Installing dependencies ..."
npm install

echo "▶ Running local build to double-check before pushing ..."
npm run build

echo "▶ Committing ..."
git add -A
if git diff --cached --quiet; then
  echo "ℹ Nothing changed — skipping commit/push."
  exit 0
fi
git commit -m "$COMMIT_MSG"

echo "▶ Pushing to origin main ..."
git push origin HEAD:main

echo "✅ Done. Vercel should pick this up and redeploy automatically."
