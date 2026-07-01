import type { Meta, StoryObj } from '@storybook/react'
import { UtDashboard } from './UtDashboard'
import { sampleRows } from './sampleData'

// UT 結果 Dashboard —— 部署到 Netlify(掛 Basic Auth)給 PM / designer / QA 看的可分享總覽。
// - 「Live(讀 Supabase)」:向 /.netlify/functions/ut-data 取真實資料。**只在部署後的站台**能拿到
//    資料(本地 Storybook 沒有 Netlify function,會顯示連線失敗提示屬正常)。
// - 「Preview(離線假資料)」:用內建 sample 資料展示版面,本地也能看,方便驗視覺 / demo。
// 放在獨立的 top-level「Dashboards」分類(不與 UT/ 測試混在一起 —— UT/ 是「跑測試」,
// 這裡是「看結果」),並在 .storybook/preview.tsx 的 storySort 把 Dashboards 釘到最上面好找。
const meta: Meta<typeof UtDashboard> = {
  title: 'Dashboards/UserTest Results Dashboard',
  component: UtDashboard,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UtDashboard>

export const Live: Story = {
  name: 'Live（讀 Supabase — 部署站台用）',
  render: () => <UtDashboard />,
}

export const Preview: Story = {
  name: 'Preview（離線假資料 — 本地看版面）',
  render: () => <UtDashboard rows={sampleRows} />,
}
