// RichTextEditor — Microsoft Teams 風格 rich text 編輯工具列 + contentEditable 輸入區。
// 供三處輸入框共用:主輸入框(InputBox)/ Thread panel 輸入框(ThreadInputBox)/
// chat bubble 編輯狀態(EditMessageComposer)。
//
// ── 消費的 SSOT ──
// - DS components:Button / Tooltip / Separator / Popover / DropdownMenu / Dialog / Input
// - Icon 按鈕 pattern:對齊 App.tsx IconBtnSm(variant="text" size="sm" iconOnly + Tooltip)
// - Active state:!bg-neutral-selected(對齊 App.tsx NavBtn active pattern)
// - Tokens:--color-neutral-* / --color-primary
//
// 工具列按鈕順序(2026-07-09 v3 user 指定,對齊 Microsoft Teams format toolbar):
// Bold / Italic / Underline / Strikethrough │ Text highlight color / Font color /
// Font size │ Bulleted list / Numbered list │ Insert link / More
// 色盤 = Office/Teams highlight 標準 15 色 + None(Teams 繼承 Office palette);
// Font size = Teams 新版 client 的 Small / Medium / Large 三檔。
// 編輯引擎 = document.execCommand(prototype 級,Teams 同為 contentEditable 架構)。

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import './rich-text.css'
import {
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Separator,
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Field,
  FieldLabel,
  FieldError,
  Input,
} from '@qijenchen/design-system'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Highlighter,
  Baseline,
  ALargeSmall,
  Link as LinkIcon,
  MoreHorizontal,
  TextQuote,
  Code,
  Minus,
  RemoveFormatting,
  Check,
  Ban,
  Pencil,
  Unlink,
} from 'lucide-react'

// ── Imperative handle(parent 取值 / 清空 / 聚焦)────────────────────────────
export type RichEditorHandle = {
  getHTML: () => string
  getText: () => string
  isEmpty: () => boolean
  clear: () => void
  focus: () => void
  setHTML: (html: string) => void
  getElement: () => HTMLDivElement | null
}

// 純文字 → 安全 HTML(rich 模式 prefill 用;newline → <br>)
export function textToHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(/\n/g, '<br>')
}

// 內容是否含格式標記(粗斜體 / 清單 / 連結 / 顏色 span 等)。純文字(含 <div>/<br>
// 換行)不算 — 送出時 hasRichMarkup=false 就只存純文字,bubble 走原本 text 渲染路徑
// (2026-07-09 v4:編輯引擎常駐 rich 後,避免每則訊息都變成 html 訊息)。
export function hasRichMarkup(html: string): boolean {
  return /<(b|strong|i|em|u|s|strike|ul|ol|a|font|blockquote|pre|hr|img|span)\b/i.test(html)
}

// URL 無 protocol 時補 https://(insert / edit link 共用)
function ensureProtocol(url: string): string {
  return /^(https?|mailto):/i.test(url) ? url : `https://${url}`
}
// URL 格式驗證(2026-07-09 user 指定:非 link 格式 → error「Please input valid URL」)
// 接受 http(s)://host.tld… / host.tld…(自動補 https)/ localhost / mailto:a@b.c
function isValidUrl(raw: string): boolean {
  const v = raw.trim()
  if (!v || /\s/.test(v)) return false
  if (/^mailto:/i.test(v)) return /^mailto:[^@\s]+@[^@\s.]+\.[^@\s]+$/i.test(v)
  try {
    const u = new URL(ensureProtocol(v))
    return u.hostname === 'localhost' || u.hostname.includes('.')
  } catch {
    return false
  }
}

// ── contentEditable 輸入區 ───────────────────────────────────────────────────
// Enter 規則(2026-07-09 user 指定,三處輸入框一致):
// - Enter = 直接送出/儲存(非 bulleted/numbered list 情境)
// - 在 list item 內 Enter = 原生換 item(空 item 再 Enter = 跳出 list,瀏覽器原生)
// - Shift+Enter = 輸入框內換行;Ctrl/Cmd+Enter = 永遠送出
// 鍵盤清單捷徑(2026-07-09 user 指定):行首「-」或「*」+ 空白 → bulleted list;
// 「1.」+ 空白 → numbered list(對齊 Teams / Word markdown 自動格式)。
export const RichTextArea = forwardRef<RichEditorHandle, {
  placeholder: string
  ariaLabel: string
  className?: string
  initialHTML?: string
  autoFocus?: boolean
  /** Enter(非 list 內)或 Ctrl/Cmd+Enter 觸發送出/儲存。 */
  onSubmit?: () => void
  onEscape?: () => void
  onHasContentChange?: (hasContent: boolean) => void
}>(function RichTextArea(
  { placeholder, ariaLabel, className, initialHTML, autoFocus, onSubmit, onEscape, onHasContentChange },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)
  // Link 右鍵選單(Edit link / Remove link)+ Edit link dialog
  const [linkMenu, setLinkMenu] = useState<{ x: number; y: number } | null>(null)
  const [editLinkOpen, setEditLinkOpen] = useState(false)
  const targetAnchor = useRef<HTMLAnchorElement | null>(null)

  const isEmpty = useCallback(() => {
    const el = elRef.current
    if (!el) return true
    return (el.textContent ?? '').trim() === '' && !el.querySelector('img,hr,li')
  }, [])

  const syncEmpty = useCallback(() => {
    const el = elRef.current
    if (!el) return
    el.setAttribute('data-empty', isEmpty() ? 'true' : 'false')
    onHasContentChange?.(!isEmpty())
  }, [isEmpty, onHasContentChange])

  useImperativeHandle(ref, () => ({
    getHTML: () => elRef.current?.innerHTML ?? '',
    getText: () => elRef.current?.innerText ?? '',
    isEmpty,
    clear: () => {
      if (elRef.current) elRef.current.innerHTML = ''
      syncEmpty()
    },
    focus: () => elRef.current?.focus(),
    setHTML: (html: string) => {
      if (elRef.current) elRef.current.innerHTML = html
      syncEmpty()
    },
    getElement: () => elRef.current,
  }), [isEmpty, syncEmpty])

  useEffect(() => {
    if (initialHTML && elRef.current) elRef.current.innerHTML = initialHTML
    syncEmpty()
    if (autoFocus && elRef.current) {
      elRef.current.focus()
      // caret 移到內容最尾(編輯既有訊息時游標接在原文後)
      const sel = window.getSelection()
      if (sel && elRef.current.childNodes.length > 0) {
        const range = document.createRange()
        range.selectNodeContents(elRef.current)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // caret 是否位於 list item 內(Enter 換 item 而非送出)
  const caretInListItem = useCallback(() => {
    const el = elRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return false
    let node: Node | null = sel.getRangeAt(0).startContainer
    while (node && node !== el) {
      if (node.nodeType === 1 && (node as Element).tagName === 'LI') return true
      node = node.parentNode
    }
    return false
  }, [])

  // 行首 markdown 清單捷徑:空白鍵時檢查 caret 前的行內文字是「-」「*」「1.」
  // → 吃掉 marker、轉成對應 list(僅在非 list / 非 code block 情境)。
  const tryAutoList = useCallback((e: React.KeyboardEvent) => {
    const el = elRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0 || !sel.isCollapsed) return false
    const range = sel.getRangeAt(0)
    if (!el.contains(range.startContainer)) return false
    // 已在 list / pre 內不觸發
    let node: Node | null = range.startContainer
    while (node && node !== el) {
      if (node.nodeType === 1 && ['LI', 'PRE'].includes((node as Element).tagName)) return false
      node = node.parentNode
    }
    // 找到 caret 所在的頂層「行」container(el 的直接 child)
    let line: Node = range.startContainer
    while (line.parentNode && line.parentNode !== el) line = line.parentNode
    if (line === el) return false
    const pre = document.createRange()
    pre.setStart(line, 0)
    pre.setEnd(range.startContainer, range.startOffset)
    const textBefore = pre.toString()
    const isBullet = textBefore === '-' || textBefore === '*'
    const isNumbered = textBefore === '1.'
    if (!isBullet && !isNumbered) return false
    e.preventDefault()
    // 選取 marker 文字刪除,再轉 list
    sel.removeAllRanges()
    sel.addRange(pre)
    document.execCommand('delete')
    document.execCommand(isBullet ? 'insertUnorderedList' : 'insertOrderedList')
    return true
  }, [])

  // Remove link:anchor 解開成純文字(2026-07-09 user 指定)
  const removeLink = useCallback(() => {
    const a = targetAnchor.current
    if (a && a.parentNode) {
      a.parentNode.replaceChild(document.createTextNode(a.textContent ?? ''), a)
    }
    targetAnchor.current = null
    setLinkMenu(null)
    syncEmpty()
  }, [syncEmpty])

  return (
    <>
      <div
        ref={elRef}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        data-empty="true"
        className={`rich-input rich-text w-full outline-none text-body ${className ?? ''}`}
        onInput={syncEmpty}
        onContextMenu={(e) => {
          const a = (e.target as HTMLElement).closest?.('a')
          if (a && elRef.current?.contains(a)) {
            e.preventDefault()
            targetAnchor.current = a as HTMLAnchorElement
            setLinkMenu({ x: e.clientX, y: e.clientY })
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onEscape?.()
            return
          }
          if (e.key === 'Backspace' || e.key === 'Delete') {
            // 全選刪除後 Chrome 會留下空的 <ol>/<ul>/<li> 或 <div><br>> 殘骸 —
            // 看起來是空的但 DOM 不是,下一次輸入會意外接在清單裡、isEmpty 也誤判。
            // 刪除鍵處理完後若無實際內容 → 徹底清空(markdown 捷徑產生的空 li 走
            // Space 鍵,不受影響)。
            requestAnimationFrame(() => {
              const el = elRef.current
              if (el && (el.textContent ?? '').trim() === '' && !el.querySelector('img,hr') && el.innerHTML !== '') {
                el.innerHTML = ''
                syncEmpty()
              }
            })
            return
          }
          if (e.key === ' ' && !e.nativeEvent.isComposing) {
            tryAutoList(e)
            return
          }
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            // Ctrl/Cmd+Enter 永遠送出
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              onSubmit?.()
              return
            }
            // Shift+Enter = 換行(交給 contentEditable 原生)
            if (e.shiftKey) return
            // list item 內 Enter = 原生換 item / 跳出 list;其餘 Enter 直接送出
            if (caretInListItem()) return
            e.preventDefault()
            onSubmit?.()
          }
        }}
      />

      {/* Link 右鍵選單 — 0-size fixed trigger 錨定在滑鼠座標(context menu pattern) */}
      {linkMenu && (
        <DropdownMenu open onOpenChange={(o) => { if (!o) setLinkMenu(null) }}>
          <DropdownMenuTrigger asChild>
            <span aria-hidden style={{ position: 'fixed', left: linkMenu.x, top: linkMenu.y, width: 0, height: 0 }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={2}>
            <DropdownMenuItem startIcon={Pencil} onSelect={() => { setLinkMenu(null); setEditLinkOpen(true) }}>
              Edit link
            </DropdownMenuItem>
            <DropdownMenuItem startIcon={Unlink} onSelect={removeLink}>Remove link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Edit link — 同一個 dialog,prefill 現有 text + href,confirm 後原地改寫 anchor */}
      <InsertLinkDialog
        open={editLinkOpen}
        onOpenChange={setEditLinkOpen}
        title="Edit link"
        initialText={targetAnchor.current?.textContent ?? ''}
        initialUrl={targetAnchor.current?.getAttribute('href') ?? ''}
        onConfirm={(text, url) => {
          const a = targetAnchor.current
          if (a) {
            a.textContent = text
            a.setAttribute('href', ensureProtocol(url))
          }
          syncEmpty()
        }}
        onCloseFocus={() => elRef.current?.focus()}
      />
    </>
  )
})

// ── 工具列小按鈕(對齊 App.tsx IconBtnSm anatomy;onMouseDown preventDefault 保住編輯區 selection)─
function ToolBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentProps<typeof Button>['startIcon']
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="text"
          size="sm"
          iconOnly
          startIcon={icon}
          aria-label={label}
          aria-pressed={active}
          title=""
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={`!h-7 !w-7 !min-w-0 !p-0 ${active ? '!bg-neutral-selected' : ''}`}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// ── 色盤(Office/Teams 標準 highlight 15 色;Teams 繼承 Office palette)──────
const HIGHLIGHT_COLORS = [
  '#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#0000FF',
  '#FF0000', '#000080', '#008080', '#008000', '#800080',
  '#800000', '#808000', '#808080', '#C0C0C0', '#000000',
]
const FONT_COLORS = [
  '#000000', '#424242', '#757575', '#FFFFFF', '#C4314B',
  '#CC4A31', '#F8D22A', '#237B4B', '#2F6349', '#0078D4',
  '#4F52B2', '#943670', '#8E562E', '#498205', '#69797E',
]

function ColorSwatchPopover({
  icon,
  label,
  colors,
  allowNone,
  onPick,
}: {
  icon: React.ComponentProps<typeof Button>['startIcon']
  label: string
  colors: string[]
  /** highlight 色盤的「None」(清除底色)格。 */
  allowNone?: boolean
  onPick: (color: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="text"
              size="sm"
              iconOnly
              startIcon={icon}
              aria-label={label}
              title=""
              className={`!h-7 !w-7 !min-w-0 !p-0 ${open ? '!bg-neutral-selected' : ''}`}
            />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" sideOffset={6} className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1">
          {allowNone && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="No color"
                  className="flex h-5 w-5 items-center justify-center rounded border hover:ring-2 hover:ring-[var(--color-primary)]"
                  style={{ borderColor: 'var(--color-neutral-5)', backgroundColor: 'white' }}
                  onClick={() => { onPick(null); setOpen(false) }}
                >
                  <Ban size={12} style={{ color: 'var(--color-neutral-7)' }} />
                </button>
              </TooltipTrigger>
              <TooltipContent>No color</TooltipContent>
            </Tooltip>
          )}
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              className="h-5 w-5 rounded border hover:ring-2 hover:ring-[var(--color-primary)]"
              style={{ backgroundColor: c, borderColor: c === '#FFFFFF' ? 'var(--color-neutral-5)' : 'transparent' }}
              onClick={() => { onPick(c); setOpen(false) }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Font size(Teams 新版 client:Small / Medium / Large)─────────────────────
type FontSizeKey = 'small' | 'medium' | 'large'
const FONT_SIZES: { key: FontSizeKey; label: string; execValue: string; px: number }[] = [
  { key: 'small', label: 'Small', execValue: '2', px: 12 },
  { key: 'medium', label: 'Medium', execValue: '3', px: 14 },
  { key: 'large', label: 'Large', execValue: '5', px: 18 },
]

// ── Insert / Edit link dialog(Teams:Text to display + URL)─────────────────
// DS 規範消費(2026-07-09):DialogHeader / DialogBody / DialogFooter(水平 padding
// 由 DS Dialog surface 提供,不手刻)+ Field / FieldLabel(required 前綴 *)/ FieldError。
// 兩欄皆必填;URL 非 link 格式 → FieldError「Please input valid URL」(confirm 時驗證,
// 修改內容即清除)。
function InsertLinkDialog({
  open,
  onOpenChange,
  title,
  initialText,
  initialUrl = '',
  onConfirm,
  onCloseFocus,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** 'Insert link'(toolbar 插入)/ 'Edit link'(右鍵選單編輯)。 */
  title: string
  initialText: string
  initialUrl?: string
  onConfirm: (text: string, url: string) => void
  /** Dialog 關閉時把焦點還給編輯區(取代 Radix 預設 focus 回 trigger 按鈕)。 */
  onCloseFocus?: () => void
}) {
  const [text, setText] = useState(initialText)
  const [url, setUrl] = useState(initialUrl)
  const [urlError, setUrlError] = useState(false)
  useEffect(() => {
    if (open) { setText(initialText); setUrl(initialUrl); setUrlError(false) }
  }, [open, initialText, initialUrl])
  // 兩欄必填 → 有值才可 Confirm;格式錯誤在 confirm 時報 FieldError
  const canConfirm = text.trim().length > 0 && url.trim().length > 0

  function confirm() {
    if (!canConfirm) return
    if (!isValidUrl(url)) {
      setUrlError(true)
      return
    }
    onConfirm(text.trim(), url.trim())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* autoHeight:高度隨內容(DS Dialog 預設填滿 viewport,link dialog 要 hug content);
          onCloseAutoFocus:改為聚焦編輯區(Radix 預設 focus 回 trigger 按鈕;只 preventDefault
          會讓焦點掉到 body,insert 後的 Enter 送出捷徑會失效)。 */}
      <DialogContent maxWidth={448} autoHeight onCloseAutoFocus={(e) => { e.preventDefault(); onCloseFocus?.() }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <Field required>
              <FieldLabel>Text to display</FieldLabel>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Link text" aria-label="Text to display" />
            </Field>
            <Field required invalid={urlError}>
              <FieldLabel>URL</FieldLabel>
              <Input
                value={url}
                onChange={(e) => { setUrl(e.target.value); setUrlError(false) }}
                placeholder="https://"
                aria-label="URL"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirm() } }}
              />
              {urlError && <FieldError>Please input valid URL</FieldError>}
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="text" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!canConfirm} onClick={confirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Format toolbar(Teams format toolbar 按鈕列)──────────────────────────────
// 透過 editorRef 對 contentEditable 執行 document.execCommand;selection 由
// selectionchange listener 存進 savedRange(popover / dialog 開啟導致失焦時可還原)。
export function FormatToolbar({ editorRef }: { editorRef: React.RefObject<RichEditorHandle | null> }) {
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [fontSize, setFontSize] = useState<FontSizeKey>('medium')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkInitialText, setLinkInitialText] = useState('')
  const savedRange = useRef<Range | null>(null)

  const refreshActive = useCallback(() => {
    const states: Record<string, boolean> = {}
    for (const cmd of ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList']) {
      try { states[cmd] = document.queryCommandState(cmd) } catch { states[cmd] = false }
    }
    setActive(states)
  }, [])

  // selection 在編輯區內 → 存 range + 刷新 active states
  useEffect(() => {
    function onSelectionChange() {
      const el = editorRef.current?.getElement()
      const sel = window.getSelection()
      if (!el || !sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      if (el.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange()
        refreshActive()
      }
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [editorRef, refreshActive])

  // 失焦(popover / dialog)後還原 selection 再執行命令
  const restoreSelection = useCallback(() => {
    const el = editorRef.current?.getElement()
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel) return
    if (savedRange.current && el.contains(savedRange.current.commonAncestorContainer)) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    } else {
      // savedRange 從未建立或已失效(送出後 clear() 清空 innerHTML,range 指向
      // detached node)→ 重建 caret 到內容最尾。沒有這個 fallback,程式化 focus()
      // 不保證產生 selection,execCommand('insertHTML') 會靜默失敗
      // (2026-07-09 user 回報「insert link 之後沒有出現 link」的 root cause)。
      savedRange.current = null
      const r = document.createRange()
      r.selectNodeContents(el)
      r.collapse(false)
      sel.removeAllRanges()
      sel.addRange(r)
    }
  }, [editorRef])

  const exec = useCallback((cmd: string, value?: string) => {
    restoreSelection()
    if (cmd === 'hiliteColor' || cmd === 'foreColor') {
      document.execCommand('styleWithCSS', false, 'true')
    }
    document.execCommand(cmd, false, value)
    refreshActive()
  }, [restoreSelection, refreshActive])

  return (
    <>
      {/* @layout-space-magic-ok: gap-0.5=2px 工具列 icon 按鈕微間距(toolbar 元件內部),非 layout-space 巨觀 gap */}
      <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatting">
        <ToolBtn icon={Bold} label="Bold" active={active.bold} onClick={() => exec('bold')} />
        <ToolBtn icon={Italic} label="Italic" active={active.italic} onClick={() => exec('italic')} />
        <ToolBtn icon={Underline} label="Underline" active={active.underline} onClick={() => exec('underline')} />
        <ToolBtn icon={Strikethrough} label="Strikethrough" active={active.strikeThrough} onClick={() => exec('strikeThrough')} />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ColorSwatchPopover
          icon={Highlighter}
          label="Text highlight color"
          colors={HIGHLIGHT_COLORS}
          allowNone
          onPick={(c) => exec('hiliteColor', c ?? 'transparent')}
        />
        <ColorSwatchPopover
          icon={Baseline}
          label="Font color"
          colors={FONT_COLORS}
          onPick={(c) => { if (c) exec('foreColor', c) }}
        />
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="text" size="sm" iconOnly startIcon={ALargeSmall} aria-label="Font size" title="" className="!h-7 !w-7 !min-w-0 !p-0" />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Font size</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" sideOffset={6}>
            {FONT_SIZES.map((s) => (
              <DropdownMenuItem
                key={s.key}
                startIcon={s.key === fontSize ? Check : undefined}
                onSelect={() => { setFontSize(s.key); exec('fontSize', s.execValue) }}
              >
                <span style={{ fontSize: s.px, paddingLeft: s.key === fontSize ? 0 : 24 }}>{s.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolBtn icon={List} label="Bulleted list" active={active.insertUnorderedList} onClick={() => exec('insertUnorderedList')} />
        <ToolBtn icon={ListOrdered} label="Numbered list" active={active.insertOrderedList} onClick={() => exec('insertOrderedList')} />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolBtn
          icon={LinkIcon}
          label="Insert link"
          onClick={() => {
            setLinkInitialText(window.getSelection()?.toString() ?? '')
            setLinkOpen(true)
          }}
        />
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="text" size="sm" iconOnly startIcon={MoreHorizontal} aria-label="More formatting options" title="" className="!h-7 !w-7 !min-w-0 !p-0" />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More options</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" sideOffset={6}>
            <DropdownMenuItem startIcon={TextQuote} onSelect={() => exec('formatBlock', 'blockquote')}>Quote</DropdownMenuItem>
            <DropdownMenuItem startIcon={Code} onSelect={() => exec('formatBlock', 'pre')}>Code snippet</DropdownMenuItem>
            <DropdownMenuItem startIcon={Minus} onSelect={() => exec('insertHorizontalRule')}>Insert horizontal rule</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem startIcon={RemoveFormatting} onSelect={() => { exec('removeFormat'); exec('formatBlock', 'div') }}>
              Clear all formatting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <InsertLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Insert link"
        initialText={linkInitialText}
        onCloseFocus={restoreSelection}
        onConfirm={(text, url) => {
          const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
          const html = `<a href="${esc(ensureProtocol(url))}" target="_blank" rel="noreferrer">${esc(text)}</a>`
          // 延後到 dialog 關閉、onCloseAutoFocus 把焦點還給編輯區之後才插入 —
          // dialog 還開著時 Radix focus trap 會跟編輯區搶焦點,insertHTML 可能落空
          setTimeout(() => exec('insertHTML', html), 0)
        }}
      />
    </>
  )
}
