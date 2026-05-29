#!/bin/bash
set -e

npm install --legacy-peer-deps --no-audit --no-fund 2>&1 || true

rm -rf .local/skills/.tmp-* .local/skills/.old-* 2>/dev/null || true

echo "Post-merge setup complete"
