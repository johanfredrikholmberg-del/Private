#!/usr/bin/env bash
# Vercel Ignored Build Step for StudieLots.
# Exit 0 = skip deployment. Exit 1 = build/deploy.
set -eu
branch="${VERCEL_GIT_COMMIT_REF:-}"
case "$branch" in
  gu-*|lu-*|boras-*|kau-*|karlstad-*|susa-*|data-*|import-*|audit-*) exit 0 ;;
esac
exit 1
