import type { Meta, StoryObj } from '@storybook/react'
import App from './App'

// Teams 整合 prototype — 與「Chat 預設」共用同一個 App 基底,差異全部由
// ChatVariantConfig 驅動(base story 行為不變):
// - chrome: 'top-search' → NavRail 移除,頂部 universal search bar(placeholder
//   "search" 置中;最右由右至左為 PersonAvatar → More DropdownMenu)
// - includeTeamsRooms: true → 注入 Microsoft Teams 匯入的聊天室(一律 general
//   chatroom,連 Teams DM 也轉換成 general group chatroom),avatar 改為 Teams
//   品牌色(#5B5FC7)圓底 + 白色 Teams logo 線條標示來源
const meta: Meta<typeof App> = {
  title: 'Apps/chat/Teams Integration',
  component: App,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof App>

export const Default: Story = {
  name: 'Teams 整合預設',
  render: () => <App config={{ chrome: 'top-search', includeTeamsRooms: true }} />,
}
