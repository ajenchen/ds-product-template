// 2026-05-26 fix:import storybook.css(Tailwind v4 + DS tokens)
//   - 之前只 `import '@qijenchen/design-system/styles/tokens'` → tokens 載入但 Tailwind 沒跑
//   - 改用 storybook.css(含 `@import 'tailwindcss'` 觸發 utility class generation + tokens import)
//   - 對齊 DS repo `.storybook/preview.tsx` 走 `../src/globals.css` 同 pattern
import './storybook.css'
import { useState, type ReactNode } from 'react'
import basePreview from '@qijenchen/storybook-config/preview'
import type { Preview, Decorator } from '@storybook/react'

// ── Storybook 維度的密碼鎖(綁在 preview,不是 story 的 prop,所以不會出現在 Controls)──
// 預設密碼 0000;輸入一次後同分頁 session 記住。所有 story 的畫面在解鎖前都會被擋住。
// 註:這是 client-side 軟鎖(密碼仍在 bundle 內,理論上可被繞過);要真正鎖死請用 Netlify
// Basic Password(edge 層)。此鎖的用途是擋掉「看得到網址就能進」的隨意訪問 + 不在 Controls 外洩。
const SB_PASSWORD = '0000'
const SB_KEY = 'ut-storybook-unlocked'

function StorybookPasswordGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(() => {
    try { return sessionStorage.getItem(SB_KEY) === '1' } catch { return false }
  })
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)
  if (ok) return <>{children}</>
  function submit() {
    if (val === SB_PASSWORD) {
      try { sessionStorage.setItem(SB_KEY, '1') } catch { /* ignore */ }
      setOk(true)
    } else setErr(true)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--color-canvas, #f4f5f7)' }}>
      <div style={{ width: '100%', maxWidth: 360, borderRadius: 12, border: '1px solid var(--color-neutral-5, #dcdfe4)', background: 'var(--color-surface, #fff)', padding: 32, textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>🔒</div>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--color-neutral-9, #1a1a1a)' }}>請輸入密碼 · Enter password</h1>
        <p style={{ fontSize: 13, color: 'var(--color-neutral-7, #6b7280)', marginTop: 6, lineHeight: 1.5 }}>此內容受密碼保護,僅供受邀者進行。<br />Password-protected; invited participants only.</p>
        <input
          type="password"
          autoFocus
          value={val}
          placeholder="請輸入密碼 / Password"
          onChange={(e) => { setVal(e.target.value); setErr(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          style={{ marginTop: 16, width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: `1px solid ${err ? '#dc2626' : 'var(--color-neutral-5, #ccd0d6)'}`, fontSize: 14, outline: 'none' }}
        />
        {err && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>密碼錯誤,請再試一次 · Wrong password</p>}
        <button
          type="button"
          onClick={submit}
          disabled={!val}
          style={{ marginTop: 16, width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: val ? 'var(--color-primary, #2563eb)' : 'var(--color-neutral-4, #e5e7eb)', color: val ? '#fff' : 'var(--color-neutral-6, #9ca3af)', fontSize: 14, fontWeight: 600, cursor: val ? 'pointer' : 'default' }}
        >
          進入 · Enter
        </button>
      </div>
    </div>
  )
}

const passwordGate: Decorator = (Story) => (
  <StorybookPasswordGate><Story /></StorybookPasswordGate>
)

// 2026-05-29 fix landing:published template 只有 Apps stories。Base storySort 以 "Design System" 起頭、
// 無 "Apps" 條目 → Apps stories 退化成字母序 → "All DS Components (Portal)" 排前 → Storybook 落在
// 技術性的 "316 export import smoke" story(user 抓「打開一片空白/技術頁」)。
// Override:Apps/template 內 "AppShell Dashboard"(真實產品 demo)排第一 = landing first story。
const preview: Preview = {
  ...basePreview,
  decorators: [passwordGate, ...(basePreview.decorators ?? [])],
  parameters: {
    ...basePreview.parameters,
    options: {
      ...basePreview.parameters?.options,
      storySort: {
        order: ['Apps', ['template', ['AppShell Dashboard', '*']]],
      },
    },
  },
}

export default preview
