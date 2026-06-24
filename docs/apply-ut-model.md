# 套用「易用性測試模型 A」到你的 prototype

本 repo 內建一套可重用的 A/B(/C)易用性測試引擎 `@imethan0254/ut-model-a`(在 `packages/ut-model-a/`)。
**引擎是鎖定的(等同 design system,改不到)**;你只需要寫「一個 adapter + 一支 story」就能把它套到自己的 prototype。

---

## 前提(兩個硬條件)

1. **prototype 原始碼要在這個 repo 裡**(`apps/<你的-app>`)。只有 Netlify 網址沒用 —— 生成 A/B/C 變體、判斷「操作對錯」、埋錄製,都需要 source code。
2. 用 **Claude Code** 開這個 repo(web 版或本機 terminal 都可以)。

---

## 步驟

### 1. 把 prototype 放進 repo
- 新做的:`npm run create-app <name>`,把 UI 寫進 `apps/<name>/`。
- 已有的:放到 `apps/<name>/`。先 push 一版,確認 `npm run storybook` 跑得起來。

### 2. 解鎖 production code 編輯(governance gate)
編輯 `apps/**` 會被 DS governance hook 擋住,擇一處理:
- **本機 terminal**:
  ```
  /plugin marketplace add github:ajenchen/design-system
  /plugin install design-system@qijenchen-ds
  ```
  裝完重啟 session。
- **web 版**(裝不了 plugin):在 `.claude/settings.local.json` 加(此檔不進版控,只對你自己生效):
  ```json
  { "env": { "CLAUDE_BYPASS_PLUGIN_BOOTSTRAP": "1" } }
  ```

### 3. 跑 skill `/apply-ut-model-a`
照問答回答:
- 測試目標(一句話)
- 要比哪幾版、每版設計差在哪(A = 基底、B = …、C = …)
- 任務清單 + 每個任務「做對」的定義(對應哪個操作)
- 要不要問卷(SEQ / 開放題)、要不要螢幕錄製

### 4. Claude 自動產生兩個檔(之後可隨時改)
- `apps/<name>/src/ut/<name>Adapter.tsx` — 把你的 prototype 包成變體,並吐 `onAction` 操作事件
- `apps/<name>/src/ut/<name>.stories.tsx` — `UTProject`:目標 / 任務 / 變體 / 問卷;綜合 story 加 `record` 開啟錄製

### 5. 本機驗證 + 改任務
- `npm run storybook` → 打開 `UT/<你的測試>` → 跑一遍,確認任務判定、問卷、錄影都正確
- 要改任務 / 文案 / 變體 → **只改那支 story**,引擎不用碰

### 6. 上線分享
- 開 PR → merge `main` → Netlify 自動 deploy
- 拿到 `...--combined-ab` 網址 + Basic Password,私訊受測者

---

## 套用後免費附帶(不用自己做)

A→B→C 多版流程 · 懸浮任務面板 · **依實際操作判定成敗** · 放聲思考逐字稿 ·
任務後 / 測試結束問卷(SEQ + 開放題) · 摘要頁**自動下載 Excel + 螢幕錄影(webm)** + toast · 結果頁與匯出。

---

## 對外契約(你只填這些,引擎負責其餘)

```ts
import { UsabilityTest, UsabilityTestAB, type UTProject } from '@imethan0254/ut-model-a'

type MyAction = { type: 'open-room' } | { type: 'submit' } // 你的 prototype 吐的操作事件

const project: UTProject<MyAction> = {
  id: 'my-test',
  title: 'UT – 我的測試',
  goal: '一句話描述要驗證什麼',
  instructions: ['受測須知…'],
  postTaskSurvey: [
    { id: 'seq', questionType: 'singleEase', prompt: '這個任務有多容易或多困難?', scalePoints: 7,
      anchors: { min: '非常困難', max: '非常容易' } },
  ],
  postTestSurvey: [
    { id: 'like', questionType: 'writtenResponse', prompt: '最喜歡的部分是什麼?', minChars: 15 },
  ],
  tasks: [
    { id: 't1', title: '請受測者做的事',
      check: (a) => a.some((x) => x.type === 'open-room') ? { ok: true } : { ok: false, reason: '沒有真的做到' } },
  ],
  variants: {
    A: { label: '版本 A', render: ({ onAction }) => <MyProto onAction={onAction} /> },
    B: { label: '版本 B', render: ({ onAction }) => <MyProto variantB onAction={onAction} /> },
  },
}

// 綜合(多版 + 問卷 + 自動下載 Excel + 螢幕錄製):
<UsabilityTestAB project={project} order={['A', 'B']} record password="0000" />
```

---

## 關鍵提醒

- **埋操作事件是唯一需要動 prototype 本體的地方**:在互動處呼叫 `onAction({ type: '...' })`,任務 `check(actions)` 才判定得了成敗。沒埋的話 skill 會引導你加。
- **螢幕錄製**:`record` 啟用時,測試開始會跳「分享畫面」授權框(瀏覽器強制,不能自動);建議用 **Chrome / Edge**。摘要頁的 toast 只通知、不附按鈕(網頁無法開啟作業系統的下載資料夾)。
- **目前是 monorepo 內共用**(透過 workspace),套件尚未發佈到 npm。所以「套用」= 在這個 repo 裡新增 app。若要讓完全獨立的 repo 也能 `npm install`,需先把套件 publish 出去。
