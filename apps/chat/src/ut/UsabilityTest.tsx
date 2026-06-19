// ════════════════════════════════════════════════════════════════════════════
// Usability-testing 通用模組(單檔):型別 + Chip + 懸浮任務面板 + 三階段外殼。
// 包住任一聊天變體跑「intro → 任務 → 結果」,可重用於任何 UT 專案。
// (刻意合併成單檔,方便在 GitHub 網頁手動建立。)
// ════════════════════════════════════════════════════════════════════════════
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Input, ProgressBar, Notice } from '@qijenchen/design-system'
import {
  ClipboardList, Target, Info, Copy, Download, RotateCcw, Check,
  SkipForward, GripVertical, ChevronDown, ChevronUp,
} from 'lucide-react'
import App, { type ChatVariantConfig } from '../App'

// ── 型別 ──────────────────────────────────────────────────────────────────
/** 單一任務指示。 */
export type UTask = {
  id: string
  title: string
  hint?: string
}
/** 一個變體(A / B …)= 一段給基底 App 的 config + 一個給人看的標籤。 */
export type UTVariant = {
  label: string
  config: ChatVariantConfig
}
/** 一個 UT 專案 = 測試中繼資料 + 任務清單 + 各變體設定。 */
export type UTProject = {
  id: string
  title: string
  goal: string
  instructions: string[]
  tasks: UTask[]
  variants: Record<string, UTVariant>
}
export type UTaskResult = 'done' | 'skipped'
/** 整場測試的彙整結果(供結果畫面顯示 + 匯出)。 */
export type UTSession = {
  projectId: string
  projectTitle: string
  variant: string
  variantLabel: string
  tester: string
  startedAt: string
  finishedAt: string
  durationMs: number
  tasks: { id: string; title: string; result: UTaskResult }[]
  completedCount: number
  totalCount: number
  completionRate: number
}

// ── 小色票 chip(DS Badge 不吃文字 children 且無語意色階,故自製)──────────────
type Tone = 'neutral' | 'info' | 'success' | 'warning'
const TONE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--color-neutral-3)', fg: 'var(--color-neutral-8)' },
  info: { bg: 'var(--color-info-subtle)', fg: 'var(--color-info-text)' },
  success: { bg: 'var(--color-success-subtle)', fg: 'var(--color-success-text)' },
  warning: { bg: 'var(--color-warning-subtle)', fg: 'var(--color-warning-text)' },
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

// ── 懸浮任務指示視窗(右下角,可拖曳、可收合)─────────────────────────────────
function TaskPanel({
  tasks, index, results, onResolve, onFinish,
}: {
  tasks: UTask[]
  index: number
  results: Record<string, UTaskResult>
  onResolve: (id: string, result: UTaskResult) => void
  onFinish: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)

  const total = tasks.length
  const doneCount = Object.values(results).filter((r) => r === 'done').length
  const current = tasks[index]
  const isLast = index >= total - 1
  const allResolved = Object.keys(results).length >= total

  function startDrag(e: React.PointerEvent) {
    const rect = (e.currentTarget.closest('[data-task-panel]') as HTMLElement).getBoundingClientRect()
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onDrag(e: React.PointerEvent) {
    if (!dragRef.current) return
    setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy })
  }
  function endDrag() {
    dragRef.current = null
  }

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 24, bottom: 24 }

  return (
    <div
      data-task-panel
      className="fixed z-[1000] w-[320px] rounded-xl border border-neutral-5 bg-surface shadow-lg"
      style={style}
    >
      <div
        className="flex cursor-grab items-center gap-2 border-b border-neutral-4 px-3 py-2 active:cursor-grabbing"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
      >
        <GripVertical size={14} className="text-neutral-6" />
        <ClipboardList size={16} className="text-primary" />
        <span style={{ fontSize: 13, fontWeight: 600 }} className="text-neutral-9">任務指示</span>
        <Chip className="ml-auto">{Math.min(index + 1, total)} / {total}</Chip>
        <Button
          variant="text"
          size="sm"
          iconOnly
          startIcon={collapsed ? ChevronUp : ChevronDown}
          aria-label={collapsed ? '展開' : '收合'}
          onClick={() => setCollapsed((v) => !v)}
          className="!h-6 !w-6 !min-w-0 !p-0"
        />
      </div>

      {!collapsed && (
        <div className="px-3 py-3">
          <ProgressBar value={total ? (doneCount / total) * 100 : 0} height={6} />
          <div className="mt-1 text-right" style={{ fontSize: 11 }}>
            <span className="text-neutral-7">已完成 {doneCount} / {total}</span>
          </div>

          {!allResolved && current ? (
            <>
              <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, lineHeight: '150%' }}>
                {current.title}
              </p>
              {current.hint && (
                <p className="mt-1 text-neutral-7" style={{ fontSize: 12, lineHeight: '140%' }}>
                  {current.hint}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" startIcon={SkipForward} onClick={() => onResolve(current.id, 'skipped')}>
                  跳過
                </Button>
                <Button variant="primary" size="sm" startIcon={Check} className="ml-auto" onClick={() => onResolve(current.id, 'done')}>
                  {isLast ? '完成最後一項' : '完成,下一步'}
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-2">
              <p style={{ fontSize: 14, fontWeight: 500 }}>所有任務已處理完畢 🎉</p>
              <Button variant="primary" size="sm" className="mt-3 w-full" onClick={onFinish}>
                查看測試結果
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 工具 ──────────────────────────────────────────────────────────────────
function fmtDateTime(d: Date) {
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ── 主外殼:intro → running → done ──────────────────────────────────────────
export function UsabilityTest({ project, variant }: { project: UTProject; variant: string }) {
  const v = project.variants[variant]
  const [phase, setPhase] = useState<'intro' | 'running' | 'done'>('intro')
  const [tester, setTester] = useState('')
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [finishedAt, setFinishedAt] = useState<Date | null>(null)
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<Record<string, UTaskResult>>({})

  function start() {
    if (!tester.trim()) return
    setStartedAt(new Date())
    setPhase('running')
  }
  function resolve(id: string, result: UTaskResult) {
    setResults((r) => ({ ...r, [id]: result }))
    setIndex((i) => i + 1)
  }
  function finish() {
    setFinishedAt(new Date())
    setPhase('done')
  }
  function reset() {
    setPhase('intro'); setTester(''); setStartedAt(null); setFinishedAt(null); setIndex(0); setResults({})
  }

  if (phase === 'intro') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-[560px] rounded-xl border border-neutral-5 bg-surface p-8 shadow-lg">
          <Chip tone="info" className="mb-3">Usability Test · 版本 {variant}</Chip>
          <h1 className="text-neutral-9" style={{ fontSize: 22, fontWeight: 600, lineHeight: '130%' }}>
            {project.title}
          </h1>
          <p className="mt-1 text-neutral-7" style={{ fontSize: 13 }}>{v.label}</p>

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
            <p className="text-neutral-8" style={{ fontSize: 13 }}>
              本次共 <b>{project.tasks.length}</b> 項任務,進行中右下角會出現任務指示框。
            </p>
          </div>

          <label className="mt-6 block" style={{ fontSize: 13, fontWeight: 600 }}>請輸入你的姓名</label>
          <Input
            className="mt-1.5"
            placeholder="例如:王小明"
            value={tester}
            onChange={(e) => setTester(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') start() }}
          />

          <Button variant="primary" className="mt-5 w-full" disabled={!tester.trim()} onClick={start}>
            確認並開始測試
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'running') {
    return (
      <div className="relative h-screen w-full">
        <App config={v.config} />
        <TaskPanel tasks={project.tasks} index={index} results={results} onResolve={resolve} onFinish={finish} />
      </div>
    )
  }

  return (
    <ResultScreen
      project={project}
      variant={variant}
      variantLabel={v.label}
      tester={tester}
      startedAt={startedAt!}
      finishedAt={finishedAt!}
      results={results}
      onReset={reset}
    />
  )
}

// ── 結果畫面 ───────────────────────────────────────────────────────────────
function ResultScreen({
  project, variant, variantLabel, tester, startedAt, finishedAt, results, onReset,
}: {
  project: UTProject
  variant: string
  variantLabel: string
  tester: string
  startedAt: Date
  finishedAt: Date
  results: Record<string, UTaskResult>
  onReset: () => void
}) {
  const [copied, setCopied] = useState(false)

  const session: UTSession = useMemo(() => {
    const tasks = project.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      result: (results[t.id] ?? 'skipped') as UTaskResult,
    }))
    const completedCount = tasks.filter((t) => t.result === 'done').length
    const totalCount = tasks.length
    return {
      projectId: project.id,
      projectTitle: project.title,
      variant,
      variantLabel,
      tester,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      tasks,
      completedCount,
      totalCount,
      completionRate: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
    }
  }, [project, variant, variantLabel, tester, startedAt, finishedAt, results])

  const durationMin = Math.max(1, Math.round(session.durationMs / 60000))
  const json = JSON.stringify(session, null, 2)

  async function copy() {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard 不可用時忽略,使用者可改用下載 */ }
  }
  function download() {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ut-${project.id}-${variant}-${tester || 'anon'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-[600px] rounded-xl border border-neutral-5 bg-surface p-8 shadow-lg">
        <Chip tone="info" className="mb-3">測試結果 · 版本 {variant}</Chip>
        <h1 className="text-neutral-9" style={{ fontSize: 22, fontWeight: 600, lineHeight: '130%' }}>
          {project.title}
        </h1>

        <div className="mt-5 rounded-lg border border-neutral-4 p-4">
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: 36, fontWeight: 700 }} className="text-primary">{session.completionRate}%</span>
            <span className="text-neutral-7" style={{ fontSize: 13 }}>
              任務達成率({session.completedCount} / {session.totalCount} 完成)
            </span>
          </div>
          <ProgressBar className="mt-2" value={session.completionRate} height={8} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-neutral-8" style={{ fontSize: 13 }}>
          <div><span className="text-neutral-6">測試者:</span> <b>{tester || '—'}</b></div>
          <div><span className="text-neutral-6">版本:</span> {variant}({variantLabel})</div>
          <div><span className="text-neutral-6">測試日期:</span> {fmtDateTime(startedAt)}</div>
          <div><span className="text-neutral-6">耗時:</span> 約 {durationMin} 分鐘</div>
        </div>

        <p className="mt-5 text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>任務 Summary</p>
        <ul className="mt-2 space-y-1.5">
          {session.tasks.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2" style={{ fontSize: 13 }}>
              <Chip tone={t.result === 'done' ? 'success' : 'warning'}>
                {t.result === 'done' ? '完成' : '跳過'}
              </Chip>
              <span className="text-neutral-8">{i + 1}. {t.title}</span>
            </li>
          ))}
        </ul>

        <Notice
          className="mt-5"
          variant="info"
          title="把結果交回給研究人員"
          description="複製或下載下方 JSON,貼到你們收集結果的試算表 / 文件即可彙整多位受測者。"
        />

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" startIcon={copied ? Check : Copy} onClick={copy}>
            {copied ? '已複製' : '複製結果 JSON'}
          </Button>
          <Button variant="secondary" startIcon={Download} onClick={download}>
            下載 JSON
          </Button>
          <Button variant="text" startIcon={RotateCcw} className="ml-auto" onClick={onReset}>
            重新測試
          </Button>
        </div>
      </div>
    </div>
  )
}
