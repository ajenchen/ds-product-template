import { useState } from 'react'
import {
  AppShell, SidebarProvider, Sidebar, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarInput, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarMenuBadge, SidebarTrigger, TooltipProvider, ScrollArea,
  Avatar, ItemAvatar, Textarea, Button,
} from '@qijenchen/design-system'
import { Phone, Video, Info, Send } from 'lucide-react'

type Presence = 'online' | 'away' | 'busy' | 'offline'
type Message = { id: string; from: 'me' | 'them'; text: string; time: string }
type Conversation = {
  id: string; name: string
  color: 'blue' | 'green' | 'purple' | 'magenta' | 'turquoise'
  status: Presence; preview: string; unread: number; messages: Message[]
}

const CONVERSATIONS: Conversation[] = [
  { id: 'amy', name: 'Amy Chen', color: 'blue', status: 'online',
    preview: '那份茶葉報告我下午寄給你 👍', unread: 2,
    messages: [
      { id: 'a1', from: 'them', text: '早安!今天的烏龍試喝排好了嗎?', time: '09:12' },
      { id: 'a2', from: 'me', text: '排好了,10:30 在三號品茶室。', time: '09:14' },
      { id: 'a3', from: 'them', text: '太好了,我準備一下評分表。', time: '09:15' },
      { id: 'a4', from: 'them', text: '那份茶葉報告我下午寄給你 👍', time: '09:16' },
    ] },
  { id: 'ben', name: 'Ben Liu', color: 'green', status: 'away',
    preview: '收到,週五前完成。', unread: 0,
    messages: [
      { id: 'b1', from: 'me', text: '新供應商的樣品到了嗎?', time: '昨天' },
      { id: 'b2', from: 'them', text: '收到,週五前完成。', time: '昨天' },
    ] },
  { id: 'team', name: '產品團隊', color: 'purple', status: 'online',
    preview: 'Cara: 設計稿更新了', unread: 5,
    messages: [
      { id: 't1', from: 'them', text: 'Cara: 設計稿更新了,大家看一下 figma。', time: '08:40' },
      { id: 't2', from: 'me', text: '收到,等等 review。', time: '08:42' },
    ] },
  { id: 'dora', name: 'Dora Wang', color: 'magenta', status: 'offline',
    preview: '謝謝!週末愉快 🍵', unread: 0,
    messages: [
      { id: 'd1', from: 'them', text: '帳單已對好,沒問題。', time: '週三' },
      { id: 'd2', from: 'me', text: '謝謝!週末愉快 🍵', time: '週三' },
    ] },
]

const STATUS_LABEL: Record<Presence, string> = {
  online: '線上', away: '離開', busy: '忙碌', offline: '離線',
}

function ConversationSidebar({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 min-w-0">
          <Avatar alt="TeaChat" size={24} shape="square" color="green" solid />
          <span className="text-body-lg font-medium truncate">TeaChat</span>
        </div>
        <SidebarInput placeholder="搜尋對話…" aria-label="搜尋對話" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>對話</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CONVERSATIONS.map((c) => (
                <SidebarMenuItem key={c.id}>
                  <SidebarMenuButton asChild isActive={c.id === activeId} onClick={() => onSelect(c.id)}>
                    <button type="button" className="w-full">
                      <ItemAvatar alt={c.name} color={c.color} status={c.status} />
                      <span data-sidebar="menu-label" className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium">{c.name}</span>
                        <span className="block truncate text-caption text-fg-secondary">{c.preview}</span>
                      </span>
                    </button>
                  </SidebarMenuButton>
                  {c.unread > 0 && <SidebarMenuBadge count={c.unread} max={99} />}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <div role="group" aria-label="當前使用者">
                <ItemAvatar alt="我" color="turquoise" status="online" />
                <span data-sidebar="menu-label" className="min-w-0 flex-1 truncate">我(線上)</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function ChatHeader({ conversation }: { conversation: Conversation }) {
  return (
    <header className="flex items-center gap-3 h-[var(--chrome-header-height)] px-[var(--layout-space-loose)] bg-surface border-b border-divider">
      <SidebarTrigger />
      <ItemAvatar alt={conversation.name} color={conversation.color} status={conversation.status} />
      <div className="flex-1 min-w-0">
        <div className="text-body-lg font-medium truncate">{conversation.name}</div>
        <div className="text-caption text-fg-secondary">{STATUS_LABEL[conversation.status]}</div>
      </div>
      <Button variant="ghost" size="md" iconOnly startIcon={Phone} aria-label="語音通話" />
      <Button variant="ghost" size="md" iconOnly startIcon={Video} aria-label="視訊通話" />
      <Button variant="ghost" size="md" iconOnly startIcon={Info} aria-label="對話資訊" />
    </header>
  )
}

function MessageBubble({ message, name, color }: { message: Message; name: string; color: Conversation['color'] }) {
  const mine = message.from === 'me'
  return (
    <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      {!mine && <ItemAvatar alt={name} color={color} />}
      <div className={`flex flex-col gap-1 max-w-[70%] ${mine ? 'items-end' : 'items-start'}`}>
        <div className={mine
          ? 'rounded-2xl rounded-br-sm bg-accent text-fg-on-accent px-3 py-2 text-body'
          : 'rounded-2xl rounded-bl-sm bg-subtle text-foreground px-3 py-2 text-body'}>
          {message.text}
        </div>
        <span className="text-caption text-fg-secondary px-1">{message.time}</span>
      </div>
    </div>
  )
}

function ChatThread({ conversation }: { conversation: Conversation }) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<Message[]>(conversation.messages)
  function send() {
    const text = draft.trim()
    if (!text) return
    setMessages((prev) => [...prev, { id: `m${prev.length}`, from: 'me', text, time: '現在' }])
    setDraft('')
  }
  return (
    <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-4 px-[var(--layout-space-loose)] py-[var(--layout-space-tight)]">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} name={conversation.name} color={conversation.color} />
          ))}
        </div>
      </ScrollArea>
      <div className="flex items-end gap-2 border-t border-divider bg-surface px-[var(--layout-space-loose)] py-[var(--layout-space-tight)]">
        <Textarea rows={1} placeholder="輸入訊息…" aria-label="輸入訊息" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          className="flex-1 max-h-32" />
        <Button variant="primary" size="md" startIcon={Send} onClick={send} disabled={!draft.trim()}>傳送</Button>
      </div>
    </div>
  )
}

export default function App() {
  const [activeId, setActiveId] = useState<string>(CONVERSATIONS[0].id)
  const current = CONVERSATIONS.find((c) => c.id === activeId) ?? CONVERSATIONS[0]
  return (
    <TooltipProvider delayDuration={500} skipDelayDuration={300}>
      <SidebarProvider>
        <AppShell layout="primary-sidebar"
          sidebar={<ConversationSidebar activeId={activeId} onSelect={setActiveId} />}
          header={<ChatHeader conversation={current} />}>
          <ChatThread key={current.id} conversation={current} />
        </AppShell>
      </SidebarProvider>
    </TooltipProvider>
  )
}
