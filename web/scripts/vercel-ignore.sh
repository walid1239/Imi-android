#!/usr/bin/env bash
set -eu

# Never build a Production deployment, even if main is configured as Vercel's
# production branch. Configure a separate, non-used production branch in Vercel
# if main should receive Preview deployments.
if [ "${VERCEL_ENV:-preview}" = "production" ]; then
  echo "Skipping Production deployment; IMI is Preview-only."
  exit 0
fi

case "${VERCEL_GIT_COMMIT_REF:-}" in
  feature/imi-teacher-admin-preview|main)
    echo "Allowed IMI Preview source branch: ${VERCEL_GIT_COMMIT_REF}"
    exit 1
    ;;
  *)
    echo "Skipping IMI deployment for non-allowlisted branch."
    exit 0
    ;;
esac
