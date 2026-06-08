# TeaChat Chat Prototype — 結構文件

單一檔案 prototype：`apps/chat/src/App.tsx`（約 1440 行）。本文件記錄元件樹、命名與職責，方便 onboarding 與對照修改。

> 消費 `@qijenchen/design-system`（public surface only）。詳見 repo 根目錄 `CLAUDE.md`。

> **維護慣例（user 約定，務必遵守）**：
> 1. 任何對 `apps/chat/src/App.tsx` 的改動，**必須同步更新本文件**，使結構描述與程式碼一致。
> 2. 每次改動完成後，**主動提供完整 PR 步驟**（bundle 指令 + compare 連結 + 標題/說明），user 不需另外要求。

---

## 整體佈局

```
App  (export default)
├── TooltipProvider
└── div.flex.h-screen          ← 3-column 主框架
    ├── NavRail                 最左窄欄（icon 導覽）
    ├── ChatList                中欄（聊天列表，可收合 / 可拉寬）
    └── Conversation            右側主區（對話 + Thread panel）
    └── SettingsModal           overlay，由 NavRail more → Settings 開啟
```

---

## App 狀態 (state)

| 變數 | 型別 | 用途 |
|---|---|---|
| `activeId` | string | 目前選中的聊天室 |
| `listOpen` | bool | ChatList 是否展開 |
| `listWidth` | number | ChatList 寬度（260–480px）|
| `showPreview` | bool | 列表是否顯示訊息預覽（Settings 控制）|
| `settingsOpen` | bool | Settings modal 開關 |
| `mutedIds` | Set\<string\> | 被靜音的聊天室 |
| `fullWidth` | bool | 訊息區全寬 / 960px 置中（預設 true = 全寬）|
| `favOrder` | string[] | 我的最愛排序 |

---

## 1. Nav rail — `function NavRail`

```
NavRail
├── Logo
├── NavBtn  Home
├── NavBtn  Chats          (overlayBadge = 未讀數)
├── (spacer)
├── DropdownMenu (More)    → DropdownMenuItem Settings → 開 SettingsModal
└── PersonAvatar (ME)      我的頭像
```

- `NavBtn`：共用按鈕。tooltip 強制在右側（`avoidCollisions={false}`），`title=""` 壓掉瀏覽器原生 tooltip。

---

## 2. Chat list — `function ChatList`

寬度範圍：`CHAT_LIST_MIN = 260` ~ `CHAT_LIST_MAX = 480`。

```
ChatList
├── Header: "Chats" + AddPopover(＋) + 搜尋 + 收合鈕
├── Section "Favorites"   → RoomRow × n
├── Section "Chats"       → RoomRow × n
└── ResizeHandle          拖曳改寬度
```

- `RoomRow`：兩行預覽（名稱 + 最後訊息）。右側 time + 未讀 badge 用 `shrink-0` 防止 resize 時裁切。
- `RoomMoreMenu`：more 選單 → Mute/Unmute · Favorite/Unfavorite · Open in new tab · Open in new window · Leave。
  - 選單出現在 more 按鈕**下方 8px**（`side="bottom" sideOffset={8}`）；保留 Radix 預設碰撞避讓，靠近視窗邊緣時自動翻上方以維持可見。
  - 外層 wrapper 用 `shrink-0 invisible group-hover:visible [&:has([data-state=open])]:visible`（**不用 absolute**，留在 flex flow 內讓 Radix 正確計算錨點）；選單開啟時 more 按鈕保持顯示，避免滑鼠移開後選單秒關。

---

## 3. Conversation — `function Conversation`

```
Conversation
├── ConversationHeader
│   ├── 頭像（靜音時換成 MutedAvatar 32×32）+ 室名
│   ├── TeamsCallButton / 搜尋
│   └── HeaderMoreMenu
│       ├── Full width        (inline Switch 切換)
│       ├── Mute / Unmute
│       └── Search / Room info…
├── MessageArea
│   └── MessageBubble × n
│       ├── 我的: bg #EBEEFF、時間在上、status icon 在泡泡外
│       ├── 對方: 頭像 + 名稱 + 時間 (12px neutral-7)
│       ├── ReactionBar
│       └── ReactionMoreMenu  (mine vs other 不同選單)
├── InputBox                  (無頂部分隔線)
└── ThreadPanel               寬 320~720，可拉寬
    ├── 父訊息 + 回覆串
    └── ThreadInputBox        含 "Also send to chatroom" checkbox
```

---

## Settings modal — `function SettingsModal`

- 左側 nav（Settings → Chats）+ 右側內容（Show message previews 開關）。
- Dialog 固定高 480px，內層 flex 填滿，footer（Cancel / Save changes）pin 在底部。

---

## 共用元件 / helper

| 名稱 | 職責 |
|---|---|
| `NavBtn` / `ListBtn` / `IconBtnSm` | 共用按鈕 primitive |
| `StatusDot` | 在線狀態圓點：online=綠實心 / busy=紅實心 / away=黃+Clock / offline=灰空心 |
| `PersonAvatar` | DS Avatar + 自訂 StatusDot overlay |
| `GroupAvatar` | 群組頭像 |
| `MutedAvatar` | 靜音狀態頭像（白底 + 灰 BellOff）|
| `makeProfileCard` | 產生 hover 用的 ProfileCard |
| `MsgStatusIcon` | 訊息狀態 icon（sending / sent / read），在泡泡外 |

---

## 資料模型 (`第 151–267 行`)

```ts
type Presence  = 'online' | 'away' | 'busy' | 'offline'
type MsgStatus = 'sending' | 'sent' | 'read'

type Person  = { name; color; status: Presence; role; email; avatar }
type Reaction = { emoji; count }
type Message = { id; author; text; time; status: MsgStatus; reactions[]; replies }
type Room    = { id; name; type; section: 'favorites' | 'chats'; unread; messages[] }
```

假資料常數：`PEOPLE`（柯南角色）· `ME` · `ROOMS` · `COMMON_EMOJI`。

---

## 常數速查

| 常數 | 值 | 用途 |
|---|---|---|
| `CHAT_LIST_MIN` / `CHAT_LIST_MAX` | 260 / 480 | ChatList 寬度範圍 |
| `THREAD_MIN` / `THREAD_MAX` | 320 / 720 | Thread panel 寬度範圍 |
| MessageArea max-width (fullWidth=false) | 960px | 訊息區置中上限 |
| 我的泡泡背景 | `#EBEEFF` | — |
