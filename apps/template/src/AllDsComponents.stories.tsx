// @anatomy-exempt: DS canonical proxy portal (per 2026-05-27 M31 codex synthesis)
/**
 * AllDsComponents.stories.tsx — DS canonical Storybook proxy portal
 *
 * Per user 2026-05-27 verbatim「確保跟 ds repo 一模一樣」+「全盤避免 minimal mock 抹平」+ M31 codex synthesis.
 *
 * 規則(SSOT):
 *   1. DS owns per-component canonical pixels — 62/62 components 三層 stories(展示/設計規格/設計原則)在 DS Storybook
 *   2. PW(consumer template)只 owns 真實業務 composition demos(AppShell Dashboard 等)
 *   3. 想看「所有 DS 元件」default render → iframe / link 連 DS deployed Storybook
 *   4. **禁** PW 重寫 `<DS.X minimal props>` — 必 drift(2026-05-27 5+ bug 錨例:CircularProgress size=32 / RadioGroup raw item 沒 SelectionItem / DataTable one-col / LinkInput placeholder mock / Empty 缺 icon)
 *   5. Mechanical 強制:hook `check-consumer-no-ds-catalog.mjs` + `check-consumer-story-baseline.mjs` (DS 0.1.0-beta.26+)
 *
 * Anchor codex M31 v1:「PW 可有 DS catalog 但只能是 DS canonical Storybook 的 proxy/manifest portal,不能在 PW 重新寫 JSX」
 */

import type { Meta, StoryObj } from '@storybook/react'
import * as DS from '@qijenchen/design-system'

// Dynamic 316 export count — import smoke only, no render
const allKeys = Object.keys(DS).sort()
const components = allKeys.filter(k => /^[A-Z]/.test(k))
const hooks = allKeys.filter(k => k.startsWith('use'))
const constants = allKeys.filter(k => /^[A-Z_]+$/.test(k))
const utils = allKeys.filter(k => !/^[A-Z]/.test(k) && !k.startsWith('use'))

const DS_STORYBOOK_URL = 'https://ajenchen.github.io/design-system/'

const meta: Meta = {
  title: 'Apps/template/All DS Components (Portal)',
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj

export const ImportSmoke: Story = {
  name: '316 export import smoke',
  render: () => (
    <div className="p-6 space-y-4" data-testid="all-ds-import-smoke">
      <h1 className="text-h3">DS Public API — Import Smoke</h1>
      <p className="text-body">
        Imports resolved: <span data-testid="total">{allKeys.length}</span> exports
        ({components.length} components / {hooks.length} hooks / {constants.length} constants / {utils.length} utils).
      </p>
      <p className="text-caption text-fg-secondary">
        本 story 只驗 import 全部解析。**禁** render DS components in PW(per codex M31 synthesis 2026-05-27).
        Per-component visual canonical → DS deployed Storybook:{' '}
        <a href={DS_STORYBOOK_URL} target="_blank" rel="noopener" className="text-info underline">
          ajenchen.github.io/design-system
        </a>
      </p>
      <details className="text-caption">
        <summary className="cursor-pointer">Full export list ({allKeys.length})</summary>
        <pre className="mt-2 p-2 bg-neutral-1 rounded text-fg-secondary break-all">{allKeys.join(', ')}</pre>
      </details>
    </div>
  ),
}

export const DsCanonicalPortal: Story = {
  name: 'DS canonical 跳轉',
  render: () => (
    <div className="p-6 space-y-4" data-testid="ds-canonical-portal">
      <h1 className="text-h3">DS Component Canonical — 跳到 DS Storybook</h1>
      <p className="text-body text-fg-secondary">
        想看每個 DS 元件預設 render / 互動 / 設計原則 → DS canonical Storybook 是唯一 SSOT.
        Consumer 不該在 PW 重寫 minimal mock(會 drift)。
      </p>
      <iframe
        src={DS_STORYBOOK_URL}
        className="w-full border border-divider rounded-md"
        style={{ height: '70vh' }}
        title="DS Storybook canonical"
      />
      <p className="text-caption text-fg-secondary">
        iframe 載入失敗 → 開新分頁:{' '}
        <a href={DS_STORYBOOK_URL} target="_blank" rel="noopener" className="text-info underline">{DS_STORYBOOK_URL}</a>
      </p>
    </div>
  ),
}
