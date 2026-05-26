# Product Workspace

Monorepo for product team apps consuming [`@qijenchen/design-system`](https://github.com/ajenchen/design-system).

## Status

- **2026-05-25** scaffold landed (Phase 5 deliverable per `design-system/.claude/planning/team-distribution-roadmap.md`)
- Active apps: `apps/_template/`(canary)
- Add a new app: `npm run create-app <kebab-case-name>`

## Quick start(Day 0)

```bash
# 1. clone
git clone git@github.com:ajenchen/product-workspace.git
cd product-workspace

# 2. install workspace deps(pulls @qijenchen/design-system@beta + storybook-config)
npm install

# 3. spawn a new app
npm run create-app order-dashboard
cd apps/order-dashboard
npm run dev
```

## Layout

```
product-workspace/
├── apps/                       ← Product apps (each is independent Vite + React)
│   └── _template/              ← Copy this via `npm run create-app <name>`
│       ├── src/
│       │   ├── main.tsx        ← React root + TooltipProvider
│       │   ├── App.tsx         ← Replace with your product UI
│       │   └── globals.css     ← @import tailwindcss + DS tokens
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── packages/                   ← Cross-app shared utilities (if any)
├── scripts/
│   ├── create-app.mjs          ← `npm run create-app <name>` generator
│   └── lint-ds-internal-imports.mjs  ← Guard against importing DS internals
├── .claude/
│   └── settings.json           ← Claude Code config (plugin marketplace flow)
├── .storybook/                 ← Shared Storybook config (imports @qijenchen/storybook-config)
├── .github/
│   ├── CODEOWNERS              ← Code review routing
│   └── workflows/
│       ├── audit.yml           ← tsc + lint + build per push/PR
│       └── deploy.yml          ← Per-app Netlify deploy
├── package.json                ← workspaces + DS deps
├── tsconfig.json               ← Base TS config (apps extend)
└── README.md                   ← You are here
```

## Claude Code plugin setup(first time)

```
/plugin marketplace add github:ajenchen/design-system
/plugin install design-system@qijenchen-ds
```

Then plugin auto-enables (`.claude/settings.json` `defaultMode: "auto"`). You get:
- 22+ skills (`/component-quality-gate`, `/visual-audit`, etc.)
- 38+ hooks (auto-fire pre/post tool events)
- 31 active M-rules (CLAUDE.md instructions inherit on every session)

## Important rules(read CLAUDE.md from `design-system` repo via plugin)

- **Never modify** `node_modules/@qijenchen/design-system/`(install another copy if you need experimental changes — file PR to DS repo instead)
- Import only from public surface: `@qijenchen/design-system` top barrel,`@qijenchen/design-system/styles/tokens`,`@qijenchen/design-system/hooks/<name>`
- Run `npm run lint:imports` before commit to catch internal-path leaks

## Fork-and-go setup(painless,對齊 DS repo pattern)

Per user 2026-05-26 directive「fork product workspace 註冊 netlify 即能達到一樣效果」+ 後續
challenge「為何要設這個 secret?」→ 對齊 DS repo pattern(netlify.toml + Netlify Git integration)。

### Storybook deploy(無需 GitHub secret)

**Step 1 — Connect Netlify**:
1. Netlify Dashboard → **New site** → 連 fork 後的 `product-workspace` repo
2. Netlify 自動讀根目錄 `netlify.toml` → build `storybook-static` → deploy
3. 每次 push main → Netlify auto rebuild。Per-branch preview 自動啟用。

**Step 2 — 🔒 設 access control**(per 2026-05-26 user directives):

**Default = Netlify Identity ⭐**(安全 + 免費 + Netlify-native + 不複雜化 infra):

1. Netlify Site settings → **Identity** → **Enable Identity**
2. Registration preferences → **Invite only**(限團隊 admin invite,訪客不能自己 signup)
3. Site settings → Visitor access → **Restrict access to site visitors**(只允 logged-in Identity users 可訪問)
4. Identity tab → **Invite users** → 輸入團隊 email → 對方收 email → set password → 訪問
5. **`.storybook/manager-head.html` 已 codify widget** — 自動 prompt login(fork user 不需動 code)

**為何 Identity > Pro Password**:per-user account(可 individually revoke)/ audit log(知道誰登入)/ 免費 1000 users / 真正 per-person control(不是共用 password)。

**Caveat**:Netlify Identity 在 2024 起 mark deprecated for new sites(短期繼續可用,長期 Netlify 可能推 successor)。若 long-term future-proof 重要,可考慮 Pro Password fallback。

**Fallback option(若 Identity 不適合)— Netlify Pro Password**:
- Site settings → Access & security → Visitor access → **Password protect site**($19/mo)
- 整 site 一個共用 password,share 給 team — visitor 不需帳號,輸 password 即訪問
- 缺點:共用 password,無 per-user revoke / 無 audit log

**Defense-in-depth**(`netlify.toml` 已 ship):X-Robots-Tag noindex / Referrer strict-origin / X-Frame SAMEORIGIN —
搜尋引擎不收錄 URL,但**只防 SEO,不防直接訪問**,必須配上述 Identity 或 Password 才真實限團隊存取。

### App deploy(`apps/_template/dist`)— 需 GitHub Actions secret
App 是 monorepo sub-dir build(root install + cd apps/X build),Netlify Git integration 不適合
(會在 root run build 但 publish dir 在 sub-dir)。所以走 GitHub Actions workflow:

| Secret | 用途 | 取得方式 |
|---|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify auth | Netlify → User settings → Applications → Personal access tokens |
| `NETLIFY_SITE_ID_TEMPLATE` | _template app site ID | 新建 Netlify site for app → Site overview → Site ID |

設完 secrets 後 `.github/workflows/deploy.yml` push main → deploy `apps/_template/dist`。

完整 step-by-step 詳 `docs/01-first-time-setup.md`。

## License

UNLICENSED — internal use only.
