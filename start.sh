#!/bin/sh
# Works from any working directory, including paths containing spaces.
set -eu
site_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if ! command -v node >/dev/null 2>&1; then
    printf '%s\n' 'Node.js 22+ is required for this launcher.' 'Alternatively: cd to this folder and run python3 -m http.server 5500 --bind 127.0.0.1' >&2
    exit 1
fi
exec node "$site_root/scripts/start.cjs" "$@"
