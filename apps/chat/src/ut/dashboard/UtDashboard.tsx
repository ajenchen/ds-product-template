// UT 結果 Dashboard — 可分享 + 可導出的易用性測試結果總覽。
//
// 資料流:正式站台向 Netlify function `/.netlify/functions/ut-data`(用 service_role 讀 Supabase,
// 個資不經 public anon key)取 ut_results,整個站台掛在 Netlify Basic Auth(edge function)後面。
// 本地 Storybook 沒 function → 可傳 `rows` prop 直接餵資料(見 sampleData.ts / stories)。
//
// 視覺:控制項用 DS primitive(Button / Select / Notice / Tabs);stat 卡片 / 成功率長條 / 表格
// 沿用 @imethan0254/ut-model-a 引擎既有的 token 視覺語言(inline CSS var + tailwind layout),
// 與 sibling UT code 一致。

import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  Notice,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@qijenchen/design-system'
import { Download, FileDown, FileText, Lock, LogOut, Printer, RefreshCw } from 'lucide-react'
import type { Session, SurveyAnswer, UTRow } from './types'
import { overview, taskAggregates, testIds, toSessions, variantAggregates } from './analytics'
import { downloadText, exportFilename, printReport, quantCsv, rawCsv, transcriptCsv } from './exports'

const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}
const DEFAULT_ENDPOINT = metaEnv.VITE_UT_DATA_URL ?? '/.netlify/functions/ut-data'

export type UtDashboardProps = {
  /** 直接餵資料(story / 測試 / 離線預覽)。不傳則向 endpoint fetch。 */
  rows?: UTRow[]
  /** 資料來源;預設 Netlify function。 */
  endpoint?: string
}

type LoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'need-key'; message?: string; wrong?: boolean }
  | { status: 'error'; message: string; detail?: string }
  | { status: 'ready'; rows: UTRow[] }

// 分析者密碼只暫存在 sessionStorage(關分頁即失效),永不進 bundle。
const SS_DASH_KEY = 'ut_dash_key'
function readDashKey(): string {
  try {
    return sessionStorage.getItem(SS_DASH_KEY) ?? ''
  } catch {
    return ''
  }
}
function writeDashKey(v: string) {
  try {
    if (v) sessionStorage.setItem(SS_DASH_KEY, v)
    else sessionStorage.removeItem(SS_DASH_KEY)
  } catch {
    /* sessionStorage 不可用時忽略 */
  }
}

// ── 小工具:tone / 格式 ─────────────────────────────────────────────────────
type Tone = 'success' | 'warning' | 'error' | 'neutral'
function rateTone(rate: number): Tone {
  if (rate >= 75) return 'success'
  if (rate >= 50) return 'warning'
  return 'error'
}
const TONE_BG: Record<Tone, string> = {
  success: 'var(--color-success-subtle)',
  warning: 'var(--color-warning-subtle)',
  error: 'var(--color-error-subtle)',
  neutral: 'var(--color-neutral-3)',
}
const TONE_FG: Record<Tone, string> = {
  success: 'var(--color-success-text)',
  warning: 'var(--color-warning-text)',
  error: 'var(--color-error-text)',
  neutral: 'var(--color-neutral-8)',
}
function fmtDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ── 原子:Chip / StatCard / Bar ────────────────────────────────────────────
function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-[4px] px-1.5 py-0.5"
      style={{ backgroundColor: TONE_BG[tone], color: TONE_FG[tone], fontSize: 12, fontWeight: 600 }}
    >
      {children}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div
      className="rounded-lg p-4 flex-1"
      style={{ minWidth: 140, backgroundColor: 'var(--color-neutral-2)', border: '1px solid var(--color-neutral-4)' }}
    >
      <div className="text-neutral-6" style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
      <div className="text-neutral-9" style={{ fontSize: 26, fontWeight: 700, lineHeight: '120%', marginTop: 2 }}>{value}</div>
      {sub && <div className="text-neutral-6" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function RateBar({ rate }: { rate: number }) {
  const tone = rateTone(rate)
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 160 }}>
      <div className="rounded-full" style={{ flex: 1, height: 8, backgroundColor: 'var(--color-neutral-3)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, rate))}%`, height: '100%', backgroundColor: TONE_FG[tone] }} />
      </div>
      <span className="text-neutral-8 tabular-nums" style={{ fontSize: 13, fontWeight: 600, width: 40, textAlign: 'right' }}>{rate}%</span>
    </div>
  )
}

// ── 表格外殼(token 樣式,對齊引擎 idiom)───────────────────────────────────
function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th className="text-neutral-6" style={{ fontSize: 12, fontWeight: 600, textAlign: align, padding: '8px 12px', borderBottom: '1px solid var(--color-neutral-4)', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  )
}
function Td({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <td className="text-neutral-9" style={{ fontSize: 13, textAlign: align, padding: '8px 12px', borderBottom: '1px solid var(--color-neutral-3)', verticalAlign: 'top' }}>
      {children}
    </td>
  )
}

// ── 場次詳情(inline 展開)──────────────────────────────────────────────────
function openAnswerLines(answers: SurveyAnswer[]): string[] {
  return answers
    .filter((a) => a.questionType === 'writtenResponse' && String(a.value ?? '').trim())
    .map((a) => `${a.prompt}:${String(a.value).trim()}`)
}
function SessionDetail({ session }: { session: Session }) {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-neutral-2)', border: '1px solid var(--color-neutral-4)' }}>
      {session.conclusion && (
        <div className="mb-3">
          <div className="text-neutral-6" style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>結論</div>
          <div className="text-neutral-9" style={{ fontSize: 13, lineHeight: '150%' }}>{session.conclusion}</div>
        </div>
      )}
      {session.runs.map((run) => (
        <div key={run.variant} className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Chip tone="neutral">版本 {run.variant}</Chip>
            <span className="text-neutral-8" style={{ fontSize: 13 }}>{run.variantLabel}</span>
            <Chip tone={rateTone(run.rate)}>{run.rate}%（{run.successCount}/{run.total}）</Chip>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {run.outcomes.map((o, i) => (
              <li key={`${o.id}-${i}`} className="text-neutral-8" style={{ fontSize: 12.5, lineHeight: '160%' }}>
                <span style={{ color: o.result === 'success' ? 'var(--color-success-text)' : 'var(--color-error-text)', fontWeight: 600 }}>
                  {o.result === 'success' ? '✔' : '✗'}
                </span>{' '}
                {o.title}{o.reason ? ` — ${o.reason}` : ''}
              </li>
            ))}
          </ul>
          {run.transcript && (
            <div className="text-neutral-6" style={{ fontSize: 12, marginTop: 4, whiteSpace: 'pre-wrap' }}>
              逐字稿:{run.transcript}
            </div>
          )}
          {run.taskSurveys.flatMap((ts) => openAnswerLines(ts.answers)).map((line, i) => (
            <div key={i} className="text-neutral-6" style={{ fontSize: 12, marginTop: 2 }}>· {line}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── 主元件 ─────────────────────────────────────────────────────────────────
export function UtDashboard({ rows, endpoint = DEFAULT_ENDPOINT }: UtDashboardProps) {
  const [load, setLoad] = useState<LoadState>(rows ? { status: 'ready', rows } : { status: 'idle' })
  const [testId, setTestId] = useState<string>('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('') // ISO YYYY-MM-DD;'' = 不限
  const [dateTo, setDateTo] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()) // 場次明細勾選(導出用)

  async function fetchRows(overrideKey?: string) {
    const dashKey = overrideKey ?? readDashKey()
    setLoad({ status: 'loading' })
    try {
      const headers: Record<string, string> = { accept: 'application/json' }
      if (dashKey) headers['x-ut-dashboard-key'] = dashKey
      const res = await fetch(endpoint, { headers })
      const body = (await res.json().catch(() => ({}))) as { rows?: UTRow[]; error?: string; message?: string }
      // 需要分析者密碼(或密碼錯誤)→ 顯示解鎖畫面,不當一般錯誤。
      if (res.status === 401 && body.error === 'dashboard_auth_required') {
        writeDashKey('') // 清掉不對的舊 key
        setLoad({ status: 'need-key', message: body.message, wrong: !!dashKey })
        return
      }
      if (!res.ok || body.error) {
        setLoad({ status: 'error', message: body.message ?? `讀取失敗(HTTP ${res.status})`, detail: body.error })
        return
      }
      setLoad({ status: 'ready', rows: body.rows ?? [] })
    } catch (e) {
      setLoad({ status: 'error', message: '無法連到資料來源(本地 Storybook 沒有 Netlify function 屬正常)。', detail: String((e as Error)?.message ?? e) })
    }
  }

  function unlock() {
    const k = keyInput.trim()
    if (!k) return
    writeDashKey(k)
    setKeyInput('')
    void fetchRows(k)
  }
  function lock() {
    writeDashKey('')
    setLoad({ status: 'need-key' })
  }

  useEffect(() => {
    if (rows) {
      setLoad({ status: 'ready', rows })
    } else if (load.status === 'idle') {
      void fetchRows()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const allSessions = useMemo(() => (load.status === 'ready' ? toSessions(load.rows) : []), [load])
  const ids = useMemo(() => testIds(allSessions), [allSessions])

  // 預設選第一個 test_id。
  useEffect(() => {
    if (ids.length && !ids.includes(testId)) setTestId(ids[0])
  }, [ids, testId])

  // 篩選:test_id + 日期範圍(比對 created_at 的 YYYY-MM-DD,字串比較即可)。
  const sessions = useMemo(
    () =>
      allSessions.filter((s) => {
        if (s.testId !== testId) return false
        const d = s.createdAt.slice(0, 10)
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
        return true
      }),
    [allSessions, testId, dateFrom, dateTo],
  )
  const ov = useMemo(() => overview(sessions), [sessions])
  const variantAgg = useMemo(() => variantAggregates(sessions), [sessions])
  const taskAgg = useMemo(() => taskAggregates(sessions), [sessions])

  // 篩選集變動 → 勾選預設全選(依當前 sessions 的 id 集合)。
  const sessionIdKey = sessions.map((s) => s.id).join(',')
  useEffect(() => {
    setSelectedIds(new Set(sessions.map((s) => s.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdKey])

  const selectedSessions = useMemo(() => sessions.filter((s) => selectedIds.has(s.id)), [sessions, selectedIds])
  const allChecked = sessions.length > 0 && selectedIds.size === sessions.length
  const someChecked = selectedIds.size > 0 && !allChecked

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelectedIds(allChecked ? new Set() : new Set(sessions.map((s) => s.id)))
  }

  // 導出一律走「已勾選」的場次(預設全選)。
  const doExport = (kind: 'quant' | 'transcript' | 'raw') => {
    const src = selectedSessions
    const csv = kind === 'quant' ? quantCsv(src) : kind === 'transcript' ? transcriptCsv(src) : rawCsv(src)
    downloadText(exportFilename(kind, testId), csv)
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 24 }}>
      <style>{`@media print { .ut-dash-toolbar { display: none !important; } }`}</style>

      {/* 標題 + 篩選 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-neutral-9" style={{ fontSize: 22, fontWeight: 700 }}>UT 結果 Dashboard</h1>
          <p className="text-neutral-6" style={{ fontSize: 13, marginTop: 2 }}>易用性測試結果總覽 —— 各版本 / 各任務成功率、SEQ、逐字稿,可篩選與導出。</p>
        </div>
        <div className="ut-dash-toolbar flex items-center gap-2">
          {ids.length > 0 && (
            <Select
              aria-label="選擇測試"
              value={testId}
              onChange={setTestId}
              options={ids.map((id) => ({ value: id, label: id }))}
              size="sm"
            />
          )}
          {!rows && (
            <Button className="shrink-0" variant="tertiary" size="sm" startIcon={RefreshCw} onClick={() => void fetchRows()}>
              重新整理
            </Button>
          )}
          {!rows && load.status === 'ready' && readDashKey() && (
            <Button className="shrink-0" variant="tertiary" size="sm" startIcon={LogOut} onClick={lock}>
              鎖定
            </Button>
          )}
        </div>
      </div>

      {/* 分析者密碼閘門 */}
      {load.status === 'need-key' && (
        <div style={{ maxWidth: 380, margin: '56px auto 0', textAlign: 'center' }}>
          <div
            className="inline-flex items-center justify-center rounded-full"
            style={{ width: 48, height: 48, backgroundColor: 'var(--color-neutral-3)', marginBottom: 12 }}
          >
            <Lock size={22} style={{ color: 'var(--color-neutral-7)' }} />
          </div>
          <h2 className="text-neutral-9" style={{ fontSize: 17, fontWeight: 600 }}>需要分析者密碼</h2>
          <p className="text-neutral-6" style={{ fontSize: 13, marginTop: 4 }}>
            這份結果含受測者個資,僅限負責分析的人檢視。請輸入分析者密碼。
          </p>
          {load.wrong && (
            <p style={{ fontSize: 12, marginTop: 8, color: 'var(--color-error-text)' }}>密碼不正確,請再試一次。</p>
          )}
          <div className="flex items-center gap-2" style={{ marginTop: 16 }}>
            <Input
              type="password"
              placeholder="分析者密碼"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') unlock() }}
              autoFocus
              style={{ flex: 1 }}
            />
            <Button variant="primary" onClick={unlock} disabled={!keyInput.trim()}>解鎖</Button>
          </div>
        </div>
      )}

      {/* 載入 / 錯誤 / 空狀態 */}
      {load.status === 'loading' && (
        <div className="text-neutral-6" style={{ fontSize: 14, padding: '48px 0', textAlign: 'center' }}>讀取中…</div>
      )}
      {load.status === 'error' && (
        <div style={{ marginTop: 16 }}>
          <Notice variant="error" title="讀取資料失敗" description={load.message} dismissible={false} />
          {load.detail && <div className="text-neutral-6" style={{ fontSize: 12, marginTop: 6 }}>細節:{load.detail}</div>}
        </div>
      )}
      {load.status === 'ready' && allSessions.length === 0 && (
        <div style={{ marginTop: 16 }}>
          <Notice variant="info" title="目前沒有測試結果" description="等受測者完成測試、結果上傳到 Supabase 後,這裡就會出現資料。" dismissible={false} />
        </div>
      )}

      {load.status === 'ready' && allSessions.length > 0 && (
        <>
          {/* 日期範圍篩選 */}
          <div className="ut-dash-toolbar flex flex-wrap items-center gap-2" style={{ marginTop: 16 }}>
            <span className="text-neutral-6" style={{ fontSize: 13 }}>日期範圍</span>
            <div style={{ width: 168 }}>
              <DatePicker aria-label="起始日" size="sm" clearable placeholder="起始日" value={dateFrom || null} onChange={setDateFrom} />
            </div>
            <span className="text-neutral-6" style={{ fontSize: 13 }}>至</span>
            <div style={{ width: 168 }}>
              <DatePicker aria-label="結束日" size="sm" clearable placeholder="結束日" value={dateTo || null} onChange={setDateTo} />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="text" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>清除</Button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div style={{ marginTop: 16 }}>
              <Notice variant="info" title="這個日期範圍沒有資料" description="調整或清除日期範圍再試。" dismissible={false} />
            </div>
          ) : (
          <>
          {/* 總覽卡片 */}
          <div className="flex flex-wrap gap-3" style={{ marginTop: 16 }}>
            <StatCard label="場次" value={ov.sessions} />
            <StatCard label="受測者" value={ov.testers} />
            <StatCard label="平均耗時" value={ov.avgDurationMin != null ? `${ov.avgDurationMin}` : '—'} sub="分鐘" />
            <StatCard
              label="日期範圍"
              value={<span style={{ fontSize: 14, fontWeight: 600 }}>{ov.earliest ? fmtDate(ov.earliest).slice(0, 10) : '—'}</span>}
              sub={ov.latest ? `至 ${fmtDate(ov.latest).slice(0, 10)}` : undefined}
            />
          </div>

          {/* 導出工具列(導出 = 場次明細已勾選的場次;預設全選) */}
          <div className="ut-dash-toolbar flex flex-wrap items-center gap-2" style={{ marginTop: 16 }}>
            <Button className="shrink-0" variant="primary" size="sm" startIcon={Download} disabled={selectedSessions.length === 0} onClick={() => doExport('quant')}>量化彙總 CSV</Button>
            <Button className="shrink-0" variant="secondary" size="sm" startIcon={FileText} disabled={selectedSessions.length === 0} onClick={() => doExport('transcript')}>逐字稿 CSV</Button>
            <Button className="shrink-0" variant="secondary" size="sm" startIcon={FileDown} disabled={selectedSessions.length === 0} onClick={() => doExport('raw')}>原始 raw CSV</Button>
            <Button className="shrink-0" variant="tertiary" size="sm" startIcon={Printer} onClick={printReport}>列印 / 存 PDF</Button>
            <span className="text-neutral-6" style={{ fontSize: 12 }}>導出 {selectedSessions.length} / {sessions.length} 場</span>
            <Chip tone="warning">逐字稿 / raw 含個資,請妥善保管</Chip>
          </div>

          {/* 分頁(切換平行檢視 → DS canonical 用 Tabs;size lg = page-level 主視覺)*/}
          <Tabs defaultValue="variants" style={{ marginTop: 20 }}>
            <TabsList size="lg">
              <TabsTrigger value="variants">版本比較</TabsTrigger>
              <TabsTrigger value="tasks">各任務成功率</TabsTrigger>
              <TabsTrigger value="sessions">場次明細</TabsTrigger>
            </TabsList>

            {/* 版本比較 */}
            <TabsContent value="variants">
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead>
                  <tr>
                    <Th>版本</Th>
                    <Th>說明</Th>
                    <Th align="center">場次</Th>
                    <Th>平均成功率</Th>
                    <Th align="right">平均 SEQ</Th>
                  </tr>
                </thead>
                <tbody>
                  {variantAgg.map((v) => (
                    <tr key={v.variant}>
                      <Td><Chip tone="neutral">{v.variant}</Chip></Td>
                      <Td>{v.variantLabel}</Td>
                      <Td align="center">{v.runs}</Td>
                      <Td><RateBar rate={v.avgRate} /></Td>
                      <Td align="right">{v.avgSeq != null ? `${v.avgSeq} / 7` : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabsContent>

            {/* 各任務成功率 */}
            <TabsContent value="tasks">
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead>
                  <tr>
                    <Th>版本</Th>
                    <Th>任務</Th>
                    <Th align="center">人次</Th>
                    <Th align="center">成功</Th>
                    <Th>成功率</Th>
                  </tr>
                </thead>
                <tbody>
                  {taskAgg.map((t) => (
                    <tr key={`${t.variant}-${t.taskId}`}>
                      <Td><Chip tone="neutral">{t.variant}</Chip></Td>
                      <Td>{t.taskTitle || t.taskId}</Td>
                      <Td align="center">{t.n}</Td>
                      <Td align="center">{t.success}</Td>
                      <Td><RateBar rate={t.rate} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabsContent>

            {/* 場次明細 */}
            <TabsContent value="sessions">
              <div className="text-neutral-6" style={{ fontSize: 12, marginTop: 12 }}>
                勾選要導出的場次(預設全選);上方導出鈕只會輸出已勾選的場次。
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
                <thead>
                  <tr>
                    <Th align="center">
                      <Checkbox
                        aria-label="全選"
                        checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                        onCheckedChange={toggleAll}
                      />
                    </Th>
                    <Th>日期</Th>
                    <Th>受測者</Th>
                    <Th>版本</Th>
                    <Th align="center">耗時</Th>
                    <Th>整體成功率</Th>
                    <Th align="right"></Th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <Fragment key={s.id}>
                      <tr>
                        <Td align="center">
                          <Checkbox
                            aria-label={`選取 ${s.tester || s.id}`}
                            checked={selectedIds.has(s.id)}
                            onCheckedChange={() => toggleOne(s.id)}
                          />
                        </Td>
                        <Td>{fmtDate(s.createdAt)}</Td>
                        <Td>{s.tester || '—'}</Td>
                        <Td>{s.variants}</Td>
                        <Td align="center">{s.durationMin != null ? `${s.durationMin}m` : '—'}</Td>
                        <Td><RateBar rate={s.overallRate} /></Td>
                        <Td align="right">
                          <Button variant="text" size="sm" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                            {expanded === s.id ? '收合' : '詳情'}
                          </Button>
                        </Td>
                      </tr>
                      {expanded === s.id && (
                        <tr>
                          <td colSpan={7} style={{ padding: '4px 12px 12px' }}>
                            <SessionDetail session={s} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </TabsContent>
          </Tabs>
          </>
          )}
        </>
      )}
    </div>
  )
}

export default UtDashboard
