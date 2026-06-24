// ════════════════════════════════════════════════════════════════════════════
// Usability-testing 模型 A(可重用引擎,單檔):型別 + 雙語(zh/en)+ 懸浮任務面板 +
// 單版/多版流程 + 問卷 + 摘要頁(自動下載 Excel / 螢幕錄影 + toast)。版本鎖定、不給
// 消費端改 —— 消費端只提供 UTProject,引擎負責其餘全部。
//
//  - 任務成功/失敗由「使用者實際操作」判定(prototype 透過 onAction 吐事件)。
//  - 雙語:測試說明頁可切語言(預設中文);所有引擎文字 + 消費端用 Localized 提供的內容
//    皆隨語言切換。語言在 intro 選定,整場固定。
//  - 摘要頁:標記「做失敗卻自評偏容易」的任務(false-easy,值得分析)。
//  - 多版本綜合流程 + counterbalancedOrders() 產生消除順序效應的測試順序。
// ════════════════════════════════════════════════════════════════════════════
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Input, Textarea, ProgressBar, Notice } from '@qijenchen/design-system'
import {
  ClipboardList, Target, Info, FileSpreadsheet, ClipboardCopy, RotateCcw, Check, ArrowRight,
  GripVertical, ChevronDown, ChevronUp, CheckCircle2, XCircle, Mic, MicOff, Lock, AlertTriangle, Languages,
} from 'lucide-react'

// ── i18n:語言 + 可在地化字串 ───────────────────────────────────────────────
export type Lang = 'zh' | 'en'
/** 消費端文字可給單一字串(不分語言)或 { zh, en } 雙語。 */
export type Localized = string | { zh?: string; en?: string }
function L(v: Localized | undefined | null, lang: Lang): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  return v[lang] ?? v.zh ?? v.en ?? ''
}

const LangCtx = createContext<Lang>('zh')
const useLang = () => useContext(LangCtx)

// 引擎自身的 UI 文字表(chrome)。
const CHROME = {
  zh: {
    langName: '中文',
    // password gate
    pwTitle: '請輸入測試密碼', pwDesc: '此測試內容受密碼保護,僅供受邀者進行。',
    pwPlaceholder: '請輸入密碼', pwError: '密碼錯誤,請再試一次。', pwEnter: '進入測試',
    // intro
    goal: '測試目標', instructions: '測試須知',
    micNote: '開始後會請求麥克風權限,用於自動把你的「放聲思考」轉成逐字稿(可拒絕,拒絕則不錄音)。',
    envCaveat: '注意:特定環境(部分瀏覽器 / 裝置 / 權限或網路設定)可能無法使用畫面錄製或錄音功能。',
    recNote: '開始後會請你分享畫面以錄製測試過程(畫面 + 你的講話聲),結束自動下載。',
    nameLabel: '請輸入你的工號與姓名', namePlaceholder: '例如:123321王小明', startBtn: '確認並開始測試',
    noteSingle: (n: number) => <>本次共 <b>{n}</b> 項任務,進行中右下角會出現任務指示框。<b>必須實際完成</b>指定操作才算成功。</>,
    noteCombined: (k: number, label: string, n: number) => <>你會<b>依序體驗 {k} 個版本({label})</b>,每版各 <b>{n}</b> 項任務。全部完成後會看到各版比較與綜合結論。</>,
    badgeSingle: (v: string) => `Usability Test · 版本 ${v}`,
    badgeCombined: (o: string) => `Usability Test · 綜合測試 ${o}`,
    version: '版本',
    // task panel
    taskTitle: '任務指示', taskHintDefault: '完成上述操作後再按下方按鈕;未實際完成會記為「失敗」。',
    finishSee: '完成並查看結果', doneNext: '完成,下一步', expand: '展開', collapse: '收合',
    // floating status
    recording: '錄音中', notRecording: '未錄音', unsupported: '不支援',
    // survey
    postTaskBadge: (n: number) => `任務 ${n} 後問卷`, postTaskTitle: '完成了!請回答幾個問題', postTaskSubmit: '送出,繼續',
    postTestBadge: '測試結束問卷', postTestTitle: '最後幾個整體問題', postTestSubmit: '送出並查看結果',
    submit: '送出', anchorMin: '非常困難', anchorMax: '非常容易', writePlaceholder: '請輸入你的想法…',
    charOk: (n: number) => `已達最低字數(${n} 字)`, charNeed: (min: number, diff: number) => `至少 ${min} 字,還差 ${diff} 字`,
    pts: (n: number) => `${n} 分`, blank: '(未填)',
    // results
    resultBadgeSingle: (v: string) => `測試結果 · 版本 ${v}`,
    resultBadgeCombined: (l: string) => `綜合測試結果 · 版本 ${l}`,
    successRate: (s: number, t: number) => `任務成功率(${s} / ${t} 成功)`,
    tester: '測試者', date: '測試日期', duration: '耗時', durationVal: (m: number) => `約 ${m} 分鐘`,
    taskSummary: '任務 Summary', success: '成功', fail: '失敗', failReason: '失敗原因',
    perVariant: (v: string) => `版本 ${v} 逐項`,
    successOf: (s: number, t: number) => `${s}/${t} 成功`,
    // false-easy
    falseEasyHeading: '⚠ 值得分析:做失敗卻自評偏容易的任務',
    falseEasyDesc: '以下任務受測者其實「沒有完成」,卻在難易度給了偏「容易」的分數 —— 代表他可能誤以為自己輕鬆做到了。這種「自覺容易但實際失敗」最值得深入訪談。',
    falseEasyItem: (title: string, score: number, max: number) => `${title} — 自評 ${score}/${max}(偏容易)但實際失敗`,
    falseEasyExcel: '值得分析(做失敗卻自評容易)',
    // transcript
    digestLabel: '自動重點(關鍵字擷取,非 AI):', digestNone: '(未擷取到明顯關鍵字,請見完整逐字稿)',
    transcriptExpand: (n: number) => `展開完整逐字稿(${n} 字)`, transcriptCollapse: '收合完整逐字稿',
    transcriptNone: '(無逐字稿:未授權麥克風或瀏覽器不支援語音轉文字)',
    transcriptTitleSingle: '放聲思考逐字稿', transcriptTitle: (v: string) => `版本 ${v} 放聲思考逐字稿`,
    // export bar
    exportExcel: '匯出 Excel', copyText: '複製文字檔', copied: '已複製', restart: '重新測試',
    // notices
    noticeSingleTitle: '把結果交回給研究人員', noticeSingleDesc: '可匯出 Excel 或複製純文字,貼到你們彙整結果的試算表 / 文件。',
    noticeCombinedTitle: '把綜合結果交回給研究人員', noticeCombinedDesc: '可匯出 Excel(含各版逐項比較、結論、逐字稿、問卷)或複製純文字。',
    // interstitial
    variantDone: (v: string, i: number, n: number) => `版本 ${v} 完成(${i}/${n})`,
    nextUp: (v: string) => `接下來進行版本 ${v}`,
    interBody: (done: string, next: string) => `版本 ${done} 的任務已完成。按下方按鈕,用同樣的方式完成版本 ${next} 的任務。`,
    startVariant: (v: string) => `開始版本 ${v} 測試`,
    // survey sections
    surveyHeadingSingle: '問卷回饋', surveyHeading: (v: string) => `版本 ${v} 問卷回饋`,
    surveyTaskLabel: (t: string) => `任務:${t}`, surveyPostTest: '整場結束問卷',
    // conclusions
    concludeSame: (m: number, t: number) => `各版本任務成功數相同(各 ${m}/${t})。建議再參考完成耗時與受測者主觀回饋來判斷。`,
    concludeTie: (names: string, m: number, t: number, rate: number) => `${names} 並列最高(${m}/${t},${rate}%);其餘版本較低,可再用耗時 / 回饋區分。`,
    concludeBest: (v: string, label: string, rate: number, s: number, t: number, others: string) => `版本 ${v}(${label})任務成功率最高:${rate}%(${s}/${t}),優於 ${others},整體易用性表現最佳。`,
    taNone: '本次未取得放聲思考逐字稿(未授權麥克風或瀏覽器不支援)。',
    taPrefix: '放聲思考重點 — ', taNoKey: '(無明顯關鍵反饋)',
    // toasts
    toastExcel: '測試結果 Excel 已下載到你的下載資料夾',
    toastRecProcessing: '螢幕錄影處理中,完成後會自動下載…',
    toastRecDone: '螢幕錄影已下載到你的下載資料夾',
    // excel/text headers
    xName: '測試名稱', xTester: '測試者', xVersion: '版本', xDate: '測試日期', xDurationMin: '耗時(分)',
    xRate: '任務達成率', xTask: '任務', xResult: '結果', xReason: '失敗原因', xDigest: '放聲思考重點',
    xTranscript: '放聲思考逐字稿', xConclusion: '綜合結論', xTaNote: '放聲思考摘要',
    xCategory: '類別', xQuestion: '題目', xAnswer: '作答', xSurveyTask: (t: string) => `問卷 · ${t}`, xSurveyPost: '問卷 · 整場結束',
    xPerCompare: '逐項比較:', xTaskResults: '任務結果:', xRateOf: (v: string, label: string, rate: number, s: number, t: number) => `版本 ${v}(${label})達成率:${rate}% (${s}/${t})`,
    none: '(無)',
  },
  en: {
    langName: 'English',
    pwTitle: 'Enter test password', pwDesc: 'This test is password-protected and for invited participants only.',
    pwPlaceholder: 'Password', pwError: 'Wrong password, please try again.', pwEnter: 'Enter',
    goal: 'Goal', instructions: 'Instructions',
    micNote: 'You will be asked for microphone access, used to auto-transcribe your think-aloud (you may decline; declining means no recording).',
    envCaveat: 'Note: some environments (certain browsers / devices / permission or network settings) may not support screen or audio recording.',
    recNote: 'You will be asked to share your screen to record the session (screen + your voice); it downloads automatically when you finish.',
    nameLabel: 'Enter your employee ID and name', namePlaceholder: 'e.g. 123321 John Doe', startBtn: 'Confirm & start',
    noteSingle: (n: number) => <>This test has <b>{n}</b> task(s). A task panel appears at the bottom-right while testing. You <b>must actually complete</b> the action for it to count as success.</>,
    noteCombined: (k: number, label: string, n: number) => <>You will <b>go through {k} versions in order ({label})</b>, <b>{n}</b> task(s) each. After all are done you'll see a per-version comparison and overall conclusion.</>,
    badgeSingle: (v: string) => `Usability Test · Version ${v}`,
    badgeCombined: (o: string) => `Usability Test · Combined ${o}`,
    version: 'Version',
    taskTitle: 'Task', taskHintDefault: 'Finish the action above, then press the button below; not actually completing it is recorded as "fail".',
    finishSee: 'Finish & see results', doneNext: 'Done, next', expand: 'Expand', collapse: 'Collapse',
    recording: 'Recording', notRecording: 'Not recording', unsupported: 'Unsupported',
    postTaskBadge: (n: number) => `Post-task ${n} survey`, postTaskTitle: 'Done! A few quick questions', postTaskSubmit: 'Submit & continue',
    postTestBadge: 'Post-test survey', postTestTitle: 'A few final questions', postTestSubmit: 'Submit & see results',
    submit: 'Submit', anchorMin: 'Very difficult', anchorMax: 'Very easy', writePlaceholder: 'Type your thoughts…',
    charOk: (n: number) => `Minimum reached (${n} chars)`, charNeed: (min: number, diff: number) => `At least ${min} chars, ${diff} more to go`,
    pts: (n: number) => `${n} pts`, blank: '(blank)',
    resultBadgeSingle: (v: string) => `Result · Version ${v}`,
    resultBadgeCombined: (l: string) => `Combined result · Version ${l}`,
    successRate: (s: number, t: number) => `Task success rate (${s} / ${t} passed)`,
    tester: 'Tester', date: 'Date', duration: 'Duration', durationVal: (m: number) => `~${m} min`,
    taskSummary: 'Task summary', success: 'Success', fail: 'Fail', failReason: 'Reason',
    perVariant: (v: string) => `Version ${v} — per task`,
    successOf: (s: number, t: number) => `${s}/${t} passed`,
    falseEasyHeading: '⚠ Worth analysing: failed but rated easy',
    falseEasyDesc: 'For the tasks below the participant did NOT complete the task, yet rated it toward the "easy" end — meaning they may have falsely believed they succeeded. These "felt easy but actually failed" cases are the most worth a follow-up interview.',
    falseEasyItem: (title: string, score: number, max: number) => `${title} — self-rated ${score}/${max} (leaning easy) but actually failed`,
    falseEasyExcel: 'Worth analysing (failed but rated easy)',
    digestLabel: 'Auto highlights (keyword extraction, not AI):', digestNone: '(No obvious keywords; see full transcript)',
    transcriptExpand: (n: number) => `Show full transcript (${n} chars)`, transcriptCollapse: 'Hide full transcript',
    transcriptNone: '(No transcript: mic not granted or speech-to-text unsupported)',
    transcriptTitleSingle: 'Think-aloud transcript', transcriptTitle: (v: string) => `Version ${v} think-aloud transcript`,
    exportExcel: 'Export Excel', copyText: 'Copy text', copied: 'Copied', restart: 'Restart',
    noticeSingleTitle: 'Hand the result back to the researcher', noticeSingleDesc: 'Export Excel or copy plain text into your results spreadsheet / doc.',
    noticeCombinedTitle: 'Hand the combined result back to the researcher', noticeCombinedDesc: 'Export Excel (per-version comparison, conclusion, transcript, survey) or copy plain text.',
    variantDone: (v: string, i: number, n: number) => `Version ${v} done (${i}/${n})`,
    nextUp: (v: string) => `Next: Version ${v}`,
    interBody: (done: string, next: string) => `Version ${done} is done. Press below to complete Version ${next} the same way.`,
    startVariant: (v: string) => `Start Version ${v}`,
    surveyHeadingSingle: 'Survey feedback', surveyHeading: (v: string) => `Version ${v} survey feedback`,
    surveyTaskLabel: (t: string) => `Task: ${t}`, surveyPostTest: 'Post-test survey',
    concludeSame: (m: number, t: number) => `All versions had the same number of passes (${m}/${t} each). Consider completion time and subjective feedback to decide.`,
    concludeTie: (names: string, m: number, t: number, rate: number) => `${names} tied highest (${m}/${t}, ${rate}%); others were lower — use time / feedback to differentiate.`,
    concludeBest: (v: string, label: string, rate: number, s: number, t: number, others: string) => `Version ${v} (${label}) had the highest success rate: ${rate}% (${s}/${t}), ahead of ${others} — best overall usability.`,
    taNone: 'No think-aloud transcript captured (mic not granted or unsupported).',
    taPrefix: 'Think-aloud highlights — ', taNoKey: '(no clear feedback)',
    toastExcel: 'Result Excel downloaded to your Downloads folder',
    toastRecProcessing: 'Processing screen recording, it will download automatically…',
    toastRecDone: 'Screen recording downloaded to your Downloads folder',
    xName: 'Test name', xTester: 'Tester', xVersion: 'Version', xDate: 'Date', xDurationMin: 'Duration (min)',
    xRate: 'Success rate', xTask: 'Task', xResult: 'Result', xReason: 'Reason', xDigest: 'Think-aloud highlights',
    xTranscript: 'Think-aloud transcript', xConclusion: 'Conclusion', xTaNote: 'Think-aloud summary',
    xCategory: 'Category', xQuestion: 'Question', xAnswer: 'Answer', xSurveyTask: (t: string) => `Survey · ${t}`, xSurveyPost: 'Survey · Post-test',
    xPerCompare: 'Per-task comparison:', xTaskResults: 'Task results:', xRateOf: (v: string, label: string, rate: number, s: number, t: number) => `Version ${v} (${label}) rate: ${rate}% (${s}/${t})`,
    none: '(none)',
  },
} as const
type Chrome = typeof CHROME['zh']
function tr(lang: Lang): Chrome { return CHROME[lang] as Chrome }

// ── 型別(對外契約)─────────────────────────────────────────────────────────
export type UTaskResult = 'success' | 'fail'

// ── 問卷(survey)— 任務後 / 測試後安插主觀回饋與開放性問題 ────────────────────
export type SurveyQuestion =
  | {
      id: string
      questionType: 'singleEase'
      prompt: Localized
      /** 量表點數,預設 7。可覆寫為 5。 */
      scalePoints?: number
      /** 兩端錨點文案,預設 非常困難 / 非常容易。 */
      anchors?: { min: Localized; max: Localized }
      required?: boolean
    }
  | {
      id: string
      questionType: 'writtenResponse'
      prompt: Localized
      minChars?: number
      placeholder?: Localized
      required?: boolean
    }

/** 受測者對單一題目的作答。scale 類 value 為 number;開放題為 string。 */
export type SurveyAnswer = {
  questionId: string
  questionType: SurveyQuestion['questionType']
  prompt: string
  value: number | string
  /** singleEase:量表上限(供「做失敗卻自評容易」分析用)。 */
  scaleMax?: number
}

/** 單一任務。check 依「任務進行期間累積的操作」判定成功與否。 */
export type UTask<A = unknown> = {
  id: string
  title: Localized
  hint?: Localized
  check: (actions: A[]) => { ok: boolean; reason?: Localized }
  /** 此任務完成後彈出的問卷;未設則沿用 project.postTaskSurvey。 */
  postTask?: SurveyQuestion[]
}

/** 單一版本。render 把消費端 prototype 渲染出來,並透過 onAction 把操作吐回引擎。 */
export type UTVariant<A = unknown> = {
  label: Localized
  render: (api: { onAction: (action: A) => void }) => ReactNode
}

/** 一個完整測試專案的定義。 */
export type UTProject<A = unknown> = {
  id: string
  title: Localized
  goal: Localized
  instructions: Localized[]
  tasks: UTask<A>[]
  variants: Record<string, UTVariant<A>>
  postTaskSurvey?: SurveyQuestion[]
  postTestSurvey?: SurveyQuestion[]
}

/** 取某任務的任務後問卷:task 層覆寫優先,否則用 project 預設。 */
function postTaskQuestionsFor<A>(project: UTProject<A>, task: UTask<A>): SurveyQuestion[] {
  return task.postTask ?? project.postTaskSurvey ?? []
}

/**
 * 產生「消除順序效應(order bias)」的測試順序集合 —— cyclic Latin square:
 * 每個版本在每個位置各出現一次。例:['A','B'] → [['A','B'],['B','A']];
 * ['A','B','C'] → [['A','B','C'],['B','C','A'],['C','A','B']]。把每個順序各做成一支綜合 story。
 */
export function counterbalancedOrders(variants: string[]): string[][] {
  const n = variants.length
  if (n <= 1) return [variants.slice()]
  return Array.from({ length: n }, (_, i) => variants.map((_, j) => variants[(i + j) % n]))
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
  transcript: string
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

// ── 工具:時間、Excel 匯出、複製、Blob 下載 ─────────────────────────────────
function fmtDateTime(d: Date) {
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function durationMin(a: Date, b: Date) {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 60000))
}
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
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// ── 螢幕錄製:畫面(getDisplayMedia)+ 麥克風(getUserMedia)混音 → webm ─────
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

// ── 輕量 toast(底部置中堆疊,自動消失;不放按鈕)────────────────────────────
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

// 到摘要頁自動交付:① 立即匯出 Excel ② 螢幕錄影 blob 就緒後下載 ③ 各自跳 toast。
function useAutoDeliver(opts: { excel: () => void; recordingBase: string; recording: boolean; recordingBlob: Blob | null; lang: Lang }): ToastMsg[] {
  const t = tr(opts.lang)
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const idRef = useRef(0)
  const excelOnceRef = useRef(false)
  const recOnceRef = useRef(false)
  function push(text: string) {
    const id = ++idRef.current
    setToasts((p) => [...p, { id, text }])
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 6000)
  }
  useEffect(() => {
    if (excelOnceRef.current) return
    excelOnceRef.current = true
    try { opts.excel() } catch { /* ignore */ }
    push(t.toastExcel)
    if (opts.recording) push(t.toastRecProcessing)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!opts.recordingBlob || recOnceRef.current) return
    recOnceRef.current = true
    downloadBlob(opts.recordingBlob, `${opts.recordingBase}.webm`)
    push(t.toastRecDone)
  }, [opts.recordingBlob]) // eslint-disable-line react-hooks/exhaustive-deps
  return toasts
}

// ── 放聲思考逐字稿:瀏覽器 Web Speech API ───────────────────────────────────
type ThinkAloud = {
  supported: boolean
  recording: boolean
  interim: string
  error: string | null
  start: () => void
  stop: () => string
}
function useThinkAloud(lang: Lang): ThinkAloud {
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
    if (!supported || recRef.current) return
    finalRef.current = ''
    const rec = new SR()
    rec.lang = lang === 'en' ? 'en-US' : 'zh-TW'
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
        setError('mic-denied'); activeRef.current = false; setRecording(false)
      }
    }
    rec.onend = () => {
      if (activeRef.current) { try { rec.start() } catch { /* ignore */ } }
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

// ── 共用拖曳 hook ───────────────────────────────────────────────────────────
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

// 關鍵字擷取(zh 啟發式;en 逐字稿不擷取,顯示完整即可)。
const PAIN_WORDS = ['難', '找不到', '不知道', '看不到', '搞不懂', '困惑', '問題', '怪', '卡住', '卡', '慢', '複雜', '錯', '不會', '奇怪', '不清楚', '麻煩', '為什麼', '怎麼']
const GOOD_WORDS = ['快', '清楚', '容易', '直覺', '方便', '好找', '喜歡', '順', '簡單', '明顯', '不錯']
function digestTranscript(transcript: string): string[] {
  const sents = transcript.split(/[。!?！？\n,，]/).map((s) => s.trim()).filter((s) => s.length >= 2)
  const picked = sents.filter((s) => PAIN_WORDS.some((k) => s.includes(k)) || GOOD_WORDS.some((k) => s.includes(k)))
  return Array.from(new Set(picked)).slice(0, 6)
}

// ── 進行中左上角小狀態列 ────────────────────────────────────────────────────
function FloatingStatus({ variant, rec }: { variant: string; rec: ThinkAloud }) {
  const t = tr(useLang())
  const { style, handlers } = useDraggable({ left: 12, top: 12 })
  return (
    <div
      data-draggable
      className="fixed z-[1000] flex max-w-[260px] cursor-grab select-none items-center gap-1.5 rounded-full border border-neutral-5 bg-surface px-2 py-1 shadow active:cursor-grabbing"
      style={style}
      {...handlers}
    >
      <GripVertical size={11} className="text-neutral-5" />
      <span style={{ fontSize: 11, fontWeight: 600 }} className="text-neutral-8">{t.version} {variant}</span>
      {rec.recording ? (
        <span className="flex items-center gap-1" style={{ fontSize: 11, color: 'var(--color-error-text)' }}>
          <Mic size={11} />
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: 'var(--color-error-text)' }} />
          {t.recording}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-neutral-6" style={{ fontSize: 11 }}>
          <MicOff size={11} />{rec.supported ? t.notRecording : t.unsupported}
        </span>
      )}
      {rec.recording && rec.interim && (
        <span className="max-w-[110px] truncate text-neutral-5" style={{ fontSize: 10 }}>{rec.interim}</span>
      )}
    </div>
  )
}

// ── 懸浮任務指示視窗 ────────────────────────────────────────────────────────
function TaskPanel({
  tasks, index, onComplete,
}: {
  tasks: UTask<any>[]
  index: number
  onComplete: () => void
}) {
  const lang = useLang()
  const t = tr(lang)
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
        <span style={{ fontSize: 13, fontWeight: 600 }} className="text-neutral-9">{t.taskTitle}</span>
        <Chip className="ml-auto">{Math.min(index + 1, total)} / {total}</Chip>
        <Button
          variant="text" size="sm" iconOnly
          startIcon={collapsed ? ChevronUp : ChevronDown}
          aria-label={collapsed ? t.expand : t.collapse}
          onClick={() => setCollapsed((v) => !v)}
          className="!h-6 !w-6 !min-w-0 !p-0"
        />
      </div>

      {!collapsed && current && (
        <div className="px-3 py-3">
          <ProgressBar value={total ? (index / total) * 100 : 0} height={6} />
          <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, lineHeight: '150%' }}>{L(current.title, lang)}</p>
          {current.hint && (
            <p className="mt-1 text-neutral-7" style={{ fontSize: 12, lineHeight: '140%' }}>{L(current.hint, lang)}</p>
          )}
          <p className="mt-2 text-neutral-6" style={{ fontSize: 11, lineHeight: '140%' }}>{t.taskHintDefault}</p>
          <Button variant="primary" size="sm" startIcon={Check} className="mt-3 w-full" onClick={onComplete}>
            {isLast ? t.finishSee : t.doneNext}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── 問卷:單題渲染器 ────────────────────────────────────────────────────────
function QuestionRenderer({
  q, value, onChange,
}: {
  q: SurveyQuestion
  value: number | string | undefined
  onChange: (v: number | string) => void
}) {
  const lang = useLang()
  const t = tr(lang)
  if (q.questionType === 'singleEase') {
    const pts = q.scalePoints ?? 7
    const minA = q.anchors ? L(q.anchors.min, lang) : t.anchorMin
    const maxA = q.anchors ? L(q.anchors.max, lang) : t.anchorMax
    return (
      <div>
        <p className="text-neutral-9" style={{ fontSize: 14, fontWeight: 500, lineHeight: '150%' }}>{L(q.prompt, lang)}</p>
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
          <span>{minA}</span>
          <span>{maxA}</span>
        </div>
      </div>
    )
  }
  const text = typeof value === 'string' ? value : ''
  const min = q.minChars ?? 0
  const len = text.trim().length
  return (
    <div>
      <p className="text-neutral-9" style={{ fontSize: 14, fontWeight: 500, lineHeight: '150%' }}>{L(q.prompt, lang)}</p>
      <Textarea
        className="mt-2"
        rows={3}
        placeholder={q.placeholder ? L(q.placeholder, lang) : t.writePlaceholder}
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
      {min > 0 && (
        <p className="mt-1 text-neutral-6" style={{ fontSize: 11 }}>
          {len >= min ? t.charOk(len) : t.charNeed(min, min - len)}
        </p>
      )}
    </div>
  )
}

// ── 問卷:一個作答步驟 ──────────────────────────────────────────────────────
function isAnswerValid(q: SurveyQuestion, value: number | string | undefined): boolean {
  const required = q.required ?? true
  if (q.questionType === 'singleEase') return !required || typeof value === 'number'
  const text = (typeof value === 'string' ? value : '').trim()
  if (!required && text.length === 0) return true
  if (text.length === 0) return false
  return text.length >= (q.minChars ?? 0)
}

function SurveyStep({
  badge, title, questions, submitLabel, presentation = 'screen', onSubmit,
}: {
  badge: string
  title: string
  questions: SurveyQuestion[]
  submitLabel?: string
  presentation?: 'screen' | 'overlay'
  onSubmit: (answers: SurveyAnswer[]) => void
}) {
  const lang = useLang()
  const t = tr(lang)
  const [values, setValues] = useState<Record<string, number | string>>({})
  const valid = questions.every((q) => isAnswerValid(q, values[q.id]))

  function submit() {
    const answers: SurveyAnswer[] = questions.map((q) => ({
      questionId: q.id,
      questionType: q.questionType,
      prompt: L(q.prompt, lang),
      value: values[q.id] ?? (q.questionType === 'singleEase' ? 0 : ''),
      ...(q.questionType === 'singleEase' ? { scaleMax: q.scalePoints ?? 7 } : {}),
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
      <Button variant="primary" className="mt-6 w-full" disabled={!valid} onClick={submit}>{submitLabel ?? t.submit}</Button>
    </div>
  )

  if (presentation === 'overlay') {
    return <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}>{card}</div>
  }
  return <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">{card}</div>
}

// ── 問卷:結果頁的作答清單 ──────────────────────────────────────────────────
function SurveyAnswerList({ answers }: { answers: SurveyAnswer[] }) {
  const t = tr(useLang())
  return (
    <ul className="mt-2 space-y-2">
      {answers.map((a) => (
        <li key={a.questionId}>
          <p className="text-neutral-6" style={{ fontSize: 12 }}>{a.prompt}</p>
          <p className="text-neutral-9" style={{ fontSize: 13, fontWeight: 500, lineHeight: '150%' }}>
            {a.questionType === 'singleEase' ? t.pts(Number(a.value)) : (String(a.value).trim() || t.blank)}
          </p>
        </li>
      ))}
    </ul>
  )
}

// ── 單一版本的任務執行階段 ───────────────────────────────────────────────────
function RunPhase<A>({ project, variant, onDone }: { project: UTProject<A>; variant: string; onDone: (run: VariantRun) => void }) {
  const lang = useLang()
  const t = tr(lang)
  const v = project.variants[variant]
  const actionsRef = useRef<A[]>([])
  const taskStartRef = useRef(0)
  const outcomesRef = useRef<TaskOutcome[]>([])
  const surveysRef = useRef<{ taskId: string; taskTitle: string; answers: SurveyAnswer[] }[]>([])
  const startedRef = useRef<Date>(new Date())
  const [index, setIndex] = useState(0)
  const [surveyIdx, setSurveyIdx] = useState<number | null>(null)
  const rec = useThinkAloud(lang)

  useEffect(() => { rec.start() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function finishVariant() {
    const outcomes = outcomesRef.current
    const successCount = outcomes.filter((o) => o.result === 'success').length
    const total = outcomes.length
    const transcript = rec.stop()
    onDone({
      variant,
      variantLabel: L(v.label, lang),
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
      title: L(task.title, lang),
      result: ok ? 'success' : 'fail',
      reason: ok ? undefined : (L(reason, lang) || (lang === 'en' ? 'Did not complete the required action' : '未實際完成任務指定的操作')),
    })
    taskStartRef.current = actionsRef.current.length

    if (postTaskQuestionsFor(project, task).length > 0) {
      setSurveyIdx(index)
      return
    }
    advanceOrFinish()
  }

  function onSurveySubmit(answers: SurveyAnswer[]) {
    const task = project.tasks[index]
    surveysRef.current.push({ taskId: task.id, taskTitle: L(task.title, lang), answers })
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
          badge={t.postTaskBadge(surveyIdx! + 1)}
          title={t.postTaskTitle}
          questions={postTaskQuestionsFor(project, surveyTask)}
          submitLabel={t.postTaskSubmit}
          presentation="overlay"
          onSubmit={onSurveySubmit}
        />
      )}
    </div>
  )
}

// ── 密碼閘門 ────────────────────────────────────────────────────────────────
function PasswordGate({ password, lang, onUnlock }: { password: string; lang: Lang; onUnlock: () => void }) {
  const t = tr(lang)
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
        <h1 className="text-neutral-9" style={{ fontSize: 18, fontWeight: 600 }}>{t.pwTitle}</h1>
        <p className="mt-1 text-neutral-7" style={{ fontSize: 13 }}>{t.pwDesc}</p>
        <Input
          className="mt-4"
          type="password"
          placeholder={t.pwPlaceholder}
          value={val}
          autoFocus
          onChange={(e) => { setVal(e.target.value); setErr(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
        {err && <p className="mt-2" style={{ fontSize: 12, color: 'var(--color-error-text)' }}>{t.pwError}</p>}
        <Button variant="primary" className="mt-4 w-full" disabled={!val} onClick={submit}>{t.pwEnter}</Button>
      </div>
    </div>
  )
}

// ── 語言切換段控 ────────────────────────────────────────────────────────────
function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const opts: Lang[] = ['zh', 'en']
  return (
    <div className="flex items-center gap-1 rounded-lg border border-neutral-5 p-0.5">
      <Languages size={14} className="ml-1 text-neutral-6" />
      {opts.map((o) => {
        const active = lang === o
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className="rounded-[6px] px-2 py-1"
            style={{
              fontSize: 12, fontWeight: 600,
              backgroundColor: active ? 'var(--color-primary)' : 'transparent',
              color: active ? 'var(--color-on-emphasis, #fff)' : 'var(--color-neutral-7)',
            }}
          >
            {CHROME[o].langName}
          </button>
        )
      })}
    </div>
  )
}

// ── intro 畫面 ──────────────────────────────────────────────────────────────
function IntroScreen({
  project, badge, note, record, tester, lang, onLangChange, onTesterChange, onStart,
}: {
  project: UTProject<any>
  badge: string
  note: ReactNode
  record: boolean
  tester: string
  lang: Lang
  onLangChange: (l: Lang) => void
  onTesterChange: (s: string) => void
  onStart: () => void
}) {
  const t = tr(lang)
  return (
    <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-[560px] rounded-xl border border-neutral-5 bg-surface p-8 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <Chip tone="info">{badge}</Chip>
          <LangToggle lang={lang} onChange={onLangChange} />
        </div>
        <h1 className="text-neutral-9" style={{ fontSize: 22, fontWeight: 600, lineHeight: '130%' }}>{L(project.title, lang)}</h1>

        <div className="mt-5 flex items-start gap-2">
          <Target size={18} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }} className="text-neutral-9">{t.goal}</p>
            <p className="mt-0.5 text-neutral-8" style={{ fontSize: 13, lineHeight: '150%' }}>{L(project.goal, lang)}</p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2">
          <Info size={18} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }} className="text-neutral-9">{t.instructions}</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-neutral-8" style={{ fontSize: 13, lineHeight: '150%' }}>
              {project.instructions.map((s, i) => <li key={i}>{L(s, lang)}</li>)}
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
            {t.micNote}
            {record && <><br />{t.recNote}</>}
            <br />
            <span style={{ color: 'var(--color-warning-text)', fontWeight: 600 }}>{t.envCaveat}</span>
          </p>
        </div>

        <label className="mt-6 block" style={{ fontSize: 13, fontWeight: 600 }}>{t.nameLabel}</label>
        <Input
          className="mt-1.5" placeholder={t.namePlaceholder} value={tester}
          onChange={(e) => onTesterChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onStart() }}
        />
        <Button variant="primary" className="mt-5 w-full" disabled={!tester.trim()} onClick={onStart}>
          {t.startBtn}
        </Button>
      </div>
    </div>
  )
}

// ── 共用:逐項任務結果清單 ───────────────────────────────────────────────────
function OutcomeList({ outcomes }: { outcomes: TaskOutcome[] }) {
  const t = tr(useLang())
  return (
    <ul className="mt-2 space-y-2">
      {outcomes.map((o, i) => (
        <li key={o.id} className="flex items-start gap-2" style={{ fontSize: 13 }}>
          {o.result === 'success'
            ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-success-text)' }} />
            : <XCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-error-text)' }} />}
          <div>
            <span className="text-neutral-8">{i + 1}. {o.title} </span>
            <Chip tone={o.result === 'success' ? 'success' : 'error'}>{o.result === 'success' ? t.success : t.fail}</Chip>
            {o.result === 'fail' && o.reason && (
              <p className="mt-0.5 text-neutral-6" style={{ fontSize: 12 }}>{t.failReason}:{o.reason}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

// ── 「做失敗卻自評偏容易」分析(false-easy)──────────────────────────────────
const FALSE_EASY_RATIO = 0.7 // 自評分數 / 量表上限 ≥ 0.7 視為偏「容易」
type FalseEasyItem = { taskTitle: string; score: number; scaleMax: number }
function falseEasyItems(run: VariantRun): FalseEasyItem[] {
  const out: FalseEasyItem[] = []
  for (const o of run.outcomes) {
    if (o.result !== 'fail') continue
    const ts = run.taskSurveys.find((s) => s.taskId === o.id)
    const seq = ts?.answers.find((a) => a.questionType === 'singleEase')
    if (!seq || typeof seq.value !== 'number') continue
    const max = seq.scaleMax ?? 7
    if (max > 0 && seq.value / max >= FALSE_EASY_RATIO) out.push({ taskTitle: o.title, score: seq.value, scaleMax: max })
  }
  return out
}
function FalseEasySection({ runs }: { runs: VariantRun[] }) {
  const t = tr(useLang())
  const blocks = runs
    .map((r) => ({ variant: r.variant, items: falseEasyItems(r) }))
    .filter((b) => b.items.length > 0)
  if (!blocks.length) return null
  return (
    <div className="mt-5 rounded-lg border p-4" style={{ borderColor: 'var(--color-warning-text)', backgroundColor: 'var(--color-warning-subtle)' }}>
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-warning-text)' }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-warning-text)' }}>{t.falseEasyHeading}</p>
          <p className="mt-1" style={{ fontSize: 12, lineHeight: '150%', color: 'var(--color-warning-text)' }}>{t.falseEasyDesc}</p>
          {blocks.map((b) => (
            <div key={b.variant} className="mt-2">
              {runs.length > 1 && <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-warning-text)' }}>{t.version} {b.variant}</p>}
              <ul className="list-disc pl-4" style={{ fontSize: 12, lineHeight: '160%', color: 'var(--color-warning-text)' }}>
                {b.items.map((it, i) => <li key={i}>{t.falseEasyItem(it.taskTitle, it.score, it.scaleMax)}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
// false-easy 匯出列(Excel / 文字共用)。
function falseEasyExportLines(runs: VariantRun[], t: Chrome): string[] {
  const lines: string[] = []
  for (const r of runs) {
    for (const it of falseEasyItems(r)) {
      lines.push(`${runs.length > 1 ? `[${t.version} ${r.variant}] ` : ''}${t.falseEasyItem(it.taskTitle, it.score, it.scaleMax)}`)
    }
  }
  return lines
}

// ── 放聲思考逐字稿 + 自動重點 ────────────────────────────────────────────────
function TranscriptBlock({ title, transcript }: { title: string; transcript: string }) {
  const t = tr(useLang())
  const [open, setOpen] = useState(false)
  const digest = digestTranscript(transcript)
  return (
    <div className="mt-4">
      <p className="text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>{title}</p>
      {transcript ? (
        <>
          <p className="mt-1 text-neutral-7" style={{ fontSize: 12 }}>{t.digestLabel}</p>
          {digest.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-neutral-8" style={{ fontSize: 12, lineHeight: '150%' }}>
              {digest.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          ) : (
            <p className="mt-1 text-neutral-6" style={{ fontSize: 12 }}>{t.digestNone}</p>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1.5 text-primary"
            style={{ fontSize: 12, fontWeight: 500 }}
          >
            {open ? t.transcriptCollapse : t.transcriptExpand(transcript.length)}
          </button>
          {open && (
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-neutral-4 bg-canvas p-3 text-neutral-8" style={{ fontSize: 12, lineHeight: '160%' }}>
              {transcript}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-neutral-6" style={{ fontSize: 12 }}>{t.transcriptNone}</p>
      )}
    </div>
  )
}

// ── 結果頁底部的匯出按鈕 ────────────────────────────────────────────────────
function ExportBar({ onExcel, onCopyText, onReset }: { onExcel: () => void; onCopyText: () => void; onReset: () => void }) {
  const t = tr(useLang())
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="secondary" startIcon={FileSpreadsheet} onClick={onExcel}>{t.exportExcel}</Button>
      <Button
        variant="secondary"
        startIcon={copied ? Check : ClipboardCopy}
        onClick={async () => { onCopyText(); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      >
        {copied ? t.copied : t.copyText}
      </Button>
      <Button variant="text" startIcon={RotateCcw} className="ml-auto" onClick={onReset}>{t.restart}</Button>
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
function fmtAnswer(a: SurveyAnswer, t: Chrome): string {
  return a.questionType === 'singleEase' ? t.pts(Number(a.value)) : (String(a.value).trim() || t.blank)
}
function surveyTextLines(label: string, taskSurveys: VariantRun['taskSurveys'], postTestAnswers: SurveyAnswer[], t: Chrome): string[] {
  const out: string[] = []
  if (taskSurveys.length) {
    for (const ts of taskSurveys) {
      out.push(`  ${t.surveyTaskLabel(ts.taskTitle)}`)
      for (const a of ts.answers) out.push(`    - ${a.prompt} → ${fmtAnswer(a, t)}`)
    }
  }
  if (postTestAnswers.length) {
    out.push(`  ${label}${t.surveyPostTest}:`)
    for (const a of postTestAnswers) out.push(`    - ${a.prompt} → ${fmtAnswer(a, t)}`)
  }
  return out
}
function surveyExcelRows(taskSurveys: VariantRun['taskSurveys'], postTestAnswers: SurveyAnswer[], t: Chrome): (string | number)[][] {
  const rows: (string | number)[][] = []
  for (const ts of taskSurveys) {
    for (const a of ts.answers) rows.push([t.xSurveyTask(ts.taskTitle), a.prompt, fmtAnswer(a, t)])
  }
  for (const a of postTestAnswers) rows.push([t.xSurveyPost, a.prompt, fmtAnswer(a, t)])
  return rows
}
function SurveySection({ heading, taskSurveys, postTestAnswers }: { heading: string; taskSurveys: VariantRun['taskSurveys']; postTestAnswers?: SurveyAnswer[] }) {
  const t = tr(useLang())
  const post = postTestAnswers ?? []
  if (!taskSurveys.length && !post.length) return null
  return (
    <div className="mt-5">
      <p className="text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>{heading}</p>
      {taskSurveys.map((ts) => (
        <div key={ts.taskId} className="mt-3">
          <p className="text-neutral-7" style={{ fontSize: 12, fontWeight: 600 }}>{t.surveyTaskLabel(ts.taskTitle)}</p>
          <SurveyAnswerList answers={ts.answers} />
        </div>
      ))}
      {post.length > 0 && (
        <div className="mt-3">
          <p className="text-neutral-7" style={{ fontSize: 12, fontWeight: 600 }}>{t.surveyPostTest}</p>
          <SurveyAnswerList answers={post} />
        </div>
      )}
    </div>
  )
}

// ── 單版本結果頁 ─────────────────────────────────────────────────────────────
function SingleResultScreen({ project, run, tester, postTestAnswers, recording, recordingBlob, onReset }: { project: UTProject<any>; run: VariantRun; tester: string; postTestAnswers: SurveyAnswer[]; recording: boolean; recordingBlob: Blob | null; onReset: () => void }) {
  const lang = useLang()
  const t = tr(lang)
  const feLines = falseEasyExportLines([run], t)
  function excel() {
    const rows: (string | number)[][] = [
      [t.xName, L(project.title, lang)],
      [t.xTester, tester || '—'],
      [t.xVersion, `${run.variant}(${run.variantLabel})`],
      [t.xDate, fmtDateTime(run.startedAt)],
      [t.xDurationMin, durationMin(run.startedAt, run.finishedAt)],
      [t.xRate, `${run.rate}% (${run.successCount}/${run.total})`],
      [],
      ['#', t.xTask, t.xResult, t.xReason],
      ...run.outcomes.map((o, i) => [i + 1, o.title, o.result === 'success' ? t.success : t.fail, o.reason ?? '']),
      ...(feLines.length ? [[], [t.falseEasyExcel, feLines.join(' / ')]] : []),
      [],
      [t.xDigest, digestTranscript(run.transcript).join(' / ') || t.none],
      [t.xTranscript, run.transcript || t.none],
      ...(run.taskSurveys.length || postTestAnswers.length ? [[], [t.xCategory, t.xQuestion, t.xAnswer], ...surveyExcelRows(run.taskSurveys, postTestAnswers, t)] : []),
    ]
    downloadExcel(`UT-${project.id}-${run.variant}-${tester || 'anon'}.xls`, rows)
  }
  function text() {
    const lines = [
      `${t.xName}:${L(project.title, lang)}`,
      `${t.xTester}:${tester || '—'}`,
      `${t.xVersion}:${run.variant}(${run.variantLabel})`,
      `${t.xDate}:${fmtDateTime(run.startedAt)}`,
      `${t.duration}:${t.durationVal(durationMin(run.startedAt, run.finishedAt))}`,
      `${t.xRate}:${run.rate}% (${run.successCount}/${run.total})`,
      '',
      `${t.xTaskResults}`,
      ...run.outcomes.map((o, i) => `  ${i + 1}. [${o.result === 'success' ? t.success : t.fail}] ${o.title}${o.result === 'fail' && o.reason ? ` — ${t.failReason}:${o.reason}` : ''}`),
      ...(feLines.length ? ['', `${t.falseEasyExcel}:`, ...feLines.map((l) => `  - ${l}`)] : []),
      '',
      `${t.xDigest}:${digestTranscript(run.transcript).join(' / ') || t.none}`,
      `${t.xTranscript}:${run.transcript || t.none}`,
      ...(run.taskSurveys.length || postTestAnswers.length ? ['', ...surveyTextLines('', run.taskSurveys, postTestAnswers, t)] : []),
    ]
    copyToClipboard(lines.join('\n'))
  }

  const toasts = useAutoDeliver({ excel, recordingBase: `UT-${project.id}-${run.variant}-${tester || 'anon'}`, recording, recordingBlob, lang })

  return (
    <>
    <ResultShell badge={t.resultBadgeSingle(run.variant)}>
      <h1 className="text-neutral-9" style={{ fontSize: 22, fontWeight: 600, lineHeight: '130%' }}>{L(project.title, lang)}</h1>

      <div className="mt-5 rounded-lg border border-neutral-4 p-4">
        <div className="flex items-baseline gap-2">
          <span style={{ fontSize: 36, fontWeight: 700 }} className="text-primary">{run.rate}%</span>
          <span className="text-neutral-7" style={{ fontSize: 13 }}>{t.successRate(run.successCount, run.total)}</span>
        </div>
        <ProgressBar className="mt-2" value={run.rate} height={8} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-neutral-8" style={{ fontSize: 13 }}>
        <div><span className="text-neutral-6">{t.tester}:</span> <b>{tester || '—'}</b></div>
        <div><span className="text-neutral-6">{t.version}:</span> {run.variant}({run.variantLabel})</div>
        <div><span className="text-neutral-6">{t.date}:</span> {fmtDateTime(run.startedAt)}</div>
        <div><span className="text-neutral-6">{t.duration}:</span> {t.durationVal(durationMin(run.startedAt, run.finishedAt))}</div>
      </div>

      <p className="mt-5 text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>{t.taskSummary}</p>
      <OutcomeList outcomes={run.outcomes} />

      <FalseEasySection runs={[run]} />

      <TranscriptBlock title={t.transcriptTitleSingle} transcript={run.transcript} />

      <SurveySection heading={t.surveyHeadingSingle} taskSurveys={run.taskSurveys} postTestAnswers={postTestAnswers} />

      <Notice className="mt-5" variant="warning" dismissible={false} title={t.noticeSingleTitle} description={t.noticeSingleDesc} />
      <ExportBar onExcel={excel} onCopyText={text} onReset={onReset} />
    </ResultShell>
    <ToastHost toasts={toasts} />
    </>
  )
}

// ── 綜合結論(N 個版本)──────────────────────────────────────────────────────
function concludeMulti(runs: VariantRun[], t: Chrome) {
  const total = runs[0]?.total ?? 0
  const max = Math.max(...runs.map((r) => r.successCount))
  const best = runs.filter((r) => r.successCount === max)
  if (best.length === runs.length) return t.concludeSame(max, total)
  if (best.length > 1) return t.concludeTie(best.map((r) => `${t.version} ${r.variant}`).join('、'), max, total, best[0].rate)
  const b = best[0]
  const others = runs.filter((r) => r !== b)
  return t.concludeBest(b.variant, b.variantLabel, b.rate, b.successCount, b.total, others.map((r) => `${t.version} ${r.variant} ${r.rate}%`).join('、'))
}
function thinkAloudNote(runs: VariantRun[], t: Chrome) {
  if (runs.every((r) => !r.transcript)) return t.taNone
  return t.taPrefix + runs.map((r) => {
    const d = digestTranscript(r.transcript)
    return `${t.version} ${r.variant}:${d.length ? d.join(';') : t.taNoKey}`
  }).join(' / ') + '。'
}

function CombinedResultScreen({ project, runs, tester, postTestAnswers, recording, recordingBlob, onReset }: { project: UTProject<any>; runs: VariantRun[]; tester: string; postTestAnswers: SurveyAnswer[]; recording: boolean; recordingBlob: Blob | null; onReset: () => void }) {
  const lang = useLang()
  const t = tr(lang)
  const conclusion = concludeMulti(runs, t)
  const taNote = thinkAloudNote(runs, t)
  const variantsLabel = runs.map((r) => r.variant).join(' vs ')
  const hasSurvey = runs.some((r) => r.taskSurveys.length > 0) || postTestAnswers.length > 0
  const feLines = falseEasyExportLines(runs, t)

  function excel() {
    const taskRows = project.tasks.map((task, i) => {
      const cells: (string | number)[] = [i + 1, L(task.title, lang)]
      runs.forEach((r) => {
        const o = r.outcomes.find((x) => x.id === task.id)
        cells.push(o?.result === 'success' ? t.success : t.fail, o?.reason ?? '')
      })
      return cells
    })
    const header: string[] = ['#', t.xTask]
    runs.forEach((r) => header.push(`${r.variant} ${t.xResult}`, `${r.variant} ${t.xReason}`))
    const rows: (string | number)[][] = [
      [t.xName, L(project.title, lang)],
      [t.xTester, tester || '—'],
      [t.xDate, fmtDateTime(runs[0].startedAt)],
      [],
      ...runs.map((r) => [`${t.version} ${r.variant} ${t.xRate}`, `${r.rate}% (${r.successCount}/${r.total})`]),
      [t.xConclusion, conclusion],
      [t.xTaNote, taNote],
      ...(feLines.length ? [[], [t.falseEasyExcel, feLines.join(' / ')]] : []),
      [],
      header,
      ...taskRows,
      [],
      ...runs.map((r) => [`${t.version} ${r.variant} ${t.xTranscript}`, r.transcript || t.none]),
      ...(hasSurvey
        ? [[], [t.xCategory, t.xQuestion, t.xAnswer],
            ...runs.flatMap((r) => surveyExcelRows(r.taskSurveys, [], t).map((row) => [`${r.variant} · ${row[0]}`, row[1], row[2]])),
            ...surveyExcelRows([], postTestAnswers, t)]
        : []),
    ]
    downloadExcel(`UT-${project.id}-${runs.map((r) => r.variant).join('')}-${tester || 'anon'}.xls`, rows)
  }
  function text() {
    const lines = [
      `${t.xName}:${L(project.title, lang)}`,
      `${t.xTester}:${tester || '—'}`,
      `${t.xDate}:${fmtDateTime(runs[0].startedAt)}`,
      '',
      ...runs.map((r) => t.xRateOf(r.variant, r.variantLabel, r.rate, r.successCount, r.total)),
      '',
      `${t.xPerCompare}`,
      ...project.tasks.map((task, i) => {
        const per = runs.map((r) => {
          const o = r.outcomes.find((x) => x.id === task.id)
          return `     ${r.variant}:${o?.result === 'success' ? t.success : `${t.fail}(${o?.reason ?? ''})`}`
        }).join('\n')
        return `  ${i + 1}. ${L(task.title, lang)}\n${per}`
      }),
      ...(feLines.length ? ['', `${t.falseEasyExcel}:`, ...feLines.map((l) => `  - ${l}`)] : []),
      '',
      `${t.xConclusion}:${conclusion}`,
      `${taNote}`,
      '',
      ...runs.map((r) => `${t.version} ${r.variant} ${t.xTranscript}:${r.transcript || t.none}`),
      ...(hasSurvey
        ? ['',
            ...runs.flatMap((r) => surveyTextLines(`${t.version} ${r.variant} `, r.taskSurveys, [], t)),
            ...surveyTextLines('', [], postTestAnswers, t)]
        : []),
    ]
    copyToClipboard(lines.join('\n'))
  }

  const Stat = ({ run }: { run: VariantRun }) => (
    <div className="min-w-[150px] flex-1 rounded-lg border border-neutral-4 p-4">
      <p style={{ fontSize: 13, fontWeight: 600 }} className="text-neutral-9">{t.version} {run.variant}</p>
      <p className="text-neutral-6" style={{ fontSize: 12 }}>{run.variantLabel}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span style={{ fontSize: 28, fontWeight: 700 }} className="text-primary">{run.rate}%</span>
        <span className="text-neutral-7" style={{ fontSize: 12 }}>{t.successOf(run.successCount, run.total)}</span>
      </div>
      <ProgressBar className="mt-2" value={run.rate} height={6} />
    </div>
  )

  const toasts = useAutoDeliver({ excel, recordingBase: `UT-${project.id}-${runs.map((r) => r.variant).join('')}-${tester || 'anon'}`, recording, recordingBlob, lang })

  return (
    <>
    <ResultShell badge={t.resultBadgeCombined(variantsLabel)}>
      <h1 className="text-neutral-9" style={{ fontSize: 22, fontWeight: 600, lineHeight: '130%' }}>{L(project.title, lang)}</h1>
      <div className="mt-2 text-neutral-8" style={{ fontSize: 13 }}>
        <span className="text-neutral-6">{t.tester}:</span> <b>{tester || '—'}</b>
        <span className="ml-4 text-neutral-6">{t.date}:</span> {fmtDateTime(runs[0].startedAt)}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {runs.map((r) => <Stat key={r.variant} run={r} />)}
      </div>

      <div className="mt-4 rounded-lg p-4" style={{ backgroundColor: 'var(--color-info-subtle)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-info-text)' }}>{t.xConclusion}</p>
        <p className="mt-1" style={{ fontSize: 13, lineHeight: '150%', color: 'var(--color-info-text)' }}>{conclusion}</p>
        <p className="mt-2" style={{ fontSize: 12, lineHeight: '150%', color: 'var(--color-info-text)' }}>{taNote}</p>
      </div>

      <FalseEasySection runs={runs} />

      {runs.map((r) => (
        <div key={r.variant}>
          <p className="mt-5 text-neutral-9" style={{ fontSize: 13, fontWeight: 600 }}>{t.perVariant(r.variant)}</p>
          <OutcomeList outcomes={r.outcomes} />
          <TranscriptBlock title={t.transcriptTitle(r.variant)} transcript={r.transcript} />
          <SurveySection heading={t.surveyHeading(r.variant)} taskSurveys={r.taskSurveys} />
        </div>
      ))}

      <SurveySection heading={t.surveyPostTest} taskSurveys={[]} postTestAnswers={postTestAnswers} />

      <Notice className="mt-5" variant="warning" dismissible={false} title={t.noticeCombinedTitle} description={t.noticeCombinedDesc} />
      <ExportBar onExcel={excel} onCopyText={text} onReset={onReset} />
    </ResultShell>
    <ToastHost toasts={toasts} />
    </>
  )
}

// ── 對外:單版本流程 ────────────────────────────────────────────────────────
export function UsabilityTest<A>({ project, variant, password = '0000', record = false, defaultLang = 'zh' }: { project: UTProject<A>; variant: string; password?: string; record?: boolean; defaultLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(defaultLang)
  const [unlocked, setUnlocked] = useState(false)
  const [phase, setPhase] = useState<'intro' | 'running' | 'posttest' | 'done'>('intro')
  const [tester, setTester] = useState('')
  const [run, setRun] = useState<VariantRun | null>(null)
  const [postTest, setPostTest] = useState<SurveyAnswer[]>([])
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const postTestQs = project.postTestSurvey ?? []
  const rec = useScreenRecorder()
  const t = tr(lang)

  useEffect(() => { if (phase === 'done') rec.stop().then(setRecordingBlob) }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  let content: ReactNode
  if (!unlocked) {
    content = <PasswordGate password={password} lang={lang} onUnlock={() => setUnlocked(true)} />
  } else if (phase === 'intro') {
    content = (
      <IntroScreen
        project={project}
        badge={t.badgeSingle(variant)}
        note={t.noteSingle(project.tasks.length)}
        record={record}
        tester={tester}
        lang={lang}
        onLangChange={setLang}
        onTesterChange={setTester}
        onStart={() => { if (tester.trim()) { if (record) rec.start(); setPhase('running') } }}
      />
    )
  } else if (phase === 'running') {
    content = <RunPhase project={project} variant={variant} onDone={(r) => { setRun(r); setPhase(postTestQs.length ? 'posttest' : 'done') }} />
  } else if (phase === 'posttest') {
    content = <SurveyStep badge={t.postTestBadge} title={t.postTestTitle} questions={postTestQs} submitLabel={t.postTestSubmit} onSubmit={(a) => { setPostTest(a); setPhase('done') }} />
  } else {
    content = <SingleResultScreen project={project} run={run!} tester={tester} postTestAnswers={postTest} recording={record && rec.started} recordingBlob={recordingBlob} onReset={() => { setPhase('intro'); setTester(''); setRun(null); setPostTest([]); setRecordingBlob(null) }} />
  }
  return <LangCtx.Provider value={lang}>{content}</LangCtx.Provider>
}

// ── 對外:多版本綜合流程(A→B→C…)──────────────────────────────────────────
export function UsabilityTestAB<A>({ project, order = ['A', 'B'], password = '0000', record = false, defaultLang = 'zh' }: { project: UTProject<A>; order?: string[]; password?: string; record?: boolean; defaultLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(defaultLang)
  const [unlocked, setUnlocked] = useState(false)
  const [phase, setPhase] = useState<'intro' | 'run' | 'interstitial' | 'posttest' | 'done'>('intro')
  const [tester, setTester] = useState('')
  const [vIndex, setVIndex] = useState(0)
  const [runs, setRuns] = useState<VariantRun[]>([])
  const [postTest, setPostTest] = useState<SurveyAnswer[]>([])
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const postTestQs = project.postTestSurvey ?? []
  const rec = useScreenRecorder()
  const t = tr(lang)

  function reset() { setPhase('intro'); setTester(''); setVIndex(0); setRuns([]); setPostTest([]); setRecordingBlob(null) }
  const orderLabel = order.map((v) => `${t.version} ${v}`).join(' → ')

  useEffect(() => { if (phase === 'done') rec.stop().then(setRecordingBlob) }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  let content: ReactNode
  if (!unlocked) {
    content = <PasswordGate password={password} lang={lang} onUnlock={() => setUnlocked(true)} />
  } else if (phase === 'intro') {
    content = (
      <IntroScreen
        project={project}
        badge={t.badgeCombined(order.join(' → '))}
        note={t.noteCombined(order.length, orderLabel, project.tasks.length)}
        record={record}
        tester={tester}
        lang={lang}
        onLangChange={setLang}
        onTesterChange={setTester}
        onStart={() => { if (tester.trim()) { if (record) rec.start(); setPhase('run') } }}
      />
    )
  } else if (phase === 'run') {
    const variant = order[vIndex]
    content = (
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
  } else if (phase === 'interstitial') {
    const doneV = order[vIndex]
    const nextV = order[vIndex + 1]
    content = (
      <div className="flex h-screen w-full items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-[480px] rounded-xl border border-neutral-5 bg-surface p-8 text-center shadow-lg">
          <Chip tone="success" className="mb-3">{t.variantDone(doneV, vIndex + 1, order.length)}</Chip>
          <h2 className="text-neutral-9" style={{ fontSize: 18, fontWeight: 600 }}>{t.nextUp(nextV)}</h2>
          <p className="mt-2 text-neutral-7" style={{ fontSize: 13, lineHeight: '150%' }}>{t.interBody(doneV, nextV)}</p>
          <Button variant="primary" className="mt-5 w-full" startIcon={ArrowRight} onClick={() => { setVIndex(vIndex + 1); setPhase('run') }}>
            {t.startVariant(nextV)}
          </Button>
        </div>
      </div>
    )
  } else if (phase === 'posttest') {
    content = <SurveyStep badge={t.postTestBadge} title={t.postTestTitle} questions={postTestQs} submitLabel={t.postTestSubmit} onSubmit={(a) => { setPostTest(a); setPhase('done') }} />
  } else {
    content = <CombinedResultScreen project={project} runs={runs} tester={tester} postTestAnswers={postTest} recording={record && rec.started} recordingBlob={recordingBlob} onReset={reset} />
  }
  return <LangCtx.Provider value={lang}>{content}</LangCtx.Provider>
}
