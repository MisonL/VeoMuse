#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
HOOKS_DIR="${ROOT_DIR}/.githooks"

git -C "${ROOT_DIR}" config core.hooksPath .githooks
chmod +x "${HOOKS_DIR}/pre-push"

echo "[hooks] core.hooksPath set to .githooks"
echo "[hooks] pre-push hook is now active"
