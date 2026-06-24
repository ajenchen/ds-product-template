import type { Meta, StoryObj } from '@storybook/react'
import { UsabilityTest, UsabilityTestAB, type UTProject } from '@imethan0254/ut-model-a'
import { chatVariant, type ChatAction } from './chatAdapter'

// ── UT 專案定義:Chat List Preview Message Display Preferences ────────────────
// 雙語(zh/en):所有 title / goal / instructions / tasks / variants / survey 皆以
// { zh, en } 提供;受測者可在測試說明頁切語言。引擎自身文字也會同步切換。
// A = 顯示預覽 / B = 精簡列表 / C = 精簡列表 + 多人聊天室字母頭像。
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

const chatListPreviewProject: UTProject<ChatAction> = {
  id: 'chat-list-preview',
  title: 'UT – Chat List Preview Message Display Preferences',
  goal: {
    zh: '了解聊天列表「是否顯示最後一則訊息預覽」對使用者快速找到並進入正確對話的影響。',
    en: 'Understand how showing (or hiding) the last-message preview in the chat list affects how quickly users find and open the right conversation.',
  },
  instructions: [
    { zh: '這是一次易用性測試,我們測的是介面、不是你 — 沒有對錯,依直覺操作即可。', en: "This is a usability test — we're testing the interface, not you. There are no right answers; just go with your instincts." },
    { zh: '過程中請盡量講出你的想法(放聲思考)。', en: 'Please think aloud as much as you can.' },
    { zh: '右下角會出現任務指示;請「實際完成」該操作後再按「完成,下一步」。', en: "A task panel appears at the bottom-right; actually complete the action before pressing 'Done, next'." },
    { zh: '每個任務做完會跳出一個簡短問卷,最後還有整體問卷。', en: 'A short survey pops up after each task, with an overall survey at the end.' },
    { zh: '任務指示框可拖曳移動,避免擋到要操作的地方。', en: 'You can drag the task panel out of the way.' },
  ],
  postTaskSurvey: [seqQuestion, postTaskComment],
  postTestSurvey: [
    { id: 'like', questionType: 'writtenResponse', prompt: { zh: '這次體驗中你最喜歡的部分是什麼?', en: 'What did you like most about this experience?' }, minChars: 15 },
    { id: 'change', questionType: 'writtenResponse', prompt: { zh: '如果可以改一件事,你會改什麼?', en: 'If you could change one thing, what would it be?' }, minChars: 15 },
    { id: 'unexpected', questionType: 'writtenResponse', prompt: { zh: '過程中有沒有遇到任何意外或預期外的狀況?', en: 'Did anything unexpected happen during the process?' }, required: false },
  ],
  tasks: [
    {
      id: 't1',
      title: { zh: '找到並開啟「IT Sales - Table格式範例」這個聊天室。', en: "Find and open the 'IT Sales - Table format example' chat." },
      check: (acts) =>
        acts.some((a) => a.type === 'open-room' && a.roomId === 'semi-sales')
          ? { ok: true }
          : { ok: false, reason: { zh: '未開啟「IT Sales - Table格式範例」聊天室', en: "Did not open the 'IT Sales - Table format example' chat" } },
    },
    {
      id: 't2',
      title: { zh: '找出一個有未讀訊息的聊天室,並進入它。', en: 'Find a chat with unread messages and open it.' },
      hint: { zh: '注意列表上的未讀標記。', en: 'Look for the unread markers in the list.' },
      check: (acts) =>
        acts.some((a) => a.type === 'open-room' && a.unread)
          ? { ok: true }
          : { ok: false, reason: { zh: '未開啟任何「有未讀訊息」的聊天室', en: 'Did not open any chat with unread messages' } },
      postTask: [
        seqQuestion,
        { id: 't2-open', questionType: 'writtenResponse', prompt: { zh: '你是怎麼判斷哪些聊天室有未讀訊息的?', en: 'How did you tell which chats had unread messages?' }, required: false },
      ],
    },
    {
      id: 't3',
      title: { zh: '把任意一個聊天室設為靜音(Mute)。', en: 'Mute any one chat.' },
      check: (acts) =>
        acts.some((a) => a.type === 'mute-room')
          ? { ok: true }
          : { ok: false, reason: { zh: '未將任何聊天室設為靜音', en: 'Did not mute any chat' } },
    },
    {
      id: 't4',
      title: { zh: '開啟任一則訊息的討論串(Thread)並回覆一句話。', en: 'Open a thread on any message and reply once.' },
      hint: { zh: '在訊息上找到「Reply in thread」,輸入文字後送出。', en: "Find 'Reply in thread' on a message, type and send." },
      check: (acts) => {
        const opened = acts.some((a) => a.type === 'open-thread')
        const replied = acts.some((a) => a.type === 'thread-reply')
        if (opened && replied) return { ok: true }
        if (!opened) return { ok: false, reason: { zh: '未開啟任何討論串(Thread)', en: 'Did not open any thread' } }
        return { ok: false, reason: { zh: '已開啟討論串但未送出回覆', en: 'Opened a thread but did not send a reply' } }
      },
    },
    {
      id: 't5',
      title: {
        zh: '找到可以開關「聊天列表顯示最新訊息預覽(Show message previews for chats)」的設定,把它調成你個人比較喜歡的狀態。',
        en: 'Find the setting that toggles "Show message previews for chats" and set it to whatever you personally prefer.',
      },
      check: (acts) =>
        acts.some((a) => a.type === 'open-settings' || a.type === 'toggle-preview')
          ? { ok: true }
          : { ok: false, reason: { zh: '未找到 / 未開啟「顯示訊息預覽」的設定', en: 'Did not find / open the "Show message previews" setting' } },
      // 偏好與原因改用「文字填答」收集(不依賴錄音/逐字稿,人人可填)。
      postTask: [
        {
          id: 't5-pref',
          questionType: 'writtenResponse',
          prompt: {
            zh: '你比較喜歡「有顯示」還是「不顯示」最新訊息預覽?為什麼?(顯示與否對你使用上的差別)',
            en: 'Do you prefer SHOWING or HIDING the latest-message preview? Why? (how it affects your use)',
          },
          minChars: 10,
        },
        postTaskComment,
      ],
    },
  ],
  variants: {
    A: chatVariant({ zh: '版本 A:列表顯示訊息預覽', en: 'Version A: list shows message preview' }, { initialShowPreview: true }),
    B: chatVariant({ zh: '版本 B:精簡列表(不顯示訊息預覽)', en: 'Version B: compact list (no message preview)' }, { initialShowPreview: false }),
    C: chatVariant({ zh: '版本 C:精簡列表 + 多人聊天室字母頭像', en: 'Version C: compact list + initial avatars for group chats' }, { initialShowPreview: false, groupAvatarMode: 'initial' }),
  },
}

const meta: Meta<typeof UsabilityTest> = {
  title: 'UT/Chat List Preview Message Display Preferences',
  component: UsabilityTest,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UsabilityTest>

// 綜合測試:不同版本順序各一支,counterbalance 消除順序效應偏差(cyclic Latin square)。
// record:錄製畫面+講話聲,摘要頁自動下載 webm + Excel。預設中文,測試說明頁可切 English。
export const CombinedAB: Story = {
  name: '綜合測試 A→B→C(含結論)',
  render: () => <UsabilityTestAB project={chatListPreviewProject} order={['A', 'B', 'C']} record />,
}
export const CombinedBCA: Story = {
  name: '綜合測試 B→C→A(counterbalance)',
  render: () => <UsabilityTestAB project={chatListPreviewProject} order={['B', 'C', 'A']} record />,
}
export const CombinedCAB: Story = {
  name: '綜合測試 C→A→B(counterbalance)',
  render: () => <UsabilityTestAB project={chatListPreviewProject} order={['C', 'A', 'B']} record />,
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
