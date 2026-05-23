#!/bin/sh
# Fail if env files or obvious secrets are tracked by git.
set -e
cd "$(dirname "$0")/.."

tracked_env="$(git ls-files '.env' '.env.local' '.env.production' '.env.development' 2>/dev/null || true)"
if [ -n "$tracked_env" ]; then
  echo "error: env files must not be committed:" >&2
  echo "$tracked_env" >&2
  exit 1
fi

if git grep -E 'RESEND_API_KEY=re_|FIREBASE_SERVICE_ACCOUNT_JSON=\{' -- ':!*.example' ':!docs/*' ':!scripts/*' 2>/dev/null; then
  echo "error: possible secret values in tracked files (see above)" >&2
  exit 1
fi

echo "check-no-secrets-in-git: ok"
