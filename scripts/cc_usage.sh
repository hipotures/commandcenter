#!/usr/bin/env bash
set -euo pipefail

OUTDIR="${OUTDIR:-/tmp/claude-stats}"
CLAUDE_CMD="${CLAUDE_CMD:-claude --no-chrome}"
WIDTH="${WIDTH:-140}"
HEIGHT="${HEIGHT:-50}"

TIMEOUT_READY="${TIMEOUT_READY:-45}"
TIMEOUT_USAGE="${TIMEOUT_USAGE:-45}"
ATTEMPTS="${ATTEMPTS:-3}"

VERBOSE="${VERBOSE:-1}"

mkdir -p "$OUTDIR"
ts="$(date +%Y%m%d-%H%M%S)"
SESSION="claude_usage_${ts}_$$"
TARGET="${SESSION}:0.0"
logfile="$OUTDIR/usage-$ts.txt"

log() {
  [[ "$VERBOSE" == "1" ]] || return 0
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2
}

cleanup() {
  # wyjdź z Usage i z Claude, potem ubij tmux
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

# czekaj aż prompt Claude się pojawi (linia zaczyna się od '>')
start=$SECONDS
while (( SECONDS - start < TIMEOUT_READY )); do
  pane="$(tmux capture-pane -p -J -t "$TARGET" 2>/dev/null || true | tr $'\302\240' ' ')"
  if grep -qE '^[[:space:]]*>' <<<"$pane"; then
    break
  fi
  sleep 0.2
done

ok=0
log "Próby wejścia w /usage: ATTEMPTS=$ATTEMPTS"

for ((i=1; i<=ATTEMPTS; i++)); do
  log "Attempt $i: wysyłam /usage (Enter x2)"
  tmux send-keys -t "$TARGET" "/usage" Enter
  sleep 0.2
  tmux send-keys -t "$TARGET" Enter

  start=$SECONDS
  while (( SECONDS - start < TIMEOUT_USAGE )); do
    pane="$(tmux capture-pane -p -J -t "$TARGET" 2>/dev/null || true | tr $'\302\240' ' ')"

    # jeśli jesteśmy na liście slash-komend, Enter wybiera /usage
    if grep -qE '^[[:space:]]*/usage[[:space:]]+Show plan usage limits' <<<"$pane"; then
      tmux send-keys -t "$TARGET" Enter
      sleep 0.2
    fi

    if grep -qE 'Current session|Current week \(all models\)|Resets[[:space:]]' <<<"$pane"; then
      ok=1
      log "Ekran Usage wykryty."
      break
    fi

    sleep 0.2
  done

  (( ok == 1 )) && break
done

tmux capture-pane -p -J -t "$TARGET" > "$logfile"
log "Zapisano snapshot: $logfile"

if (( ok == 0 )); then
  printf '{"error":"failed_to_capture_usage_screen","logfile":"%s","tmux_session":"%s"}\n' "$logfile" "$SESSION"
  exit 1
fi

# wyjście z Usage i Claude (tak jak u Ciebie działa)
log "Zamykam Usage (Esc) i wychodzę z Claude (Ctrl-D x2)"
tmux send-keys -t "$TARGET" Escape
sleep 0.1
tmux send-keys -t "$TARGET" C-d
sleep 0.1
tmux send-keys -t "$TARGET" C-d

# PARSER (ten sam co w cc_usage11.sh – tylko domknięty i z plikiem wejściowym)
awk -v logfile="$logfile" '
function trim(s){ sub(/^[[:space:]]+/,"",s); sub(/[[:space:]]+$/,"",s); return s }
BEGIN{ mode=""; s_used=""; w_used=""; w_reset="" }
{
  l=trim($0); if(l=="") next
  if(l ~ /^Current session/) { mode="S"; next }
  if(l ~ /^Current week/)    { mode="W"; next }

  if(mode=="S" && s_used=="" && match(l,/([0-9]{1,3})%[[:space:]]*used/)) { s_used=substr(l,RSTART,RLENGTH); next }
  if(mode=="W" && w_used=="" && match(l,/([0-9]{1,3})%[[:space:]]*used/)) { w_used=substr(l,RSTART,RLENGTH); next }

  if(mode=="W" && w_reset=="" && l ~ /^Resets[[:space:]]+/) {
    sub(/^Resets[[:space:]]+/,"",l); w_reset=l; next
  }
}
END{
  if(s_used=="" || w_used==""){
    printf("{\"error\":\"failed_to_parse_usage\",\"current_session_used\":\"%s\",\"current_week_used\":\"%s\",\"current_week_resets\":\"%s\",\"logfile\":\"%s\"}\n",
      s_used, w_used, w_reset, logfile)
    exit 1
  }
  printf("{\"current_session\":{\"used\":\"%s\"},\"current_week_all_models\":{\"used\":\"%s\",\"resets\":\"%s\"},\"logfile\":\"%s\"}\n",
    s_used, w_used, w_reset, logfile)
}
' "$logfile"

