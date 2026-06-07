// basic-auth.ts — FREE 密碼保護(Netlify Edge Function,所有方案含 free-tier 可用)。
//
// 為什麼用 Edge Function 而非 Netlify 內建:
//   Netlify Dashboard 的「Password protection」與 `_headers` 的 Basic-Auth header **都是 Pro 專屬**
//   ($20/mo,官方 docs + support forum 2026-06-05 證實)。free-tier 要密碼 → 用 Edge Function
//   自己實作 HTTP Basic Auth(讀 Authorization → 比對 → 回 401)。Edge Functions 免費方案可用
//   (額度依方案,低流量內部 Storybook 綽綽有餘),且 `.netlify.app` 預設網址直接生效、無需自訂網域。
//   (注:官方限制頁載明 `_headers` 的 basic-auth header 不會套用到 edge function,故必在此自己做。)
//   Netlify 官方有記載此 edge-function 密碼 gate pattern(非野路子):
//   docs.netlify.com/prompt-templates/netlify/password-protect-a-page/(env var gate 範例,© 2026 Netlify)。
//
// 怎麼啟用(fork user,30 秒,免費):
//   Netlify → Site configuration → Environment variables → Add a variable
//     Key:   STORYBOOK_BASIC_AUTH
//     Value: your_user:your_password          (多組帳密空格分隔:"alice:pw1 bob:pw2")
//   下次 deploy → 站台跳瀏覽器原生帳密彈窗。未設 env var = 公開(pass-through)。
//   密碼只存 Netlify env var,不進 public repo。
//
// netlify.toml 已 wire:[[edge_functions]] path="/*" function="basic-auth"
//
// 進階(要更好體驗才升級,非必須):Pro Password Protection($20/mo,美化密碼頁 / 只擋 deploy preview
//   放行 production)OR Cloudflare Access(免費 50 user 真 SSO,需自訂網域 + proxy)。

export default async function basicAuth(request: Request): Promise<Response | undefined> {
  const creds = (Deno.env.get('STORYBOOK_BASIC_AUTH') ?? '').trim()
  if (!creds) return // 未設密碼 → 公開放行(no-op)

  const allowed = new Set(creds.split(/\s+/).filter(Boolean)) // {"user:pass", ...}
  const header = request.headers.get('authorization') ?? ''
  if (header.startsWith('Basic ')) {
    try {
      if (allowed.has(atob(header.slice(6)))) return // 帳密正確 → 放行
    } catch {
      // base64 decode 失敗 → 落到 401
    }
  }
  return new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Storybook", charset="UTF-8"' },
  })
}
