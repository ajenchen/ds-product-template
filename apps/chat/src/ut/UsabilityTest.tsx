// ════════════════════════════════════════════════════════════════════════════
// Usability-testing 通用模組(單檔):型別 + Chip + 懸浮任務面板 + 單版/雙版流程 + 結果頁。
//  - 任務成功/失敗由「使用者實際操作(ChatAction)」判定,不是按鈕點了就算成功。
//  - 結果頁:成功/失敗 + 失敗原因;可匯出 Excel、複製純文字。
//  - 支援 A→B 雙版本流程,最後給綜合結論。
// (刻意合併成單檔,方便在 GitHub 網頁手動維護。)
// ════════════════════════════════════════════════════════════════════════════
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Input, ProgressBar, Notice } from '@qijenchen/design-system'
import {
  ClipboardList, Target, Info, FileSpreadsheet, ClipboardCopy, RotateCcw, Check, ArrowRight,
  GripVertical, ChevronDown, ChevronUp, CheckCircle2, XCircle,
} from 'lucide-react'
import App, { type ChatVariantConfig, type ChatAction } from '../App'

// ── 型別 ──────────────────────────────────────────────────────────────────
export type UTaskResult = 'success' | 'fail'
/** 單一任務。check 依「任務進行期間累積的操作」判定成功與否。 */
export type UTask = {
  id: string
  title: string
  hint?: string
  check: (actions: ChatAction[]) => { ok: boolean; reason?: string }
}
export type UTVariant = { label: string; config: ChatVariantConfig }
export type UTProject = {
  id: string
  title: string
  goal: string
  instructions: string[]
  tasks: UTask[]
  variants: Record<string, UTVariant>
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

// ── 懸浮任務指示視窗(右下角,可拖曳、可收合)─────────────────────────────────
function TaskPanel({
  tasks, index, onComplete,
}: {
  tasks: UTask[]
  index: number
  onComplete: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)

  const total = tasks.length
  const current = tasks[index]
  const isLast = index >= total - 1

  function startDrag(e: React.PointerEvent) {
    const rect = (e.currentTarget.closest('[data-task-panel]') as HTMLElement).getBoundingClientRect()
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onDrag(e: React.PointerEvent) {
    if (!dragRef.current) return
    setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy })
  }
  function endDrag() { dragRef.current = null }

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 24, bottom: 24 }

  return (
    <div data-task-panel className="fixed z-[1000] w-[320px] rounded-xl border border-neutral-5 bg-surface shadow-lg" style={style}>
      <div
        className="flex cursor-grab items-center gap-2 border-b border-neutral-4 px-3 py-2 active:cursor-grabbing"
        onPointerDown={startDrag} onPointerMove={onDrag} onPointerUp={endDrag}
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
function RunPhase({ project, variant, onDone }: { project: UTProject; variant: string; onDone: (run: VariantRun) => void }) {
  const v = project.variants[variant]
  const actionsRef = useRef<ChatAction[]>([])
  const taskStartRef = useRef(0)
  const outcomesRef = useRef<TaskOutcome[]>([])
  const startedRef = useRef<Date>(new Date())
  const [index, setIndex] = useState(0)

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
      onDone({
        variant,
        variantLabel: v.label,
        outcomes,
        successCount,
        total,
        rate: total ? Math.round((successCount / total) * 100) : 0,
        startedAt: startedRef.current,
        finishedAt: new Date(),
      })
    } else {
      setIndex(index + 1)
    }
  }

  return (
    <div className="relative h-screen w-full">
      <App config={v.config} onAction={(a) => { actionsRef.current.push(a) }} />
      <div className="pointer-events-none fixed left-1/2 top-3 z-[1000] -translate-x-1/2">
        <Chip tone="info">測試進行中 · 版本 {variant}</Chip>
      </div>
      <TaskPanel tasks={project.tasks} index={index} onComplete={complete} />
    </div>
  )
}

// ── intro 畫面 ──────────────────────────────────────────────────────────────
function IntroScreen({
  project, badge, note, tester, onTesterChange, onStart,
}: {
  project: UTProject
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
function SingleResultScreen({ project, run, tester, onReset }: { project: UTProject; run: VariantRun; tester: string; onReset: () => void }) {
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

function CombinedResultScreen({ project, runA, runB, tester, onReset }: { project: UTProject; runA: VariantRun; runB: VariantRun; tester: string; onReset: () => void }) {
  const conclusion = concludeText(runA, runB)

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
      [],
      ['#', '任務', 'A 結果', 'A 失敗原因', 'B 結果', 'B 失敗原因'],
      ...taskRows,
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
      </div>

      <p className="mt-5 text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>版本 A 逐項</p>
      <OutcomeList outcomes={runA.outcomes} />
      <p className="mt-4 text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>版本 B 逐項</p>
      <OutcomeList outcomes={runB.outcomes} />

      <Notice className="mt-5" variant="info" title="把綜合結果交回給研究人員" description="可匯出 Excel(含 A/B 逐項比較與結論)或複製純文字。" />
      <ExportBar onExcel={excel} onCopyText={text} onReset={onReset} />
    </ResultShell>
  )
}

// ── 對外:單版本流程(VersionA / VersionB 用)────────────────────────────────
export function UsabilityTest({ project, variant }: { project: UTProject; variant: string }) {
  const [phase, setPhase] = useState<'intro' | 'running' | 'done'>('intro')
  const [tester, setTester] = useState('')
  const [run, setRun] = useState<VariantRun | null>(null)

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
export function UsabilityTestAB({ project, order = ['A', 'B'] }: { project: UTProject; order?: [string, string] }) {
  const [vA, vB] = order
  const [phase, setPhase] = useState<'intro' | 'runA' | 'interstitial' | 'runB' | 'done'>('intro')
  const [tester, setTester] = useState('')
  const [runA, setRunA] = useState<VariantRun | null>(null)
  const [runB, setRunB] = useState<VariantRun | null>(null)

  function reset() { setPhase('intro'); setTester(''); setRunA(null); setRunB(null) }

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
