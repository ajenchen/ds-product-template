import type { Meta, StoryObj } from '@storybook/react'
import { UsabilityTest, UsabilityTestAB, type UTProject } from '@imethan0254/ut-model-a'
import { chatVariant, type ChatAction } from './chatAdapter'
import { utSubmit } from './utSubmit'

// ── UT 專案定義:Teams 匯入聊天室標示辨識度 ─────────────────────────────────────
// 受測 prototype = Teams 整合預設(chrome='top-search' + includeTeamsRooms)。
// 驗證:使用者能否分辨哪些聊天室是從 Microsoft Teams 搬遷過來的,並比較兩種標示方式的辨識度:
//   A = Teams 品牌色頭像標示(現行設計,teamsRoomMarker: 'avatar')
//   B = 一般群組頭像 + 房名後綴「[Teams]」(teamsRoomMarker: 'suffix',僅存在於本測試,
//       不影響本體 prototype — config 驅動,預設值仍為 'avatar')
// 無密碼閘;adjacentTeamsNamesake 讓同名的原生 DM 與 Teams 房在列表相鄰,方便觀察比較。
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

const teamsMarkerProject: UTProject<ChatAction> = {
  id: 'teams-room-marker',
  title: 'UT – Teams Migrated Room Marker',
  goal: {
    zh: '驗證使用者能否分辨哪些聊天室是從 Microsoft Teams 搬遷過來的,並比較「品牌色頭像」與「房名後綴 [Teams]」兩種標示方式的辨識度。',
    en: 'Verify whether users can tell which chatrooms were migrated from Microsoft Teams, and compare two marker designs: brand-color avatar vs. a "[Teams]" name suffix.',
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
    { id: 'marker-pref', questionType: 'writtenResponse', prompt: { zh: '哪一種「來自 Teams」的標示方式對你比較清楚?(紫色品牌頭像 vs 房名後綴 [Teams])為什麼?', en: 'Which "from Teams" marker was clearer to you — the purple brand avatar or the "[Teams]" name suffix? Why?' }, required: false },
    { id: 'unexpected', questionType: 'writtenResponse', prompt: { zh: '過程中有沒有遇到任何意外或預期外的狀況?', en: 'Did anything unexpected happen during the process?' }, required: false },
  ],
  tasks: [
    {
      id: 't1',
      title: { zh: '用頂部搜尋,找到並開啟你與「灰原哀」在 Microsoft Teams 時期的 1 對 1 私訊(DM)紀錄。', en: "Use the top search bar to find and open your 1-on-1 direct message (DM) history with 'Haibara Ai' from your Microsoft Teams days." },
      check: (acts) => {
        if (acts.some((a) => a.type === 'open-room' && a.roomId === 'teams-ai')) return { ok: true }
        if (acts.some((a) => a.type === 'open-room' && a.roomId === 'ai')) {
          return { ok: false, reason: { zh: '開到的是本 app 原生的私訊,不是從 Teams 搬遷過來的那筆紀錄', en: "Opened this app's native DM, not the record migrated from Teams" } }
        }
        return { ok: false, reason: { zh: '未開啟與灰原哀從 Teams 搬遷過來的私訊紀錄', en: 'Did not open the Teams-migrated DM record with Haibara Ai' } }
      },
      postTask: [
        seqQuestion,
        { id: 't1-tell', questionType: 'writtenResponse', prompt: { zh: '你是怎麼找到並確認那筆是「從 Teams 搬過來」的私訊紀錄的?', en: 'How did you find and confirm that this was the DM record migrated "from Teams"?' }, required: false },
      ],
    },
    {
      id: 't2',
      title: { zh: '這個 app 裡有些聊天室是從 Microsoft Teams 搬遷過來的。請找出任何一間,並開啟它。', en: 'Some chatrooms in this app were migrated from Microsoft Teams. Find any one of them and open it.' },
      hint: { zh: '注意聊天室在列表上的標示方式。', en: 'Look at how rooms are marked in the list.' },
      check: (acts) =>
        acts.some((a) => a.type === 'open-room' && a.roomId.startsWith('teams-'))
          ? { ok: true }
          : { ok: false, reason: { zh: '未開啟任何從 Teams 匯入的聊天室', en: 'Did not open any Teams-migrated chatroom' } },
      postTask: [
        seqQuestion,
        { id: 't2-tell', questionType: 'writtenResponse', prompt: { zh: '你是怎麼判斷哪些聊天室是從 Teams 搬過來的?', en: 'How did you tell which chatrooms came from Teams?' }, required: false },
      ],
    },
  ],
  variants: {
    // roomOrderSeed 各版不同 → 列表排序各異,受測者無法靠記憶位置作答;check 依 room id 判定不受影響。
    A: chatVariant(
      { zh: '版本 A:Teams 品牌色頭像標示', en: 'Version A: Teams brand-color avatar marker' },
      { chrome: 'top-search', includeTeamsRooms: true, initialShowPreview: false, teamsRoomMarker: 'avatar', adjacentTeamsNamesake: true, roomOrderSeed: 11 },
    ),
    B: chatVariant(
      { zh: '版本 B:一般群組頭像 + 房名後綴 [Teams]', en: 'Version B: regular group avatar + "[Teams]" name suffix' },
      { chrome: 'top-search', includeTeamsRooms: true, initialShowPreview: false, teamsRoomMarker: 'suffix', adjacentTeamsNamesake: true, roomOrderSeed: 22 },
    ),
  },
}

// @app-story-title-skip: UT 測試 story 依 /apply-ut-model-a skill 鐵則必用 `UT/` 前綴 namespace
// (Storybook sidebar 集中在「UT」資料夾;同 repo 既有 UT/Chat List Preview、UT/UserTest Results
// Dashboard 同 convention,title 唯一、不與 template/其他 app 撞 id)
const meta: Meta<typeof UsabilityTest> = {
  title: 'UT/Teams Migrated Room Marker',
  component: UsabilityTest,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UsabilityTest>

// 綜合測試:A→B 與 B→A 各一支,counterbalance 消除順序效應。
// record:錄製畫面+講話聲,摘要頁自動下載 webm + Excel。預設中文,測試說明頁可切 English。
export const CombinedAB: Story = {
  name: '綜合測試 A→B(含結論)',
  render: () => <UsabilityTestAB project={teamsMarkerProject} order={['A', 'B']} record estimatedMinutes={10} submit={utSubmit} />,
}
export const CombinedBA: Story = {
  name: '綜合測試 B→A(counterbalance)',
  render: () => <UsabilityTestAB project={teamsMarkerProject} order={['B', 'A']} record estimatedMinutes={10} submit={utSubmit} />,
}

// 單獨跑某一版(需要時用)。
export const VersionA: Story = {
  name: '只測版本 A — 品牌色頭像標示',
  render: () => <UsabilityTest project={teamsMarkerProject} variant="A" estimatedMinutes={10} submit={utSubmit} />,
}
export const VersionB: Story = {
  name: '只測版本 B — 房名後綴 [Teams]',
  render: () => <UsabilityTest project={teamsMarkerProject} variant="B" estimatedMinutes={10} submit={utSubmit} />,
}
