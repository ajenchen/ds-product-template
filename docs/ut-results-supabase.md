# 把 UT 測試結果自動匯集到 Supabase + 出大總結

測試到摘要頁時,引擎會自動把每位受測者的**結構化結果** POST 到 Supabase 一張表,讓你集中批次分析。
(螢幕錄影 webm 太大不在此範圍 —— 那是另接檔案儲存的第二階段。)

---

## 一、建 Supabase 專案 + 資料表(一次性)

1. 到 [supabase.com](https://supabase.com) 用 GitHub 登入 → **New project**(免費 tier 即可,選離你近的 region)。
2. 左側 **SQL Editor** → 貼上並執行:

```sql
create table public.ut_results (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  test_id     text,        -- 測試 id(project.id)
  kind        text,        -- 'single' | 'combined'
  variants    text,        -- 'A' 或 'A,B,C'
  tester      text,        -- 受測者工號姓名
  lang        text,        -- 'zh' | 'en'
  started_at  timestamptz,
  finished_at timestamptz,
  result      jsonb        -- 完整結果(成敗 / SEQ / 問卷 / 逐字稿 / false-easy)
);

-- 開 RLS,只允許「匿名 anon 寫入」、不允許讀 → anon key 外洩也只能寫不能偷看別人資料。
alter table public.ut_results enable row level security;
create policy "anon insert only" on public.ut_results
  for insert to anon with check (true);
-- 故意不建 select policy:你自己用 Dashboard / service role 看資料即可。
```

3. 左側 **Project Settings → API**,複製兩個值:
   - **Project URL**(像 `https://abcdefgh.supabase.co`)
   - **anon public** key

---

## 二、填進 repo(一次性)

編輯 `apps/chat/src/ut/utSubmit.ts`,把剛剛兩個值貼進去:

```ts
const SUPABASE_URL = 'https://abcdefgh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGci...(你的 anon public key)'
```

> anon key 設計上可公開(配上面的 RLS insert-only 才安全),所以放進 repo 沒問題。
> 兩者留空 = 不上傳,維持原本本地匯出。

push main → Netlify 重新 deploy 後即生效。之後每位受測者跑完,摘要頁會自動 insert 一列,並跳「結果已上傳」toast。

---

## 三、看資料 + 出大總結

**看原始資料**:Supabase → **Table editor → ut_results**(每列一位受測者一場)。

**量化彙總(SQL 範例)**:
```sql
-- 各版本任務成功率(combined 測試)
select variants, count(*) as n,
       round(avg((result->>'rate')::numeric)) as avg_rate_single
from ut_results
group by variants;

-- 看某測試的所有逐字稿 + 開放題(匯出給 Claude 用)
select tester, lang, result
from ut_results
where test_id = 'chat-list-preview'
order by created_at desc;
```

**質化大總結(用 Claude)**:
1. 在 Supabase 把該測試的 rows **Export → CSV**(或上面 SQL 結果)。
2. 丟給 Claude:「這是 N 位受測者的 UT 結果,幫我歸納:① 各版本量化差異 ② 共同痛點/正面回饋主題 ③ false-easy(自覺容易卻失敗)的任務代表什麼 ④ 給設計的建議。」
3. 得到整批的質化 + 量化大總結。

---

## 四、提醒

- **個資**:`tester`(工號姓名)+ 逐字稿屬個資。測試說明頁已可加「結果將回傳供研究分析」告知;資料存在你的 Supabase 專案內,自行控管存取。
- **要連螢幕錄影也集中**:webm 需另接檔案儲存(Supabase **Storage** bucket / Google Drive),把上傳的 URL 也寫進 result —— 那是第二階段,需要時再做。
- **多個測試共用同一張表**:用 `test_id` 區分即可,不用每個測試各建表。
