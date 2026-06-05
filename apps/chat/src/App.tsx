// Chat prototype — 3-column messaging UI(Nav rail / Chat list / Conversation)
// 對齊 DS canonical「走 DS primitive composition」+ 視覺 token 全走 DS semantic tokens。
//
// SSOT 鐵律:
//   - Consumer 只 import `@qijenchen/design-system` public exports
//   - 禁修改 DS source(走 fork DS repo)
//   - 聊天 UI 全用 DS primitives 組(Avatar / ProfileCard / Button / Tooltip / Popover
//     / DropdownMenu / ScrollArea / Separator / Textarea / Badge),不自寫 widget bypass
//   - 視覺 token 透過 DS `@qijenchen/design-system/styles/tokens` 載入,App-level 只 compose
//
// Language canonical:UI 文案一律英文;人名走「English + 中文」格式;聊天室名稱可混雜中文(自定義資訊)。
//
// Layout(由左而右):
//   1. Nav rail   — 產品 logo / Home / Chat(未讀 badge)/ avatar / more
//   2. Chat list  — Chats header + Favorites / Chats sections(DM + general rooms)
//   3. Conversation — header bar / message area(bubbles + hover reaction bar)/ input box

import { useEffect, useRef, useState } from 'react'
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Button,
  Avatar,
  ProfileCard,
  ProfileCardDefaultActions,
  Badge,
  Separator,
  ScrollArea,
  Textarea,
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@qijenchen/design-system'
import {
  Home,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  Users,
  Video,
  Pencil,
  Smile,
  Type,
  Send,
  SmilePlus,
  MessagesSquare,
  Reply,
  Volume2,
  Star,
  ExternalLink,
  AppWindow,
  LogOut,
  Maximize2,
} from 'lucide-react'

// ── 共用小工具:icon button + tooltip(所有按鈕 hover 皆給 tooltip) ───────────
function IconBtn({
  icon,
  label,
  onClick,
  badge,
  variant = 'text',
  className,
}: {
  icon: React.ComponentProps<typeof Button>['startIcon']
  label: string
  onClick?: () => void
  badge?: React.ReactNode
  variant?: 'text' | 'tertiary' | 'primary'
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size="md"
          iconOnly
          startIcon={icon}
          badge={badge}
          aria-label={label}
          onClick={onClick}
          className={className}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function IconBtnSm({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Button>['startIcon']
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="text" size="sm" iconOnly startIcon={icon} aria-label={label} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// ── Data model ───────────────────────────────────────────────────────────────
type Presence = 'online' | 'away' | 'busy' | 'offline'
type Color = 'blue' | 'green' | 'purple' | 'magenta' | 'turquoise' | 'indigo' | 'red'

type Person = {
  name: string // "English 中文"
  color: Color
  status: Presence
  role: string
  email: string
}

type Reaction = { emoji: string; count: number }
type Message = {
  id: string
  author: 'me' | string // person key for DM/general
  text: string
  time: string
  reactions?: Reaction[]
  replies?: number
}

type Room = {
  id: string
  type: 'dm' | 'general'
  title: string
  section: 'favorites' | 'chats'
  unread: boolean
  person?: Person // dm
  memberKeys?: string[] // general
  messages: Message[]
}

const PEOPLE: Record<string, Person> = {
  shinichi: { name: 'Kudo Shinichi 工藤新一', color: 'blue', status: 'online', role: 'Detective', email: 'shinichi@teachat.app' },
  ai: { name: 'Haibara Ai 灰原哀', color: 'purple', status: 'busy', role: 'Researcher', email: 'ai@teachat.app' },
  ran: { name: 'Mouri Ran 毛利蘭', color: 'magenta', status: 'away', role: 'Karate Captain', email: 'ran@teachat.app' },
  guanyu: { name: 'Chen Guan-Yu 陳冠宇', color: 'green', status: 'online', role: 'Product Manager', email: 'guanyu@teachat.app' },
  yating: { name: 'Lin Ya-Ting 林雅婷', color: 'turquoise', status: 'offline', role: 'Designer', email: 'yating@teachat.app' },
  kenji: { name: 'Takahashi Kenji 高橋健二', color: 'indigo', status: 'online', role: 'Engineer', email: 'kenji@teachat.app' },
  yui: { name: 'Watanabe Yui 渡邊結衣', color: 'red', status: 'away', role: 'QA Lead', email: 'yui@teachat.app' },
}

const ROOMS: Room[] = [
  {
    id: 'shinichi',
    type: 'dm',
    title: PEOPLE.shinichi.name,
    section: 'favorites',
    unread: true,
    person: PEOPLE.shinichi,
    messages: [
      { id: 'm1', author: 'shinichi', text: 'Morning! Is the oolong tasting flight ready?', time: '09:12', reactions: [{ emoji: '👍', count: 8 }], replies: 8 },
      { id: 'm2', author: 'me', text: 'All set — 10:30 in tasting room No.3.', time: '09:14' },
      { id: 'm3', author: 'shinichi', text: 'Great, I will prepare the scoring sheet.', time: '09:15' },
    ],
  },
  {
    id: 'tea-team',
    type: 'general',
    title: 'Tea Tasting 品茶小組',
    section: 'favorites',
    unread: false,
    memberKeys: ['shinichi', 'guanyu', 'yating', 'kenji'],
    messages: [
      { id: 'g1', author: 'guanyu', text: 'Cupcake ipsum: the tasting report is updated, please take a look on Figma.', time: '08:40', reactions: [{ emoji: '👍', count: 8 }, { emoji: '🍵', count: 3 }], replies: 8 },
      { id: 'g2', author: 'me', text: 'Got it, reviewing now.', time: '08:42' },
    ],
  },
  {
    id: 'ai',
    type: 'dm',
    title: PEOPLE.ai.name,
    section: 'chats',
    unread: true,
    person: PEOPLE.ai,
    messages: [
      { id: 'a1', author: 'ai', text: 'The new supplier samples arrived.', time: 'Yesterday', replies: 2 },
      { id: 'a2', author: 'me', text: 'Perfect, let us cup them tomorrow.', time: 'Yesterday' },
    ],
  },
  {
    id: 'ran',
    type: 'dm',
    title: PEOPLE.ran.name,
    section: 'chats',
    unread: false,
    person: PEOPLE.ran,
    messages: [{ id: 'r1', author: 'ran', text: 'Thanks! Have a great weekend 🍵', time: 'Wed' }],
  },
  {
    id: 'product-team',
    type: 'general',
    title: 'Product Team 產品團隊',
    section: 'chats',
    unread: true,
    memberKeys: ['guanyu', 'yating', 'kenji', 'yui', 'ran'],
    messages: [
      { id: 'p1', author: 'kenji', text: 'Deploy is green. Shipping to staging now.', time: '11:02', reactions: [{ emoji: '🚀', count: 4 }] },
      { id: 'p2', author: 'me', text: 'Nice work team.', time: '11:05' },
    ],
  },
  {
    id: 'engineering',
    type: 'general',
    title: 'Engineering',
    section: 'chats',
    unread: false,
    memberKeys: ['kenji', 'yui'],
    messages: [{ id: 'e1', author: 'kenji', text: 'PR merged. Closing the ticket.', time: 'Mon' }],
  },
]

const COMMON_EMOJI = ['👍', '❤️', '😂', '🎉']

// ── Person avatar(hover → ProfileCard,DS canonical avatar.hoverCard)──────────
function makeProfileCard(p: Person) {
  return (
    <ProfileCard
      name={p.name}
      subtitle={p.role}
      status={p.status}
      avatar={{ alt: p.name, color: p.color }}
      fields={[
        { label: 'Role', value: p.role },
        { label: 'Email', value: p.email },
      ]}
      actions={<ProfileCardDefaultActions />}
    />
  )
}

function PersonAvatar({ person, size = 36 }: { person: Person; size?: number }) {
  return (
    <Avatar
      alt={person.name}
      color={person.color}
      status={person.status}
      size={size}
      hoverCard={makeProfileCard(person)}
    />
  )
}

// 多人聊天室 avatar:統一中性灰底 + 白色 group icon(不給五顏六色)
function GroupAvatar({ size = 36 }: { size?: number }) {
  return <Avatar icon={Users} color="neutral" solid size={size} shape="circle" />
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Nav rail
// ════════════════════════════════════════════════════════════════════════════
function Logo() {
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" aria-label="TeaChat" role="img">
      <defs>
        <linearGradient id="teachat-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      {/* 五邊形帶微微圓角 */}
      <path
        d="M16 2.5 L28 11.2 L23.4 25.6 Q22.9 27 21.4 27 L10.6 27 Q9.1 27 8.6 25.6 L4 11.2 Q3.6 9.9 4.8 9 L14.8 2.9 Q15.4 2.5 16 2.5 Z"
        fill="url(#teachat-logo)"
      />
    </svg>
  )
}

function NavRail({ unreadCount }: { unreadCount: number }) {
  const [tab, setTab] = useState<'home' | 'chat'>('chat')
  return (
    <nav className="flex w-14 shrink-0 flex-col items-stretch gap-1 bg-surface-strong py-2">
      <div className="flex justify-center px-2 py-1">
        <Logo />
      </div>
      <div className="px-2 py-1">
        <Separator />
      </div>
      {/* Home / Chat tabs(可點擊區與 rail 左右各留 8px = px-2)*/}
      <div className="flex flex-col gap-1 px-2">
        <IconBtn
          icon={Home}
          label="Home"
          variant={tab === 'home' ? 'tertiary' : 'text'}
          onClick={() => setTab('home')}
          className="w-full"
        />
        <IconBtn
          icon={MessageCircle}
          label="Chat"
          variant={tab === 'chat' ? 'tertiary' : 'text'}
          onClick={() => setTab('chat')}
          className="w-full"
          badge={unreadCount > 0 ? <Badge variant="critical" count={unreadCount} max={99} /> : undefined}
        />
      </div>
      {/* 底部:avatar + more(more 上方不放分隔線)*/}
      <div className="mt-auto flex flex-col gap-1 px-2">
        <div className="flex justify-center py-1">
          <Avatar
            alt="Me 我"
            color="green"
            status="online"
            size={32}
            hoverCard={makeProfileCard({ name: 'Me 我', color: 'green', status: 'online', role: 'You', email: 'me@teachat.app' })}
          />
        </div>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="text" size="md" iconOnly startIcon={MoreHorizontal} aria-label="More" className="w-full" />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Help</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 2. Chat list
// ════════════════════════════════════════════════════════════════════════════
function AddPopover() {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="text" size="md" iconOnly startIcon={Plus} aria-label="Add" />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-52 p-1">
        <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body hover:bg-neutral-hover">
          <Plus size={16} /> Create new chat
        </button>
        <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body hover:bg-neutral-hover">
          <Plus size={16} /> Create new section
        </button>
      </PopoverContent>
    </Popover>
  )
}

function Section({
  label,
  open,
  onToggle,
  trailing,
}: {
  label: string
  open: boolean
  onToggle: () => void
  trailing?: React.ReactNode
}) {
  return (
    <div className="mt-2 flex items-center gap-1 px-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex flex-1 items-center gap-1 rounded-md py-1 text-caption font-semibold uppercase tracking-wide text-fg-secondary hover:text-foreground"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {label}
      </button>
      {trailing}
    </div>
  )
}

function RoomMoreMenu({ type }: { type: 'dm' | 'general' }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="text" size="sm" iconOnly startIcon={MoreHorizontal} aria-label="More" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem startIcon={Volume2}>Mute</DropdownMenuItem>
        <DropdownMenuItem startIcon={Star}>Favorite</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem startIcon={ExternalLink}>Open in new tab</DropdownMenuItem>
        <DropdownMenuItem startIcon={AppWindow}>Open in new window</DropdownMenuItem>
        {type === 'general' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem startIcon={LogOut} className="text-fg-error">
              Leave
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RoomRow({
  room,
  active,
  onSelect,
}: {
  room: Room
  active: boolean
  onSelect: (id: string) => void
}) {
  return (
    <div
      className={`group relative flex items-center gap-2.5 rounded-lg px-2 py-2 cursor-pointer ${
        active ? 'bg-neutral-selected' : 'hover:bg-neutral-hover'
      }`}
      onClick={() => onSelect(room.id)}
    >
      {room.type === 'dm' && room.person ? (
        <PersonAvatar person={room.person} size={36} />
      ) : (
        <GroupAvatar size={36} />
      )}
      <span className={`min-w-0 flex-1 truncate text-body ${room.unread ? 'font-bold' : 'font-normal'}`}>
        {room.title}
      </span>

      {/* 未讀紅點(hover 時被 more 暫時遮擋)*/}
      {room.unread && (
        <span className="group-hover:hidden">
          <Badge dot variant="critical" />
        </span>
      )}

      {/* hover → more 按鈕 */}
      <div className="absolute right-2 hidden group-hover:block" onClick={(e) => e.stopPropagation()}>
        <RoomMoreMenu type={room.type} />
      </div>
    </div>
  )
}

function ChatList({
  activeId,
  onSelect,
  onCollapse,
}: {
  activeId: string
  onSelect: (id: string) => void
  onCollapse: () => void
}) {
  const [openFav, setOpenFav] = useState(true)
  const [openChats, setOpenChats] = useState(true)
  const favorites = ROOMS.filter((r) => r.section === 'favorites')
  const chats = ROOMS.filter((r) => r.section === 'chats')

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-divider bg-surface">
      {/* Header — Chats + actions(右→左:collapse / search / add)*/}
      <header className="flex items-center gap-1 px-3 py-2.5">
        <h2 className="flex-1 truncate text-body-lg font-semibold">Chats</h2>
        <AddPopover />
        <IconBtn icon={Search} label="Search" />
        <IconBtn icon={PanelLeftClose} label="Collapse sidebar" onClick={onCollapse} />
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 pb-3">
          <Section label="Favorites" open={openFav} onToggle={() => setOpenFav((v) => !v)} />
          {openFav &&
            favorites.map((r) => (
              <RoomRow key={r.id} room={r} active={r.id === activeId} onSelect={onSelect} />
            ))}

          <Section
            label="Chats"
            open={openChats}
            onToggle={() => setOpenChats((v) => !v)}
            trailing={<IconBtn icon={Plus} label="Add chat" />}
          />
          {openChats &&
            chats.map((r) => (
              <RoomRow key={r.id} room={r} active={r.id === activeId} onSelect={onSelect} />
            ))}
        </div>
      </ScrollArea>
    </aside>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3. Conversation
// ════════════════════════════════════════════════════════════════════════════
function TeamsCallButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="text" size="md" startIcon={Video} endIcon={ChevronDown} aria-label="Teams call" />
      </TooltipTrigger>
      <TooltipContent>Teams call</TooltipContent>
    </Tooltip>
  )
}

// group user icon + 成員數(灰字 + 圓角方框背景),整體一個可點擊按鈕
function RoomInfoButton({ count }: { count: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="text" size="md" startIcon={Users} aria-label="Room information">
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-caption font-medium text-fg-secondary">
            {count}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Room information</TooltipContent>
    </Tooltip>
  )
}

function HeaderMoreMenu({ type }: { type: 'dm' | 'general' }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="text" size="md" iconOnly startIcon={MoreHorizontal} aria-label="More" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {type === 'general' && (
          <>
            <DropdownMenuItem startIcon={Users}>Room information</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem startIcon={Maximize2}>Full width</DropdownMenuItem>
        <DropdownMenuItem startIcon={Volume2}>Mute</DropdownMenuItem>
        <DropdownMenuItem startIcon={Star}>Favorite</DropdownMenuItem>
        {type === 'general' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem startIcon={LogOut} className="text-fg-error">
              Leave
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// 3a. Header bar
function ConversationHeader({
  room,
  listOpen,
  onExpandList,
}: {
  room: Room
  listOpen: boolean
  onExpandList: () => void
}) {
  const memberCount = room.memberKeys?.length ?? 0
  return (
    <header className="flex items-center gap-2.5 h-[var(--chrome-header-height)] px-4 border-b border-divider bg-surface">
      {/* chat list 隱藏時:展開按鈕 + 分隔線(在 avatar 左邊)*/}
      {!listOpen && (
        <>
          <IconBtn icon={PanelLeftOpen} label="Expand sidebar" onClick={onExpandList} />
          <Separator orientation="vertical" className="h-6" />
        </>
      )}

      {room.type === 'dm' && room.person ? (
        <PersonAvatar person={room.person} size={36} />
      ) : (
        <GroupAvatar size={36} />
      )}

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <h1 className="truncate text-body-lg font-semibold">{room.title}</h1>
        {room.type === 'general' && <IconBtn icon={Pencil} label="Edit chatroom name" />}
      </div>

      {/* 右側 actions */}
      <div className="flex items-center gap-1">
        <TeamsCallButton />
        {room.type === 'general' && <RoomInfoButton count={memberCount} />}
        <IconBtn icon={Search} label="Search" />
        <HeaderMoreMenu type={room.type} />
      </div>
    </header>
  )
}

// 3b. Message area
function ReactionBar() {
  return (
    <div className="absolute -top-4 right-2 z-10 hidden items-center gap-0.5 rounded-lg border border-divider bg-surface-raised p-0.5 shadow-md group-hover/msg:flex">
      {COMMON_EMOJI.map((e) => (
        <Tooltip key={e}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`React ${e}`}
              className="rounded-md px-1.5 py-1 text-body hover:bg-neutral-hover"
            >
              {e}
            </button>
          </TooltipTrigger>
          <TooltipContent>{e}</TooltipContent>
        </Tooltip>
      ))}
      <IconBtnSm icon={SmilePlus} label="Add reaction" />
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <IconBtnSm icon={MessagesSquare} label="Reply in thread" />
      <IconBtnSm icon={Reply} label="Reply with quote" />
      <IconBtnSm icon={MoreHorizontal} label="More" />
    </div>
  )
}

function MessageBubble({ room, message }: { room: Room; message: Message }) {
  const mine = message.author === 'me'
  const author = mine ? null : PEOPLE[message.author] ?? null

  return (
    <div className={`group/msg flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      {/* 對方:avatar + name + time on top */}
      {!mine && author && (
        <div className="mb-1 flex items-center gap-2 pl-11">
          <span className="text-body font-medium">{author.name}</span>
          <span className="text-caption text-fg-secondary">{message.time}</span>
        </div>
      )}

      <div className={`flex items-start gap-2 ${mine ? 'flex-row-reverse' : ''} max-w-[78%]`}>
        {!mine && author && <PersonAvatar person={author} size={32} />}

        <div className="relative">
          {/* hover reaction bar — bubble 右上角 */}
          <ReactionBar />

          <div
            className={`rounded-2xl px-3.5 py-2.5 text-body ${
              mine
                ? 'rounded-tr-sm bg-primary-subtle text-foreground'
                : 'rounded-tl-sm bg-muted text-foreground'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{message.text}</p>

            {/* 既有 reactions(顯示在 bubble 底部)*/}
            {message.reactions && message.reactions.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {message.reactions.map((r) => (
                  <span
                    key={r.emoji}
                    className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-caption"
                  >
                    <span>{r.emoji}</span>
                    <span className="text-fg-secondary">{r.count}</span>
                  </span>
                ))}
                <button
                  type="button"
                  aria-label="Add reaction"
                  className="flex items-center rounded-full bg-surface px-1.5 py-1 text-fg-secondary hover:text-foreground"
                >
                  <SmilePlus size={14} />
                </button>
              </div>
            )}
          </div>

          {/* thread reply indicator(bubble 下方)*/}
          {message.replies != null && message.replies > 0 && (
            <button
              type="button"
              className="mt-1 flex items-center gap-1.5 text-caption text-info-text hover:underline"
            >
              <MessagesSquare size={14} />
              {message.replies} replies
            </button>
          )}
        </div>
      </div>

      {/* 我的訊息:time 在泡泡下方 */}
      {mine && <span className="mt-1 pr-1 text-caption text-fg-secondary">{message.time}</span>}
    </div>
  )
}

function MessageArea({ room }: { room: Room }) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-5 px-6 py-4">
        {room.messages.map((m) => (
          <MessageBubble key={m.id} room={room} message={m} />
        ))}
      </div>
    </ScrollArea>
  )
}

// 3c. Input box(auto-grow,no manual resize;內嵌 send 按鈕)
function InputBox() {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  function send() {
    setValue('')
  }

  return (
    <div className="border-t border-divider bg-surface px-4 py-3">
      <div className="rounded-xl border border-border bg-canvas px-3 py-2 focus-within:border-border-hover">
        <Textarea
          ref={ref}
          rows={1}
          variant="bare"
          placeholder="Type a message"
          aria-label="Type a message"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          className="!resize-none !border-0 !px-0 !py-0 max-h-40"
        />
        <div className="mt-1.5 flex items-center justify-end gap-0.5">
          <IconBtnSm icon={Type} label="Rich editor" />
          <IconBtnSm icon={Smile} label="Emoji" />
          <IconBtnSm icon={Plus} label="Attach files" />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="primary"
                size="sm"
                iconOnly
                startIcon={Send}
                aria-label="Send"
                onClick={send}
                disabled={!value.trim()}
              />
            </TooltipTrigger>
            <TooltipContent>Send</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

function Conversation({
  room,
  listOpen,
  onExpandList,
}: {
  room: Room
  listOpen: boolean
  onExpandList: () => void
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-canvas">
      <ConversationHeader room={room} listOpen={listOpen} onExpandList={onExpandList} />
      <MessageArea room={room} />
      <InputBox key={room.id} />
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [activeId, setActiveId] = useState<string>(ROOMS[0].id)
  const [listOpen, setListOpen] = useState(true)
  const current = ROOMS.find((r) => r.id === activeId) ?? ROOMS[0]
  const unreadCount = ROOMS.filter((r) => r.unread).length

  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={200}>
      <div className="flex h-screen w-full overflow-hidden bg-canvas text-foreground">
        <NavRail unreadCount={unreadCount} />
        {listOpen && (
          <ChatList activeId={activeId} onSelect={setActiveId} onCollapse={() => setListOpen(false)} />
        )}
        <Conversation room={current} listOpen={listOpen} onExpandList={() => setListOpen(true)} />
      </div>
    </TooltipProvider>
  )
}
