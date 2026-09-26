#!/usr/bin/env bash
# Start the Vite dev server (:5173) inside a tmux session, so it survives any
# one terminal or Claude session and either of us can restart it.
#
# Usage:
#   scripts/start-dev.sh            start (or report) the tmux session "cairn-dev"
#   scripts/start-dev.sh --attach   same, then attach to the session
#   scripts/start-dev.sh --no-tmux  run in the foreground of this terminal
#
# Inside tmux: Ctrl-b d detaches (keeps running); Ctrl-C stops the server.
# Logs: tmux capture-pane -pt cairn-dev
set -euo pipefail
cd "$(dirname "$0")/.."

SESSION=cairn-dev
PORT=5173

if [[ "${1:-}" == "--no-tmux" ]] || ! command -v tmux >/dev/null; then
  # Without --strictPort, Vite quietly moves to :5174 when :5173 is taken,
  # which is the port the Playwright suite claims for itself.
  exec npm run dev -- --port "$PORT" --strictPort
fi

# Link the dev window into the invoking tmux session so it's one Ctrl-b n
# away, while the canonical cairn-dev session keeps it alive independently.
# $TMUX names the exact session — it's inherited even by Claude's shells,
# since claude is launched inside tmux. Outside tmux we don't guess.
link_into_current_session() {
  [[ -z "${TMUX:-}" ]] && return 0
  local target
  target="$(tmux display-message -p '#S')"
  [[ -z "$target" || "$target" == "$SESSION" ]] && return 0
  if ! tmux list-windows -t "$target" -F '#{window_name}' | grep -qx "$SESSION"; then
    tmux link-window -d -s "$SESSION:^" -t "$target" 2>/dev/null &&
      echo "Linked '$SESSION' as a window in session '$target'."
  fi
}

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "tmux session '$SESSION' already exists."
else
  if ss -tln 2>/dev/null | grep -q ":$PORT "; then
    echo "Port $PORT is in use but there's no '$SESSION' session — a stray process is still running." >&2
    echo "Check: ss -tlnp | grep $PORT" >&2
    exit 1
  fi
  tmux new-session -d -s "$SESSION" -n "$SESSION" "scripts/start-dev.sh --no-tmux"
  echo "Started dev server in tmux session '$SESSION'."
fi
link_into_current_session

if [[ "${1:-}" == "--attach" && -t 0 ]]; then
  if [[ -n "${TMUX:-}" ]]; then
    exec tmux switch-client -t "$SESSION"
  else
    exec tmux attach -t "$SESSION"
  fi
else
  echo "Attach with: tmux attach -t $SESSION (or 'tmux switch -t $SESSION' from inside tmux)"
fi
