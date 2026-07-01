// 2026-05-26 fix:import storybook.css(Tailwind v4 + DS tokens)
//   - 之前只 `import '@qijenchen/design-system/styles/tokens'` → tokens 載入但 Tailwind 沒跑
//   - 改用 storybook.css(含 `@import 'tailwindcss'` 觸發 utility class generation + tokens import)
//   - 對齊 DS repo `.storybook/preview.tsx` 走 `../src/globals.css` 同 pattern
import './storybook.css'
import basePreview from '@qijenchen/storybook-config/preview'
import type { Preview } from '@storybook/react'

// 密碼保護走 Netlify Edge Function(netlify/edge-functions/basic-auth.ts,edge 層、免費、無法繞過),
// 不在這裡做 client-side 軟鎖(會出現雙重密碼提示且可被繞過)。設 Netlify env var
// STORYBOOK_BASIC_AUTH="user:password" 後整站即跳瀏覽器原生帳密彈窗。

// 2026-05-29 fix landing:published template 只有 Apps stories。Base storySort 以 "Design System" 起頭、
// 無 "Apps" 條目 → Apps stories 退化成字母序 → "All DS Components (Portal)" 排前 → Storybook 落在
// 技術性的 "316 export import smoke" story(user 抓「打開一片空白/技術頁」)。
// Override:Apps/template 內 "AppShell Dashboard"(真實產品 demo)排第一 = landing first story。
const preview: Preview = {
  ...basePreview,
  parameters: {
    ...basePreview.parameters,
    options: {
      ...basePreview.parameters?.options,
      // Dashboards 排在 Apps 之後、其餘(UT 等)之前 —— 讓「看結果」的儀表板獨立且好找,
      // 不埋在 UT/(跑測試)裡。AppShell Dashboard 仍是 landing story(不改既有落地行為)。
      // 若想讓 UserTest Results Dashboard 變成落地首頁,把 'Dashboards' 移到 'Apps' 之前即可。
      storySort: {
        order: ['Apps', ['template', ['AppShell Dashboard', '*']], 'Dashboards'],
      },
    },
  },
}

export default preview
