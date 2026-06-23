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

<UsabilityTestAB project={project} order={['A', 'B']} password="0000" /> // A→B 綜合
<UsabilityTest project={project} variant="A" />                          // 只測單版
```

## API

| 匯出 | 說明 |
|---|---|
| `UsabilityTest({ project, variant, password? })` | 單版本流程 |
| `UsabilityTestAB({ project, order?, password? })` | A→B 雙版本綜合流程(預設 `order=['A','B']`) |
| `UTProject<A>` / `UTask<A>` / `UTVariant<A>` | 對外型別,`A` = 你的操作事件 union |

`password` 是測試頁自己的密碼閘門(預設 `0000`),與 Netlify Basic Password 無關。

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

## 設計原則

引擎對「被測 prototype」完全不可知 —— 它只認識 `render()` 與 `onAction`。
所有 prototype-specific 的東西(變體長相、操作事件)都在消費端,不在這個套件。
要改流程/結果頁/匯出格式 → 改的是引擎本體、發新版本,不在消費端 fork。
