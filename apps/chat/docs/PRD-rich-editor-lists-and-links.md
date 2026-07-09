# PRD — Rich Editor:項目符號清單、編號清單、插入連結

| 欄位 | 內容 |
|---|---|
| 文件版本 | v1.0（2026-07-09） |
| 產品 | TeaChat（Storybook prototype:`Apps/chat/TeaChat Desktop version`） |
| 功能範圍 | Rich editor 之 **Bulleted list(項目符號清單)/ Numbered list(編號清單)/ Insert link(插入連結)** |
| 參考實作 | `apps/chat/src/RichTextEditor.tsx` + `apps/chat/src/rich-text.css`(prototype = 行為 SSOT) |
| 對標產品 | Microsoft Teams(new client)compose box;色盤對標 Office highlight palette |
| 相關文件 | `apps/chat/STRUCTURE.md`「Rich editor」callout(工程結構) |

---

## 1. 背景與目標

TeaChat 的訊息輸入框需提供與 Microsoft Teams 對等的 rich text 編寫能力。本 PRD 涵蓋其中三個結構型功能:兩種清單與超連結——這三者與純字元樣式(粗斜體等)不同,牽涉**區塊結構、鍵盤捷徑、跳窗表單與右鍵選單**,故獨立成篇供開發依循。

**目標:**
1. 使用者能以工具列按鈕**或純鍵盤**建立/退出清單,心智模型與 Teams、Word 一致。
2. 使用者能插入帶顯示文字的超連結,並能事後**編輯或移除**連結。
3. 三個功能在**所有輸入介面行為一致**,且不依賴工具列是否展開。

## 2. 適用範圍(三處輸入框)

| # | 輸入框 | 進入方式 |
|---|---|---|
| 1 | **主輸入框** | 聊天室底部 compose box |
| 2 | **Thread panel 輸入框** | 訊息「Reply in thread」開啟的右側面板底部 |
| 3 | **Chat bubble 編輯輸入框** | 自己的訊息 hover → More(⋯)→ Edit,bubble 原地變編輯框 |

**通用前提(P0,架構層)**:三處輸入框的編輯引擎**常駐為 rich editor(contentEditable)**。工具列的「Rich editor」toggle(Type icon)只控制 **format toolbar 的顯示/隱藏**,不切換編輯引擎。因此本 PRD 所有行為(清單捷徑、清單內 Enter、連結右鍵選單)**不論工具列有沒有展開都必須可用**。

## 3. 名詞

| 名詞 | 定義 |
|---|---|
| 工具列(toolbar) | Rich editor toggle 展開後,輸入框頂部的一排格式按鈕 |
| 清單項(list item) | `<li>`;bulleted list 渲染 disc 圓點,numbered list 渲染十進位編號 |
| 行首 | 游標所在「行」(top-level 區塊)從開頭到游標之間沒有其他字元 |
| 連結(link) | `<a href target="_blank" rel="noreferrer">` 包裹的顯示文字 |

---

## 4. 功能一:Bulleted list(項目符號清單)

### 4.1 進入點

| 進入點 | 行為 |
|---|---|
| 工具列「Bulleted list」按鈕(List icon,tooltip = `Bulleted list`) | 將目前行(或選取的多行)轉為 bulleted list;游標已在 bulleted list 內時再按 = 轉回一般段落(toggle)。按鈕在游標位於 bulleted list 內時顯示 active 樣式(`aria-pressed=true` + selected 底色) |
| **鍵盤捷徑** | 行首輸入 `-` 或 `*` 後按**空白鍵** → 該行立即轉為 bulleted list 的第一個清單項,`-`/`*` 與空白**不得殘留**於內容 |

### 4.2 鍵盤捷徑細則(P0)

1. 觸發條件:游標前的**同一行文字恰好是** `-` 或 `*`(其後緊接空白鍵)。行首之外(例:`abc -` + 空白)**不觸發**,空白正常輸入。
2. 已在清單項內、或在 code block(`<pre>`)內 → **不觸發**。
3. 觸發時序:空白鍵 keydown 即攔截(preventDefault)→ 刪除 marker 字元 → 執行清單轉換 → 游標停在空清單項內,繼續輸入即為第一項內容。
4. IME 組字中(composition)不觸發。
5. 工具列展開與否**不影響**本捷徑。

### 4.3 清單內編輯行為

| 操作 | 行為 |
|---|---|
| Enter(游標在清單項內) | 產生**下一個清單項**(不送出訊息) |
| Enter(游標在**空**清單項) | 跳出清單,回到一般段落(瀏覽器原生行為) |
| Shift+Enter | 清單項內換行(同項第二行) |
| Backspace 至清單清空 | 清單結構解除;**全選刪除後不得留下看不見的空清單殘骸**(下一次輸入不得意外接在清單裡) |
| 送出(Enter 於清單外 / Send 鈕 / Ctrl(Cmd)+Enter) | 訊息以 rich 內容送出,bubble 內以 disc 圓點渲染 |

### 4.4 視覺規格

- `ul`:`list-style: disc`、`padding-left: 24px`、上下 margin 2px(見 `rich-text.css` `.rich-text ul`)。
- 編輯區與已送出的 bubble 用**同一份樣式**(同一 class),所見即所得。

---

## 5. 功能二:Numbered list(編號清單)

### 5.1 進入點

| 進入點 | 行為 |
|---|---|
| 工具列「Numbered list」按鈕(ListOrdered icon,tooltip = `Numbered list`) | 同 4.1,目標為編號清單;active 樣式同規則 |
| **鍵盤捷徑** | 行首輸入 `1.` 後按**空白鍵** → 該行轉為編號清單第一項(自 1 起算),`1.` 與空白不殘留 |

### 5.2 鍵盤捷徑細則(P0)

1. 觸發字串**限定 `1.`**(不接受 `2.`、`10.` 等 — 避免使用者輸入日期/版本號誤觸發;與起始編號語意衝突)。
2. 其餘條件(行首限定、清單/code block 內不觸發、IME、工具列無關)同 4.2。

### 5.3 清單內編輯行為與視覺

- 編輯行為同 4.3(Enter 下一項自動遞增編號、空項 Enter 跳出、全選刪除不留殘骸)。
- `ol`:`list-style: decimal`、`padding-left: 24px`、上下 margin 2px。
- Bulleted 與 numbered 互斥:游標在 bulleted list 內按「Numbered list」→ 轉為編號清單(反之亦然)。

---

## 6. 功能三:Insert link(插入連結)

### 6.1 進入點

工具列「Insert link」按鈕(Link icon,tooltip = `Insert link`)→ 開啟 **Insert link dialog**。若開啟前編輯區有選取文字,選取文字自動帶入「Text to display」欄位。

### 6.2 Insert link dialog 規格(P0)

遵照 design system 表單規範(Dialog + DialogBody + Field / FieldLabel / FieldError):

| 項目 | 規格 |
|---|---|
| 標題 | `Insert link`(編輯模式時 `Edit link`) |
| 尺寸 | maxWidth 448px,高度隨內容(autoHeight);水平 padding 由 DS Dialog surface 提供,**不得自行手刻 padding** |
| 欄位 1 | `Text to display` — **必填**,label 前綴 `*`(DS Field `required` 機制);純文字輸入 |
| 欄位 2 | `URL` — **必填**,label 前綴 `*`;placeholder `https://` |
| 按鈕 | `Cancel`(text variant)/ `Confirm`(primary)— **兩欄皆有值才 enable** |
| URL 欄按 Enter | 等同點 Confirm |

### 6.3 URL 驗證(P0)

- 驗證時機:點 Confirm(或 URL 欄 Enter)時。
- 合法:`http(s)://` 開頭之合法 URL;無 protocol 者自動補 `https://` 後驗證(hostname 需含 `.` 或為 `localhost`);`mailto:local@domain.tld`。
- 不合法(例:`not a url`、含空白、`abc`)→ URL 欄位轉 error 狀態(紅框)+ 欄位下方 FieldError 顯示 **`Please input valid URL`**;dialog 不關閉。
- 使用者修改 URL 內容 → error 即時清除。

### 6.4 插入行為(P0)

1. Confirm 後 dialog 關閉,**焦點回到編輯區**(不得落回工具列按鈕或 body)。
2. 連結插入於**開啟 dialog 當下的游標/選取位置**;游標位置已失效(如剛送出訊息、編輯區被清空)→ 插入於內容最尾端。**任何情況下插入不得靜默失敗**。
3. 產出 `<a href="<正規化後 URL>" target="_blank" rel="noreferrer">顯示文字</a>`;顯示文字與 URL 需做 HTML escape。
4. 編輯區與 bubble 中連結渲染:primary 色 + underline(`.rich-text a`)。

### 6.5 連結右鍵選單(P0)

- 在**編輯區內**右鍵點擊連結 → 於滑鼠座標開啟 context menu(取代瀏覽器原生選單),兩個選項**皆含 icon**:
  - **Edit link**(Pencil icon):重開同一 dialog(標題 `Edit link`),「Text to display」「URL」帶入現值;Confirm 後**原地改寫**該連結的顯示文字與 href(驗證規則同 6.3)。
  - **Remove link**(Unlink icon):連結解除,顯示文字轉為**純文字**(內容保留、樣式移除)。
- 範圍界定:右鍵選單只作用於**輸入框內**的連結(含 bubble 編輯狀態的輸入框);已送出 bubble 內的連結不掛此選單(修改需走該訊息的 Edit 流程)。

---

## 7. 跨功能通用規則

### 7.1 Enter 規則(三處輸入框一致)

| 按鍵 | 游標位置 | 行為 |
|---|---|---|
| Enter | 清單項外 | **直接送出**(主/thread)/ **儲存**(bubble 編輯) |
| Enter | 清單項內(有內容) | 下一個清單項 |
| Enter | 空清單項 | 跳出清單(不送出) |
| Shift+Enter | 任意 | 輸入框內換行 |
| Ctrl/Cmd+Enter | 任意 | 強制送出/儲存 |
| Escape | bubble 編輯 | 取消編輯 |
| Enter | IME 組字中 | 不送出(交給輸入法選字) |

### 7.2 送出資料格式

- 訊息一律保存**純文字**(`text`,供聊天列表 preview 與搜尋)。
- 內容含格式標記(清單、連結、粗斜體、顏色等)→ 額外保存 `html`,bubble 以 rich 樣式渲染;**純文字內容(即使多行)不保存 html**,維持原純文字渲染路徑。
- 編輯訊息時若格式全數移除 → 清除既有 `html`。

### 7.3 無障礙

- 工具列:`role="toolbar"` + `aria-label="Formatting"`;各按鈕 `aria-label` 與 tooltip 同文案;toggle 類按鈕帶 `aria-pressed`。
- 編輯區:`role="textbox"` + `aria-multiline="true"` + 對應 `aria-label`(`Type a message` / `Reply in thread` / `Edit message`)。
- Dialog 欄位 label 與 input 綁定(DS Field);必填以視覺 `*` + DS required 機制表達。

## 8. 驗收標準(節錄,Given / When / Then)

1. **Given** 任一輸入框、工具列**未展開**,**When** 行首輸入 `-` + 空白,**Then** 立即出現 disc 清單項且 `-` 不殘留。
2. **Given** 同上,**When** 行首輸入 `1.` + 空白,**Then** 立即出現編號清單第一項。
3. **Given** 游標在清單項內,**When** 按 Enter,**Then** 產生下一項且訊息**未送出**;**When** 於空項再按 Enter,**Then** 跳出清單。
4. **Given** 句中輸入 `-` + 空白(非行首),**Then** 不轉清單。
5. **Given** Insert link dialog、URL 填 `not a url`,**When** 按 Confirm,**Then** 顯示紅框 + `Please input valid URL`、dialog 不關閉。
6. **Given** URL 填 `teachat.app/docs`,**When** Confirm,**Then** 編輯區游標處出現 `https://teachat.app/docs` 連結、焦點回編輯區。
7. **Given** 剛送出一則訊息(編輯區已清空)且未點擊編輯區,**When** 直接 Insert link 並 Confirm,**Then** 連結仍成功出現(不得靜默失敗)。
8. **Given** 編輯區內連結,**When** 右鍵 → Edit link 改 URL 後 Confirm,**Then** 連結原地更新;**When** 右鍵 → Remove link,**Then** 變純文字。
9. **Given** 清單訊息送出,**Then** bubble 內圓點/編號渲染與編輯區一致。
10. **Given** 全選刪除輸入框所有內容,**Then** 下一次輸入為一般段落(不殘留清單結構)、Send 鈕回到無值狀態。

## 9. Out of scope(本期不做)

- 巢狀清單(Tab / Shift+Tab 縮排)
- 清單起始編號自訂(輸入 `3.` 從 3 起算)
- 已送出 bubble 內連結的右鍵選單、連結 hover preview 卡片
- 貼上 URL 自動轉連結(auto-link on paste)
- Markdown 其他捷徑(`#` 標題、`>` 引用等)

## 10. 開放問題

| # | 問題 | 現況假設 |
|---|---|---|
| 1 | 貼上含清單/連結的外部 HTML 是否清洗? | 現階段保留原格式(prototype);正式版需定義 sanitize 白名單 |
| 2 | 連結是否需在 chat bubble 中可點擊開新分頁? | 是(`target="_blank"` + `rel="noreferrer"` 已內建) |
