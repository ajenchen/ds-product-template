import type { Meta, StoryObj } from '@storybook/react'
import { UsabilityTest, UsabilityTestAB, type UTProject } from '@imethan0254/ut-model-a'
import { messageWidthVariant, type ChatAction } from './messageWidthAdapter'

// ── UT 專案定義:訊息區寬度（全寬 vs 880px 置中）──────────────────────────────
// 雙語(zh/en):受測者可在測試說明頁切語言。A = 全寬 / B = 880px 置中欄。
const seqQuestion = {
  id: 'seq',
  questionType: 'singleEase' as const,
  prompt: { zh: '整體而言,這個任務有多容易或多困難?', en: 'Overall, how easy or difficult was this task?' },
  scalePoints: 7,
}
// 每個任務評分後的「選填」想法輸入框。
const postTaskComment = {
  id: 'comment',
  questionType: 'writtenResponse' as const,
  prompt: { zh: '想補充說明剛剛的操作或感受嗎?(選填)', en: 'Anything to add about what you just did or felt? (optional)' },
  required: false,
}

const messageWidthProject: UTProject<ChatAction> = {
  id: 'message-area-width',
  title: { zh: 'UT – 訊息區寬度（全寬 vs 880px 置中）', en: 'UT – Message area width (full-width vs 880px centered)' },
  goal: {
    zh: '了解訊息區「全寬」與「880px 置中欄」對閱讀長訊息與掃描寬版資料表的影響。',
    en: 'Understand how a full-width vs an 880px centered message area affects reading long messages and scanning wide data tables.',
  },
  instructions: [
    { zh: '這是一次易用性測試,我們測的是介面、不是你 — 沒有對錯,依直覺操作即可。', en: "This is a usability test — we're testing the interface, not you. There are no right answers; just go with your instincts." },
    { zh: '過程中請盡量講出你的想法（放聲思考）,例如訊息會不會太寬不好讀、表格好不好掃。', en: 'Please think aloud — e.g. whether messages feel too wide to read, or how easy the table is to scan.' },
    { zh: '右下角會出現任務指示;請「實際完成」該操作後再按「完成,下一步」。', en: "A task panel appears at the bottom-right; actually complete the action before pressing 'Done, next'." },
    { zh: '每個任務做完會跳出一個簡短問卷,最後還有整體問卷。', en: 'A short survey pops up after each task, with an overall survey at the end.' },
    { zh: '任務指示框可拖曳移動,避免擋到要操作的地方。', en: 'You can drag the task panel out of the way.' },
  ],
  postTaskSurvey: [seqQuestion, postTaskComment],
  postTestSurvey: [
    { id: 'readable', questionType: 'writtenResponse', prompt: { zh: '剛剛兩種寬度,哪一個讓你比較好讀長訊息或掃描表格?可以說說原因嗎?', en: 'Of the two widths, which made long messages or tables easier to read? Why?' }, required: false },
  ],
  tasks: [
    {
      id: 't1',
      title: { zh: '找到並開啟含有寬版資料表的「IT Sales - Table格式範例」聊天室,把整張表格看過一遍。', en: "Find and open the 'IT Sales - Table format example' chat with the wide table, and look through the whole table." },
      hint: { zh: '可使用列表上方的搜尋;進去後左右捲動瀏覽寬表格。', en: 'Use the search at the top; scroll horizontally to browse the wide table.' },
      check: (acts) =>
        acts.some((a) => a.type === 'open-room' && a.roomId === 'semi-sales')
          ? { ok: true }
          : { ok: false, reason: { zh: '未開啟「IT Sales - Table格式範例」聊天室', en: "Did not open the 'IT Sales - Table format example' chat" } },
    },
    {
      id: 't2',
      title: { zh: '開啟與「Kudo Shinichi 工藤新一」的對話,讀一下他那幾則較長的訊息。', en: "Open the conversation with 'Kudo Shinichi' and read his longer messages." },
      hint: { zh: '他在「我的最愛」區;訊息較長,留意這個寬度好不好讀。', en: "He's in Favorites; his messages are long — notice how readable this width is." },
      check: (acts) =>
        acts.some((a) => a.type === 'open-room' && a.roomId === 'shinichi')
          ? { ok: true }
          : { ok: false, reason: { zh: '未開啟與「Kudo Shinichi 工藤新一」的對話', en: "Did not open the conversation with 'Kudo Shinichi'" } },
    },
    {
      id: 't3',
      title: { zh: '在任一則訊息開啟討論串（Thread）並回覆一句你的想法。', en: 'Open a thread on any message and reply with one thought.' },
      hint: { zh: '在訊息上找到「Reply in thread」,輸入文字後送出。', en: "Find 'Reply in thread' on a message, type and send." },
      check: (acts) => {
        const opened = acts.some((a) => a.type === 'open-thread')
        const replied = acts.some((a) => a.type === 'thread-reply')
        if (opened && replied) return { ok: true }
        if (!opened) return { ok: false, reason: { zh: '未開啟任何討論串（Thread）', en: 'Did not open any thread' } }
        return { ok: false, reason: { zh: '已開啟討論串但未送出回覆', en: 'Opened a thread but did not send a reply' } }
      },
    },
  ],
  variants: {
    // 各版本用不同 roomOrderSeed 打散聊天室排序,避免受測者背順序。
    A: messageWidthVariant({ zh: '版本 A:訊息區全寬', en: 'Version A: full-width message area' }, { initialFullWidth: true, roomOrderSeed: 1 }),
    B: messageWidthVariant({ zh: '版本 B:訊息區 880px 置中欄', en: 'Version B: 880px centered column' }, { initialFullWidth: false, roomOrderSeed: 2 }),
  },
}

const meta: Meta<typeof UsabilityTest> = {
  title: 'UT/Message Area Width',
  component: UsabilityTest,
  parameters: { layout: 'fullscreen' },
  argTypes: { password: { table: { disable: true } } },
}
export default meta
type Story = StoryObj<typeof UsabilityTest>

// 綜合測試:A→B 與 B→A 各一支,counterbalance 消除順序效應偏差。
// record:錄製畫面+講話聲,摘要頁自動下載 webm + Excel。預設中文,測試說明頁可切 English。
export const CombinedAB: Story = {
  name: '綜合測試 A→B（含結論）',
  render: () => <UsabilityTestAB project={messageWidthProject} order={['A', 'B']} record />,
}
export const CombinedBA: Story = {
  name: '綜合測試 B→A（counterbalance）',
  render: () => <UsabilityTestAB project={messageWidthProject} order={['B', 'A']} record />,
}

// 單獨跑某一版（需要時用）。
export const VersionA: Story = {
  name: '只測版本 A — 訊息區全寬',
  render: () => <UsabilityTest project={messageWidthProject} variant="A" />,
}
export const VersionB: Story = {
  name: '只測版本 B — 880px 置中欄',
  render: () => <UsabilityTest project={messageWidthProject} variant="B" />,
}
