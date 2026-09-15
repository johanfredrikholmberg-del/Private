#!/usr/bin/env bash
# Vercel Ignored Build Step for StudieLots.
# Exit 0 = skip deployment. Exit 1 = build/deploy.
set -eu

branch="${VERCEL_GIT_COMMIT_REF:-}"
case "$branch" in
  gu-*|lu-*|boras-*|kau-*|karlstad-*|susa-*|data-*|import-*|audit-*)
    echo "Skipping Vercel deployment for data/import branch: $branch"
    exit 0
    ;;
esac
echo "Vercel deployment allowed for branch: ${branch:-unknown}"
exit 1
