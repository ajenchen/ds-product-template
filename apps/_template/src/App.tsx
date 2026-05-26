// 2026-05-26 完整 AppShell 範例 — per user 「預設應該是 app shells 的範例」directive
// Fork user 複製本檔為新 product 起點,替換 sidebar nav / page content 為真實業務。
//
// SSOT 鐵律:
//   - Consumer 只 import `@qijenchen/design-system` exports
//   - 禁修改 DS source(走 fork DS repo)
//   - 視覺 token 透過 DS 提供的 `@qijenchen/design-system/styles/tokens` 載入

import { useState } from 'react'
import {
  AppShell,
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  Button,
} from '@qijenchen/design-system'
import { LayoutDashboard, Users, Settings, FileText, BarChart3 } from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'orders', label: 'Orders', icon: FileText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-3 py-2 text-body font-medium">Acme Product</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton id={id}>
                    <Icon className="size-4" />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

function PageHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between px-[var(--layout-space-loose)] h-[var(--chrome-header-height)] border-b border-divider">
      <h1 className="text-h4">{title}</h1>
      <Button variant="primary" size="md">New customer</Button>
    </div>
  )
}

function DashboardPage() {
  return (
    <div className="px-[var(--layout-space-loose)] py-[var(--layout-space-tight)] space-y-6">
      <section>
        <h2 className="text-h5 mb-2">Today</h2>
        <p className="text-body text-fg-secondary">
          替換為真實業務 — 訂單 / 收入 / 待處理任務等 dashboard widgets。Consume DS components
          (DataTable / Chart / Card / Stat 等),never modify DS source。
        </p>
      </section>
      <section className="grid grid-cols-3 gap-4">
        {['Revenue', 'Active customers', 'Pending orders'].map((label) => (
          <div key={label} className="rounded-lg border border-divider bg-surface p-4">
            <div className="text-caption text-fg-muted">{label}</div>
            <div className="text-h3 mt-1">—</div>
          </div>
        ))}
      </section>
    </div>
  )
}

export default function App() {
  const [activeId, setActiveId] = useState<string>('dashboard')
  const current = NAV.find((n) => n.id === activeId) ?? NAV[0]
  return (
    <SidebarProvider activeId={activeId} onActiveChange={setActiveId}>
      <AppShell
        layout="primary-sidebar"
        sidebar={<AppSidebar />}
        header={<PageHeader title={current.label} />}
      >
        <DashboardPage />
      </AppShell>
    </SidebarProvider>
  )
}
