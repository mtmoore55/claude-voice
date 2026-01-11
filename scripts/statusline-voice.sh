#!/bin/bash
# Claude Code Status Line with Voice Indicator
# Add to ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "~/.claude/statusline-voice.sh" }

input=$(cat)

# ---- check jq availability ----
HAS_JQ=0
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=1
fi

# ---- color helpers ----
use_color=1
[ -n "$NO_COLOR" ] && use_color=0

rst() { if [ "$use_color" -eq 1 ]; then printf '\033[0m'; fi; }
dir_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;117m'; fi; }
model_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;147m'; fi; }
git_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;150m'; fi; }
context_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;158m'; fi; }
voice_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;219m'; fi; }
dim_color() { if [ "$use_color" -eq 1 ]; then printf '\033[2m'; fi; }

# ---- extract data ----
if [ "$HAS_JQ" -eq 1 ]; then
  current_dir=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // "unknown"' 2>/dev/null | sed "s|^$HOME|~|g")
  model_name=$(echo "$input" | jq -r '.model.display_name // "Claude"' 2>/dev/null)
  CONTEXT_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000' 2>/dev/null)
  USAGE=$(echo "$input" | jq '.context_window.current_usage' 2>/dev/null)
  if [ "$USAGE" != "null" ] && [ -n "$USAGE" ]; then
    CURRENT_TOKENS=$(echo "$USAGE" | jq '(.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0)' 2>/dev/null)
    if [ -n "$CURRENT_TOKENS" ] && [ "$CURRENT_TOKENS" -gt 0 ] 2>/dev/null; then
      context_remaining_pct=$(( 100 - (CURRENT_TOKENS * 100 / CONTEXT_SIZE) ))
      (( context_remaining_pct < 0 )) && context_remaining_pct=0
      (( context_remaining_pct > 100 )) && context_remaining_pct=100
      context_pct="${context_remaining_pct}%"
      # Color based on remaining
      if [ "$context_remaining_pct" -le 20 ]; then
        context_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;203m'; fi; }
      elif [ "$context_remaining_pct" -le 40 ]; then
        context_color() { if [ "$use_color" -eq 1 ]; then printf '\033[38;5;215m'; fi; }
      fi
    fi
  fi
else
  current_dir=$(pwd | sed "s|^$HOME|~|g")
  model_name="Claude"
fi

# ---- git branch ----
git_branch=""
if git rev-parse --git-dir >/dev/null 2>&1; then
  git_branch=$(git branch --show-current 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
fi

# ---- voice status ----
voice_status=""
voice_port=$(cat /tmp/claude-voice-ttys*.port 2>/dev/null | head -1)
if [ -z "$voice_port" ]; then
  voice_port="17394"
fi
voice_response=$(curl -s --connect-timeout 0.5 "http://127.0.0.1:${voice_port}/status" 2>/dev/null)
if [ -n "$voice_response" ]; then
  voice_status="$(voice_color)Voice Ready$(rst) $(dim_color)(⌘.)$(rst)"
fi

# ---- render ----
# Line 1: Directory, git, model
printf '📁 %s%s%s' "$(dir_color)" "$current_dir" "$(rst)"
if [ -n "$git_branch" ]; then
  printf '  🌿 %s%s%s' "$(git_color)" "$git_branch" "$(rst)"
fi
printf '  🤖 %s%s%s' "$(model_color)" "$model_name" "$(rst)"

# Line 2: Context + Voice
printf '\n'
if [ -n "$context_pct" ]; then
  printf '🧠 %sContext: %s%s' "$(context_color)" "$context_pct" "$(rst)"
  if [ -n "$voice_status" ]; then
    printf '  🎙️ %s' "$voice_status"
  fi
elif [ -n "$voice_status" ]; then
  printf '🎙️ %s' "$voice_status"
fi

printf '\n'
