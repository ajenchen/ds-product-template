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

- `NavBtn`：共用按鈕。tooltip 強制在右側（`side="right" avoidCollisions={false}`）。
  - **重要**：DS Button 在 `iconOnly` + **string** `aria-label` 時會自動補一個 side="top" 的 tooltip（無法調位置）→ 會出現雙 tooltip。解法：**不傳 string `aria-label`**，改用 `aria-labelledby` 指向 sr-only span 保住無障礙名稱，讓 DS auto-tooltip 條件失效，只剩我們 right-side 的單一 tooltip。此規則僅 apply 在 nav rail 按鈕。

---

## 2. Chat list — `function ChatList`

寬度範圍：`CHAT_LIST_MIN = 120`（小安全 floor，讓 RoomRow 寬度隨 ResizeHandle 自由縮放）~ `CHAT_LIST_MAX = 480`。

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
  - more 按鈕為 **24×24px**（`!h-6 !w-6 !p-0`），外層 `absolute right-1 top-1/2 -translate-y-1/2`，框右緣距分隔線 **12px**（icon 視覺右緣落在 16px，與 date/time 右緣重疊）。用 **`invisible` 而非 `hidden`**（保留可量測 box，讓 Radix 正確錨定 dropdown）；`group-hover:visible` + `[&:has([data-state=open])]:visible` → hover 才出現、選單開啟時保持顯示。
- **間距**：列表外層 `px-2` + row `px-2` → date/time & badge 右緣距右側分隔線 **16px**；hover 時 date/time + badge 用 `group-hover:invisible` 隱藏，由 more 按鈕覆蓋。
- **ReactionBar**：用 `invisible/visible`（非 `hidden/flex`）控制顯隱，確保 Radix trigger 保留 box、選單開啟時 bar 不消失。
- **ScrollArea 寬度約束**：Radix viewport 內部會自動包一層 `display:table; min-width:100%` 的 div，會讓 `truncate` 的 row 以 max-content 撐大、溢出被分隔線遮擋。ChatList 的 ScrollArea 加 `[&_[data-radix-scroll-area-viewport]>div]:!block` 把它改回 block，row 才會被 aside 寬度約束、正常 truncate。

---

## 3. Conversation — `function Conversation`

```
Conversation
├── ConversationHeader   (上下 padding 8px `py-2`；avatar 32×32；標題 16px / medium / lh 130%)
│   ├── 頭像（靜音時換成 MutedAvatar 32×32）+ 室名 + Edit 按鈕(28×28)
│   ├── TeamsCallButton（h28 / px4 / 18px icons）/ RoomInfoButton（h28 / px4 / 18px icon + badge h20 px4 py2 12px/130% medium）/ Search(28×28)
│   ├── 按鈕群 spacing 8px（`gap-2`），icon-only 按鈕一律 size="sm"=28×28
│   └── HeaderMoreMenu (28×28 trigger)
│       ├── Full width        (inline Switch 切換)
│       ├── Mute / Unmute
│       └── Search / Room info…
├── MessageArea
│   └── MessageBubble × n
│       ├── 我的: bg #EBEEFF、時間在上、status icon 在泡泡外
│       ├── 對方: 頭像 + 名稱 + 時間 (12px neutral-7)
│       ├── ReactionBar
│       └── ReactionMoreMenu  (mine vs other 不同選單；`side="bottom" sideOffset={8}`，保留 Radix 碰撞避讓)
├── InputBox                  (無頂部分隔線；接受 `fullWidth` prop。ON=全寬；OFF=max 880px 置中)
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
