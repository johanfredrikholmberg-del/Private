#!/usr/bin/env bash
# Vercel Ignored Build Step for StudieLots.
# Exit 0 = skip deployment. Exit 1 = build/deploy.
set -eu

branch="${VERCEL_GIT_COMMIT_REF:-}"

# Data ingestion, verification and audit branches run in GitHub Actions and
# must not consume Vercel Deployment Storage.
case "$branch" in
  gu-*|lu-*|boras-*|kau-*|karlstad-*|susa-*|data-*|import-*|audit-*)
    echo "Skipping Vercel deployment for data/import branch: $branch"
    exit 0
    ;;
esac

# Production and intentional UI/feature previews continue to deploy normally.
echo "Vercel deployment allowed for branch: ${branch:-unknown}"
exit 1
