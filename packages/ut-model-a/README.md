# @imethan0254/ut-model-a

**易用性測試模型 A** — 一個版本鎖定、可重用的 A/B(/C)易用性測試引擎。
使用者可以拿它套自己的 prototype,**改不到引擎本體**,只填「測試目標 + 任務 + 變體」。

## 引擎包了什麼(你不用自己做)

- 測試前 intro 畫面(測試名稱 / 目標 / 須知 / 受測者姓名)+ 密碼閘門
- 進行中右下角**可拖曳懸浮任務面板**、左上角版本/錄音狀態列
- **依使用者實際操作判定任務成敗**(不是按了「完成」就算過)
- **放聲思考**逐字稿(瀏覽器 Web Speech API,免後端)+ 關鍵字重點擷取
- A→B **雙版本綜合流程**與綜合結論
- 結果頁:成功率、逐項 summary、逐字稿、**Excel / 純文字匯出**

消費端只提供一個 `UTProject` config,引擎負責其餘全部。

## 安裝

```bash
npm install @imethan0254/ut-model-a
# peer deps: react, react-dom, @qijenchen/design-system, lucide-react
```

## 你只填這四樣(對外契約)

```ts
import type { UTProject } from '@imethan0254/ut-model-a'

type MyAction = { type: 'open-room' } | { type: 'submit' } // 你的 prototype 吐的操作事件

const project: UTProject<MyAction> = {
  id: 'my-test',
  title: 'UT – 我的測試',
  goal: '一句話描述要驗證什麼',
  instructions: ['受測須知…'],
  tasks: [
    {
      id: 't1',
      title: '請受測者做的事',
      check: (actions) =>
        actions.some((a) => a.type === 'open-room')
          ? { ok: true }
          : { ok: false, reason: '沒有真的做到' },
    },
  ],
  variants: {
    A: { label: '版本 A', render: ({ onAction }) => <MyProto onAction={onAction} /> },
    B: { label: '版本 B', render: ({ onAction }) => <MyProto variantB onAction={onAction} /> },
  },
}
```

關鍵:`variant.render({ onAction })` 把**你自己的 prototype** 包進來,使用者每做一個關鍵操作就 `onAction(...)`,`task.check(actions)` 才能判定成敗。

## 跑起來

```tsx
import { UsabilityTest, UsabilityTestAB } from '@imethan0254/ut-model-a'

<UsabilityTestAB project={project} order={['A', 'B']} /> // A→B 綜合
<UsabilityTest project={project} variant="A" />                          // 只測單版
```

## API

| 匯出 | 說明 |
|---|---|
| `UsabilityTest({ project, variant, password? })` | 單版本流程 |
| `UsabilityTestAB({ project, order?, password? })` | A→B 雙版本綜合流程(預設 `order=['A','B']`) |
| `UTProject<A>` / `UTask<A>` / `UTVariant<A>` | 對外型別,`A` = 你的操作事件 union |

`password` 是**選用**的元件層密碼閘門(不傳 = 不擋)。在 Storybook 中**不要**用它(會出現在 Controls 而外洩);請改在 `.storybook/preview.tsx` 用 preview decorator 綁一個 Storybook 維度的密碼(預設 `0000`)—— 這樣鎖在 Storybook 層、不會出現在 story Controls。真正要鎖死(防繞過)請用 Netlify Basic Password(edge 層)。

## 摘要頁自動交付(Excel + 螢幕錄製)

到結果頁時引擎會**自動把測試結果 Excel 下載**到使用者的下載資料夾,並跳一個 toast 告知。

加 `record` prop 可額外**錄製整個測試過程(畫面 + 麥克風講話聲)**,結束自動下載 `.webm`:

```tsx
<UsabilityTestAB project={project} order={['A', 'B', 'C']} record />
<UsabilityTest project={project} variant="A" record />
```

限制(瀏覽器層面,務必知道):
- `record` 啟用時,測試**開始**會跳「分享畫面」授權框,使用者須自行選擇分享範圍(瀏覽器強制,不能自動)。建議 **Chrome / Edge**(Safari 對螢幕錄製支援有限)。
- toast **只通知、不附按鈕**:網頁無法打開作業系統的「下載」資料夾(沒有這種 API)。檔案就在使用者的預設下載資料夾。
- 自動下載依賴「結束前剛點過按鈕」的近期互動;首次多檔下載 Chrome 可能問一次「允許多個下載」。

## 問卷(survey)— 任務後 / 測試後安插主觀回饋

在任務的「實際操作判定」之外,可在 config 加問卷,捕捉主觀感受與開放性意見。v1 題型:
`singleEase`(SEQ 單題難易度量表,預設 7 點)、`writtenResponse`(開放式文字,可設最低字數)。

```ts
const project: UTProject<MyAction> = {
  ...
  // 每個任務完成後彈出(overlay);單一 task 可用 task.postTask 覆寫
  postTaskSurvey: [
    { id: 'seq', questionType: 'singleEase',
      prompt: '整體而言,這個任務有多容易或多困難?',
      scalePoints: 7, anchors: { min: '非常困難', max: '非常容易' } },
  ],
  // 整場測試結束、結果頁前彈出一次
  postTestSurvey: [
    { id: 'like', questionType: 'writtenResponse', prompt: '這次體驗中你最喜歡的部分是什麼?', minChars: 25 },
    { id: 'change', questionType: 'writtenResponse', prompt: '如果可以改一件事,你會改什麼?', minChars: 25 },
  ],
  tasks: [
    { id: 't1', title: '…', check: (a) => …,
      // 只在這個任務後問一題開放題(覆寫 project.postTaskSurvey)
      postTask: [{ id: 't1-open', questionType: 'writtenResponse', prompt: '剛剛操作時你在想什麼?', required: false }] },
  ],
}
```

問卷回應會進結果頁,並一併匯出 Excel / 文字。文案請維持中性、非引導(要「你的第一印象是什麼?」不要「你喜歡嗎?」),開放題建議單場 ≤ 1–2 題避免疲勞。
> roadmap(尚未做):ratingScale / likert / nps(含計分) / multipleChoice / matrix / SUS 題組 / 跳題邏輯 / 期望vs體驗散佈圖。

## 雙語(中文 / English)

測試說明頁右上角有語言切換,**預設中文**,切 English 後整個流程(引擎文字 + 你的內容)都變英文。

- 引擎自身文字內建 zh/en。
- 你的內容用 `Localized` 提供雙語:`string`(不分語言)或 `{ zh, en }`。
  ```ts
  title: { zh: '我的測試', en: 'My test' }
  tasks: [{ title: { zh: '…', en: '…' }, check: (a) => ok ? { ok: true } : { ok: false, reason: { zh: '…', en: '…' } } }]
  variants: { A: { label: { zh: '版本 A', en: 'Version A' }, render } }
  ```
- 預設語言可用 `defaultLang="en"` 覆寫(預設 `'zh'`)。
- SEQ 量表錨點不給就用引擎內建雙語(非常困難/非常容易 ↔ Very difficult/Very easy)。

## 摘要頁分析:做失敗卻自評偏容易(false-easy)

結果頁會特別用警示區塊標出「實際**失敗**、但任務後 SEQ 自評落在偏『容易』(分數 / 量表 ≥ 0.7)」的任務 —— 代表受測者誤以為自己輕鬆完成,最值得回放 / 訪談。也會寫進 Excel / 文字匯出。需該任務有 `singleEase` 任務後問卷才偵測得到。

## 消除順序效應(counterbalancing)

`counterbalancedOrders(variants)` 產生 cyclic Latin square 的順序集合(每版在每位置各一次),每個順序做成一支綜合 story 即可平衡 order bias:

```ts
import { counterbalancedOrders } from '@imethan0254/ut-model-a'
counterbalancedOrders(['A', 'B'])      // [['A','B'], ['B','A']]
counterbalancedOrders(['A', 'B', 'C']) // [['A','B','C'], ['B','C','A'], ['C','A','B']]
// 各順序:<UsabilityTestAB project={p} order={ord} record />
```

## 設計原則

引擎對「被測 prototype」完全不可知 —— 它只認識 `render()` 與 `onAction`。
所有 prototype-specific 的東西(變體長相、操作事件)都在消費端,不在這個套件。
要改流程/結果頁/匯出格式 → 改的是引擎本體、發新版本,不在消費端 fork。
