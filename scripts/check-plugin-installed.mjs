#!/usr/bin/env node
/**
 * check-plugin-installed.mjs — postinstall gate(2026-05-26 per user verbatim
 * 「我們做那麼多 plugin 不就是要避免這件事?結果還避不了?」)
 *
 * 偵測 design-system plugin 是否安裝在 ~/.claude/plugins/ 或 .claude/plugins/。
 * 沒裝 → 印巨型紅色 ASCII warning + 不 exit 1(避免擋 npm install,但訊息要不可漏)。
 *
 * 為何不 exit 1?
 * - npm install 失敗會擋 CI / Netlify build / Dependabot autobump
 * - Plugin install 是 Claude Code-side action,user 跑 npm 不一定是用 Claude
 * - 純 warning 模式:user 用 Claude 開 repo 時看到 → 跑 /plugin install
 * - DS-side SessionStart hook(check_fork_user_plugin_install.sh)會二次攔截
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const HOME = homedir()
const CWD = process.cwd()

const PLUGIN_PATHS = [
  resolve(HOME, '.claude/plugins/design-system'),
  resolve(CWD, '.claude/plugins/design-system'),
]

const installed = PLUGIN_PATHS.some(p => existsSync(p))

if (installed) {
  console.log('✓ @qijenchen/design-system plugin detected — DS governance hooks active.')
  process.exit(0)
}

const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

console.log(`
${RED}${BOLD}┌─────────────────────────────────────────────────────────────────────────┐${RESET}
${RED}${BOLD}│  🚨 @qijenchen/design-system plugin NOT INSTALLED                       │${RESET}
${RED}${BOLD}└─────────────────────────────────────────────────────────────────────────┘${RESET}

${YELLOW}本 monorepo 消費 @qijenchen/design-system,但 Claude Code DS governance plugin
未在 ~/.claude/plugins/ 或本 repo .claude/plugins/ 偵測到。${RESET}

${BOLD}沒裝後果(anchor case 2026-05-26):${RESET}
  - AI 寫 App.tsx 憑記憶寫 simplified mock(漏 SidebarTrigger / collapsible / startIcon)
  - DS governance hooks(M29 anchor preflight / SSOT propagation 等,40+ 個)全部不 fire
  - product-workspace 視覺直接跑版,fork user 抓不到 root cause

${BOLD}修法(用 Claude Code 開本 repo 後第一件事):${RESET}
  1. ${YELLOW}/plugin marketplace add github:ajenchen/design-system${RESET}
  2. ${YELLOW}/plugin install design-system@qijenchen-ds${RESET}

${BOLD}Plugin install 後拿到:${RESET}
  ✓ 40+ 個 DS governance hooks(自動 fire,dynamic — 跟 DS repo 同步)
  ✓ 22 個 skills(/prototype / /component-quality-gate / /design-system-audit 等)
  ✓ DS canonical(31 M-rules + 56 audit dims + ssot-index)cross-load
  ✓ App.tsx 憑記憶寫 mock 會被 mechanical BLOCKER 攔

${YELLOW}注意:本 script 不 exit 1(避免擋 npm install / CI / Netlify build)。
僅作 warning。DS-side SessionStart hook 會二次攔截 fork-user。${RESET}
`)

// 永遠 exit 0(warning-only),per docstring rationale。
process.exit(0)
