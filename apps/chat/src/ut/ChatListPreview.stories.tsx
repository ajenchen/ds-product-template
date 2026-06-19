import type { Meta, StoryObj } from '@storybook/react'
import { UsabilityTest, type UTProject } from './UsabilityTest'

// ── UT 專案定義:Chat List Preview Message Display Preferences ────────────────
// 驗證「聊天列表是否顯示訊息預覽」對使用者快速定位對話的影響。
// A = 顯示預覽(基底預設) / B = 精簡列表(不顯示預覽)。
const chatListPreviewProject: UTProject = {
  id: 'chat-list-preview',
  title: 'UT – Chat List Preview Message Display Preferences',
  goal: '了解聊天列表「是否顯示最後一則訊息預覽」對使用者快速找到並進入正確對話的影響。',
  instructions: [
    '這是一次易用性測試,我們測的是介面、不是你 — 沒有對錯,依直覺操作即可。',
    '過程中請盡量講出你的想法(放聲思考)。',
    '畫面右下角會出現任務指示框,完成一項後按「完成,下一步」;卡住可按「跳過」。',
    '任務指示框可拖曳移動,避免擋到要操作的地方。',
  ],
  tasks: [
    { id: 't1', title: '找到並開啟「IT Sales - Table 格式範例」這個聊天室。', hint: '可使用列表上方的搜尋。' },
    { id: 't2', title: '找出有未讀訊息的聊天室,並進入其中一個。', hint: '注意列表上的未讀標記。' },
    { id: 't3', title: '把任意一個聊天室設為靜音(Mute)。', hint: '在聊天室列上 hover 找到更多選單。' },
    { id: 't4', title: '開啟任一則訊息的討論串(Thread)並回覆。' },
  ],
  variants: {
    A: { label: '版本 A:列表顯示訊息預覽', config: { initialShowPreview: true } },
    B: { label: '版本 B:精簡列表(不顯示訊息預覽)', config: { initialShowPreview: false } },
  },
}

// 各版本各為獨立 story → 各自獨立網址,完全不影響 base(apps-chat-chat--default)。
const meta: Meta<typeof UsabilityTest> = {
  title: 'UT/Chat List Preview Message Display Preferences',
  component: UsabilityTest,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UsabilityTest>

export const VersionA: Story = {
  name: '版本 A — 顯示訊息預覽',
  render: () => <UsabilityTest project={chatListPreviewProject} variant="A" />,
}

export const VersionB: Story = {
  name: '版本 B — 精簡列表',
  render: () => <UsabilityTest project={chatListPreviewProject} variant="B" />,
}
