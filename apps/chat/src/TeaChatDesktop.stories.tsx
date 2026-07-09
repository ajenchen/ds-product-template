import type { Meta, StoryObj } from '@storybook/react'
import App from './App'

// TeaChat Desktop version — 獨立 prototype(2026-07-09 user 指定):
// 桌面版 3-column chat(NavRail chrome,與「Chat 預設」同基底),重點展示
// Microsoft Teams 風格的 Rich editor 輸入功能(RichTextEditor.tsx):
// - 三處輸入框都有 Rich editor(Type icon)toggle:主輸入框 / Thread panel
//   輸入框 / chat bubble hover → More → Edit 的編輯狀態輸入框
// - Toggle ON → format toolbar(對齊 Teams,2026-07-09 v3 順序):Bold / Italic /
//   Underline / Strikethrough │ Text highlight color / Font color / Font size │
//   Bulleted list / Numbered list │ Insert link / More(Quote / Code snippet /
//   Horizontal rule / Clear all formatting)
// - Enter 規則(2026-07-09):Enter 直接送出(list 內 = 換 item)、Shift+Enter 換行
// - 鍵盤清單捷徑:「-」/「*」+空白 → bulleted list;「1.」+空白 → numbered list
// - Link:右鍵 → Edit link / Remove link;Insert link dialog 走 DS Field 規範
//   (必填 * 前綴 + URL 驗證「Please input valid URL」)
const meta: Meta<typeof App> = {
  title: 'Apps/chat/TeaChat Desktop version',
  component: App,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof App>

export const Default: Story = {
  name: 'TeaChat Desktop 預設',
  render: () => <App />,
}
