# Day 0 — First-Time Setup

5 min to ready-to-code state.

## Prerequisites

- Node 22+ (`node -v`)
- npm 10+ (`npm -v`)
- Git
- Claude Code CLI installed

## Steps

```bash
# 1. Create from template or clone
git clone git@github.com:ajenchen/ds-product-template.git
cd ds-product-template

# 2. Install workspace deps
npm install

# 3. Open in Claude Code
claude
```

治理自動生效,**不需 /plugin install**:committed `.claude/settings.json` 的 SessionStart hook 在你開 session 時自動注入設計紀律 preamble(寫 code 前主動遵循 item-anatomy / SSOT 消費 / Tailwind / 命名 / 4-Family)+ 編輯時 dispatcher 跑官方 fork hook 機械把關(手刻 table / 硬寫間距色值 / 誤用 primitive 被擋)。雲端 fresh-clone 缺治理本體時,SessionStart 會自動 `npm install @beta` 補上。

## Verify

- `npm run create-app test-app` creates `apps/test-app/`.
- `cd apps/test-app && npm run dev` opens a styled Vite app.
- 開 Claude Code session 後,AI context 含設計紀律(問它「有沒有 item-anatomy 的設計原則?」應答得出);叫它手刻 `<table>` 或硬寫 `gap-13` 會被官方 hook 擋。(注:`/prototype` 等 slash command **非** C-prime 自動送達——治理核心靠注入的 preamble + 機械 hook,不靠 skills;詳 CLAUDE.md。)

## Next

Run `npm run setup:netlify`, then continue with `docs/02-create-new-product.md`.
