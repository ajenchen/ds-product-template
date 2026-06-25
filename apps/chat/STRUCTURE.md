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
| `rooms` | Room[] | 全部聊天室（含已送出訊息，初始值 `INITIAL_ROOMS`）|
| `activeId` | string | 目前選中的聊天室 |
| `listOpen` | bool | ChatList 是否展開 |
| `listWidth` | number | ChatList 寬度（260–480px）|
| `showPreview` | bool | 列表是否顯示訊息預覽（Settings 控制）|
| `settingsOpen` | bool | Settings modal 開關 |
| `mutedIds` | Set\<string\> | 被靜音的聊天室 |
| `fullWidth` | bool | 訊息區全寬 / 880px 置中（預設 true = 全寬）|
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
- **尺寸 spec（2026-06-18 confirmed）**：`<nav>` 左右 `px-2`=8px + 按鈕 `!h-8 !w-8`=32×32 → 整體寬 `w-12`=48px（8+32+8）。按鈕間距 `gap-1`=4px。Chat tab 未讀 badge `<Badge variant="critical">` 加 `className="!bg-[#EC540F]"` 對齊 `bg/notification` token。More 按鈕同套 `!h-8 !w-8` 32×32 對齊。

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

- `RoomRow`：兩行預覽（名稱 + 最後訊息）。右側 time + 未讀 badge 用 `shrink-0` 防止 resize 時裁切。ChatList `<aside>` 無 `border-r`，視覺分隔線由 ResizeHandle 本身的 1px line 提供（避免雙線 = 2px 外觀）。
- `RoomMoreMenu`：more 選單 → Mute/Unmute · Favorite/Unfavorite · Open in new tab · Open in new window · Leave。
  - 選單出現在 more 按鈕**下方 8px**（`side="bottom" sideOffset={8}`）；保留 Radix 預設碰撞避讓，靠近視窗邊緣時自動翻上方以維持可見。
  - more 按鈕為 **24×24px**（`!h-6 !w-6 !p-0`），外層 `absolute right-1 top-1/2 -translate-y-1/2`，框右緣距分隔線 **12px**（icon 視覺右緣落在 16px，與 date/time 右緣重疊）。用 **`invisible` 而非 `hidden`**（保留可量測 box，讓 Radix 正確錨定 dropdown）；`group-hover:visible` + `[&:has([data-state=open])]:visible` → hover 才出現、選單開啟時保持顯示。
- **間距**：列表外層 `px-2` + row `px-2` → date/time & badge 右緣距右側分隔線 **16px**；hover 時 date/time + badge 用 `group-hover:invisible` 隱藏，由 more 按鈕覆蓋。
- **ReactionBar**：用 `invisible/visible`（非 `hidden/flex`）控制顯隱，確保 Radix trigger 保留 box、選單開啟時 bar 不消失。
- **ScrollArea 寬度約束**：Radix viewport 內部會自動包一層 `display:table; min-width:100%` 的 div，會讓 `truncate` 的 row 以 max-content 撐大、溢出被分隔線遮擋。ChatList 的 ScrollArea 加 `[&_[data-radix-scroll-area-viewport]>div]:!block` 把它改回 block，row 才會被 aside 寬度約束、正常 truncate。
- **Header「Chats」spec（2026-06-18 confirmed）**：`header` 上下 padding 改 10px（`style={{ paddingTop:10, paddingBottom:10 }}`，取代原 `py-2`=8px）；標題 `fontSize:16 / fontWeight:500 / lineHeight:'130%' / color:var(--color-neutral-9)`。
- **Section spec（2026-06-18 confirmed）**：容器 `p-1`=4px all sides + `gap-1`=4px（左 icon ↔ label ↔ trailing icon 各 4px）；外層 ChatList `px-2`=8px 提供 section 與列表邊界的左右間隔。左側展開/收起鈕 `IconBtnSm` + `!h-5 !w-5`=20×20（icon 16px，由 `size="sm"` 預設對齊），color `var(--color-neutral-7)`。右側 trailing 鈕（"Add chat" Plus）改用 `IconBtnSm` + `!h-6 !w-6`=24×24，同色 neutral-7（原為 `ListBtn`，已換成可控尺寸的 `IconBtnSm`）。Section name 字級 `fontSize:12 / fontWeight:500 / lineHeight:'130%' / color:var(--color-neutral-7)`。`IconBtnSm` 新增 `style` prop 支援顏色 override。
- **RoomRow 已讀/未讀 spec（2026-06-18 confirmed）**：未讀（`room.unread && !isMuted`）標題 `14px/700/150%/neutral-9`；已讀標題 `14px/400/150%/neutral-8`。時間資訊（`showPreview` ON 才顯示）一律 `12px/400/130%/neutral-7`。副標題（preview text）未讀 `12px/400/130%/neutral-9`，已讀 `12px/400/130%/neutral-8`。未讀 dot badge `<Badge dot variant="critical">` 加 `className="!bg-[#EC540F]"` 對齊 `bg/notification`。
- **RoomRow hover 截斷 spec（2026-06-19 confirmed, v2）**：preview OFF 時未讀也在**標題後**顯示 `#EC540F` dot badge。hover 出現 RoomMoreMenu（24×24，絕對定位 `right-1`）時：文字容器加 `group-hover:pr-6`（保留 24px 按鈕 footprint）→ 標題/副標題截斷邊界移到 more 按鈕左緣、不被覆蓋；時間資訊與 dot badge 用 **`group-hover:invisible`（visibility:hidden，非 `hidden`/display:none）**隱藏 —— 保留原本佔位 box，確保 RoomRow 高度在 initial/hover/clicked 三態**完全一致**（`hidden` 會 collapse line-box 致 hover 高度微縮，2026-06-19 user 回報後修正）。截斷由 `pr-6` 負責、不依賴隱藏元素。
- **Chats section 測試資料（2026-06-18 updated v2）**：`GENERATED_CHAT_ROOMS`（App.tsx，`INITIAL_ROOMS` 之前宣告，IIFE）產生 **40 間不重複** room（id `gen-0`…`gen-39`）：**20 間 `type:'dm'`（1 on 1）+ 20 間 `type:'general'`（多人）= 精確 50/50**。
  - DM 用 `GENERATED_DM_PEOPLE`（20 位全新不重複人物，每位 unique name/avatar/color）；這 20 位以 `g-xxx` key **`PEOPLE.forEach` 注入 PEOPLE map**，讓 conversation 內 `PEOPLE[message.author]` 能解析頭像 + 名字。Group 用 `GENERATED_GROUP_TOPICS`（20 個 unique 主題，與既有 room 名不撞）+ 既有 7 位成員輪替 3 位。
  - **排序自然錯開**：`GENERATED_RUNS` run-length pattern `dm5, grp3, dm3, grp4, dm6, grp2, dm2, grp5, dm4, grp6`（dm/group 各總和 20），交錯成不規則但可重現的順序（非簡單 odd/even）。
  - 每間室 `makeGeneratedMessages()` 產生 **20 則來回對話**（偶數 slot = 對方 / 奇數 slot = `me`，真 1↔1 back-and-forth）；`unread = n % 3 === 0`。名稱與 id 全程不重複。
- **Avatar 狀態燈尺寸 spec（2026-06-18 confirmed v2）**：`StatusDot` 有 `size` prop（預設 8px）+ 永遠帶 `ring-1 ring-surface`（1px `bg/surface` 外框線）。`PersonAvatar` 有 `dotSize` prop（預設 8）往下傳。RoomRow（ChatList）依 `showPreview` 傳 `dotSize={showPreview ? 8 : 6}`（preview OFF → **6×6** / ON → **8×8**）；ConversationHeader / MessageArea 用預設 **8×8**。
- **RoomRow hover/active 圓角**：`rounded-lg` 改為 `rounded-[4px]`，確保視覺上精確 4px（不依賴 DS `rounded-lg` token 映射）。

---

## 2a. Avatar 狀態燈（`function StatusDot` / `function PersonAvatar`）

`StatusDot({ status, size = 8 })`：online/busy/offline 圓點直徑 = `size`；away 圖示（`Clock`）依 `size * 0.67` 等比縮放。`PersonAvatar({ person, size = 32, dotSize = 8 })` 把 `dotSize` 轉傳給 `StatusDot`，與頭像本體 `size`（決定頭像直徑）互相獨立 — 各呼叫點可分別控制頭像大小與狀態燈大小。

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
│       ├── 我的: bg #EBEEFF、時間在上、status icon (16×16) 在泡泡外；泡泡四角圓角 rounded-xl (12px)
│       │      邊距(MessageArea layout): bubble 左緣撐滿時距 region 左緣 96px(paddingLeft)；status icon 距 region 右緣 20px(paddingRight)；bubble↔icon 4px gap；無 icon 仍保留 16px 寬
│       ├── 對方: 頭像 + 名稱 + 時間 (sm/400 12px/130% neutral-7)；名稱與時間間距 8px；名稱+時間列與泡泡間距 4px；bubble 右緣撐滿跨行時距 region 右緣 96px(paddingRight)，短訊息自然內縮
│       ├── 泡泡 padding p-3 (12px)；reactions emoji 按鈕一律 h-6(24px)/px-2(8px)/py-1(4px)/border neutral-5/按鈕間 gap-1(4px)；emoji 16px、count `12px/400/130%/neutral-8`；Add reaction 按鈕同尺寸/padding，icon `SmilePlus 16px` color neutral-7（2026-06-18 confirmed）
│       ├── inline image: width 200px(max-w 100%) / aspect 3:2 / rounded-lg
│       ├── table(`Message.table?: string[][]`): cell font 12px/400/130%(首列 600) + padding 4px 8px；白底(td + wrapper backgroundColor white)；多欄每欄 max-w 120 / min-w 24；單欄 max-w 隨 bubble 自適應 / min-w 24；列 min-h 24 自動長高；max-h 320px；wrapper `width:fit-content; max-width:100%` → 少欄位自然 hug 內容(不被長文字撐開的 bubble 拉寬)，多欄寬表 cap 在 bubble 寬度上限內並水平捲動；超出寬/高出現 hover-only scrollbar(`.scroll-hover`，globals.css)
│       │      泡泡寬度: bubble 用 `max-w-full min-w-0`(非 w-fit — fit-content 會抓 table max-content 而溢出畫面)；hug 由 column 的 items-start(對方)/items-end(我的) shrink-to-fit 提供
│       │      MessageArea 用普通 scroll div(`overflow-y-auto overflow-x-hidden` + `.scroll-hover`)取代 DS ScrollArea：Radix Viewport 內包 `display:table; min-width:100%` 會被寬 table max-content 撐大、bubble 的 % cap 失效；普通 div 寬度確定(= flex parent)，min-w-0 flex chain 才能 cap bubble + 讓 table 在泡泡內水平捲動
│       ├── ReactionBar (z-[8]；hover 顯示；hideReplyInThread 時不顯示 Reply in thread 按鈕)
│       ├── ReactionMoreMenu  (mine vs other 不同選單；`side="bottom" sideOffset={8}`，保留 Radix 碰撞避讓)
│       └── Thread replies link: shrink-0 L-connector 24×12（border-l/b 1px neutral-4 + rounded-bl-[8px] 圓角，橫線落在 24×24 視覺垂直中點 y=12）+ MessagesSquare 16 + "N replies" sm/500 + 最新回覆時間 sm/400 neutral-7；icon 與 "N replies" 文字顏色皆為 `var(--color-primary)`（= primary-6，2026-06-18 confirmed）；最新回覆時間維持 neutral-7
├── InputBox                  (接受 `fullWidth` + `onSend` prop。左右外側距欄位邊緣 56px；OFF=max 880px 置中，視窗窄於 880px 時仍保持 56px。單行：textarea + buttons 同排；多行：textarea 全寬在上，buttons 獨立在下。外框 padding top/bottom 6px / left 12px / right 8px；整個輸入方塊 max-height 280px（textarea clamp 232）；圓角 rounded-lg(8px)；輸入後外框轉 primary-hover 藍框；按鈕一律 24×24(`!h-6 !w-6 !min-w-0 !p-0`)，按鈕間距 8px(`gap-2`，同套用於 ThreadInputBox)；Send 按鈕無值時 text variant(無底深線)、有值時 primary。外層 pt-2=8px / pb-4=16px)
└── ThreadPanel               寬 320~720，可拉寬（ResizeHandle line 1px neutral-4）
    ├── 父訊息（MessageBubble isInThread，下方無 "N replies" 分隔線）+ 回覆訊息（MessageBubble isInThread，ReactionBar 無 Reply in thread）
    ├── `Message.threadMessages?: Message[]` 存實際回覆內容；replies count/latestReplyTime 由此衍生
    └── ThreadInputBox        含 "Also send to chatroom" checkbox；圓角 rounded-lg(8px)；Send 按鈕 24×24 + 無值 text / 有值 primary（與主 InputBox 同規則）（ThreadPanel 容器無 `border-l`，視覺分隔線由 ResizeHandle 1px line 提供）；**可發送**（Enter 或 Send 鈕，`onSend(text, alsoSend)` 上拋至 App `handleThreadSend`）
```

> **未讀標記 + Last read / 日期分隔線（2026-06-25 confirmed）**：
> - **點擊未讀 RoomRow 轉已讀**：`App.handleSelectRoom` 點擊非當前 room 時，若該 room `unread===true`，在 `setRooms` 標記 `unread:false` 之前，先把它最後一則訊息的 id 存進 `lastReadDivider = { roomId, messageId }`；點擊已讀 room 則清空 `lastReadDivider`。換 room 即清掉上個 room 的標記，所以**離開後再回來不會再看到這條線**（state 只認「這次切換」，不持久化）。
> - **Last read divider**：`MessageArea` 收 `lastReadMessageId` prop（= `lastReadDivider` 命中當前 room 時的 messageId），渲染時若該訊息 id 命中就在泡泡上方插入 `LastReadDivider`（純色線 `var(--color-primary)` + 置中文字 "Last read" 12px/500 同色）。
> - **日期分隔線**：`Message.date?: string`（ISO `YYYY-MM-DD`，省略 = 預設今天，因多數 demo 訊息只有 `time: 'HH:MM'`）。`MessageArea` 逐則算 `getMsgDate(m, now).toDateString()`，與前一則不同就插入 `DateDivider`（neutral-4 線 + 置中文字 neutral-7 12px/400）。文字格式 `formatDateDivider`：今天 `Today, W{週標籤}`；昨天 `Yesterday, W{週標籤}`；本週其他天 `{星期英文}, W{週標籤}`；今年本週以前 `M/D, W{週標籤}`；非今年 `M/D, YYYY, W{週標籤}`。
> - **週標籤格式（2026-06-25 訂正）**：`weekLabel(date)` = `W` + 年份尾數(1 位) + ISO 週數(補零 2 位)，例如 2026 年第 26 週 → `W626`（非單純 `W26`）。週數用標準 ISO-8601 算法（`getISOWeek`）。
> - **分隔線 padding（2026-06-25）**：`DateDivider`/`LastReadDivider` 根 div 加 `px-10`（40px），疊加在 `MessageArea` 既有 `px-4`（16px）外層 padding 之上 —— full-width ON 時等於離視窗真實邊緣 56px（16+40），與 InputBox 等元素對齊；full-width OFF 時則是在 `maxWidth:960` 置中欄內左右 40px，兩種模式皆滿足規格、不需另外條件判斷。
> - Demo 資料：`shinichi`（預設/未讀 room）m1 = 3 天前（本週一）、m2/m3 = 昨天、m4–m7 = 今天（省略 `date`），同時展示三種桶 + Last read 線（落在最後一則 m7 上方）。`ai`/`ran` room 的 `5/28`/`5/25` 訊息補 `date: '2026-05-28'/'2026-05-25'`（今年本週以前桶）；`engineering` room `e1` 改 `date: '2025-05-26'`（跨年桶）。Thread panel 內訊息不顯示日期分隔線（僅 main MessageArea）。

> **Universal Search modal（2026-06-25 new）**：點擊 ChatList header 的 `ListBtn icon={Search}`（非 ConversationHeader 內既有的單聊室內搜尋按鈕，那是獨立既有功能不動）開啟 `SearchModal`。
> - **視覺**：`fixed inset-0` 透明點擊捕捉層（**無 dimmed backdrop**，點擊空白處關閉）+ 浮動卡片（`rounded-2xl` 白底卡，定位於螢幕上方居中，參考 ClickUp 命令面板風格）。
> - **Search bar**：placeholder 固定為 `Search people, chatroom, or message…`；無關鍵字 = empty state（圖示 + 提示文字）；輸入後出現 People/Chatroom/Message 三個 tab（預設 People），結果列表的資訊結構參考 Microsoft Teams 搜尋結果（avatar + 主文字 + 次要文字/位置 + 右側時間）。
> - **People tab**：比對 DM room 的 `person.name`；點擊直接 `onNavigateRoom` 切換到該 DM room 並關閉 modal。
> - **Chatroom tab**：比對任一 room 的 `title`；點擊切換到該 room 並關閉 modal。
> - **Message tab**：比對所有 room 訊息的 `text`；點擊某結果**不關閉 modal**，改在 modal 右側開啟唯讀 preview pane（`MessagePreviewHeader` + 重用 `MessageArea(readOnly, scrollToMessageId, flashMessageId, flashToken)`）——header 右側 action 全部換成單一「View message」按鈕、底部無 InputBox、`MessageBubble` 在 `readOnly` 時整個跳過 `ReactionBar`（reaction / add-reaction / reply-in-thread 全部不可用）且 thread 連結 onClick 變 no-op。
> - **一次性 flash 效果**：`MessageBubble` 新增 `flashToken` prop，變動時 `useEffect` 設 1.2s 的 `flashing` state，泡泡內層 `rounded-xl` div 用 `transition-colors duration-700` + inline `backgroundColor: var(--color-indigo-6)` 一次性淡入淡出（非持續 highlight）；`MessageArea` 新增 `flashMessageId`/`flashToken`/`scrollToMessageId` 三個 prop 透傳。preview pane 點擊訊息時立即帶 `Date.now()` token 觸發；點 modal 內「View message」會呼叫 `App.handleSearchViewMessage(roomId, messageId)` —— 關閉 modal、必要時切換 room（`handleSelectRoom`）、並把同樣的 `{roomId, messageId, token: Date.now()}` 存進 `flash` state 透傳給真正的 `Conversation`，在主畫面再次觸發同一套 flash + 捲動（`MessageArea` 用兩個獨立 `useEffect`：一個只認 `flashToken` 變動捲到該訊息，另一個維持原本「訊息變多就捲到底部」邏輯，互不干擾，所以 flash 過後新訊息照常捲到底部）。

> **IME 中文輸入法 Enter 防誤送出（2026-06-24 fix）**：主 InputBox（單行/多行兩處）+ ThreadInputBox 的 Enter-to-send `onKeyDown` 一律加 `!e.nativeEvent.isComposing && e.keyCode !== 229` 防呆 — 中文/日文等輸入法用 Enter 確認候選字時不應觸發 send，只有「選字完成後再按一次 Enter」（此時非 composing）才送出。`keyCode !== 229` 額外擋 Safari 在 composing Enter 上 `isComposing` 回報不準的已知瑕疵。

> **Thread 發送 + "replied to a thread" link（2026-06-19 confirmed）**：
> - State 改造：`Conversation` 用 `threadParentId`（非 message 快照）+ `room.messages.find(id)` 即時查 live 訊息，確保送出後 thread panel 立即顯示新回覆。`onOpenThread` 一律存 `m.id`。
> - `handleThreadSend(parentId, text, alsoSend)`（App，SSOT of rooms state）：① 一定 append 一則 `threadReply` 到 `parent.threadMessages`（thread panel 內顯示，**普通 bubble、無 link**）。② 若 `alsoSend` 另 append 一則 `mainCopy` 到 `room.messages`（主區顯示），帶 `repliedToThreadParentId: parentId`。
> - `Message.repliedToThreadParentId?: string`：標記「主區的 thread 回覆副本」(`isRepliedCopy`)。`MessageBubble` 偵測到 → 渲染 **repliedLink** 並把 bubble + link 包進 `bubbleBlock`（`inline-flex flex-col`，shrink-to-content，align 依 mine）。
>   - **link 寬度卡在 bubble 寬度內、不超出 bubble 邊緣**：link 外層 `w-0 min-w-full`（對 width 貢獻 0、實際渲染成 bubble 寬度）；內含 L-connector（`border-l border-b rounded-bl-[8px]` 24×12 neutral-4，**shrink-0**，mine/other 皆顯示）+ `MessagesSquare 16`（**shrink-0**，色 `var(--color-primary)` = primary-6）+ 「replied to a thread: {母訊息}」單一 `min-w-0 truncate` span（色 neutral-7）。文字（含 prefix）一起截斷,只保證 L+icon 可見。
>   - **bubble 太短時加寬**：reply 副本的 bubble 外層加 `minWidth: REPLIED_LINK_MIN_W(120)` → bubble 至少 120px,確保 link 有空間放 L+icon+「…」;bubble 內容比 120 長時正常 hug。
>   - 點擊 `onOpenThread(parent)` 開該 thread。`bubbleBlock` 在非 reply 副本時 = `{bubble}{threadLink}`（行為不變）;reply 副本時 = bubble + repliedLink。threadLink / repliedLink 互斥。

> **ConversationHeader spec 驗證表（2026-06-09 confirmed）**：avatar 32×32(`size={32}`) · header `py-2`=上下 8px · 標題 `fontSize:16 / fontWeight:500 / lineHeight:'130%'` · icon-only 按鈕全 `size="sm"`=28×28 · 按鈕群 `gap-2`=8px · TeamsCallButton `px-1`=左右 4px + icon `size={18}` · RoomInfoButton `px-1`=4px + icon `size={18}` + badge `h-5`=20px / `pl:4 pr:4 pt:2 pb:2` / `fontSize:12 / lineHeight:'130%'` / `font-medium` · Edit 按鈕 `size="sm"`=28×28。

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
type Message = { id; author; text; time; status: MsgStatus; reactions[]; replies; threadMessages[]; images?: string[]; date?: string }
type Room    = { id; name; type; section: 'favorites' | 'chats'; unread; messages[] }
```

Inline image（`message.images`）用 `UNSPLASH(id)` helper 產生 `images.unsplash.com` 直連圖片 URL（允許 hotlink、穩定，用 `?w=480&h=300&fit=crop` 控制尺寸）。之前用 `picsum.photos` 會因 ad-blocker/firewall/403 host_not_allowed 而變破圖。

假資料常數：`PEOPLE`（柯南角色）· `ME` · `INITIAL_ROOMS`（含長訊息 + inline image 範例 + `semi-sales`「IT Sales - Table格式範例」chatroom 的 table 範例：少欄少列 forecast/utilization(hug 範例) + 30 欄 22 列 wafer starts 大表(達 max-h 320px 觸發 hover scrollbar + 水平捲動範例)）· `COMMON_EMOJI`。
App 以 `useState(INITIAL_ROOMS)` 管理 rooms，`handleSend` 在 active room 尾端 append 新訊息。

---

## 常數速查

| 常數 | 值 | 用途 |
|---|---|---|
| `CHAT_LIST_MIN` / `CHAT_LIST_MAX` | 120 / 480 | ChatList 寬度範圍 |
| `THREAD_MIN` / `THREAD_MAX` | 320 / 720 | Thread panel 寬度範圍 |
| MessageArea max-width (fullWidth=false) | 960px | 訊息區置中上限 |
| MessageArea padding | `px-4 py-4` (16px) | fullWidth ON/OFF 均同 |
| MessageBubble gap | `gap-3` (12px) | 訊息間距 |
| InputBox max-width (fullWidth=false) | 880px | InputBox 置中上限 |
| 我的泡泡背景 | `#EBEEFF` | — |
