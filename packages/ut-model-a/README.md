# @imethan0254/ut-model-a

**易用性測試模型 A** — 一個版本鎖定、可重用的 A/B(/C)易用性測試引擎。
你的同事拿它套自己的 prototype,**改不到引擎本體**,只填「測試目標 + 任務 + 變體」。

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

## 設計原則

引擎對「被測 prototype」完全不可知 —— 它只認識 `render()` 與 `onAction`。
所有 prototype-specific 的東西(變體長相、操作事件)都在消費端,不在這個套件。
要改流程/結果頁/匯出格式 → 改的是引擎本體、發新版本,不在消費端 fork。
