// ── Supabase 自動上傳設定(消費端,一次性填)──────────────────────────────────
// 測試到摘要頁時,引擎會把每位受測者的結構化結果自動 POST 到這裡集中,方便你批次分析。
//
// 設定步驟(見 docs/ut-results-supabase.md 完整版):
//   1. supabase.com 建免費專案。
//   2. SQL Editor 建表 ut_results(欄位見下方 docs)+ 開 RLS、只允許 anon INSERT(不可 SELECT)。
//   3. Project Settings → API:複製 Project URL 與 anon public key,填到下面兩個常數。
//
// 註:anon key 設計上可公開(配 RLS insert-only 才安全);但仍建議改從環境變數讀。
// 兩者留空 = 不上傳(維持原本本地匯出 + 手動回傳)。
import type { SubmitConfig } from '@imethan0254/ut-model-a'

const SUPABASE_URL = '' // 例:'https://abcdefgh.supabase.co'
const SUPABASE_ANON_KEY = '' // anon public key(配表上 RLS insert-only)

export const utSubmit: SubmitConfig | undefined =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? {
        url: `${SUPABASE_URL}/rest/v1/ut_results`,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal',
        },
      }
    : undefined
