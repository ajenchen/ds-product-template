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
// 工具列按鈕順序(2026-07-09 user 指定,對齊 Microsoft Teams format toolbar):
// Bold / Italic / Underline / Strikethrough │ Bulleted list / Numbered list │
// Text highlight color / Font color / Font size │ Insert link / More
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
  DialogFooter,
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

// ── contentEditable 輸入區 ───────────────────────────────────────────────────
export const RichTextArea = forwardRef<RichEditorHandle, {
  placeholder: string
  ariaLabel: string
  className?: string
  initialHTML?: string
  autoFocus?: boolean
  /** Enter 行為:'send' = Enter 送出(Shift+Enter 換行);'newline' = Enter 換行(Teams format 模式)。 */
  enterMode: 'send' | 'newline'
  /** enterMode='send' 的 Enter,或任一模式的 Ctrl/Cmd+Enter 觸發。 */
  onSubmit?: () => void
  onEscape?: () => void
  onHasContentChange?: (hasContent: boolean) => void
}>(function RichTextArea(
  { placeholder, ariaLabel, className, initialHTML, autoFocus, enterMode, onSubmit, onEscape, onHasContentChange },
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null)

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

  return (
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
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onEscape?.()
          return
        }
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          // Ctrl/Cmd+Enter 永遠送出(Teams format 模式送出捷徑)
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            onSubmit?.()
            return
          }
          if (enterMode === 'send' && !e.shiftKey) {
            e.preventDefault()
            onSubmit?.()
          }
          // enterMode='newline' → 交給 contentEditable 原生換行(Teams format 模式行為)
        }
      }}
    />
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

// ── Insert link dialog(Teams:Text to display + Address)────────────────────
function InsertLinkDialog({
  open,
  onOpenChange,
  initialText,
  onInsert,
  onCloseFocus,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialText: string
  onInsert: (text: string, url: string) => void
  /** Dialog 關閉時把焦點還給編輯區(取代 Radix 預設 focus 回 trigger 按鈕)。 */
  onCloseFocus?: () => void
}) {
  const [text, setText] = useState(initialText)
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (open) { setText(initialText); setUrl('') }
  }, [open, initialText])
  const canInsert = url.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* autoHeight:高度隨內容(DS Dialog 預設填滿 viewport,link dialog 要 hug content);
          onCloseAutoFocus:改為聚焦編輯區(Radix 預設 focus 回 trigger 按鈕;只 preventDefault
          會讓焦點掉到 body,insert 後的 Ctrl+Enter 送出捷徑都會失效)。 */}
      <DialogContent maxWidth={448} autoHeight onCloseAutoFocus={(e) => { e.preventDefault(); onCloseFocus?.() }}>
        <DialogHeader>
          <DialogTitle>Insert link</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <label className="flex flex-col gap-1">
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-neutral-8)' }}>Text to display</span>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Link text" aria-label="Text to display" />
          </label>
          <label className="flex flex-col gap-1">
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-neutral-8)' }}>Address</span>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              aria-label="Address"
              onKeyDown={(e) => { if (e.key === 'Enter' && canInsert) { e.preventDefault(); onInsert(text.trim() || url.trim(), url.trim()); onOpenChange(false) } }}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="text" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!canInsert}
            onClick={() => { onInsert(text.trim() || url.trim(), url.trim()); onOpenChange(false) }}
          >
            Insert
          </Button>
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
    if (sel && savedRange.current && el.contains(savedRange.current.commonAncestorContainer)) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
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
        <ToolBtn icon={List} label="Bulleted list" active={active.insertUnorderedList} onClick={() => exec('insertUnorderedList')} />
        <ToolBtn icon={ListOrdered} label="Numbered list" active={active.insertOrderedList} onClick={() => exec('insertOrderedList')} />
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
        initialText={linkInitialText}
        onCloseFocus={restoreSelection}
        onInsert={(text, url) => {
          const href = /^(https?|mailto):/i.test(url) ? url : `https://${url}`
          const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
          exec('insertHTML', `<a href="${esc(href)}" target="_blank" rel="noreferrer">${esc(text)}</a>`)
        }}
      />
    </>
  )
}
