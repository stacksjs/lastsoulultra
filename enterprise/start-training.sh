#!/bin/sh
set -eu
# Buddy records the private media environment beside this launcher at deploy.
# Runtime services can load it without access to the privileged Pantry CLI.
. "$(dirname "$0")/runtime-env.sh"
if [ "${1:-}" = --local-speech ]; then
  shift
  exec /bin/sh scripts/start-local-speech.sh "$@"
fi
exec ./scripts/start-production.sh "$@"
