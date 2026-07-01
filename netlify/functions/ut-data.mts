// ut-data — UT 結果 Dashboard 的讀取層(Netlify Function v2)。
//
// 為何要這支 function(而不是前端直接用 anon key 讀 Supabase):
//   ut_results 含個資(受測者姓名 / email / 逐字稿)。原表 RLS 是 anon「只能 insert、不能 select」,
//   且 anon key 是 public(在 repo 裡)。若為了讓 dashboard 讀而開 anon SELECT,等於任何拿到 anon key
//   的人都能直接撈走全部個資,繞過 Netlify 密碼。
//   → 改由這支 server-side function 用 **service_role key**(只存 Netlify env var,絕不進前端 / repo)
//     讀取。service_role bypass RLS,不需改任何 policy。前端只看得到 function 回傳的 JSON。
//
// 防護:整站已由 netlify/edge-functions/basic-auth.ts 掛 Basic Auth(path=/*,涵蓋本 function)。
//   這裡再做一層 defense-in-depth:若有設 STORYBOOK_BASIC_AUTH,function 自己也驗一次 Authorization
//   header(瀏覽器登入站台後會自動帶),雙保險避免個資 endpoint 意外裸奔。
//
// 需在 Netlify 設的環境變數(Site configuration → Environment variables):
//   SUPABASE_URL          例:https://qjaedugymiezllhhtbgs.supabase.co
//   SUPABASE_SECRET_KEY   Supabase → Settings → API Keys → Secret key(新版 `sb_secret_...`)。
//                         也吃舊名 SUPABASE_SERVICE_ROLE_KEY(legacy service_role JWT `eyJ...`)。
//                         兩者皆 bypass RLS、皆為 secret,只可放後端 env,絕不進前端 / repo。
//   STORYBOOK_BASIC_AUTH  "user:password"(站台密碼,dashboard 沿用同一組)—— 見 basic-auth.ts
//   UT_DASHBOARD_KEY      (選填)第二道「分析者密碼」。設了之後,除了站台密碼,還要再帶對這組
//                         key 才拿得到資料 —— 用來擋「有站台密碼(能跑測試)但不該看結果」的人。
//                         只存 Netlify env,絕不進 code;分析者在 dashboard 畫面 runtime 輸入,
//                         經 x-ut-dashboard-key header 送來這裡比對。未設 = 不啟用此第二道關(向後相容)。
//
// ⚠️ header 差異(2026 Supabase 新 key 制):
//   - 新版 secret key(sb_secret_…)只放 `apikey` header;若又放 Authorization: Bearer,
//     平台會把它當 JWT 解析 → 回 "Invalid JWT" 拒絕。
//   - legacy service_role(eyJ… JWT)需放 Authorization: Bearer 才 bypass RLS。
//   下面依 key 形態自動切,兩種都相容。

import { createHash, timingSafeEqual } from 'node:crypto'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

// Constant-time 字串比對(先 SHA-256 成定長 digest,避免長度洩漏 + timing attack)。
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export default async function handler(req: Request): Promise<Response> {
  const auth = (process.env.STORYBOOK_BASIC_AUTH ?? '').trim()

  // Defense-in-depth:站台有設密碼 → 本 function 也要求同一組 Basic Auth。
  if (auth) {
    const allowed = new Set(auth.split(/\s+/).filter(Boolean))
    const header = req.headers.get('authorization') ?? ''
    let ok = false
    if (header.startsWith('Basic ')) {
      try {
        ok = allowed.has(atob(header.slice(6)))
      } catch {
        ok = false
      }
    }
    if (!ok) {
      return new Response('Authentication required.', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="UT Dashboard", charset="UTF-8"' },
      })
    }
  }

  // 第二道:分析者密碼(選填)。設了 UT_DASHBOARD_KEY 才啟用 —— 擋「有站台密碼但不該看結果」的人。
  const dashKey = (process.env.UT_DASHBOARD_KEY ?? '').trim()
  if (dashKey) {
    const provided = req.headers.get('x-ut-dashboard-key') ?? ''
    if (!provided || !safeEqual(provided, dashKey)) {
      return json({ error: 'dashboard_auth_required', message: '需要分析者密碼才能檢視結果。' }, 401)
    }
  }

  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) {
    return json(
      {
        error: 'missing_config',
        message: '請在 Netlify 設定環境變數 SUPABASE_URL 與 SUPABASE_SECRET_KEY(新版 secret key,或 legacy SUPABASE_SERVICE_ROLE_KEY)。',
      },
      500,
    )
  }

  // 新版 secret key(sb_secret_…)= apikey only;legacy service_role JWT(eyJ…)需 Authorization: Bearer。
  const isLegacyJwt = key.startsWith('eyJ')
  const supaHeaders: Record<string, string> = isLegacyJwt
    ? { apikey: key, Authorization: `Bearer ${key}` }
    : { apikey: key }

  const endpoint = `${url}/rest/v1/ut_results?select=*&order=created_at.desc`
  try {
    const res = await fetch(endpoint, { headers: supaHeaders })
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500)
      return json({ error: 'supabase_error', message: `Supabase 回應 ${res.status}`, detail }, 502)
    }
    const rows = await res.json()
    return json({ rows }, 200)
  } catch (e) {
    return json({ error: 'fetch_failed', message: String((e as Error)?.message ?? e) }, 502)
  }
}
