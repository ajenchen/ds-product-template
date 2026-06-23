---
name: apply-ut-model-a
description: 把「易用性測試模型 A(A/B/C 易用性測)」套到一個 prototype 上,產出可跑的 Storybook 測試。當使用者說「我想用測試模型 A 套到某個 prototype」「幫某某的 prototype 建一個 A/B 易用性測試」「set up usability test for this prototype」時使用。需要 prototype 的原始碼在 repo 內(光有 Netlify 網址不夠)。
---

# 套用測試模型 A(@imethan0254/ut-model-a)

把鎖定的測試引擎 `@imethan0254/ut-model-a` 套到一個 prototype,長出一個可跑的 A/B(/C)易用性測試 story。**引擎本體不改**,你只產出 config(目標 + 任務 + 變體 adapter)。

## 0. 前置確認(缺一不可)

1. **prototype 原始碼在 repo 裡**(React 元件,Claude 讀得到、改得到)。只有部署網址 → 無法埋操作事件、無法可靠生變體;請先把原始碼放進 repo(或用 `npm run create-app` 起一個)。
2. 套件已安裝:`@imethan0254/ut-model-a` 在 `package.json`。monorepo 內透過 vite/tsconfig alias 直接讀 source。
3. **不要修改 `packages/ut-model-a/`** —— 那是鎖定的模型。所有客製都在消費端(`apps/<app>/src/...`)。

## 1. 跟使用者釐清(問完才動手)

- 受測 prototype 是哪個(`apps/<app>` 路徑 / 元件)?
- 測試目標一句話?(要驗證什麼設計假設)
- 要比幾個版本、各版的**設計差異**是什麼?(A=基底、B=…、C=…)
- 幾個任務?每個任務「做對」的定義是什麼操作?
- 測試密碼(預設 `0000`)。

## 2. 讓 prototype 可被測(埋兩個接點)

模型 A 靠「使用者實際操作」判定成敗,所以 prototype 要對引擎暴露兩件事:

1. **變體輸入**:prototype 接受一個 config/props,能渲染出 A/B/C 各自的設計變體。
2. **操作事件輸出**:prototype 接受一個 `onAction(action)` callback,使用者每做一個關鍵操作就吐一個事件。

定義該 prototype 自己的 Action union,例如:
```ts
export type MyAction =
  | { type: 'open-room'; roomId: string; unread: boolean }
  | { type: 'submit-form' }
```
在 prototype 對應互動處呼叫 `onAction({ type: 'open-room', ... })`。`onAction` 為 optional,base story 不傳時完全不影響行為。

## 3. 寫變體 adapter(消費端,薄薄一層)

`apps/<app>/src/ut/<name>Adapter.tsx`:
```tsx
import App, { type MyVariantConfig, type MyAction } from '../App'
import type { UTVariant } from '@imethan0254/ut-model-a'

export type { MyAction } from '../App'

export function myVariant(label: string, config: MyVariantConfig): UTVariant<MyAction> {
  return { label, render: ({ onAction }) => <App config={config} onAction={onAction} /> }
}
```

## 4. 寫測試 config + story

`apps/<app>/src/ut/<name>.stories.tsx`:
```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { UsabilityTest, UsabilityTestAB, type UTProject } from '@imethan0254/ut-model-a'
import { myVariant, type MyAction } from './<name>Adapter'

const project: UTProject<MyAction> = {
  id: '<kebab-id>',
  title: 'UT – <測試名稱>',
  goal: '<測試目標一句話>',
  instructions: [
    '這是一次易用性測試,我們測的是介面、不是你 — 沒有對錯,依直覺操作即可。',
    '過程中請盡量講出你的想法(放聲思考)。',
    '右下角會出現任務指示;請「實際完成」該操作後再按「完成,下一步」。',
  ],
  tasks: [
    {
      id: 't1',
      title: '<請受測者做的事>',
      hint: '<可選提示>',
      check: (acts) => acts.some((a) => a.type === 'open-room')
        ? { ok: true }
        : { ok: false, reason: '<為何算失敗>' },
    },
  ],
  variants: {
    A: myVariant('版本 A:<差異>', { /* config */ }),
    B: myVariant('版本 B:<差異>', { /* config */ }),
    // C: myVariant('版本 C:<差異>', { /* config */ }),
  },
}

const meta: Meta<typeof UsabilityTest> = {
  title: 'UT/<測試名稱>',
  component: UsabilityTest,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UsabilityTest>

export const CombinedAB: Story = {
  name: '綜合測試 A→B(含結論)',
  render: () => <UsabilityTestAB project={project} order={['A', 'B']} />,
}
export const VersionA: Story = { name: '只測版本 A', render: () => <UsabilityTest project={project} variant="A" /> }
export const VersionB: Story = { name: '只測版本 B', render: () => <UsabilityTest project={project} variant="B" /> }
```

> 三版以上:`order` 目前是兩版綜合流程;要 A→B→C 可分別跑單版 story,或回報需求由模型 A 加多版流程(改的是引擎、發新版,不在消費端硬改)。

## 4b. (選用)在任務中安插問卷 / 開放性問題

模型 A 支援任務後(post-task)與測試後(post-test)問卷,用來收主觀感受與開放意見。v1 題型:
`singleEase`(SEQ,預設 7 點)、`writtenResponse`(開放題,可設 `minChars`)。在 config 加:

```ts
postTaskSurvey: [
  { id: 'seq', questionType: 'singleEase', prompt: '這個任務有多容易或多困難?', scalePoints: 7,
    anchors: { min: '非常困難', max: '非常容易' } },
],
postTestSurvey: [
  { id: 'like', questionType: 'writtenResponse', prompt: '最喜歡的部分是什麼?', minChars: 25 },
  { id: 'change', questionType: 'writtenResponse', prompt: '如果可以改一件事,你會改什麼?', minChars: 25 },
],
```
單一任務想問不同題 → 在該 `task.postTask` 放題目(覆寫 project 預設)。

指引:文案中性非引導;量表預設 7 點;開放題單場建議 ≤ 1–2 題避免疲勞;`post-task` 題綁該任務、`post-test` 收整體。問卷回應會進結果頁 + Excel/文字匯出。

## 5. 驗證

- `npm run typecheck` 綠
- `npm run storybook` → 打開 `UT/<測試名稱>` → 走完 intro → 任務 → 結果頁
- 任務 `check` 要對著「真的做對的操作」回 `ok:true`,光按完成不該成功

## 6. 修改任務

任務、目標、變體都在消費端的 `*.stories.tsx` / `*Adapter.tsx`,隨時可改 —— 改 config 不動引擎。引擎要升級時 `npm update @imethan0254/ut-model-a`。
