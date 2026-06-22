// ════════════════════════════════════════════════════════════════════════════
// Usability-testing 模型 A(可重用引擎,單檔):型別 + Chip + 懸浮任務面板 +
// 單版/雙版流程 + 結果頁。本套件是「測試模型 A」的本體,版本鎖定、不給消費端改 —
// 消費端只提供 UTProject(goal / instructions / tasks / variants),引擎負責其餘全部。
//
//  - 任務成功/失敗由「使用者實際操作(你的 prototype 透過 onAction 吐出的事件)」判定,
//    不是按了「完成」就算成功。
//  - 進行中提供左上角「可拖曳」小狀態列(版本 + 錄音狀態),不擋畫面。
//  - 放聲思考:用瀏覽器 Web Speech API 即時轉逐字稿(免後端);結果頁顯示逐字稿 +
//    關鍵字擷取重點,並彙整進結論與 Excel / 文字匯出。
//  - 支援 A→B 雙版本流程,最後給綜合結論。
//
// 與特定 prototype 解耦:variant.render({ onAction }) 由消費端把自己的 prototype 包進來,
// tasks[].check(actions) 依消費端自訂的 Action 型別判定。引擎對 Action 泛型,完全不認識 chat。
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Input, ProgressBar, Notice } from '@qijenchen/design-system'
import {
  ClipboardList, Target, Info, FileSpreadsheet, ClipboardCopy, RotateCcw, Check, ArrowRight,
  GripVertical, ChevronDown, ChevronUp, CheckCircle2, XCircle, Mic, MicOff, Lock,
} from 'lucide-react'

// ── 型別(對外契約)─────────────────────────────────────────────────────────
export type UTaskResult = 'success' | 'fail'

/** 單一任務。check 依「任務進行期間累積的操作(你的 prototype 吐出的 Action)」判定成功與否。 */
export type UTask<A = unknown> = {
  id: string
  title: string
  hint?: string
  check: (actions: A[]) => { ok: boolean; reason?: string }
}

/**
 * 單一版本。render 由消費端把「自己的 prototype」針對此版本渲染出來,
 * 並透過 api.onAction 把使用者操作吐回引擎,讓 task.check 能判定成敗。
 */
export type UTVariant<A = unknown> = {
  label: string
  render: (api: { onAction: (action: A) => void }) => ReactNode
}

/** 一個完整測試專案的定義。引擎吃這個 config,其餘流程全由引擎負責。 */
export type UTProject<A = unknown> = {
  id: string
  title: string
  goal: string
  instructions: string[]
  tasks: UTask<A>[]
  variants: Record<string, UTVariant<A>>
}

type TaskOutcome = { id: string; title: string; result: UTaskResult; reason?: string }
type VariantRun = {
  variant: string
  variantLabel: string
  outcomes: TaskOutcome[]
  successCount: number
  total: number
  rate: number
  startedAt: Date
  finishedAt: Date
  /** 放聲思考逐字稿(可能為空:不支援或未授權麥克風)。 */
  transcript: string
}

// ── 小色票 chip ────────────────────────────────────────────────────────────
type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error'
const TONE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--color-neutral-3)', fg: 'var(--color-neutral-8)' },
  info: { bg: 'var(--color-info-subtle)', fg: 'var(--color-info-text)' },
  success: { bg: 'var(--color-success-subtle)', fg: 'var(--color-success-text)' },
  warning: { bg: 'var(--color-warning-subtle)', fg: 'var(--color-warning-text)' },
  error: { bg: 'var(--color-error-subtle)', fg: 'var(--color-error-text)' },
}
function Chip({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-1.5 py-0.5 ${className ?? ''}`}
      style={{ backgroundColor: TONE[tone].bg, color: TONE[tone].fg, fontSize: 11, fontWeight: 600, lineHeight: '130%' }}
    >
      {children}
    </span>
  )
}

// ── 工具:時間、Excel 匯出、複製文字 ─────────────────────────────────────────
function fmtDateTime(d: Date) {
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function durationMin(a: Date, b: Date) {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 60000))
}
// 用 HTML table 產生 Excel 可開的 .xls(免依賴、支援中文)。
function downloadExcel(filename: string, rows: (string | number)[][]) {
  const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body><table border="1">${body}</table></body></html>`
  const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
async function copyToClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

// ── 放聲思考逐字稿:瀏覽器 Web Speech API(免後端)──────────────────────────
type ThinkAloud = {
  supported: boolean
  recording: boolean
  interim: string
  error: string | null
  start: () => void
  /** 停止並回傳目前累積的逐字稿。 */
  stop: () => string
}
function useThinkAloud(): ThinkAloud {
  const SR: any = typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null
  const supported = !!SR
  const recRef = useRef<any>(null)
  const finalRef = useRef<string>('')
  const activeRef = useRef(false)
  const [recording, setRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  function start() {
    if (!supported || recRef.current) { if (!supported) setError('此瀏覽器不支援語音轉文字'); return }
    finalRef.current = ''
    const rec = new SR()
    rec.lang = 'zh-TW'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: any) => {
      let it = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalRef.current += r[0].transcript
        else it += r[0].transcript
      }
      setInterim(it)
    }
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('麥克風權限被拒,未錄音')
        activeRef.current = false
        setRecording(false)
      }
    }
    rec.onend = () => {
      if (activeRef.current) { try { rec.start() } catch { /* ignore restart race */ } }
      else setRecording(false)
    }
    recRef.current = rec
    activeRef.current = true
    try { rec.start(); setRecording(true) } catch { /* ignore */ }
  }

  function stop(): string {
    activeRef.current = false
    try { recRef.current?.stop() } catch { /* ignore */ }
    recRef.current = null
    setRecording(false)
    setInterim('')
    return finalRef.current.trim()
  }

  useEffect(() => () => { activeRef.current = false; try { recRef.current?.stop() } catch { /* ignore */ } }, [])

  return { supported, recording, interim, error, start, stop }
}

// ── 共用拖曳 hook(放在帶 data-draggable 的容器上)──────────────────────────
function useDraggable(initial: React.CSSProperties) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  function onPointerDown(e: React.PointerEvent) {
    const host = (e.currentTarget.closest('[data-draggable]') as HTMLElement).getBoundingClientRect()
    dragRef.current = { dx: e.clientX - host.left, dy: e.clientY - host.top }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy })
  }
  function onPointerUp() { dragRef.current = null }
  const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : initial
  return { style, handlers: { onPointerDown, onPointerMove, onPointerUp } }
}

// 關鍵字擷取式重點(非 AI;抓出含易用性訊號的句子)。
const PAIN_WORDS = ['難', '找不到', '不知道', '看不到', '搞不懂', '困惑', '問題', '怪', '卡住', '卡', '慢', '複雜', '錯', '不會', '奇怪', '不清楚', '麻煩', '為什麼', '怎麼']
const GOOD_WORDS = ['快', '清楚', '容易', '直覺', '方便', '好找', '喜歡', '順', '簡單', '明顯', '不錯']
function digestTranscript(transcript: string): string[] {
  const sents = transcript.split(/[。!?！？\n,，]/).map((s) => s.trim()).filter((s) => s.length >= 2)
  const picked = sents.filter((s) => PAIN_WORDS.some((k) => s.includes(k)) || GOOD_WORDS.some((k) => s.includes(k)))
  // 去重 + 取前 6 句
  return Array.from(new Set(picked)).slice(0, 6)
}

// ── 進行中左上角小狀態列(可拖曳;版本 + 錄音狀態 + 即時逐字稿預覽)──────────
function FloatingStatus({ variant, rec }: { variant: string; rec: ThinkAloud }) {
  const { style, handlers } = useDraggable({ left: 12, top: 12 })
  return (
    <div
      data-draggable
      className="fixed z-[1000] flex max-w-[260px] cursor-grab select-none items-center gap-1.5 rounded-full border border-neutral-5 bg-surface px-2 py-1 shadow active:cursor-grabbing"
      style={style}
      {...handlers}
    >
      <GripVertical size={11} className="text-neutral-5" />
      <span style={{ fontSize: 11, fontWeight: 600 }} className="text-neutral-8">版本 {variant}</span>
      {rec.recording ? (
        <span className="flex items-center gap-1" style={{ fontSize: 11, color: 'var(--color-error-text)' }}>
          <Mic size={11} />
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: 'var(--color-error-text)' }} />
          錄音中
        </span>
      ) : (
        <span className="flex items-center gap-1 text-neutral-6" style={{ fontSize: 11 }}>
          <MicOff size={11} />{rec.supported ? '未錄音' : '不支援'}
        </span>
      )}
      {rec.recording && rec.interim && (
        <span className="max-w-[110px] truncate text-neutral-5" style={{ fontSize: 10 }}>{rec.interim}</span>
      )}
    </div>
  )
}

// ── 懸浮任務指示視窗(右下角,可拖曳、可收合)─────────────────────────────────
function TaskPanel({
  tasks, index, onComplete,
}: {
  tasks: UTask<any>[]
  index: number
  onComplete: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const { style, handlers } = useDraggable({ right: 24, bottom: 24 })

  const total = tasks.length
  const current = tasks[index]
  const isLast = index >= total - 1

  return (
    <div data-draggable className="fixed z-[1000] w-[320px] rounded-xl border border-neutral-5 bg-surface shadow-lg" style={style}>
      <div
        className="flex cursor-grab items-center gap-2 border-b border-neutral-4 px-3 py-2 active:cursor-grabbing"
        {...handlers}
      >
        <GripVertical size={14} className="text-neutral-6" />
        <ClipboardList size={16} className="text-primary" />
        <span style={{ fontSize: 13, fontWeight: 600 }} className="text-neutral-9">任務指示</span>
        <Chip className="ml-auto">{Math.min(index + 1, total)} / {total}</Chip>
        <Button
          variant="text" size="sm" iconOnly
          startIcon={collapsed ? ChevronUp : ChevronDown}
          aria-label={collapsed ? '展開' : '收合'}
          onClick={() => setCollapsed((v) => !v)}
          className="!h-6 !w-6 !min-w-0 !p-0"
        />
      </div>

      {!collapsed && current && (
        <div className="px-3 py-3">
          <ProgressBar value={total ? (index / total) * 100 : 0} height={6} />
          <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, lineHeight: '150%' }}>{current.title}</p>
          {current.hint && (
            <p className="mt-1 text-neutral-7" style={{ fontSize: 12, lineHeight: '140%' }}>{current.hint}</p>
          )}
          <p className="mt-2 text-neutral-6" style={{ fontSize: 11, lineHeight: '140%' }}>
            完成上述操作後再按下方按鈕;未實際完成會記為「失敗」。
          </p>
          <Button variant="primary" size="sm" startIcon={Check} className="mt-3 w-full" onClick={onComplete}>
            {isLast ? '完成並查看結果' : '完成,下一步'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── 單一版本的任務執行階段 ───────────────────────────────────────────────────
function RunPhase<A>({ project, variant, onDone }: { project: UTProject<A>; variant: string; onDone: (run: VariantRun) => void }) {
  const v = project.variants[variant]
  const actionsRef = useRef<A[]>([])
  const taskStartRef = useRef(0)
  const outcomesRef = useRef<TaskOutcome[]>([])
  const startedRef = useRef<Date>(new Date())
  const [index, setIndex] = useState(0)
  const rec = useThinkAloud()

  // 進入測試即自動開始錄音(intro 的按鈕點擊提供了 user gesture)。
  useEffect(() => { rec.start() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function complete() {
    const task = project.tasks[index]
    const slice = actionsRef.current.slice(taskStartRef.current)
    const { ok, reason } = task.check(slice)
    outcomesRef.current.push({
      id: task.id,
      title: task.title,
      result: ok ? 'success' : 'fail',
      reason: ok ? undefined : (reason ?? '未實際完成任務指定的操作'),
    })
    taskStartRef.current = actionsRef.current.length

    if (index >= project.tasks.length - 1) {
      const outcomes = outcomesRef.current
      const successCount = outcomes.filter((o) => o.result === 'success').length
      const total = outcomes.length
      const transcript = rec.stop()
      onDone({
        variant,
        variantLabel: v.label,
        outcomes,
        successCount,
        total,
        rate: total ? Math.round((successCount / total) * 100) : 0,
        startedAt: startedRef.current,
        finishedAt: new Date(),
        transcript,
      })
    } else {
      setIndex(index + 1)
    }
  }

  return (
    <div className="relative h-screen w-full">
      {v.render({ onAction: (a) => { actionsRef.current.push(a) } })}
      <FloatingStatus variant={variant} rec={rec} />
      <TaskPanel tasks={project.tasks} index={index} onComplete={complete} />
    </div>
  )
}

// ── 密碼閘門(每個測試開始前)─────────────────────────────────────────────────
function PasswordGate({ password, onUnlock }: { password: string; onUnlock: () => void }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)
  function submit() {
    if (val === password) onUnlock()
    else setErr(true)
  }
  return (
    <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-[400px] rounded-xl border border-neutral-5 bg-surface p-8 text-center shadow-lg">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--color-info-subtle)' }}>
          <Lock size={22} style={{ color: 'var(--color-info-text)' }} />
        </div>
        <h1 className="text-neutral-9" style={{ fontSize: 18, fontWeight: 600 }}>請輸入測試密碼</h1>
        <p className="mt-1 text-neutral-7" style={{ fontSize: 13 }}>此測試內容受密碼保護,僅供受邀者進行。</p>
        <Input
          className="mt-4"
          type="password"
          placeholder="請輸入密碼"
          value={val}
          autoFocus
          onChange={(e) => { setVal(e.target.value); setErr(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
        {err && <p className="mt-2" style={{ fontSize: 12, color: 'var(--color-error-text)' }}>密碼錯誤,請再試一次。</p>}
        <Button variant="primary" className="mt-4 w-full" disabled={!val} onClick={submit}>進入測試</Button>
      </div>
    </div>
  )
}

// ── intro 畫面 ──────────────────────────────────────────────────────────────
function IntroScreen({
  project, badge, note, tester, onTesterChange, onStart,
}: {
  project: UTProject<any>
  badge: string
  note: ReactNode
  tester: string
  onTesterChange: (s: string) => void
  onStart: () => void
}) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-[560px] rounded-xl border border-neutral-5 bg-surface p-8 shadow-lg">
        <Chip tone="info" className="mb-3">{badge}</Chip>
        <h1 className="text-neutral-9" style={{ fontSize: 22, fontWeight: 600, lineHeight: '130%' }}>{project.title}</h1>

        <div className="mt-5 flex items-start gap-2">
          <Target size={18} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }} className="text-neutral-9">測試目標</p>
            <p className="mt-0.5 text-neutral-8" style={{ fontSize: 13, lineHeight: '150%' }}>{project.goal}</p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2">
          <Info size={18} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }} className="text-neutral-9">測試須知</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-neutral-8" style={{ fontSize: 13, lineHeight: '150%' }}>
              {project.instructions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2">
          <ClipboardList size={18} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-neutral-8" style={{ fontSize: 13 }}>{note}</p>
        </div>

        <div className="mt-4 flex items-start gap-2">
          <Mic size={18} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-neutral-8" style={{ fontSize: 13 }}>
            開始後會請求<b>麥克風權限</b>,用於自動把你的「放聲思考」轉成逐字稿(可拒絕,拒絕則不錄音)。
          </p>
        </div>

        <label className="mt-6 block" style={{ fontSize: 13, fontWeight: 600 }}>請輸入你的姓名</label>
        <Input
          className="mt-1.5" placeholder="例如:王小明" value={tester}
          onChange={(e) => onTesterChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onStart() }}
        />
        <Button variant="primary" className="mt-5 w-full" disabled={!tester.trim()} onClick={onStart}>
          確認並開始測試
        </Button>
      </div>
    </div>
  )
}

// ── 共用:逐項任務結果清單 ───────────────────────────────────────────────────
function OutcomeList({ outcomes }: { outcomes: TaskOutcome[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {outcomes.map((o, i) => (
        <li key={o.id} className="flex items-start gap-2" style={{ fontSize: 13 }}>
          {o.result === 'success'
            ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-success-text)' }} />
            : <XCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-error-text)' }} />}
          <div>
            <span className="text-neutral-8">{i + 1}. {o.title} </span>
            <Chip tone={o.result === 'success' ? 'success' : 'error'}>{o.result === 'success' ? '成功' : '失敗'}</Chip>
            {o.result === 'fail' && o.reason && (
              <p className="mt-0.5 text-neutral-6" style={{ fontSize: 12 }}>失敗原因:{o.reason}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

// ── 放聲思考逐字稿 + 自動重點 ────────────────────────────────────────────────
function TranscriptBlock({ title, transcript }: { title: string; transcript: string }) {
  const [open, setOpen] = useState(false)
  const digest = digestTranscript(transcript)
  return (
    <div className="mt-4">
      <p className="text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>{title}</p>
      {transcript ? (
        <>
          <p className="mt-1 text-neutral-7" style={{ fontSize: 12 }}>自動重點(關鍵字擷取,非 AI):</p>
          {digest.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-neutral-8" style={{ fontSize: 12, lineHeight: '150%' }}>
              {digest.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          ) : (
            <p className="mt-1 text-neutral-6" style={{ fontSize: 12 }}>(未擷取到明顯關鍵字,請見完整逐字稿)</p>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1.5 text-primary"
            style={{ fontSize: 12, fontWeight: 500 }}
          >
            {open ? '收合完整逐字稿' : `展開完整逐字稿(${transcript.length} 字)`}
          </button>
          {open && (
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-neutral-4 bg-canvas p-3 text-neutral-8" style={{ fontSize: 12, lineHeight: '160%' }}>
              {transcript}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-neutral-6" style={{ fontSize: 12 }}>(無逐字稿:未授權麥克風或瀏覽器不支援語音轉文字)</p>
      )}
    </div>
  )
}

// ── 結果頁底部的匯出按鈕(Excel + 複製文字)─────────────────────────────────
function ExportBar({ onExcel, onCopyText, onReset }: { onExcel: () => void; onCopyText: () => void; onReset: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="secondary" startIcon={FileSpreadsheet} onClick={onExcel}>匯出 Excel</Button>
      <Button
        variant="secondary"
        startIcon={copied ? Check : ClipboardCopy}
        onClick={async () => { onCopyText(); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      >
        {copied ? '已複製' : '複製文字檔'}
      </Button>
      <Button variant="text" startIcon={RotateCcw} className="ml-auto" onClick={onReset}>重新測試</Button>
    </div>
  )
}

function ResultShell({ badge, children }: { badge: string; children: ReactNode }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">
      <div className="max-h-full w-full max-w-[640px] overflow-auto rounded-xl border border-neutral-5 bg-surface p-8 shadow-lg">
        <Chip tone="info" className="mb-3">{badge}</Chip>
        {children}
      </div>
    </div>
  )
}

// ── 單版本結果頁 ─────────────────────────────────────────────────────────────
function SingleResultScreen({ project, run, tester, onReset }: { project: UTProject<any>; run: VariantRun; tester: string; onReset: () => void }) {
  function excel() {
    const rows: (string | number)[][] = [
      ['測試名稱', project.title],
      ['測試者', tester || '—'],
      ['版本', `${run.variant}(${run.variantLabel})`],
      ['測試日期', fmtDateTime(run.startedAt)],
      ['耗時(分)', durationMin(run.startedAt, run.finishedAt)],
      ['任務達成率', `${run.rate}% (${run.successCount}/${run.total})`],
      [],
      ['#', '任務', '結果', '失敗原因'],
      ...run.outcomes.map((o, i) => [i + 1, o.title, o.result === 'success' ? '成功' : '失敗', o.reason ?? '']),
      [],
      ['放聲思考重點', digestTranscript(run.transcript).join(' / ') || '(無)'],
      ['放聲思考逐字稿', run.transcript || '(無)'],
    ]
    downloadExcel(`UT-${project.id}-${run.variant}-${tester || 'anon'}.xls`, rows)
  }
  function text() {
    const lines = [
      `測試名稱:${project.title}`,
      `測試者:${tester || '—'}`,
      `版本:${run.variant}(${run.variantLabel})`,
      `測試日期:${fmtDateTime(run.startedAt)}`,
      `耗時:約 ${durationMin(run.startedAt, run.finishedAt)} 分鐘`,
      `任務達成率:${run.rate}% (${run.successCount}/${run.total})`,
      '',
      '任務結果:',
      ...run.outcomes.map((o, i) => `  ${i + 1}. [${o.result === 'success' ? '成功' : '失敗'}] ${o.title}${o.result === 'fail' && o.reason ? ` — 失敗原因:${o.reason}` : ''}`),
      '',
      `放聲思考重點:${digestTranscript(run.transcript).join(' / ') || '(無)'}`,
      `放聲思考逐字稿:${run.transcript || '(無)'}`,
    ]
    copyToClipboard(lines.join('\n'))
  }

  return (
    <ResultShell badge={`測試結果 · 版本 ${run.variant}`}>
      <h1 className="text-neutral-9" style={{ fontSize: 22, fontWeight: 600, lineHeight: '130%' }}>{project.title}</h1>

      <div className="mt-5 rounded-lg border border-neutral-4 p-4">
        <div className="flex items-baseline gap-2">
          <span style={{ fontSize: 36, fontWeight: 700 }} className="text-primary">{run.rate}%</span>
          <span className="text-neutral-7" style={{ fontSize: 13 }}>任務成功率({run.successCount} / {run.total} 成功)</span>
        </div>
        <ProgressBar className="mt-2" value={run.rate} height={8} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-neutral-8" style={{ fontSize: 13 }}>
        <div><span className="text-neutral-6">測試者:</span> <b>{tester || '—'}</b></div>
        <div><span className="text-neutral-6">版本:</span> {run.variant}({run.variantLabel})</div>
        <div><span className="text-neutral-6">測試日期:</span> {fmtDateTime(run.startedAt)}</div>
        <div><span className="text-neutral-6">耗時:</span> 約 {durationMin(run.startedAt, run.finishedAt)} 分鐘</div>
      </div>

      <p className="mt-5 text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>任務 Summary</p>
      <OutcomeList outcomes={run.outcomes} />

      <TranscriptBlock title="放聲思考逐字稿" transcript={run.transcript} />

      <Notice className="mt-5" variant="info" title="把結果交回給研究人員" description="可匯出 Excel 或複製純文字,貼到你們彙整結果的試算表 / 文件。" />
      <ExportBar onExcel={excel} onCopyText={text} onReset={onReset} />
    </ResultShell>
  )
}

// ── 綜合結論(A vs B)─────────────────────────────────────────────────────────
function concludeText(a: VariantRun, b: VariantRun) {
  if (a.successCount === b.successCount) {
    return `兩版本任務成功數相同(各 ${a.successCount}/${a.total},${a.rate}%)。建議再參考完成耗時與受測者主觀回饋來判斷。`
  }
  const better = a.successCount > b.successCount ? a : b
  const worse = better === a ? b : a
  return `${better.variantLabel}(版本 ${better.variant})任務成功率較高:${better.rate}%(${better.successCount}/${better.total}) vs ${worse.rate}%(${worse.successCount}/${worse.total}),整體易用性表現較佳。`
}
// 放聲思考摘要(關鍵字擷取,彙整進結論)。
function thinkAloudNote(a: VariantRun, b: VariantRun) {
  if (!a.transcript && !b.transcript) return '本次未取得放聲思考逐字稿(未授權麥克風或瀏覽器不支援)。'
  const da = digestTranscript(a.transcript)
  const db = digestTranscript(b.transcript)
  return `放聲思考重點 — 版本 A:${da.length ? da.join(';') : '(無明顯關鍵反饋)'};版本 B:${db.length ? db.join(';') : '(無明顯關鍵反饋)'}。`
}

function CombinedResultScreen({ project, runA, runB, tester, onReset }: { project: UTProject<any>; runA: VariantRun; runB: VariantRun; tester: string; onReset: () => void }) {
  const conclusion = concludeText(runA, runB)
  const taNote = thinkAloudNote(runA, runB)

  function excel() {
    const taskRows = project.tasks.map((t, i) => {
      const oa = runA.outcomes.find((o) => o.id === t.id)
      const ob = runB.outcomes.find((o) => o.id === t.id)
      return [
        i + 1, t.title,
        oa?.result === 'success' ? '成功' : '失敗', oa?.reason ?? '',
        ob?.result === 'success' ? '成功' : '失敗', ob?.reason ?? '',
      ]
    })
    const rows: (string | number)[][] = [
      ['測試名稱', project.title],
      ['測試者', tester || '—'],
      ['測試日期', fmtDateTime(runA.startedAt)],
      [],
      ['版本 A 達成率', `${runA.rate}% (${runA.successCount}/${runA.total})`],
      ['版本 B 達成率', `${runB.rate}% (${runB.successCount}/${runB.total})`],
      ['綜合結論', conclusion],
      ['放聲思考摘要', taNote],
      [],
      ['#', '任務', 'A 結果', 'A 失敗原因', 'B 結果', 'B 失敗原因'],
      ...taskRows,
      [],
      ['版本 A 逐字稿', runA.transcript || '(無)'],
      ['版本 B 逐字稿', runB.transcript || '(無)'],
    ]
    downloadExcel(`UT-${project.id}-AB-${tester || 'anon'}.xls`, rows)
  }
  function text() {
    const lines = [
      `測試名稱:${project.title}`,
      `測試者:${tester || '—'}`,
      `測試日期:${fmtDateTime(runA.startedAt)}`,
      '',
      `版本 A(${runA.variantLabel})達成率:${runA.rate}% (${runA.successCount}/${runA.total})`,
      `版本 B(${runB.variantLabel})達成率:${runB.rate}% (${runB.successCount}/${runB.total})`,
      '',
      '逐項比較:',
      ...project.tasks.map((t, i) => {
        const oa = runA.outcomes.find((o) => o.id === t.id)
        const ob = runB.outcomes.find((o) => o.id === t.id)
        return `  ${i + 1}. ${t.title}\n     A:${oa?.result === 'success' ? '成功' : `失敗(${oa?.reason ?? ''})`}\n     B:${ob?.result === 'success' ? '成功' : `失敗(${ob?.reason ?? ''})`}`
      }),
      '',
      `綜合結論:${conclusion}`,
      `${taNote}`,
      '',
      `版本 A 逐字稿:${runA.transcript || '(無)'}`,
      `版本 B 逐字稿:${runB.transcript || '(無)'}`,
    ]
    copyToClipboard(lines.join('\n'))
  }

  const Stat = ({ run }: { run: VariantRun }) => (
    <div className="flex-1 rounded-lg border border-neutral-4 p-4">
      <p style={{ fontSize: 13, fontWeight: 600 }} className="text-neutral-9">版本 {run.variant}</p>
      <p className="text-neutral-6" style={{ fontSize: 12 }}>{run.variantLabel}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span style={{ fontSize: 30, fontWeight: 700 }} className="text-primary">{run.rate}%</span>
        <span className="text-neutral-7" style={{ fontSize: 12 }}>{run.successCount}/{run.total} 成功</span>
      </div>
      <ProgressBar className="mt-2" value={run.rate} height={6} />
    </div>
  )

  return (
    <ResultShell badge="綜合測試結果 · 版本 A vs B">
      <h1 className="text-neutral-9" style={{ fontSize: 22, fontWeight: 600, lineHeight: '130%' }}>{project.title}</h1>
      <div className="mt-2 text-neutral-8" style={{ fontSize: 13 }}>
        <span className="text-neutral-6">測試者:</span> <b>{tester || '—'}</b>
        <span className="ml-4 text-neutral-6">測試日期:</span> {fmtDateTime(runA.startedAt)}
      </div>

      <div className="mt-4 flex gap-3">
        <Stat run={runA} />
        <Stat run={runB} />
      </div>

      <div className="mt-4 rounded-lg p-4" style={{ backgroundColor: 'var(--color-info-subtle)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-info-text)' }}>綜合結論</p>
        <p className="mt-1" style={{ fontSize: 13, lineHeight: '150%', color: 'var(--color-info-text)' }}>{conclusion}</p>
        <p className="mt-2" style={{ fontSize: 12, lineHeight: '150%', color: 'var(--color-info-text)' }}>{taNote}</p>
      </div>

      <p className="mt-5 text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>版本 A 逐項</p>
      <OutcomeList outcomes={runA.outcomes} />
      <TranscriptBlock title="版本 A 放聲思考逐字稿" transcript={runA.transcript} />
      <p className="mt-4 text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>版本 B 逐項</p>
      <OutcomeList outcomes={runB.outcomes} />
      <TranscriptBlock title="版本 B 放聲思考逐字稿" transcript={runB.transcript} />

      <Notice className="mt-5" variant="info" title="把綜合結果交回給研究人員" description="可匯出 Excel(含 A/B 逐項比較、結論、逐字稿)或複製純文字。" />
      <ExportBar onExcel={excel} onCopyText={text} onReset={onReset} />
    </ResultShell>
  )
}

// ── 對外:單版本流程(VersionA / VersionB 用)────────────────────────────────
export function UsabilityTest<A>({ project, variant, password = '0000' }: { project: UTProject<A>; variant: string; password?: string }) {
  const [unlocked, setUnlocked] = useState(false)
  const [phase, setPhase] = useState<'intro' | 'running' | 'done'>('intro')
  const [tester, setTester] = useState('')
  const [run, setRun] = useState<VariantRun | null>(null)

  if (!unlocked) return <PasswordGate password={password} onUnlock={() => setUnlocked(true)} />

  if (phase === 'intro') {
    return (
      <IntroScreen
        project={project}
        badge={`Usability Test · 版本 ${variant}`}
        note={<>本次共 <b>{project.tasks.length}</b> 項任務,進行中右下角會出現任務指示框。<b>必須實際完成</b>指定操作才算成功。</>}
        tester={tester}
        onTesterChange={setTester}
        onStart={() => { if (tester.trim()) setPhase('running') }}
      />
    )
  }
  if (phase === 'running') {
    return <RunPhase project={project} variant={variant} onDone={(r) => { setRun(r); setPhase('done') }} />
  }
  return <SingleResultScreen project={project} run={run!} tester={tester} onReset={() => { setPhase('intro'); setTester(''); setRun(null) }} />
}

// ── 對外:A→B 雙版本綜合流程 ────────────────────────────────────────────────
export function UsabilityTestAB<A>({ project, order = ['A', 'B'], password = '0000' }: { project: UTProject<A>; order?: [string, string]; password?: string }) {
  const [vA, vB] = order
  const [unlocked, setUnlocked] = useState(false)
  const [phase, setPhase] = useState<'intro' | 'runA' | 'interstitial' | 'runB' | 'done'>('intro')
  const [tester, setTester] = useState('')
  const [runA, setRunA] = useState<VariantRun | null>(null)
  const [runB, setRunB] = useState<VariantRun | null>(null)

  function reset() { setPhase('intro'); setTester(''); setRunA(null); setRunB(null) }

  if (!unlocked) return <PasswordGate password={password} onUnlock={() => setUnlocked(true)} />

  if (phase === 'intro') {
    return (
      <IntroScreen
        project={project}
        badge="Usability Test · 綜合測試 A → B"
        note={<>你會<b>依序體驗兩個版本(A 然後 B)</b>,每版各 <b>{project.tasks.length}</b> 項任務。全部完成後會看到 A/B 比較與綜合結論。</>}
        tester={tester}
        onTesterChange={setTester}
        onStart={() => { if (tester.trim()) setPhase('runA') }}
      />
    )
  }
  if (phase === 'runA') {
    return <RunPhase project={project} variant={vA} onDone={(r) => { setRunA(r); setPhase('interstitial') }} />
  }
  if (phase === 'interstitial') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-[480px] rounded-xl border border-neutral-5 bg-surface p-8 text-center shadow-lg">
          <Chip tone="success" className="mb-3">版本 {vA} 完成</Chip>
          <h2 className="text-neutral-9" style={{ fontSize: 18, fontWeight: 600 }}>接下來進行版本 {vB}</h2>
          <p className="mt-2 text-neutral-7" style={{ fontSize: 13, lineHeight: '150%' }}>
            版本 {vA} 的任務已完成。按下方按鈕,用同樣的方式完成版本 {vB} 的任務。
          </p>
          <Button variant="primary" className="mt-5 w-full" startIcon={ArrowRight} onClick={() => setPhase('runB')}>
            開始版本 {vB} 測試
          </Button>
        </div>
      </div>
    )
  }
  if (phase === 'runB') {
    return <RunPhase project={project} variant={vB} onDone={(r) => { setRunB(r); setPhase('done') }} />
  }
  return <CombinedResultScreen project={project} runA={runA!} runB={runB!} tester={tester} onReset={reset} />
}
