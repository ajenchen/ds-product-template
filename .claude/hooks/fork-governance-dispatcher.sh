#!/bin/bash
# fork-governance-dispatcher.sh — C-prime 治理派發器(committed in fork,極穩定、幾乎永不改)
#
# 這是 fork repo 唯一 commit 的「啟動器」:讀 npm 套件 ship 的 fork 治理 manifest,跑當下這個
# event 的所有官方 fork hook。DS 未來治理增刪改 → 重生 npm 套件的 manifest → fork `npm install`
# 後本派發器自動跑新的那套(committed 設定不用動)= 完全同步。
#
# 設計鐵則:
#   - 本體在 node_modules(npm install 覆蓋 = 官方控管、使用者改不動)
#   - manifest 缺(還沒 npm install)→ exit 0 永不 brick(bootstrap 另外發 notice)
#   - 任一官方 fork hook exit 2(BLOCKER)→ 派發器 exit 2(轉發攔截)
#   - 其餘 exit code 不阻擋(soft)

set -uo pipefail
INPUT=$(cat 2>/dev/null || echo "{}")
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // ""' 2>/dev/null)

DS_FORK="${CLAUDE_PROJECT_DIR:-.}/node_modules/@qijenchen/design-system/ds-canonical/fork"
MANIFEST="$DS_FORK/manifest.json"

# 治理本體還沒就位(fork 第一個 session 還沒 npm install)→ 不阻擋(bootstrap 會發 notice)
[ -f "$MANIFEST" ] || exit 0

# 取這個 event 註冊的官方 fork hook 清單
HOOK_FILES=$(jq -r --arg ev "$EVENT" '.hooks[$ev][]?.file // empty' "$MANIFEST" 2>/dev/null)
[ -z "$HOOK_FILES" ] && exit 0

RC=0
while IFS= read -r hf; do
  [ -z "$hf" ] && continue
  body="$DS_FORK/$hf"
  [ -f "$body" ] || continue   # 個別 body 缺 → skip,不阻擋(派發器穩健)
  # 依副檔名選 interpreter:.py 用 python3、其餘 bash。
  # 鐵則:用 bash 跑 .py → syntax error → exit 2 → 被下面誤判成 BLOCKER → 擋掉所有編輯(致命)。
  # python3 缺(罕見)→ exit 127(非 2)→ 不轉發 = fail-open,不 brick。
  case "$body" in
    *.py) echo "$INPUT" | python3 "$body" ;;
    *)    echo "$INPUT" | bash "$body" ;;
  esac
  hc=$?
  [ "$hc" -eq 2 ] && RC=2       # 官方 hook 攔截 → 轉發攔截
done <<< "$HOOK_FILES"

exit $RC
