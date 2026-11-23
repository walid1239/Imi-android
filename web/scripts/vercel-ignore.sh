#!/usr/bin/env bash
set -eu

case "${VERCEL_GIT_COMMIT_REF:-}" in
  feature/imi-teacher-admin-preview|main)
    echo "Allowed IMI preview source branch: ${VERCEL_GIT_COMMIT_REF}"
    exit 1
    ;;
  *)
    echo "Skipping IMI deployment for non-allowlisted branch."
    exit 0
    ;;
esac
