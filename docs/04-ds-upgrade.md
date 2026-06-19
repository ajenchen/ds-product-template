# DS Upgrade Flow

`@qijenchen/design-system` 升新版的流程。

## 自動 / 手動 3 條路

### 路 A:DS repository_dispatch(auto)

DS release workflow 會送 `design-system-published` / `ds-published` event；非版本 SSOT main push 會送 `ds-ssot-changed` event。`.github/workflows/sync-design-system.yml` 收到後自動：

1. `npm update @qijenchen/design-system @qijenchen/storybook-config --legacy-peer-deps`
2. sync DS canonical template if the app has not opted out
3. build verify
4. commit + push if changed

### 路 B:fork user manual sync

```
npm run sync-all
```

This updates the npm packages (DS + 治理本體 in `ds-canonical/fork`) and idempotently refreshes the committed governance skeleton (launchers + `settings.json` hooks block, removing obsolete plugin-era hooks). Effect timing is per-track (don't blindly restart) — mechanical hooks: immediate; settings wiring: auto hot-reload; design-guidance preamble + skills: `/clear` or next session (see the 3-track table in CLAUDE.md). **No plugin involved (C-prime committed-config).**

### 路 C:Dependabot fallback

`.github/dependabot.yml` is daily fallback for npm package drift if cross-repo dispatch fails.

## Breaking change(major version bump)

DS 升 major(e.g. `v0.x` → `v1.0`)時:

1. 看 CHANGELOG.md(自動 generate via changesets)中 breaking 段
2. 跑 codemod(若 DS 提供):
   ```
   npx @qijenchen/design-system-codemod v0-to-v1 apps/<name>/src
   ```
3. 手動 review + 修剩餘
4. `npm run build` verify

## 緊急 rollback

```
# 鎖回特定版本
npm install @qijenchen/design-system@0.1.0-beta.13 --save-exact --legacy-peer-deps
```

## 同步治理 canonical(hooks / 設計紀律 preamble / 接線骨架)

C-prime committed-config,**不需 /plugin install**:

```text
npm run sync-all
```

`sync-all` 做兩件:(1) `npm install @beta` 更治理本體(`ds-canonical/fork`:fork hooks + preamble + manifest);(2) 從 npm idempotent 刷新接線骨架(committed 啟動器 + `settings.json` hooks 區塊,移除 obsolete plugin-era hook,帶 `.github/no-governance-sync` opt-out)。生效分軌(別盲目重啟):機械 hook 即時 / settings 自動 hot-reload / 設計指引 preamble + skills 跑 `/clear` 或下個 session(見 CLAUDE.md 三軌表)。

## Next

→ `docs/05-troubleshooting.md` 常見問題
