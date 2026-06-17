#!/usr/bin/env node
/**
 * check-plugin-installed.mjs — postinstall governance-presence notice(C-prime)
 *
 * 2026-06-17 C-prime 改寫(adversarial pre-ship verify FINDING M4):
 *   舊版印「plugin NOT INSTALLED → /plugin install」巨型紅 banner,但 C-prime 治理
 *   改 committed-config + npm,**不需 plugin**(對齊同套件 CLAUDE.md「不需裝 plugin」)。
 *   舊 banner 在每次 npm install(含 Dependabot/sync workflow)誤嚇 fork user 說治理壞了。
 *   檔名保留(package.json postinstall + mirror ALLOWLIST + mirror workflow paths 三處同步,
 *   sync-governance-counters --check 驗 allowlist↔paths 對齊 → 改名會連鎖,故只改行為)。
 *
 * 新行為:偵測治理本體(node_modules/@qijenchen/design-system/ds-canonical/fork/manifest.json)。
 *   - 就位 → 安靜確認。
 *   - 缺(雲端 fresh-clone / 還沒裝完)→ 友善 notice:Claude Code 開 session 時 SessionStart
 *     bootstrap 會自動裝,或 `npm run sync-all`。**永遠 exit 0**(不擋 npm install / CI / Netlify)。
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const CWD = process.cwd()
const FORK_MANIFEST = resolve(CWD, 'node_modules/@qijenchen/design-system/ds-canonical/fork/manifest.json')

if (existsSync(FORK_MANIFEST)) {
  console.log('✓ DS 治理本體就位(ds-canonical/fork)— Claude Code 開 session 時自動套用設計治理(免 plugin)。')
  process.exit(0)
}

const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

console.log(`
${BOLD}💡 DS 治理本體尚未就位${RESET}(node_modules/@qijenchen/design-system/ds-canonical/fork 還沒在)。

${YELLOW}不需 /plugin install。${RESET}治理走 committed-config + npm:
  • 用 Claude Code 開本 repo → SessionStart bootstrap 會自動裝最新治理(@beta)。
  • 或手動:${BOLD}npm run sync-all${RESET}(拉治理本體 + 刷新接線骨架)。

就位後拿到:事前設計紀律注入(寫 code 前主動遵循 item-anatomy / SSOT 消費 / Tailwind)
+ 機械強制 hook(手刻 table / 硬寫間距色值 / 誤用 primitive 被擋)。

${YELLOW}注:本 notice 不擋 npm install(永遠放行);治理本體就位後 hook 才機械把關。${RESET}
`)

// 永遠 exit 0(notice-only)。
process.exit(0)
