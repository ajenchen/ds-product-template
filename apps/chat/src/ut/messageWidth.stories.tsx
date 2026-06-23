import type { Meta, StoryObj } from '@storybook/react'
import { UsabilityTest, UsabilityTestAB, type UTProject } from '@imethan0254/ut-model-a'
import { messageWidthVariant, type ChatAction } from './messageWidthAdapter'

// ── UT 專案定義:訊息區寬度（全寬 vs 880px 置中）──────────────────────────────
// 驗證「訊息區全寬」與「880px 置中欄」對閱讀長訊息 / 掃描寬版資料表的影響。
// A = 訊息區全寬（基底預設） / B = 880px 置中欄。
//
// 每個任務的 check() 依「使用者實際操作（ChatAction 事件）」判定成功/失敗 —— 光按「完成」不算成功。
// 寬度本身是被動的版面差異,任務刻意把受測者導去「含長訊息 / 寬資料表」的聊天室,
// 讓他們在該版面下實際閱讀與互動;主觀好讀程度則由放聲思考逐字稿捕捉。
const messageWidthProject: UTProject<ChatAction> = {
  id: 'message-area-width',
  title: 'UT – 訊息區寬度（全寬 vs 880px 置中）',
  goal: '了解訊息區「全寬」與「880px 置中欄」對閱讀長訊息與掃描寬版資料表的影響。',
  instructions: [
    '這是一次易用性測試,我們測的是介面、不是你 — 沒有對錯,依直覺操作即可。',
    '過程中請盡量講出你的想法（放聲思考）,例如訊息會不會太寬不好讀、表格好不好掃。',
    '右下角會出現任務指示;請「實際完成」該操作後再按「完成,下一步」。',
    '沒有實際完成就按下一步,該任務會被記為「失敗」。',
    '每個任務做完會跳出一個簡短問卷,最後還有整體問卷。',
    '任務指示框可拖曳移動,避免擋到要操作的地方。',
  ],
  // 任務後問卷:每個任務後收即時難易度感受(SEQ,7 點)。
  postTaskSurvey: [
    {
      id: 'seq',
      questionType: 'singleEase',
      prompt: '整體而言,這個任務有多容易或多困難?',
      scalePoints: 7,
      anchors: { min: '非常困難', max: '非常容易' },
    },
  ],
  // 整場結束問卷:用開放題引導受測者說出對「寬度 / 好讀程度」的整體觀點。
  postTestSurvey: [
    { id: 'readable', questionType: 'writtenResponse', prompt: '剛剛兩種寬度,哪一個讓你比較好讀長訊息或掃描表格?可以說說原因嗎?', minChars: 15 },
    { id: 'change', questionType: 'writtenResponse', prompt: '如果可以調整訊息區的版面,你會怎麼改?', required: false },
  ],
  tasks: [
    {
      id: 't1',
      title: '找到並開啟含有寬版資料表的「IT Sales - Table格式範例」聊天室,把整張表格看過一遍。',
      hint: '可使用列表上方的搜尋;進去後左右捲動瀏覽寬表格。',
      check: (acts) =>
        acts.some((a) => a.type === 'open-room' && a.roomId === 'semi-sales')
          ? { ok: true }
          : { ok: false, reason: '未開啟「IT Sales - Table格式範例」聊天室' },
    },
    {
      id: 't2',
      title: '開啟與「Kudo Shinichi 工藤新一」的對話,讀一下他那幾則較長的訊息。',
      hint: '他在「我的最愛」區;訊息較長,留意這個寬度好不好讀。',
      check: (acts) =>
        acts.some((a) => a.type === 'open-room' && a.roomId === 'shinichi')
          ? { ok: true }
          : { ok: false, reason: '未開啟與「Kudo Shinichi 工藤新一」的對話' },
    },
    {
      id: 't3',
      title: '在任一則訊息開啟討論串（Thread）並回覆一句你的想法。',
      hint: '在訊息上找到「Reply in thread」,輸入文字後送出。',
      check: (acts) => {
        const opened = acts.some((a) => a.type === 'open-thread')
        const replied = acts.some((a) => a.type === 'thread-reply')
        if (opened && replied) return { ok: true }
        if (!opened) return { ok: false, reason: '未開啟任何討論串（Thread）' }
        return { ok: false, reason: '已開啟討論串但未送出回覆' }
      },
    },
  ],
  variants: {
    A: messageWidthVariant('版本 A:訊息區全寬', { initialFullWidth: true }),
    B: messageWidthVariant('版本 B:訊息區 880px 置中欄', { initialFullWidth: false }),
  },
}

// 各 story 各自獨立網址,完全不影響 base（apps-chat-chat--default）。
const meta: Meta<typeof UsabilityTest> = {
  title: 'UT/Message Area Width',
  component: UsabilityTest,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UsabilityTest>

// 綜合測試（推薦）:依序跑版本 A → 版本 B,最後給 A/B 比較與綜合結論。
export const CombinedAB: Story = {
  name: '綜合測試 A→B（含結論）',
  render: () => <UsabilityTestAB project={messageWidthProject} order={['A', 'B']} />,
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
