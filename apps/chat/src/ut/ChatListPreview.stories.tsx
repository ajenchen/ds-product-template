import type { Meta, StoryObj } from '@storybook/react'
import { UsabilityTest, UsabilityTestAB, type UTProject } from '@imethan0254/ut-model-a'
import { chatVariant, type ChatAction } from './chatAdapter'

// ── UT 專案定義:Chat List Preview Message Display Preferences ────────────────
// 驗證「聊天列表是否顯示訊息預覽」對使用者快速定位對話的影響。
// A = 顯示預覽(基底預設) / B = 精簡列表(不顯示預覽) / C = 精簡列表 + 多人聊天室字母頭像。
//
// 每個任務的 check() 依「使用者實際操作」判定成功/失敗 —— 光按「完成」不算成功。
// 任務後 / 測試後另以「問卷」收主觀感受與開放意見(模型 A 的 survey 層)。
const chatListPreviewProject: UTProject<ChatAction> = {
  id: 'chat-list-preview',
  title: 'UT – Chat List Preview Message Display Preferences',
  goal: '了解聊天列表「是否顯示最後一則訊息預覽」對使用者快速找到並進入正確對話的影響。',
  instructions: [
    '這是一次易用性測試,我們測的是介面、不是你 — 沒有對錯,依直覺操作即可。',
    '過程中請盡量講出你的想法(放聲思考)。',
    '右下角會出現任務指示;請「實際完成」該操作後再按「完成,下一步」。',
    '每個任務做完會跳出一個簡短問卷,最後還有整體問卷。',
    '任務指示框可拖曳移動,避免擋到要操作的地方。',
  ],
  // 任務後問卷:套用到所有任務(單一任務可用 task.postTask 覆寫)。
  postTaskSurvey: [
    {
      id: 'seq',
      questionType: 'singleEase',
      prompt: '整體而言,這個任務有多容易或多困難?',
      scalePoints: 7,
      anchors: { min: '非常困難', max: '非常容易' },
    },
  ],
  // 整場測試結束後問卷:開放題引導受測者表達整體觀點。
  postTestSurvey: [
    { id: 'like', questionType: 'writtenResponse', prompt: '這次體驗中你最喜歡的部分是什麼?', minChars: 15 },
    { id: 'change', questionType: 'writtenResponse', prompt: '如果可以改一件事,你會改什麼?', minChars: 15 },
    { id: 'unexpected', questionType: 'writtenResponse', prompt: '過程中有沒有遇到任何意外或預期外的狀況?', required: false },
  ],
  tasks: [
    {
      id: 't1',
      title: '找到並開啟「IT Sales - Table格式範例」這個聊天室。',
      hint: '可使用列表上方的搜尋。',
      check: (acts) =>
        acts.some((a) => a.type === 'open-room' && a.roomId === 'semi-sales')
          ? { ok: true }
          : { ok: false, reason: '未開啟「IT Sales - Table格式範例」聊天室' },
    },
    {
      id: 't2',
      title: '找出一個有未讀訊息的聊天室,並進入它。',
      hint: '注意列表上的未讀標記。',
      check: (acts) =>
        acts.some((a) => a.type === 'open-room' && a.unread)
          ? { ok: true }
          : { ok: false, reason: '未開啟任何「有未讀訊息」的聊天室' },
      // 這個任務後多問一題開放題(覆寫 project.postTaskSurvey):SEQ + 開放意見。
      postTask: [
        {
          id: 'seq',
          questionType: 'singleEase',
          prompt: '整體而言,這個任務有多容易或多困難?',
          scalePoints: 7,
          anchors: { min: '非常困難', max: '非常容易' },
        },
        {
          id: 't2-open',
          questionType: 'writtenResponse',
          prompt: '你是怎麼判斷哪些聊天室有未讀訊息的?',
          required: false,
        },
      ],
    },
    {
      id: 't3',
      title: '把任意一個聊天室設為靜音(Mute)。',
      hint: '在聊天室列上 hover 或開啟更多選單。',
      check: (acts) =>
        acts.some((a) => a.type === 'mute-room')
          ? { ok: true }
          : { ok: false, reason: '未將任何聊天室設為靜音' },
    },
    {
      id: 't4',
      title: '開啟任一則訊息的討論串(Thread)並回覆一句話。',
      hint: '在訊息上找到「Reply in thread」,輸入文字後送出。',
      check: (acts) => {
        const opened = acts.some((a) => a.type === 'open-thread')
        const replied = acts.some((a) => a.type === 'thread-reply')
        if (opened && replied) return { ok: true }
        if (!opened) return { ok: false, reason: '未開啟任何討論串(Thread)' }
        return { ok: false, reason: '已開啟討論串但未送出回覆' }
      },
    },
  ],
  variants: {
    A: chatVariant('版本 A:列表顯示訊息預覽', { initialShowPreview: true }),
    B: chatVariant('版本 B:精簡列表(不顯示訊息預覽)', { initialShowPreview: false }),
    // 版本 C:不顯示訊息預覽;多人(general)聊天室頭像改為室名首字母 + 隨機色;DM 不變。
    C: chatVariant('版本 C:精簡列表 + 多人聊天室字母頭像', { initialShowPreview: false, groupAvatarMode: 'initial' }),
  },
}

// 各 story 各自獨立網址,完全不影響 base(apps-chat-chat--default)。
const meta: Meta<typeof UsabilityTest> = {
  title: 'UT/Chat List Preview Message Display Preferences',
  component: UsabilityTest,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UsabilityTest>

// 綜合測試(推薦):依序跑版本 A → B → C,最後給三版比較與綜合結論。
export const CombinedAB: Story = {
  name: '綜合測試 A→B→C(含結論)',
  render: () => <UsabilityTestAB project={chatListPreviewProject} order={['A', 'B', 'C']} />,
}

// 單獨跑某一版(需要時用)。
export const VersionA: Story = {
  name: '只測版本 A — 顯示訊息預覽',
  render: () => <UsabilityTest project={chatListPreviewProject} variant="A" />,
}
export const VersionB: Story = {
  name: '只測版本 B — 精簡列表',
  render: () => <UsabilityTest project={chatListPreviewProject} variant="B" />,
}
export const VersionC: Story = {
  name: '只測版本 C — 精簡列表 + 字母頭像',
  render: () => <UsabilityTest project={chatListPreviewProject} variant="C" />,
}
