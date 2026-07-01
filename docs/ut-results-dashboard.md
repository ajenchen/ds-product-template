# UT 結果 Dashboard(可分享 + 可導出)

把 `ut_results`(受測者跑完自動上傳的結構化結果,見 `ut-results-supabase.md`)做成一個
**掛在 Netlify 密碼後面、給 PM / designer / QA 看的可分享儀表板**,並提供 4 種導出。

Dashboard 本身是一支 Storybook story(`Dashboards/UserTest Results Dashboard`),跟你的 UT 測試一樣經 Netlify
部署 + Basic Password 保護。

---

## 一、架構(為什麼這樣設計)

```
受測者跑測試(story)──POST(anon, insert-only)──▶  Supabase: ut_results（含個資）
                                                          ▲
PM / designer 看 dashboard(瀏覽器)                       │ secret key 讀(bypass RLS)
      │                                                   │
      ▼  GET /.netlify/functions/ut-data                  │
  UT Dashboard story ◀──JSON──  Netlify Function ─────────┘
      （整站掛 Basic Auth edge function）      （secret key 只存 Netlify env,不進前端 / repo）
```

**關鍵安全點**:`ut_results` 含個資(姓名 / email / 逐字稿),而 anon key 是 public(在 repo 裡)。
所以**不開** anon SELECT;改由 server-side function 用 **secret key(`sb_secret_...`,權限等同舊
service_role)** 讀(bypass RLS,不需改任何 policy)。前端只拿得到 function 回傳的 JSON,且整站掛 Netlify Basic Auth。

> 不需要跑 `ut-results-supabase.md` 裡那些 view —— dashboard 直接讀原始 `ut_results`,
> 在瀏覽器端即時算成功率 / SEQ。那些 view 仍可留著給你手動 SQL 分析用。

---

## 二、一次性設定(3 個 Netlify 環境變數)

Netlify → **Site configuration → Environment variables → Add a variable**:

| Key | Value | 哪裡拿 |
|---|---|---|
| `SUPABASE_URL` | `https://qjaedugymiezllhhtbgs.supabase.co` | Supabase → Settings → API Keys → Project URL |
| `SUPABASE_SECRET_KEY` | `sb_secret_...`(**secret,勿外流 / 勿進 repo**) | Supabase → Settings → **API Keys → Secret keys** → default(點眼睛 reveal 再複製) |
| `STORYBOOK_BASIC_AUTH` | `user:password`(站台密碼,dashboard 沿用同一組) | 你自訂;見 `netlify/edge-functions/basic-auth.ts` |

> **新舊 key 制**:2026 起 Supabase 用 `sb_publishable_...` / `sb_secret_...` 取代舊的 anon / service_role。
> 這裡要的是 **Secret key(`sb_secret_...`)**—— 它一樣 bypass RLS、一樣只能放後端。若你的專案還是舊制
> (`service_role` JWT `eyJ...`),把它設成 `SUPABASE_SERVICE_ROLE_KEY` 也可,function 兩種都吃。
>
> ⚠️ Secret key **只能放後端**(Netlify env / function),Supabase 會擋瀏覽器直接使用(User-Agent 偵測回 401),
> 這正是為何要走 server-side function、不能前端直連。

設完 → 下次 push main(或 Netlify **Trigger deploy**)生效。

> ⚠️ **一定要設 `STORYBOOK_BASIC_AUTH`**。沒設 = 整站(含含個資的 dashboard / function)公開放行。

---

## 三、看 + 用

1. 打開你的 Netlify 站台 → 輸入 Basic Auth 帳密 → 進 Storybook。
2. 左側 **Dashboards → UserTest Results Dashboard → Live（讀 Supabase）**。
3. 用右上「選擇測試」下拉切 `test_id`;分頁看:
   - **版本比較** — 各版本平均成功率 + 平均 SEQ。
   - **各任務成功率** — 各版本 × 各任務,找出哪版哪題卡關。
   - **場次明細** — 每位受測者一列,點「詳情」展開逐字稿 / 結論 / 問卷。

> **Preview（離線假資料)** story 用內建假資料展示版面,本地 `npm run storybook` 也看得到
> (本地沒有 Netlify function,Live 會顯示連線失敗提示,屬正常)。

---

## 四、導出(4 種)

工具列(列印時自動隱藏):

| 按鈕 | 內容 | 個資 | 用途 |
|---|---|---|---|
| **量化彙總 CSV** | 各版本 / 各任務成功率、SEQ、場次 | ❌ 無 | 給報告 / 對外分享 |
| **逐字稿 CSV** | 受測者、email、逐字稿、開放題、結論 | ⚠️ 含 | 丟 Claude 出質化總結 |
| **原始 raw CSV** | 每場攤平欄位 + 完整 `result` JSON | ⚠️ 含 | 自行再分析 |
| **列印 / 存 PDF** | 整頁 dashboard | 視畫面 | 貼進簡報(瀏覽器「列印 → 存成 PDF」) |

CSV 皆帶 UTF-8 BOM,Excel 開中文不亂碼。

**質化大總結**:匯出「逐字稿 CSV」→ 丟 Claude:「這是 N 位受測者的 UT 結果,幫我歸納
① 各版本量化差異 ② 共同痛點 / 正面回饋 ③ false-easy(自覺容易卻失敗)代表什麼 ④ 給設計的建議。」

---

## 五、檔案地圖

| 檔 | 作用 |
|---|---|
| `netlify/functions/ut-data.mts` | 讀取層(secret key 讀 Supabase + defense-in-depth Basic Auth)|
| `apps/chat/src/ut/dashboard/analytics.ts` | 純資料分析(normalize + 各版本 / 各任務彙總)|
| `apps/chat/src/ut/dashboard/exports.ts` | 4 種導出(CSV × 3 + 列印)|
| `apps/chat/src/ut/dashboard/UtDashboard.tsx` | 儀表板 UI(DS primitives + 引擎 token 視覺)|
| `apps/chat/src/ut/dashboard/UtDashboard.stories.tsx` | Live + Preview 兩支 story |
| `netlify.toml` `[functions]` | 宣告 function 目錄 |

---

## 六、提醒 / 進階

- **多測試共用**:同一張 `ut_results`,dashboard 用 `test_id` 下拉切,不用每測試各建。
- **只想給某人看某一測試**:目前是共用密碼看全部。要 per-test 權限需 Supabase Auth,超出免費 tier 範圍。
- **要含螢幕錄影**:webm 需另接 Storage(見 `ut-results-supabase.md` 第二階段),再把 URL 寫進 result。
