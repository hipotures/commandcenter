#!/usr/bin/env bash
set -euo pipefail

# Verbose logs to stderr: VERBOSE=1 bash cc_usage.sh

OUTDIR="${OUTDIR:-/tmp/claude-stats}"
CLAUDE_CMD="${CLAUDE_CMD:-claude --no-chrome --setting-sources local}"
WIDTH="${WIDTH:-140}"
HEIGHT="${HEIGHT:-50}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

TIMEOUT_READY="${TIMEOUT_READY:-45}"
TIMEOUT_STATUS="${TIMEOUT_STATUS:-45}"
TIMEOUT_USAGE="${TIMEOUT_USAGE:-45}"
ATTEMPTS="${ATTEMPTS:-3}"

VERBOSE="${VERBOSE:-0}"
CC_USAGE_LOG_DB="${CC_USAGE_LOG_DB:-1}"
CC_USAGE_DB_PATH="${CC_USAGE_DB_PATH:-$HOME/.claude/db/cc_usage.db}"
CC_USAGE_LOGGER="${CC_USAGE_LOGGER:-$SCRIPT_DIR/cc_usage_logger.py}"

mkdir -p "$OUTDIR"
ts="$(date +%Y%m%d-%H%M%S)"
SESSION="claude_usage_${ts}_$$"
TARGET="${SESSION}:0.0"
logfile="$OUTDIR/usage-$ts.txt"
status_logfile="$OUTDIR/status-$ts.txt"

log() {
  [[ "$VERBOSE" == "1" ]] || return 0
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2
}

cleanup() {
  # Exit Usage and Claude, then stop tmux.
  tmux send-keys -t "$TARGET" Escape 2>/dev/null || true
  tmux send-keys -t "$TARGET" C-d 2>/dev/null || true
  sleep 0.1
  tmux send-keys -t "$TARGET" C-d 2>/dev/null || true
  sleep 0.2
  tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "tmux session: $SESSION"
tmux new-session -d -s "$SESSION" -x "$WIDTH" -y "$HEIGHT"

log "Start Claude: $CLAUDE_CMD"
tmux send-keys -t "$TARGET" "$CLAUDE_CMD" Enter

# Wait for the Claude prompt (line starts with '>').
start=$SECONDS
while (( SECONDS - start < TIMEOUT_READY )); do
  pane="$(tmux capture-pane -p -J -t "$TARGET" 2>/dev/null || true | tr $'\302\240' ' ')"
  if grep -qE '^[[:space:]]*>' <<<"$pane"; then
    break
  fi
  sleep 0.2
done

ok_status=0
log "Attempts to enter /status: ATTEMPTS=$ATTEMPTS"

for ((i=1; i<=ATTEMPTS; i++)); do
  log "Attempt $i: sending /status (Enter x2)"
  tmux send-keys -t "$TARGET" "/status" Enter
  sleep 0.3
  tmux send-keys -t "$TARGET" Enter

  start=$SECONDS
  while (( SECONDS - start < TIMEOUT_STATUS )); do
    pane="$(tmux capture-pane -p -J -t "$TARGET" 2>/dev/null || true | tr $'\302\240' ' ')"

    # If we're on the slash command list, Enter selects /status.
    if grep -qE '^[[:space:]]*/status[[:space:]]+' <<<"$pane"; then
      tmux send-keys -t "$TARGET" Enter
      sleep 0.3
    fi

    if grep -qE '^[[:space:]]*Email:[[:space:]]+' <<<"$pane"; then
      ok_status=1
      log "Status screen detected."
      break
    fi

    sleep 0.2
  done

  (( ok_status == 1 )) && break
done

tmux capture-pane -p -J -t "$TARGET" > "$status_logfile"
log "Saved status snapshot: $status_logfile"

if (( ok_status == 0 )); then
  printf '{"error":"failed_to_capture_status_screen","status_logfile":"%s","tmux_session":"%s"}\n' "$status_logfile" "$SESSION"
  exit 1
fi

email="$(
  awk '
  function trim(s){ sub(/^[[:space:]]+/,"",s); sub(/[[:space:]]+$/,"",s); return s }
  {
    l=$0
    gsub(/\r/,"",l)
    if (l ~ /^[[:space:]]*Email:[[:space:]]*/) {
      sub(/^[[:space:]]*Email:[[:space:]]*/,"",l)
      l=trim(l)
      if (l != "") { print l; exit }
    }
  }
  ' "$status_logfile"
)"

if [[ -z "$email" ]]; then
  printf '{"error":"failed_to_parse_email","status_logfile":"%s","tmux_session":"%s"}\n' "$status_logfile" "$SESSION"
  exit 1
fi

log "Closing Status (Esc)"
tmux send-keys -t "$TARGET" Escape
sleep 0.2

ok=0
log "Attempts to enter /usage: ATTEMPTS=$ATTEMPTS"

for ((i=1; i<=ATTEMPTS; i++)); do
  log "Attempt $i: sending /usage (Enter x2)"
  tmux send-keys -t "$TARGET" "/usage" Enter
  sleep 0.2
  tmux send-keys -t "$TARGET" Enter

  start=$SECONDS
  while (( SECONDS - start < TIMEOUT_USAGE )); do
    pane="$(tmux capture-pane -p -J -t "$TARGET" 2>/dev/null || true | tr $'\302\240' ' ')"

    # If we're on the slash command list, Enter selects /usage.
    if grep -qE '^[[:space:]]*/usage[[:space:]]+Show plan usage limits' <<<"$pane"; then
      tmux send-keys -t "$TARGET" Enter
      sleep 0.2
    fi

    if grep -qE 'Current session|Current week \(all models\)|Resets[[:space:]]' <<<"$pane"; then
      ok=1
      log "Usage screen detected."
      break
    fi

    sleep 0.2
  done

  (( ok == 1 )) && break
done

tmux capture-pane -p -J -t "$TARGET" > "$logfile"
log "Saved snapshot: $logfile"

if (( ok == 0 )); then
  printf '{"error":"failed_to_capture_usage_screen","logfile":"%s","tmux_session":"%s"}\n' "$logfile" "$SESSION"
  exit 1
fi

# Exit Usage and Claude (works in your setup).
log "Closing Usage (Esc) and exiting Claude (Ctrl-D x2)"
tmux send-keys -t "$TARGET" Escape
sleep 0.1
tmux send-keys -t "$TARGET" C-d
sleep 0.1
tmux send-keys -t "$TARGET" C-d

set +e
json_output="$(
  awk -v logfile="$logfile" -v email="$email" '
function trim(s){ sub(/^[[:space:]]+/,"",s); sub(/[[:space:]]+$/,"",s); return s }
BEGIN{ mode=""; s_used=""; s_reset=""; w_used=""; w_reset="" }
{
  l=trim($0); if(l=="") next
  if(l ~ /^Current session/) { mode="S"; next }
  if(l ~ /^Current week/)    { mode="W"; next }

  if(mode=="S" && s_used=="" && match(l,/([0-9]{1,3})%[[:space:]]*used/)) { s_used=substr(l,RSTART,RLENGTH); next }
  if(mode=="S" && s_reset=="" && l ~ /^Resets[[:space:]]+/) {
    sub(/^Resets[[:space:]]+/,"",l); s_reset=l; next
  }
  if(mode=="W" && w_used=="" && match(l,/([0-9]{1,3})%[[:space:]]*used/)) { w_used=substr(l,RSTART,RLENGTH); next }

  if(mode=="W" && w_reset=="" && l ~ /^Resets[[:space:]]+/) {
    sub(/^Resets[[:space:]]+/,"",l); w_reset=l; next
  }
}
END{
  if(s_used=="" || w_used==""){
    printf("{\"error\":\"failed_to_parse_usage\",\"current_session_used\":\"%s\",\"current_session_resets\":\"%s\",\"current_week_used\":\"%s\",\"current_week_resets\":\"%s\",\"email\":\"%s\",\"logfile\":\"%s\"}\n",
      s_used, s_reset, w_used, w_reset, email, logfile)
    exit 1
  }
  printf("{\"current_session\":{\"used\":\"%s\",\"resets\":\"%s\"},\"current_week_all_models\":{\"used\":\"%s\",\"resets\":\"%s\"},\"email\":\"%s\",\"logfile\":\"%s\"}\n",
    s_used, s_reset, w_used, w_reset, email, logfile)
}
' "$logfile"
)"
awk_status=$?
set -e

printf '%s\n' "$json_output"

if (( awk_status != 0 )); then
  exit "$awk_status"
fi

if [[ "$CC_USAGE_LOG_DB" != "0" ]]; then
  logger_cmd=(python3 "$CC_USAGE_LOGGER" --db "$CC_USAGE_DB_PATH")
  if [[ "$VERBOSE" == "1" ]]; then
    logger_cmd+=(--verbose)
  fi
  printf '%s\n' "$json_output" | "${logger_cmd[@]}"
fi
