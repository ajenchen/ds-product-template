// 2026-05-26 完整 AppShell product layout 範例
// Per user「預設應該是 app shells 的範例」directive — fork user 看 Storybook 直接看到
// 真實 product 起點(Sidebar + Header + Page),不是孤立 Button。

import type { Meta, StoryObj } from '@storybook/react'
import App from './App'

const meta: Meta<typeof App> = {
  title: 'Apps/_template/AppShell Dashboard',
  component: App,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '`_template` 是 fork product-workspace 後的起始 app skeleton,**用 DS AppShell + Sidebar + PageHeader 完整 layout**。\n\n' +
          'Consumer 替換 `App.tsx` 內的:\n' +
          '- `NAV` array(sidebar navigation 項目)\n' +
          '- `PageHeader` content(business-specific 標題 / actions)\n' +
          '- Page component(DashboardPage / OrderListPage / etc.)\n\n' +
          'SSOT 鐵律:只 import `@qijenchen/design-system` exports,**禁修改 DS source**。',
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof App>

export const Default: Story = {
  name: 'Dashboard 預設',
}
