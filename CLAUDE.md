# Product Workspace — Claude Code Instructions

This repo consumes `@qijenchen/design-system`. **All design governance lives in the DS plugin** — install via `/plugin marketplace add github:ajenchen/design-system` and inherit 31+ M-rules / 22+ skills / 38+ hooks automatically.

## 🚀 Fork-and-go onboarding(Claude 自動執行流程)

Fork 本 repo 後,user 用 Claude 開啟,Claude **必依以下順序**幫 user 設定 painless onboarding:

| Step | Action | Why |
|---|---|---|
| 1 | `npm install` | 拉 `@qijenchen/design-system` + `@qijenchen/storybook-config` npm deps |
| 2 | `/plugin marketplace add github:ajenchen/design-system` | 拿 DS governance plugin(31 M-rules / 22 skills / 38 hooks 自動下載) |
| 3 | `npm run setup:netlify` | 自動 Netlify CLI 流程:login + link site + enable Identity + restrict access + invite team |
| 4 | `npm run create-app <new-app-name>`(若需新 product app) | copy `_template/` → 新 app folder |
| 5 | `npm run storybook` 本地驗 fork 跑起來 | 確認 DS components 視覺正確 |
| 6 | Push main → Netlify auto-deploy + Storybook auto-rebuild | done |

## Local-only rules(not in DS plugin)

### Consumer canonical(this repo specific)

1. **禁** import DS internals(`@qijenchen/design-system/src/...` or `/dist/...`)— 用 public surface only。Hook + `npm run lint:imports` 攔。
2. **禁** 修 `node_modules/@qijenchen/design-system/` — 有需求 file PR 回 DS repo,不在 product workspace fork。
3. 每新 app(`npm run create-app <name>`)務必走 `_template/`(已配 AppShell + Sidebar + globals.css + storybook 標準 import)。
4. App-level CSS 只 extend / override,**不重寫** DS tokens(`--color-*` / `--space-*` 等)。
5. **App.tsx 起點走 AppShell + Sidebar**(per 2026-05-26 user directive「app shells 的範例」),不從孤立 Button 開始。

### Storybook 用途分工

- **DS repo Storybook**(<https://ajenchen.github.io/design-system/>)= DS library 元件 reference docs
- **本 repo Storybook**(Netlify deploy)= **真實 product UI demo**(PM / designer / QA 看業務情境)
- Stories 寫 PRODUCT scenarios(不是 DS element trait grid)

### Access control(strict required for Netlify)

**Default = Netlify Identity**(自動 invite,per-user revoke,免費 1000 users)。
- `npm run setup:netlify` 自動跑完
- 或手動 Dashboard:Site → Identity → Enable + Invite-only + Restrict access + Invite users
- `.storybook/manager-head.html` Identity widget 已 codify(fork user 不需動 code)

### Task navigation

| 任務 | 走法 |
|------|-------|
| 建新 product UI / 開新 page | `/prototype` skill(走 DS plugin)|
| 元件用法問題 | DS Storybook URL(reference)或 grep `node_modules/@qijenchen/design-system/dist/` types |
| App 完成要 ship | `/component-quality-gate` skill 走過 review,然後 push main |
| Bug fix | 查 DS spec + grep 本 repo apps/* 既有用法,不發明新 pattern |
| 新 product | `npm run create-app <name>` |

## Stack

Vite + React 19 + TypeScript + Tailwind v4 + Storybook 8.6 + `@qijenchen/design-system@beta`.

## CI

- `audit.yml` — tsc + lint:imports + build per push/PR
- `deploy.yml` — `apps/_template/dist` per-app Netlify(需 NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID_TEMPLATE secrets)
- `netlify.toml` — Storybook Netlify Git integration(無需 secret,直接讀 build command + access headers)
- `sync-design-system.yml` — Dependabot daily + repository_dispatch(DS release 自動 bump deps)
