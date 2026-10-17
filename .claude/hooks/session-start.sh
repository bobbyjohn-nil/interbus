#!/bin/bash
# Session start for interbus. In a cloud session it installs what the checks need (npm packages,
# the pinned pyosmium for the bake, the fonts and the city files) and exports the paths the tests
# read. At a start or a clear it prints docs/STATUS.md, so a new session starts from the handoff
# (CLAUDE.md "How sessions work"); a resume already holds it and a compaction's summary carries what
# is in flight, so neither prints it again (D27). Idempotent; a failed optional step warns.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

# What started this session: startup, resume, clear or compact (JSON on stdin).
source_kind=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).source||"")}catch{console.log("")}})' 2>/dev/null || true)

warn() { echo "session-start: $1 failed; run it by hand if you need it" >&2; }

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ "$source_kind" != "compact" ] && [ "$source_kind" != "resume" ]; then
  # npm install keeps the cached node_modules between sessions; the lockfile pins every version.
  npm install --no-audit --no-fund --loglevel=error >&2 || { echo "session-start: npm install failed" >&2; exit 1; }

  # pyosmium for tools/bake/osm.py, in its own venv, from hashed wheels.
  venv=.cache/bakevenv
  want=$(sha256sum tools/bake/requirements.txt | cut -d' ' -f1)
  if [ "$(cat "$venv/.requirements-sha256" 2>/dev/null)" != "$want" ]; then
    rm -rf "$venv"
    if python3 -m venv "$venv" >&2 \
      && "$venv/bin/pip" install --quiet --require-hashes --only-binary=:all: --no-deps -r tools/bake/requirements.txt >&2; then
      echo "$want" > "$venv/.requirements-sha256"
    else
      warn "the pyosmium install"
    fi
  fi

  npm run --silent fonts >&2 || warn "npm run fonts"
  npm run --silent cities >&2 || warn "npm run cities"

  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    [ -x "$venv/bin/python" ] && echo "export BAKE_PYTHON=\"$PWD/$venv/bin/python\"" >> "$CLAUDE_ENV_FILE"
    # Playwright's pinned browser may not be the preinstalled one; point the tests at what exists.
    chrome=$(ls -d "${PLAYWRIGHT_BROWSERS_PATH:-/nonexistent}"/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)
    [ -n "$chrome" ] && echo "export PW_CHROMIUM=\"$chrome\"" >> "$CLAUDE_ENV_FILE"
    # Node's fetch uses the outbound proxy only when asked (bake:sources, cities); silence just
    # the "EnvHttpProxyAgent is experimental" notice it prints for every node process.
    if [ -n "${HTTPS_PROXY:-}" ]; then
      echo "export NODE_USE_ENV_PROXY=1" >> "$CLAUDE_ENV_FILE"
      echo "export NODE_OPTIONS=\"\${NODE_OPTIONS:+\$NODE_OPTIONS }--disable-warning=UNDICI-EHPA\"" >> "$CLAUDE_ENV_FILE"
    fi
  fi
fi

if [ -f docs/STATUS.md ] && [ "$source_kind" != "compact" ] && [ "$source_kind" != "resume" ]; then
  echo "interbus: the session handoff follows (docs/STATUS.md). Read CLAUDE.md's rules, then work from it."
  echo
  cat docs/STATUS.md
fi
exit 0
