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
import { Button, Input, Textarea, ProgressBar, Notice } from '@qijenchen/design-system'
import {
  ClipboardList, Target, Info, FileSpreadsheet, ClipboardCopy, RotateCcw, Check, ArrowRight,
  GripVertical, ChevronDown, ChevronUp, CheckCircle2, XCircle, Mic, MicOff, Lock,
} from 'lucide-react'

// ── 型別(對外契約)─────────────────────────────────────────────────────────
export type UTaskResult = 'success' | 'fail'

// ── 問卷(survey)— 任務後 / 測試後安插主觀回饋與開放性問題 ────────────────────
// v1 題型:singleEase(SEQ 單題難易度量表,預設 7 點)+ writtenResponse(開放式文字)。
// 設計原則:中性非引導文案、量表預設 7 點可覆寫、開放題可設最低字數。新增題型 =
// 在 QuestionRenderer 加一個 case + union 加一支,不動流程。
export type SurveyQuestion =
  | {
      id: string
      questionType: 'singleEase'
      prompt: string
      /** 量表點數,預設 7(信度較 5 點高)。可覆寫為 5。 */
      scalePoints?: number
      /** 兩端錨點文案,預設 非常困難 / 非常容易。 */
      anchors?: { min: string; max: string }
      /** 預設 true。 */
      required?: boolean
    }
  | {
      id: string
      questionType: 'writtenResponse'
      prompt: string
      /** 最低字數,未達不可送出(僅 required 題強制)。 */
      minChars?: number
      placeholder?: string
      /** 預設 true。 */
      required?: boolean
    }

/** 受測者對單一題目的作答。scale 類 value 為 number;開放題為 string。 */
export type SurveyAnswer = {
  questionId: string
  questionType: SurveyQuestion['questionType']
  prompt: string
  value: number | string
}

/** 單一任務。check 依「任務進行期間累積的操作(你的 prototype 吐出的 Action)」判定成功與否。 */
export type UTask<A = unknown> = {
  id: string
  title: string
  hint?: string
  check: (actions: A[]) => { ok: boolean; reason?: string }
  /** 此任務完成後彈出的問卷;未設則沿用 project.postTaskSurvey。 */
  postTask?: SurveyQuestion[]
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
  /** 任務後問卷(套用到所有任務;單一任務可用 task.postTask 覆寫)。 */
  postTaskSurvey?: SurveyQuestion[]
  /** 整場測試結束後問卷(開放題 + 整體滿意度等)。 */
  postTestSurvey?: SurveyQuestion[]
}

/** 取某任務的任務後問卷:task 層覆寫優先,否則用 project 預設。 */
function postTaskQuestionsFor<A>(project: UTProject<A>, task: UTask<A>): SurveyQuestion[] {
  return task.postTask ?? project.postTaskSurvey ?? []
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
  /** 每個任務後問卷的作答(無問卷的任務不會出現)。 */
  taskSurveys: { taskId: string; taskTitle: string; answers: SurveyAnswer[] }[]
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

// 觸發一個 Blob 的瀏覽器下載(存到使用者的「下載」資料夾)。
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// ── 螢幕錄製:畫面(getDisplayMedia)+ 麥克風講話聲(getUserMedia)混音 → webm ──
// 必須由 user gesture 觸發(intro 的「開始測試」按鈕)。使用者會看到瀏覽器的「分享畫面」
// 授權框並自行選擇分享範圍;取消或不支援時 graceful 不錄(測試照常進行)。建議 Chrome / Edge。
function pickRecorderMime(): { mimeType: string } | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const t of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(t)) return { mimeType: t }
  }
  return undefined
}
type ScreenRecorder = { started: boolean; start: () => Promise<void>; stop: () => Promise<Blob | null> }
function useScreenRecorder(): ScreenRecorder {
  const startedRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamsRef = useRef<MediaStream[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [started, setStarted] = useState(false)

  function cleanup() {
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    streamsRef.current = []
    try { audioCtxRef.current?.close() } catch { /* ignore */ }
    audioCtxRef.current = null
    recorderRef.current = null
  }

  async function start() {
    if (startedRef.current) return
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!md?.getDisplayMedia) return
    try {
      const display = await md.getDisplayMedia({ video: true, audio: true })
      streamsRef.current.push(display)
      let mic: MediaStream | null = null
      try { mic = await md.getUserMedia({ audio: true }); streamsRef.current.push(mic) } catch { /* mic 可選 */ }

      const videoTrack = display.getVideoTracks()[0]
      const audioInputs = [...display.getAudioTracks(), ...(mic ? mic.getAudioTracks() : [])]
      const tracks: MediaStreamTrack[] = [videoTrack]
      if (audioInputs.length === 1) {
        tracks.push(audioInputs[0])
      } else if (audioInputs.length > 1) {
        // 多個音源(系統音 + 麥克風)→ 用 Web Audio 混成單一 track。
        const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
        const ctx = new Ctx()
        audioCtxRef.current = ctx
        const dest = ctx.createMediaStreamDestination()
        audioInputs.forEach((t) => ctx.createMediaStreamSource(new MediaStream([t])).connect(dest))
        tracks.push(dest.stream.getAudioTracks()[0])
      }

      const rec = new MediaRecorder(new MediaStream(tracks), pickRecorderMime())
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
      rec.start()
      recorderRef.current = rec
      startedRef.current = true
      setStarted(true)
    } catch {
      // 使用者取消分享 / 不允許 → 不錄製
      cleanup()
    }
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = recorderRef.current
      if (!rec || rec.state === 'inactive') { cleanup(); resolve(null); return }
      rec.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: chunksRef.current[0].type || 'video/webm' })
          : null
        cleanup()
        resolve(blob)
      }
      try { rec.stop() } catch { cleanup(); resolve(null) }
    })
  }

  useEffect(() => () => cleanup(), [])
  return { started, start, stop }
}

// ── 輕量 toast(右下方堆疊,自動消失;依需求不放按鈕)────────────────────────
type ToastMsg = { id: number; text: string }
function ToastHost({ toasts }: { toasts: ToastMsg[] }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-[1300] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-stretch gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-lg border border-neutral-5 bg-surface px-4 py-2.5 shadow-lg" style={{ fontSize: 13 }}>
          <Check size={16} className="shrink-0" style={{ color: 'var(--color-success-text)' }} />
          <span className="text-neutral-9">{t.text}</span>
        </div>
      ))}
    </div>
  )
}

// 到摘要頁時自動交付:① 立即匯出 Excel ② 螢幕錄影 blob 就緒後下載 ③ 各自跳 toast。
function useAutoDeliver(opts: { excel: () => void; recordingBase: string; recording: boolean; recordingBlob: Blob | null }): ToastMsg[] {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const idRef = useRef(0)
  const excelOnceRef = useRef(false)
  const recOnceRef = useRef(false)
  function push(text: string) {
    const id = ++idRef.current
    setToasts((p) => [...p, { id, text }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 6000)
  }
  useEffect(() => {
    if (excelOnceRef.current) return
    excelOnceRef.current = true
    try { opts.excel() } catch { /* ignore */ }
    push('測試結果 Excel 已下載到你的下載資料夾')
    if (opts.recording) push('螢幕錄影處理中,完成後會自動下載…')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!opts.recordingBlob || recOnceRef.current) return
    recOnceRef.current = true
    downloadBlob(opts.recordingBlob, `${opts.recordingBase}.webm`)
    push('螢幕錄影已下載到你的下載資料夾')
  }, [opts.recordingBlob]) // eslint-disable-line react-hooks/exhaustive-deps
  return toasts
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

// ── 問卷:單題渲染器(題型驅動;新增題型 = 加一個 case)──────────────────────
function QuestionRenderer({
  q, value, onChange,
}: {
  q: SurveyQuestion
  value: number | string | undefined
  onChange: (v: number | string) => void
}) {
  if (q.questionType === 'singleEase') {
    const pts = q.scalePoints ?? 7
    const anchors = q.anchors ?? { min: '非常困難', max: '非常容易' }
    return (
      <div>
        <p className="text-neutral-9" style={{ fontSize: 14, fontWeight: 500, lineHeight: '150%' }}>{q.prompt}</p>
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: pts }, (_, i) => i + 1).map((n) => {
            const selected = value === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className="flex h-9 flex-1 items-center justify-center rounded-lg border"
                style={{
                  borderColor: selected ? 'var(--color-primary)' : 'var(--color-neutral-5)',
                  backgroundColor: selected ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: selected ? 'var(--color-on-emphasis, #fff)' : 'var(--color-neutral-8)',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
        <div className="mt-1 flex justify-between text-neutral-6" style={{ fontSize: 11 }}>
          <span>{anchors.min}</span>
          <span>{anchors.max}</span>
        </div>
      </div>
    )
  }
  // writtenResponse
  const text = typeof value === 'string' ? value : ''
  const min = q.minChars ?? 0
  const len = text.trim().length
  return (
    <div>
      <p className="text-neutral-9" style={{ fontSize: 14, fontWeight: 500, lineHeight: '150%' }}>{q.prompt}</p>
      <Textarea
        className="mt-2"
        rows={3}
        placeholder={q.placeholder ?? '請輸入你的想法…'}
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
      {min > 0 && (
        <p className="mt-1 text-neutral-6" style={{ fontSize: 11 }}>
          {len >= min ? `已達最低字數(${len} 字)` : `至少 ${min} 字,還差 ${min - len} 字`}
        </p>
      )}
    </div>
  )
}

// ── 問卷:一個作答步驟(post-task 用 overlay,post-test 用整頁)──────────────
function isAnswerValid(q: SurveyQuestion, value: number | string | undefined): boolean {
  const required = q.required ?? true
  if (q.questionType === 'singleEase') return !required || typeof value === 'number'
  const text = (typeof value === 'string' ? value : '').trim()
  if (!required && text.length === 0) return true
  if (text.length === 0) return false
  return text.length >= (q.minChars ?? 0)
}

function SurveyStep({
  badge, title, questions, submitLabel = '送出', presentation = 'screen', onSubmit,
}: {
  badge: string
  title: string
  questions: SurveyQuestion[]
  submitLabel?: string
  presentation?: 'screen' | 'overlay'
  onSubmit: (answers: SurveyAnswer[]) => void
}) {
  const [values, setValues] = useState<Record<string, number | string>>({})
  const valid = questions.every((q) => isAnswerValid(q, values[q.id]))

  function submit() {
    const answers: SurveyAnswer[] = questions.map((q) => ({
      questionId: q.id,
      questionType: q.questionType,
      prompt: q.prompt,
      value: values[q.id] ?? (q.questionType === 'singleEase' ? 0 : ''),
    }))
    onSubmit(answers)
  }

  const card = (
    <div className="max-h-full w-full max-w-[560px] overflow-auto rounded-xl border border-neutral-5 bg-surface p-8 shadow-lg">
      <Chip tone="info" className="mb-3">{badge}</Chip>
      <h2 className="text-neutral-9" style={{ fontSize: 18, fontWeight: 600, lineHeight: '130%' }}>{title}</h2>
      <div className="mt-5 space-y-6">
        {questions.map((q) => (
          <QuestionRenderer key={q.id} q={q} value={values[q.id]} onChange={(v) => setValues((prev) => ({ ...prev, [q.id]: v }))} />
        ))}
      </div>
      <Button variant="primary" className="mt-6 w-full" disabled={!valid} onClick={submit}>{submitLabel}</Button>
    </div>
  )

  if (presentation === 'overlay') {
    return <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}>{card}</div>
  }
  return <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">{card}</div>
}

// ── 問卷:結果頁的作答清單 ───────────────────────────────────────────────────
function SurveyAnswerList({ answers }: { answers: SurveyAnswer[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {answers.map((a) => (
        <li key={a.questionId}>
          <p className="text-neutral-6" style={{ fontSize: 12 }}>{a.prompt}</p>
          <p className="text-neutral-9" style={{ fontSize: 13, fontWeight: 500, lineHeight: '150%' }}>
            {a.questionType === 'singleEase'
              ? `${a.value} 分`
              : (String(a.value).trim() || '(未填)')}
          </p>
        </li>
      ))}
    </ul>
  )
}

// ── 單一版本的任務執行階段 ───────────────────────────────────────────────────
function RunPhase<A>({ project, variant, onDone }: { project: UTProject<A>; variant: string; onDone: (run: VariantRun) => void }) {
  const v = project.variants[variant]
  const actionsRef = useRef<A[]>([])
  const taskStartRef = useRef(0)
  const outcomesRef = useRef<TaskOutcome[]>([])
  const surveysRef = useRef<{ taskId: string; taskTitle: string; answers: SurveyAnswer[] }[]>([])
  const startedRef = useRef<Date>(new Date())
  const [index, setIndex] = useState(0)
  // 不為 null 時表示正在作答 tasks[surveyIdx] 的任務後問卷(以 overlay 蓋在 prototype 上)。
  const [surveyIdx, setSurveyIdx] = useState<number | null>(null)
  const rec = useThinkAloud()

  // 進入測試即自動開始錄音(intro 的按鈕點擊提供了 user gesture)。
  useEffect(() => { rec.start() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function finishVariant() {
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
      taskSurveys: surveysRef.current,
    })
  }

  function advanceOrFinish() {
    if (index >= project.tasks.length - 1) finishVariant()
    else setIndex(index + 1)
  }

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

    // 有任務後問卷 → 先彈問卷,作答後才前進。
    if (postTaskQuestionsFor(project, task).length > 0) {
      setSurveyIdx(index)
      return
    }
    advanceOrFinish()
  }

  function onSurveySubmit(answers: SurveyAnswer[]) {
    const task = project.tasks[index]
    surveysRef.current.push({ taskId: task.id, taskTitle: task.title, answers })
    setSurveyIdx(null)
    advanceOrFinish()
  }

  const surveyTask = surveyIdx !== null ? project.tasks[surveyIdx] : null

  return (
    <div className="relative h-screen w-full">
      {v.render({ onAction: (a) => { actionsRef.current.push(a) } })}
      <FloatingStatus variant={variant} rec={rec} />
      <TaskPanel tasks={project.tasks} index={index} onComplete={complete} />
      {surveyTask && (
        <SurveyStep
          key={surveyTask.id}
          badge={`任務 ${surveyIdx! + 1} 後問卷`}
          title="完成了!請回答幾個問題"
          questions={postTaskQuestionsFor(project, surveyTask)}
          submitLabel="送出,繼續"
          presentation="overlay"
          onSubmit={onSurveySubmit}
        />
      )}
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

// ── 問卷:匯出文字列 + 結果頁區塊 ─────────────────────────────────────────────
function fmtAnswer(a: SurveyAnswer): string {
  return a.questionType === 'singleEase' ? `${a.value} 分` : (String(a.value).trim() || '(未填)')
}
function surveyTextLines(label: string, taskSurveys: VariantRun['taskSurveys'], postTestAnswers: SurveyAnswer[]): string[] {
  const out: string[] = []
  if (taskSurveys.length) {
    out.push(`${label}任務後問卷:`)
    for (const ts of taskSurveys) {
      out.push(`  任務:${ts.taskTitle}`)
      for (const a of ts.answers) out.push(`    - ${a.prompt} → ${fmtAnswer(a)}`)
    }
  }
  if (postTestAnswers.length) {
    out.push('整場結束問卷:')
    for (const a of postTestAnswers) out.push(`  - ${a.prompt} → ${fmtAnswer(a)}`)
  }
  return out
}
function surveyExcelRows(taskSurveys: VariantRun['taskSurveys'], postTestAnswers: SurveyAnswer[]): (string | number)[][] {
  const rows: (string | number)[][] = []
  for (const ts of taskSurveys) {
    for (const a of ts.answers) rows.push([`問卷 · ${ts.taskTitle}`, a.prompt, fmtAnswer(a)])
  }
  for (const a of postTestAnswers) rows.push(['問卷 · 整場結束', a.prompt, fmtAnswer(a)])
  return rows
}
function SurveySection({ heading, taskSurveys, postTestAnswers }: { heading: string; taskSurveys: VariantRun['taskSurveys']; postTestAnswers?: SurveyAnswer[] }) {
  const post = postTestAnswers ?? []
  if (!taskSurveys.length && !post.length) return null
  return (
    <div className="mt-5">
      <p className="text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>{heading}</p>
      {taskSurveys.map((ts) => (
        <div key={ts.taskId} className="mt-3">
          <p className="text-neutral-7" style={{ fontSize: 12, fontWeight: 600 }}>任務:{ts.taskTitle}</p>
          <SurveyAnswerList answers={ts.answers} />
        </div>
      ))}
      {post.length > 0 && (
        <div className="mt-3">
          <p className="text-neutral-7" style={{ fontSize: 12, fontWeight: 600 }}>整場結束問卷</p>
          <SurveyAnswerList answers={post} />
        </div>
      )}
    </div>
  )
}

// ── 單版本結果頁 ─────────────────────────────────────────────────────────────
function SingleResultScreen({ project, run, tester, postTestAnswers, recording, recordingBlob, onReset }: { project: UTProject<any>; run: VariantRun; tester: string; postTestAnswers: SurveyAnswer[]; recording: boolean; recordingBlob: Blob | null; onReset: () => void }) {
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
      ...(run.taskSurveys.length || postTestAnswers.length ? [[], ['類別', '題目', '作答'], ...surveyExcelRows(run.taskSurveys, postTestAnswers)] : []),
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
      ...(run.taskSurveys.length || postTestAnswers.length ? ['', ...surveyTextLines('', run.taskSurveys, postTestAnswers)] : []),
    ]
    copyToClipboard(lines.join('\n'))
  }

  // 到摘要頁:自動下載 Excel,並在錄影就緒後自動下載 webm,各跳 toast。
  const toasts = useAutoDeliver({ excel, recordingBase: `UT-${project.id}-${run.variant}-${tester || 'anon'}`, recording, recordingBlob })

  return (
    <>
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

      <SurveySection heading="問卷回饋" taskSurveys={run.taskSurveys} postTestAnswers={postTestAnswers} />

      <Notice className="mt-5" variant="info" title="把結果交回給研究人員" description="可匯出 Excel 或複製純文字,貼到你們彙整結果的試算表 / 文件。" />
      <ExportBar onExcel={excel} onCopyText={text} onReset={onReset} />
    </ResultShell>
    <ToastHost toasts={toasts} />
    </>
  )
}

// ── 綜合結論(N 個版本)──────────────────────────────────────────────────────
function concludeMulti(runs: VariantRun[]) {
  const total = runs[0]?.total ?? 0
  const max = Math.max(...runs.map((r) => r.successCount))
  const best = runs.filter((r) => r.successCount === max)
  if (best.length === runs.length) {
    return `各版本任務成功數相同(各 ${max}/${total})。建議再參考完成耗時與受測者主觀回饋來判斷。`
  }
  if (best.length > 1) {
    return `${best.map((r) => `版本 ${r.variant}`).join('、')} 並列最高(${max}/${total},${best[0].rate}%);其餘版本較低,可再用耗時 / 回饋區分。`
  }
  const b = best[0]
  const others = runs.filter((r) => r !== b)
  return `版本 ${b.variant}(${b.variantLabel})任務成功率最高:${b.rate}%(${b.successCount}/${b.total}),優於 ${others.map((r) => `版本 ${r.variant} ${r.rate}%`).join('、')},整體易用性表現最佳。`
}
// 放聲思考摘要(關鍵字擷取,彙整進結論)。
function thinkAloudNote(runs: VariantRun[]) {
  if (runs.every((r) => !r.transcript)) return '本次未取得放聲思考逐字稿(未授權麥克風或瀏覽器不支援)。'
  return '放聲思考重點 — ' + runs.map((r) => {
    const d = digestTranscript(r.transcript)
    return `版本 ${r.variant}:${d.length ? d.join(';') : '(無明顯關鍵反饋)'}`
  }).join(' / ') + '。'
}

function CombinedResultScreen({ project, runs, tester, postTestAnswers, recording, recordingBlob, onReset }: { project: UTProject<any>; runs: VariantRun[]; tester: string; postTestAnswers: SurveyAnswer[]; recording: boolean; recordingBlob: Blob | null; onReset: () => void }) {
  const conclusion = concludeMulti(runs)
  const taNote = thinkAloudNote(runs)
  const variantsLabel = runs.map((r) => r.variant).join(' vs ')
  const hasSurvey = runs.some((r) => r.taskSurveys.length > 0) || postTestAnswers.length > 0

  function excel() {
    const taskRows = project.tasks.map((t, i) => {
      const cells: (string | number)[] = [i + 1, t.title]
      runs.forEach((r) => {
        const o = r.outcomes.find((x) => x.id === t.id)
        cells.push(o?.result === 'success' ? '成功' : '失敗', o?.reason ?? '')
      })
      return cells
    })
    const header: string[] = ['#', '任務']
    runs.forEach((r) => header.push(`${r.variant} 結果`, `${r.variant} 失敗原因`))
    const rows: (string | number)[][] = [
      ['測試名稱', project.title],
      ['測試者', tester || '—'],
      ['測試日期', fmtDateTime(runs[0].startedAt)],
      [],
      ...runs.map((r) => [`版本 ${r.variant} 達成率`, `${r.rate}% (${r.successCount}/${r.total})`]),
      ['綜合結論', conclusion],
      ['放聲思考摘要', taNote],
      [],
      header,
      ...taskRows,
      [],
      ...runs.map((r) => [`版本 ${r.variant} 逐字稿`, r.transcript || '(無)']),
      ...(hasSurvey
        ? [[], ['類別', '題目', '作答'],
            ...runs.flatMap((r) => surveyExcelRows(r.taskSurveys, []).map((row) => [`${r.variant} · ${row[0]}`, row[1], row[2]])),
            ...surveyExcelRows([], postTestAnswers)]
        : []),
    ]
    downloadExcel(`UT-${project.id}-${runs.map((r) => r.variant).join('')}-${tester || 'anon'}.xls`, rows)
  }
  function text() {
    const lines = [
      `測試名稱:${project.title}`,
      `測試者:${tester || '—'}`,
      `測試日期:${fmtDateTime(runs[0].startedAt)}`,
      '',
      ...runs.map((r) => `版本 ${r.variant}(${r.variantLabel})達成率:${r.rate}% (${r.successCount}/${r.total})`),
      '',
      '逐項比較:',
      ...project.tasks.map((t, i) => {
        const per = runs.map((r) => {
          const o = r.outcomes.find((x) => x.id === t.id)
          return `     ${r.variant}:${o?.result === 'success' ? '成功' : `失敗(${o?.reason ?? ''})`}`
        }).join('\n')
        return `  ${i + 1}. ${t.title}\n${per}`
      }),
      '',
      `綜合結論:${conclusion}`,
      `${taNote}`,
      '',
      ...runs.map((r) => `版本 ${r.variant} 逐字稿:${r.transcript || '(無)'}`),
      ...(hasSurvey
        ? ['',
            ...runs.flatMap((r) => surveyTextLines(`版本 ${r.variant} `, r.taskSurveys, [])),
            ...surveyTextLines('', [], postTestAnswers)]
        : []),
    ]
    copyToClipboard(lines.join('\n'))
  }

  const Stat = ({ run }: { run: VariantRun }) => (
    <div className="min-w-[150px] flex-1 rounded-lg border border-neutral-4 p-4">
      <p style={{ fontSize: 13, fontWeight: 600 }} className="text-neutral-9">版本 {run.variant}</p>
      <p className="text-neutral-6" style={{ fontSize: 12 }}>{run.variantLabel}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span style={{ fontSize: 28, fontWeight: 700 }} className="text-primary">{run.rate}%</span>
        <span className="text-neutral-7" style={{ fontSize: 12 }}>{run.successCount}/{run.total} 成功</span>
      </div>
      <ProgressBar className="mt-2" value={run.rate} height={6} />
    </div>
  )

  // 到摘要頁:自動下載 Excel,並在錄影就緒後自動下載 webm,各跳 toast。
  const toasts = useAutoDeliver({ excel, recordingBase: `UT-${project.id}-${runs.map((r) => r.variant).join('')}-${tester || 'anon'}`, recording, recordingBlob })

  return (
    <>
    <ResultShell badge={`綜合測試結果 · 版本 ${variantsLabel}`}>
      <h1 className="text-neutral-9" style={{ fontSize: 22, fontWeight: 600, lineHeight: '130%' }}>{project.title}</h1>
      <div className="mt-2 text-neutral-8" style={{ fontSize: 13 }}>
        <span className="text-neutral-6">測試者:</span> <b>{tester || '—'}</b>
        <span className="ml-4 text-neutral-6">測試日期:</span> {fmtDateTime(runs[0].startedAt)}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {runs.map((r) => <Stat key={r.variant} run={r} />)}
      </div>

      <div className="mt-4 rounded-lg p-4" style={{ backgroundColor: 'var(--color-info-subtle)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-info-text)' }}>綜合結論</p>
        <p className="mt-1" style={{ fontSize: 13, lineHeight: '150%', color: 'var(--color-info-text)' }}>{conclusion}</p>
        <p className="mt-2" style={{ fontSize: 12, lineHeight: '150%', color: 'var(--color-info-text)' }}>{taNote}</p>
      </div>

      {runs.map((r) => (
        <div key={r.variant}>
          <p className="mt-5 text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>版本 {r.variant} 逐項</p>
          <OutcomeList outcomes={r.outcomes} />
          <TranscriptBlock title={`版本 ${r.variant} 放聲思考逐字稿`} transcript={r.transcript} />
          <SurveySection heading={`版本 ${r.variant} 問卷回饋`} taskSurveys={r.taskSurveys} />
        </div>
      ))}

      <SurveySection heading="整場結束問卷" taskSurveys={[]} postTestAnswers={postTestAnswers} />

      <Notice className="mt-5" variant="info" title="把綜合結果交回給研究人員" description="可匯出 Excel(含各版逐項比較、結論、逐字稿、問卷)或複製純文字。" />
      <ExportBar onExcel={excel} onCopyText={text} onReset={onReset} />
    </ResultShell>
    <ToastHost toasts={toasts} />
    </>
  )
}

// ── 對外:單版本流程(VersionA / VersionB 用)────────────────────────────────
export function UsabilityTest<A>({ project, variant, password = '0000', record = false }: { project: UTProject<A>; variant: string; password?: string; record?: boolean }) {
  const [unlocked, setUnlocked] = useState(false)
  const [phase, setPhase] = useState<'intro' | 'running' | 'posttest' | 'done'>('intro')
  const [tester, setTester] = useState('')
  const [run, setRun] = useState<VariantRun | null>(null)
  const [postTest, setPostTest] = useState<SurveyAnswer[]>([])
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const postTestQs = project.postTestSurvey ?? []
  const rec = useScreenRecorder()

  // 進入摘要頁時停止錄製,取回 webm blob。
  useEffect(() => { if (phase === 'done') rec.stop().then(setRecordingBlob) }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!unlocked) return <PasswordGate password={password} onUnlock={() => setUnlocked(true)} />

  if (phase === 'intro') {
    return (
      <IntroScreen
        project={project}
        badge={`Usability Test · 版本 ${variant}`}
        note={<>本次共 <b>{project.tasks.length}</b> 項任務,進行中右下角會出現任務指示框。<b>必須實際完成</b>指定操作才算成功。{record && <><br />開始後會請你<b>分享畫面</b>以錄製測試過程(畫面 + 你的講話聲),結束自動下載。</>}</>}
        tester={tester}
        onTesterChange={setTester}
        onStart={() => { if (tester.trim()) { if (record) rec.start(); setPhase('running') } }}
      />
    )
  }
  if (phase === 'running') {
    return <RunPhase project={project} variant={variant} onDone={(r) => { setRun(r); setPhase(postTestQs.length ? 'posttest' : 'done') }} />
  }
  if (phase === 'posttest') {
    return (
      <SurveyStep
        badge="測試結束問卷"
        title="最後幾個整體問題"
        questions={postTestQs}
        submitLabel="送出並查看結果"
        onSubmit={(a) => { setPostTest(a); setPhase('done') }}
      />
    )
  }
  return <SingleResultScreen project={project} run={run!} tester={tester} postTestAnswers={postTest} recording={record && rec.started} recordingBlob={recordingBlob} onReset={() => { setPhase('intro'); setTester(''); setRun(null); setPostTest([]); setRecordingBlob(null) }} />
}

// ── 對外:多版本綜合流程(A→B→C…,依序跑完給綜合結論)──────────────────────
export function UsabilityTestAB<A>({ project, order = ['A', 'B'], password = '0000', record = false }: { project: UTProject<A>; order?: string[]; password?: string; record?: boolean }) {
  const [unlocked, setUnlocked] = useState(false)
  const [phase, setPhase] = useState<'intro' | 'run' | 'interstitial' | 'posttest' | 'done'>('intro')
  const [tester, setTester] = useState('')
  const [vIndex, setVIndex] = useState(0)
  const [runs, setRuns] = useState<VariantRun[]>([])
  const [postTest, setPostTest] = useState<SurveyAnswer[]>([])
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const postTestQs = project.postTestSurvey ?? []
  const rec = useScreenRecorder()

  function reset() { setPhase('intro'); setTester(''); setVIndex(0); setRuns([]); setPostTest([]); setRecordingBlob(null) }
  const orderLabel = order.map((v) => `版本 ${v}`).join(' → ')

  // 進入摘要頁時停止錄製,取回 webm blob。
  useEffect(() => { if (phase === 'done') rec.stop().then(setRecordingBlob) }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!unlocked) return <PasswordGate password={password} onUnlock={() => setUnlocked(true)} />

  if (phase === 'intro') {
    return (
      <IntroScreen
        project={project}
        badge={`Usability Test · 綜合測試 ${order.join(' → ')}`}
        note={<>你會<b>依序體驗 {order.length} 個版本({orderLabel})</b>,每版各 <b>{project.tasks.length}</b> 項任務。全部完成後會看到各版比較與綜合結論。{record && <><br />開始後會請你<b>分享畫面</b>以錄製測試過程(畫面 + 你的講話聲),結束自動下載。</>}</>}
        tester={tester}
        onTesterChange={setTester}
        onStart={() => { if (tester.trim()) { if (record) rec.start(); setPhase('run') } }}
      />
    )
  }
  if (phase === 'run') {
    const variant = order[vIndex]
    return (
      <RunPhase
        key={variant}
        project={project}
        variant={variant}
        onDone={(r) => {
          setRuns((prev) => [...prev, r])
          if (vIndex >= order.length - 1) setPhase(postTestQs.length ? 'posttest' : 'done')
          else setPhase('interstitial')
        }}
      />
    )
  }
  if (phase === 'interstitial') {
    const doneV = order[vIndex]
    const nextV = order[vIndex + 1]
    return (
      <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-[480px] rounded-xl border border-neutral-5 bg-surface p-8 text-center shadow-lg">
          <Chip tone="success" className="mb-3">版本 {doneV} 完成({vIndex + 1}/{order.length})</Chip>
          <h2 className="text-neutral-9" style={{ fontSize: 18, fontWeight: 600 }}>接下來進行版本 {nextV}</h2>
          <p className="mt-2 text-neutral-7" style={{ fontSize: 13, lineHeight: '150%' }}>
            版本 {doneV} 的任務已完成。按下方按鈕,用同樣的方式完成版本 {nextV} 的任務。
          </p>
          <Button variant="primary" className="mt-5 w-full" startIcon={ArrowRight} onClick={() => { setVIndex(vIndex + 1); setPhase('run') }}>
            開始版本 {nextV} 測試
          </Button>
        </div>
      </div>
    )
  }
  if (phase === 'posttest') {
    return (
      <SurveyStep
        badge="測試結束問卷"
        title="最後幾個整體問題"
        questions={postTestQs}
        submitLabel="送出並查看結果"
        onSubmit={(a) => { setPostTest(a); setPhase('done') }}
      />
    )
  }
  return <CombinedResultScreen project={project} runs={runs} tester={tester} postTestAnswers={postTest} recording={record && rec.started} recordingBlob={recordingBlob} onReset={reset} />
}
