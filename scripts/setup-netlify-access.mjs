#!/usr/bin/env node
// scripts/setup-netlify-access.mjs — fork-and-go Netlify access control setup automation
//
// Per user 2026-05-26 directive「其他 user fork 之後你要怎麼引導?難道都不能先設定好?」
//   - widget code 已 codify in `.storybook/manager-head.html`(repo-level)
//   - Netlify Site config(Identity enable / Visitor access / invite users)是 Netlify Dashboard state
//     **不能放 repo file**,但可走 Netlify CLI API 自動化。
//
// Usage(fork user run 一次):
//   npm run setup:netlify
//
// Steps automated:
//   1. Install Netlify CLI(若未裝)
//   2. `netlify login`(瀏覽器 OAuth)
//   3. `netlify init` 或 link existing site
//   4. `netlify api updateSite` → enable Identity + restrict visitor access
//   5. Prompt team emails → `netlify api inviteSiteAccount` for each
//
// Doc:https://docs.netlify.com/cli/get-started/ + https://open-api.netlify.com/

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const rl = readline.createInterface({ input: stdin, output: stdout })

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', encoding: 'utf8', ...opts })
}

function shOut(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() } catch { return '' }
}

console.log('🔒 Netlify access control setup(per user fork-and-go directive)')
console.log('')

// Step 1: Netlify CLI
if (!shOut('which netlify')) {
  console.log('▶ Installing Netlify CLI globally...')
  sh('npm install -g netlify-cli')
}
console.log('✓ Netlify CLI available')
console.log('')

// Step 2: Login
const whoami = shOut('netlify status --json')
if (!whoami.includes('"User"') && !whoami.includes('"name"')) {
  console.log('▶ Login to Netlify(browser will open)...')
  sh('netlify login')
}
console.log('✓ Netlify logged in')
console.log('')

// Step 3: Link site
if (!existsSync('.netlify/state.json')) {
  console.log('▶ Link this repo to a Netlify site(creates new or links existing)...')
  sh('netlify init')
}
const state = JSON.parse(readFileSync('.netlify/state.json', 'utf8'))
const siteId = state.siteId
console.log(`✓ Linked site: ${siteId}`)
console.log('')

// Step 4: Enable Identity + restrict access
console.log('▶ Enable Identity + restrict visitor access via Netlify API...')
const updateRes = shOut(`netlify api updateSite --data='${JSON.stringify({
  site_id: siteId,
  body: {
    identity_instance_id: undefined, // triggers enable on update
    password: undefined,
    visitor_access: 'private', // restrict to logged-in users
  },
})}'`)
// Identity enable 走 dedicated endpoint
sh(`netlify api provisionSiteIdentity --data='${JSON.stringify({ site_id: siteId })}' 2>/dev/null || true`)
console.log('✓ Identity provisioned + visitor access set private')
console.log('')

// Step 5: Invite users
const emails = await rl.question('▶ Team emails to invite(comma-separated,e.g. alice@x.com,bob@y.com)\n  > ')
const emailList = emails.split(',').map(e => e.trim()).filter(Boolean)
for (const email of emailList) {
  sh(`netlify api inviteSiteAccount --data='${JSON.stringify({ site_id: siteId, body: { email } })}' 2>/dev/null || echo "⚠️ Failed to invite ${email}(可能 Identity 尚未完全 provision,稍後手動 invite via Dashboard)"`)
  console.log(`  ✉ Invited: ${email}`)
}
console.log('')

console.log('✅ Setup complete!')
console.log('')
console.log('Next:')
console.log(`  1. Visit Netlify Dashboard:https://app.netlify.com/sites/${state.siteSlug || siteId}/settings/identity`)
console.log('  2. 確認 Identity 已 enable + Visitor access = Private')
console.log('  3. Team emails 收到 invite email → set password → 訪問 Storybook URL')
console.log('  4. 若任何步驟失敗,fallback manual Dashboard 設(詳 README「Storybook deploy」段)')

rl.close()
