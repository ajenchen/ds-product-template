// Chat prototype — 3-column messaging UI(Nav rail / Chat list / Conversation + Thread panel)
// v3.1: tooltip fix / overflow fix / header mute / status outside bubble / reaction menus / thread panel cleanup

import { useEffect, useId, useRef, useState } from 'react'
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  ResizeHandle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Switch,
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
  BellOff,
  Bell,
  Star,
  ExternalLink,
  AppWindow,
  LogOut,
  Maximize2,
  Minimize2,
  Settings,
  HelpCircle,
  Clock,
  Check,
  CheckCheck,
  X,
  Copy,
  Pin,
  Forward,
  Trash2,
  ChevronRight as SubArrow,
} from 'lucide-react'

// ── Shared button primitives ──────────────────────────────────────────────────
function NavBtn({
  icon,
  label,
  active,
  onClick,
  overlayBadge,
}: {
  icon: React.ComponentProps<typeof Button>['startIcon']
  label: string
  active?: boolean
  onClick?: () => void
  overlayBadge?: React.ReactNode
}) {
  // DS Button auto-adds a TOP tooltip when iconOnly + a *string* aria-label is passed.
  // To keep a single RIGHT-side tooltip (and overlayBadge, which needs iconOnly), we avoid
  // the string aria-label and supply the accessible name via aria-labelledby → sr-only span.
  const labelId = useId()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="text"
          size="md"
          iconOnly
          startIcon={icon}
          aria-labelledby={labelId}
          onClick={onClick}
          overlayBadge={overlayBadge}
          className={`!h-8 !w-8 !min-w-0 !p-0 ${active ? '!bg-neutral-selected' : ''}`}
        />
      </TooltipTrigger>
      {/* avoidCollisions=false forces right side always — prevents Radix from flipping to top */}
      <TooltipContent side="right" avoidCollisions={false}>{label}</TooltipContent>
      <span id={labelId} className="sr-only">{label}</span>
    </Tooltip>
  )
}

function ListBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ComponentProps<typeof Button>['startIcon']
  label: string
  onClick?: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="text" size="sm" iconOnly startIcon={icon} aria-label={label} title="" onClick={onClick} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function IconBtnSm({
  icon,
  label,
  onClick,
  className,
  style,
}: {
  icon: React.ComponentProps<typeof Button>['startIcon']
  label: string
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="text" size="sm" iconOnly startIcon={icon} aria-label={label} title="" onClick={onClick} className={className} style={style} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// ── Data model ────────────────────────────────────────────────────────────────
type Presence = 'online' | 'away' | 'busy' | 'offline'
type Color = 'blue' | 'green' | 'purple' | 'magenta' | 'turquoise' | 'indigo' | 'red'
type MsgStatus = 'sending' | 'sent' | 'read'

type Person = {
  name: string
  color: Color
  status: Presence
  role: string
  email: string
  avatar: string
}

type Reaction = { emoji: string; count: number }
type Message = {
  id: string
  author: 'me' | string
  text: string
  time: string
  reactions?: Reaction[]
  replies?: number
  msgStatus?: MsgStatus
  threadMessages?: Message[]
  images?: string[]
  table?: string[][]
}

type Room = {
  id: string
  type: 'dm' | 'general'
  title: string
  section: 'favorites' | 'chats'
  unread: boolean
  person?: Person
  memberKeys?: string[]
  messages: Message[]
}

const PEOPLE: Record<string, Person> = {
  shinichi: { name: 'Kudo Shinichi 工藤新一', color: 'blue', status: 'online', role: 'Detective', email: 'shinichi@teachat.app', avatar: 'https://i.pravatar.cc/96?img=12' },
  ai: { name: 'Haibara Ai 灰原哀', color: 'purple', status: 'busy', role: 'Researcher', email: 'ai@teachat.app', avatar: 'https://i.pravatar.cc/96?img=5' },
  ran: { name: 'Mouri Ran 毛利蘭', color: 'magenta', status: 'away', role: 'Karate Captain', email: 'ran@teachat.app', avatar: 'https://i.pravatar.cc/96?img=9' },
  guanyu: { name: 'Chen Guan-Yu 陳冠宇', color: 'green', status: 'online', role: 'Product Manager', email: 'guanyu@teachat.app', avatar: 'https://i.pravatar.cc/96?img=13' },
  yating: { name: 'Lin Ya-Ting 林雅婷', color: 'turquoise', status: 'offline', role: 'Designer', email: 'yating@teachat.app', avatar: 'https://i.pravatar.cc/96?img=16' },
  kenji: { name: 'Takahashi Kenji 高橋健二', color: 'indigo', status: 'online', role: 'Engineer', email: 'kenji@teachat.app', avatar: 'https://i.pravatar.cc/96?img=33' },
  yui: { name: 'Watanabe Yui 渡邊結衣', color: 'red', status: 'away', role: 'QA Lead', email: 'yui@teachat.app', avatar: 'https://i.pravatar.cc/96?img=20' },
}

const ME: Person = { name: 'Me 我', color: 'green', status: 'online', role: 'You', email: 'me@teachat.app', avatar: 'https://i.pravatar.cc/96?img=8' }

// 20 unique 1-on-1 DM partners. Registered into PEOPLE below so message author
// lookups (PEOPLE[author]) resolve name + avatar in the conversation view.
const GENERATED_DM_PEOPLE: { key: string; person: Person }[] = [
  { key: 'g-rei', person: { name: 'Aoki Rei 青木玲', color: 'blue', status: 'online', role: 'Account Exec', email: 'rei@teachat.app', avatar: 'https://i.pravatar.cc/96?img=25' } },
  { key: 'g-marco', person: { name: 'Marco Bianchi', color: 'green', status: 'away', role: 'Logistics Lead', email: 'marco@teachat.app', avatar: 'https://i.pravatar.cc/96?img=15' } },
  { key: 'g-mei', person: { name: 'Zhao Mei 趙美', color: 'magenta', status: 'busy', role: 'Buyer', email: 'mei@teachat.app', avatar: 'https://i.pravatar.cc/96?img=24' } },
  { key: 'g-tom', person: { name: 'Tom Becker', color: 'indigo', status: 'online', role: 'Sales Eng', email: 'tom@teachat.app', avatar: 'https://i.pravatar.cc/96?img=51' } },
  { key: 'g-hana', person: { name: 'Sato Hana 佐藤花', color: 'purple', status: 'offline', role: 'Coordinator', email: 'hana@teachat.app', avatar: 'https://i.pravatar.cc/96?img=44' } },
  { key: 'g-leo', person: { name: 'Leo Fernandez', color: 'turquoise', status: 'online', role: 'Analyst', email: 'leo@teachat.app', avatar: 'https://i.pravatar.cc/96?img=52' } },
  { key: 'g-jing', person: { name: 'Wu Jing 吳靜', color: 'red', status: 'away', role: 'Ops', email: 'jing@teachat.app', avatar: 'https://i.pravatar.cc/96?img=45' } },
  { key: 'g-erik', person: { name: 'Erik Lund', color: 'blue', status: 'online', role: 'Vendor Mgr', email: 'erik@teachat.app', avatar: 'https://i.pravatar.cc/96?img=53' } },
  { key: 'g-yuki', person: { name: 'Kimura Yuki 木村雪', color: 'green', status: 'busy', role: 'Designer', email: 'yuki@teachat.app', avatar: 'https://i.pravatar.cc/96?img=26' } },
  { key: 'g-priya', person: { name: 'Priya Nair', color: 'purple', status: 'online', role: 'PM', email: 'priya@teachat.app', avatar: 'https://i.pravatar.cc/96?img=27' } },
  { key: 'g-chen', person: { name: 'Chen Wei 陳偉', color: 'indigo', status: 'away', role: 'Engineer', email: 'chenwei@teachat.app', avatar: 'https://i.pravatar.cc/96?img=54' } },
  { key: 'g-sara', person: { name: 'Sara Olsen', color: 'magenta', status: 'online', role: 'Marketing', email: 'sara@teachat.app', avatar: 'https://i.pravatar.cc/96?img=28' } },
  { key: 'g-ken', person: { name: 'Yamada Ken 山田健', color: 'turquoise', status: 'offline', role: 'Support', email: 'yamada@teachat.app', avatar: 'https://i.pravatar.cc/96?img=55' } },
  { key: 'g-nina', person: { name: 'Nina Costa', color: 'red', status: 'busy', role: 'Finance', email: 'nina@teachat.app', avatar: 'https://i.pravatar.cc/96?img=29' } },
  { key: 'g-feng', person: { name: 'Li Feng 李峰', color: 'blue', status: 'online', role: 'Sourcing', email: 'lifeng@teachat.app', avatar: 'https://i.pravatar.cc/96?img=56' } },
  { key: 'g-omar', person: { name: 'Omar Haddad', color: 'green', status: 'away', role: 'Retail', email: 'omar@teachat.app', avatar: 'https://i.pravatar.cc/96?img=57' } },
  { key: 'g-aiko', person: { name: 'Mori Aiko 森愛子', color: 'purple', status: 'online', role: 'QA', email: 'aiko@teachat.app', avatar: 'https://i.pravatar.cc/96?img=30' } },
  { key: 'g-paul', person: { name: 'Paul Meyer', color: 'indigo', status: 'busy', role: 'Data', email: 'paul@teachat.app', avatar: 'https://i.pravatar.cc/96?img=58' } },
  { key: 'g-xia', person: { name: 'Deng Xia 鄧霞', color: 'magenta', status: 'online', role: 'Brand', email: 'xia@teachat.app', avatar: 'https://i.pravatar.cc/96?img=31' } },
  { key: 'g-ivan', person: { name: 'Ivan Petrov', color: 'turquoise', status: 'offline', role: 'Warehouse', email: 'ivan@teachat.app', avatar: 'https://i.pravatar.cc/96?img=59' } },
]
GENERATED_DM_PEOPLE.forEach(({ key, person }) => { PEOPLE[key] = person })

// 20 unique group chat topics (no overlap with INITIAL_ROOMS' existing names).
const GENERATED_GROUP_TOPICS = [
  'Marketing Sync', 'Design Review', 'Sourcing Updates', 'Logistics 物流', 'Customer Feedback',
  'Roadmap Planning', 'QA Handoff', 'Packaging Vendors', 'Retail Partners', 'Finance Q&A',
  'Brewing Lab 茶研室', 'Supply Chain', 'Event Planning', 'Tasting Notes 品評', 'Inventory Check',
  'Cold Brew Project', 'Seasonal Blends', 'Export Compliance', 'Storefront Refresh', 'Wholesale Orders',
]
const GENERATED_GROUP_MEMBERS = ['shinichi', 'ai', 'ran', 'guanyu', 'yating', 'kenji', 'yui']
const GENERATED_MSG_LINES = [
  "Quick update on this — let's sync this week.",
  'Sounds good, I will take a look today.',
  'Can we push the deadline by a day?',
  'Yes, that works on my end.',
  'Just sent over the latest file, please check.',
  'Thanks! Reviewing now.',
  'One thing to flag — the numbers shifted slightly.',
  'Got it, will adjust the plan accordingly.',
  'Should we loop in the rest of the team?',
  "Let's keep it small for now.",
  'I added some notes in the doc.',
  'Looks great, no further comments from me.',
  'Quick question — is this ready for review?',
  'Almost there, give me an hour.',
  'No rush, take your time.',
  'Following up on this thread.',
  "Apologies for the delay, here's the update.",
  'Perfect, that resolves it.',
  'Let me know if anything else is needed.',
  'Closing this out — thanks everyone!',
]
// 20 alternating back-and-forth messages: even slots = other party, odd = me.
function makeGeneratedMessages(roomId: string, speakers: string[]) {
  return Array.from({ length: 20 }, (_, j) => ({
    id: `${roomId}-m${j + 1}`,
    author: j % 2 === 1 ? 'me' : speakers[Math.floor(j / 2) % speakers.length],
    text: GENERATED_MSG_LINES[j % GENERATED_MSG_LINES.length],
    time: `${9 + (j % 8)}:${String((j * 3) % 60).padStart(2, '0')}`,
  }))
}

// Natural, irregular interleave of the two queues (run lengths sum to 20 each):
// dm5, grp3, dm3, grp4, dm6, grp2, dm2, grp5, dm4, grp6
const GENERATED_RUNS: [('dm' | 'group'), number][] = [
  ['dm', 5], ['group', 3], ['dm', 3], ['group', 4], ['dm', 6],
  ['group', 2], ['dm', 2], ['group', 5], ['dm', 4], ['group', 6],
]
const GENERATED_CHAT_ROOMS: Room[] = (() => {
  const rooms: Room[] = []
  let dmIdx = 0
  let groupIdx = 0
  let n = 0
  for (const [kind, len] of GENERATED_RUNS) {
    for (let k = 0; k < len; k++) {
      const id = `gen-${n}`
      const unread = n % 3 === 0
      if (kind === 'dm') {
        const { key, person } = GENERATED_DM_PEOPLE[dmIdx++]
        rooms.push({ id, type: 'dm', title: person.name, section: 'chats', unread, person, messages: makeGeneratedMessages(id, [key]) })
      } else {
        const members = [
          GENERATED_GROUP_MEMBERS[groupIdx % GENERATED_GROUP_MEMBERS.length],
          GENERATED_GROUP_MEMBERS[(groupIdx + 1) % GENERATED_GROUP_MEMBERS.length],
          GENERATED_GROUP_MEMBERS[(groupIdx + 2) % GENERATED_GROUP_MEMBERS.length],
        ]
        rooms.push({ id, type: 'general', title: GENERATED_GROUP_TOPICS[groupIdx++], section: 'chats', unread, memberKeys: members, messages: makeGeneratedMessages(id, members) })
      }
      n++
    }
  }
  return rooms
})()

const INITIAL_ROOMS: Room[] = [
  {
    id: 'shinichi',
    type: 'dm',
    title: PEOPLE.shinichi.name,
    section: 'favorites',
    unread: true,
    person: PEOPLE.shinichi,
    messages: [
      { id: 'm1', author: 'shinichi', text: 'Morning! Is the oolong tasting flight ready?', time: '09:12', reactions: [{ emoji: '👍', count: 8 }], threadMessages: [
        { id: 'm1-t1', author: 'me', text: "I'll confirm with the sourcing team first.", time: '09:13' },
        { id: 'm1-t2', author: 'shinichi', text: 'The Dong Ding batch or the High Mountain?', time: '09:13' },
        { id: 'm1-t3', author: 'me', text: 'Both — 4 samples each.', time: '09:13' },
        { id: 'm1-t4', author: 'guanyu', text: 'Should I bring the aroma wheel?', time: '09:14' },
        { id: 'm1-t5', author: 'me', text: 'Yes please, and the scoring sheets too.', time: '09:14' },
        { id: 'm1-t6', author: 'yating', text: 'I can bring extra cups.', time: '09:15' },
        { id: 'm1-t7', author: 'shinichi', text: 'Perfect. See everyone at 10:30.', time: '09:15' },
        { id: 'm1-t8', author: 'me', text: '👍 See you there.', time: '09:15' },
      ] },
      { id: 'm2', author: 'me', text: 'All set — 10:30 in tasting room No.3.', time: '09:14', msgStatus: 'sent' },
      { id: 'm3', author: 'shinichi', text: 'Great, I will prepare the scoring sheet.', time: '09:15' },
      {
        id: 'm4', author: 'shinichi', time: '09:18',
        text: "Just finished reviewing the Dong Ding samples from the Lugu Co-op. The spring harvest this year is noticeably lighter in body than last year — likely due to the unusually dry March. The roast on batch #3 is particularly interesting though; it has this subtle honey-caramel finish that lingers for almost a minute. I think it could be a strong candidate for the premium single-origin line. Can you pull the moisture readings and compare against the Q1 benchmark?",
      },
      {
        id: 'm5', author: 'me', time: '09:21', msgStatus: 'read',
        text: 'Here are the moisture readings from the lab — batch #3 is definitely the standout.',
        images: ['https://picsum.photos/seed/tealeaf1/480/300', 'https://picsum.photos/seed/teacup2/480/280'],
      },
      {
        id: 'm6', author: 'shinichi', time: '09:23',
        text: "These look really promising. The color on batch #3 is exactly what we want — golden amber, no greenish tint. I also noticed in the second photo that the leaf unfurl looks very even, which usually correlates with consistent steeping performance. Let's reserve at least 20 kg for the premium line and run a blind comparison with last year's Alishan at Friday's session.",
      },
      {
        id: 'm7', author: 'me', time: '09:25', msgStatus: 'read',
        text: "Agreed. I'll block the 20 kg now. Should we invite the retail buyers to Friday's tasting, or keep it internal this round?",
      },
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
      { id: 'g1', author: 'guanyu', text: 'Cupcake ipsum: the tasting report is updated, please take a look on Figma.', time: '08:40', reactions: [{ emoji: '👍', count: 8 }, { emoji: '🍵', count: 3 }], threadMessages: [
        { id: 'g1-t1', author: 'yating', text: 'Left comments on the color section.', time: '08:41' },
        { id: 'g1-t2', author: 'shinichi', text: 'The typography looks great.', time: '08:41' },
        { id: 'g1-t3', author: 'me', text: 'Agreed, nice work.', time: '08:42' },
        { id: 'g1-t4', author: 'kenji', text: 'Component specs are clear, easy to implement.', time: '08:42' },
        { id: 'g1-t5', author: 'yating', text: 'Updated the spacing tokens too.', time: '08:43' },
        { id: 'g1-t6', author: 'me', text: 'The grid system looks clean.', time: '08:43' },
        { id: 'g1-t7', author: 'guanyu', text: 'Thanks everyone! Will sync with PM after.', time: '08:44' },
        { id: 'g1-t8', author: 'me', text: 'Great, see you at standup.', time: '08:44' },
      ] },
      { id: 'g2', author: 'me', text: 'Got it, reviewing now.', time: '08:42', msgStatus: 'read' },
      {
        id: 'g3', author: 'yating', time: '08:50',
        text: "I updated the tasting room layout — we now have a dedicated aroma station near the window for better lighting conditions. Here's how it looks:",
        images: ['https://picsum.photos/seed/room88/560/360'],
      },
      {
        id: 'g4', author: 'kenji', time: '08:52',
        text: 'Nice setup! One thing — the infra for the water temperature controllers is finally stable. We had the 95°C drift issue last week where the PID loop was overshooting by about 3°C before stabilising. I pushed a firmware fix and ran 50 cycles overnight; max deviation is now under 0.5°C. Should be solid for Friday.',
      },
      {
        id: 'g5', author: 'me', time: '08:55', msgStatus: 'read',
        text: 'Great news on the temp fix, Kenji. I will add that to the session notes so the buyers know we hit spec.',
      },
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
      { id: 'a1', author: 'ai', text: 'The new supplier samples arrived.', time: '5/28', threadMessages: [
        { id: 'a1-t1', author: 'ai', text: 'Three oolong, two green tea varieties.', time: '5/28' },
        { id: 'a1-t2', author: 'me', text: 'I will set up the cupping station.', time: '5/28' },
      ] },
      { id: 'a2', author: 'me', text: 'Perfect, let us cup them tomorrow.', time: '5/28', msgStatus: 'read' },
    ],
  },
  {
    id: 'ran',
    type: 'dm',
    title: PEOPLE.ran.name,
    section: 'chats',
    unread: false,
    person: PEOPLE.ran,
    messages: [{ id: 'r1', author: 'ran', text: 'Thanks! Have a great weekend 🍵', time: '5/25' }],
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
      { id: 'p2', author: 'me', text: 'Nice work team.', time: '11:05', msgStatus: 'read' },
    ],
  },
  {
    id: 'semi-sales',
    type: 'general',
    title: 'IT Sales - Table格式範例',
    section: 'chats',
    unread: true,
    memberKeys: ['guanyu', 'kenji', 'yui', 'shinichi'],
    messages: [
      {
        id: 'sc1', author: 'guanyu', time: '14:02',
        text: 'Q3 wafer demand forecast by key account — please review before the QBR with the foundry.',
        table: [
          ['Customer', 'Node', 'Q3 Wafers', 'Q4 Wafers', 'Status'],
          ['Apex Systems', 'N5', '12,000', '14,500', 'Confirmed'],
          ['Nimbus AI', 'N3', '8,200', '11,000', 'Pending PO'],
          ['Orion Devices', 'N7', '5,600', '5,400', 'Confirmed'],
          ['Vega Mobile', 'N5', '9,800', '10,200', 'Forecast'],
          ['Helix Auto', 'N12', '3,400', '3,900', 'Confirmed'],
        ],
      },
      {
        id: 'sc2', author: 'kenji', time: '14:08',
        text: 'N3 capacity is tight for Q4 — Nimbus may need an allocation review before we commit the PO.',
      },
      {
        id: 'sc3', author: 'me', time: '14:10', msgStatus: 'read',
        text: 'Here is the current N3 line utilization snapshot:',
        table: [
          ['Line', 'Utilization'],
          ['Fab 18 P1', '94%'],
          ['Fab 18 P2', '88%'],
        ],
      },
      {
        id: 'sc4', author: 'yui', time: '14:15',
        text: 'Yield on N3 P2 climbed to 71% last week, so we should free up a bit of capacity for Nimbus.',
        reactions: [{ emoji: '🎉', count: 3 }],
      },
      {
        id: 'sc5', author: 'guanyu', time: '14:22',
        text: 'Weekly wafer starts by product × week (WW22–WW27, all nodes) — full view for capacity planning:',
        table: [
          ['Product', 'Node', 'WW22 Plan', 'WW22 Act', 'WW23 Plan', 'WW23 Act', 'WW24 Plan', 'WW24 Act', 'WW25 Plan', 'WW25 Act', 'WW26 Plan', 'WW26 Act', 'WW27 Plan', 'Cum Plan', 'Cum Act', 'Δ', 'Yield%', 'Die/Wfr', 'Good Die', 'Scrap', 'On Hold', 'Rework', 'Priority', 'PM', 'Customer', 'Ship Wk', 'Rev $K', 'ASP', 'Margin%', 'Risk'],
          ['APX-V3', 'N5', '800', '812', '820', '805', '830', '831', '840', '829', '850', '–', '860', '5000', '4807', '-193', '92%', '320', '259K', '18', '0', '5', 'High', 'Kenji', 'Apex', 'WW29', '4,128', '$15.9', '38%', 'Low'],
          ['NIM-A1', 'N3', '600', '590', '620', '614', '640', '–', '650', '–', '660', '–', '670', '3840', '1818', '-282', '71%', '280', '128K', '42', '12', '8', 'Critical', 'Yui', 'Nimbus', 'WW30', '2,899', '$22.6', '41%', 'High'],
          ['ORI-7X', 'N7', '400', '402', '410', '408', '420', '419', '430', '427', '440', '–', '450', '2550', '2083', '-47', '88%', '410', '183K', '9', '0', '0', 'Normal', 'Shinichi', 'Orion', 'WW28', '3,294', '$18.0', '36%', 'Low'],
          ['VGA-M2', 'N5', '700', '695', '710', '708', '720', '715', '730', '–', '740', '–', '750', '4350', '2844', '-156', '90%', '350', '256K', '14', '4', '2', 'High', 'Kenji', 'Vega', 'WW29', '4,608', '$18.0', '39%', 'Med'],
          ['HLX-A12', 'N12', '300', '305', '310', '311', '315', '314', '320', '319', '325', '–', '330', '1900', '1574', '+24', '95%', '520', '149K', '4', '0', '0', 'Normal', 'Guanyu', 'Helix', 'WW27', '2,682', '$18.0', '34%', 'Low'],
          ['APX-V4', 'N5', '200', '198', '210', '207', '220', '219', '230', '–', '240', '–', '250', '1350', '831', '-19', '91%', '318', '264K', '7', '0', '2', 'High', 'Kenji', 'Apex', 'WW30', '1,056', '$16.0', '37%', 'Low'],
          ['NIM-B2', 'N3', '150', '148', '160', '–', '170', '–', '180', '–', '190', '–', '200', '1050', '296', '-6', '70%', '275', '206K', '10', '2', '0', 'Critical', 'Yui', 'Nimbus', 'WW31', '740', '$22.0', '40%', 'High'],
          ['ORI-9X', 'N7', '250', '252', '260', '258', '270', '269', '280', '279', '290', '–', '300', '1650', '1307', '+8', '87%', '405', '231K', '6', '0', '1', 'Normal', 'Shinichi', 'Orion', 'WW29', '2,358', '$18.1', '35%', 'Low'],
          ['VGA-M3', 'N5', '350', '346', '360', '357', '370', '368', '380', '–', '390', '–', '400', '2250', '1439', '-21', '89%', '345', '311K', '11', '1', '3', 'High', 'Kenji', 'Vega', 'WW30', '2,592', '$18.0', '38%', 'Med'],
          ['HLX-B6', 'N12', '180', '182', '185', '184', '190', '191', '195', '194', '200', '–', '205', '1155', '944', '+6', '94%', '515', '178K', '3', '0', '0', 'Normal', 'Guanyu', 'Helix', 'WW28', '1,692', '$18.0', '33%', 'Low'],
          ['SXR-10', 'N3', '100', '98', '110', '–', '120', '–', '130', '–', '140', '–', '150', '750', '196', '-6', '68%', '260', '133K', '15', '5', '4', 'Critical', 'Yui', 'Nimbus', 'WW32', '534', '$22.5', '42%', 'High'],
          ['MTX-V1', 'N7', '220', '221', '230', '228', '240', '239', '250', '249', '260', '–', '270', '1470', '1156', '+7', '86%', '400', '192K', '5', '0', '0', 'Normal', 'Shinichi', 'Orion', 'WW29', '1,920', '$18.0', '35%', 'Low'],
          ['PHX-A5', 'N5', '430', '428', '440', '437', '450', '449', '460', '–', '470', '–', '480', '2730', '1762', '-14', '91%', '330', '266K', '9', '2', '1', 'High', 'Kenji', 'Apex', 'WW30', '2,838', '$15.9', '38%', 'Low'],
          ['QNT-C3', 'N3', '80', '78', '90', '–', '100', '–', '110', '–', '120', '–', '130', '630', '156', '-6', '69%', '270', '108K', '12', '3', '2', 'Critical', 'Yui', 'Nimbus', 'WW32', '432', '$22.0', '41%', 'High'],
          ['RVX-D7', 'N7', '160', '161', '170', '169', '180', '179', '190', '189', '200', '–', '210', '1110', '867', '+8', '88%', '415', '149K', '4', '0', '0', 'Normal', 'Shinichi', 'Orion', 'WW29', '1,490', '$18.0', '36%', 'Low'],
          ['STR-E9', 'N5', '560', '554', '570', '565', '580', '577', '590', '–', '600', '–', '610', '3510', '2253', '-27', '90%', '340', '204K', '16', '3', '2', 'High', 'Kenji', 'Vega', 'WW30', '3,672', '$18.0', '39%', 'Med'],
          ['TRX-F2', 'N12', '140', '142', '145', '144', '148', '149', '150', '150', '155', '–', '160', '898', '728', '+5', '96%', '530', '140K', '2', '0', '0', 'Normal', 'Guanyu', 'Helix', 'WW27', '1,260', '$18.0', '34%', 'Low'],
          ['ULT-G4', 'N3', '120', '118', '130', '–', '140', '–', '150', '–', '160', '–', '170', '870', '236', '-6', '72%', '285', '170K', '8', '1', '0', 'Critical', 'Yui', 'Nimbus', 'WW31', '612', '$22.3', '41%', 'High'],
          ['VRX-H8', 'N7', '190', '191', '200', '198', '210', '209', '220', '219', '230', '–', '240', '1290', '1006', '+8', '87%', '408', '159K', '5', '0', '1', 'Normal', 'Shinichi', 'Orion', 'WW29', '1,590', '$18.0', '35%', 'Low'],
          ['WVE-I6', 'N5', '480', '475', '490', '486', '500', '497', '510', '–', '520', '–', '530', '3030', '1955', '-22', '91%', '325', '289K', '13', '2', '1', 'High', 'Kenji', 'Apex', 'WW30', '3,204', '$15.9', '37%', 'Low'],
          ['XPR-J3', 'N3', '90', '88', '100', '–', '110', '–', '120', '–', '130', '–', '140', '690', '176', '-6', '70%', '275', '123K', '10', '2', '2', 'Critical', 'Yui', 'Nimbus', 'WW32', '493', '$22.0', '40%', 'High'],
        ],
      },
    ],
  },
  {
    id: 'engineering',
    type: 'general',
    title: 'Engineering',
    section: 'chats',
    unread: false,
    memberKeys: ['kenji', 'yui'],
    messages: [{ id: 'e1', author: 'kenji', text: 'PR merged. Closing the ticket.', time: '5/26' }],
  },
  ...GENERATED_CHAT_ROOMS,
]

const COMMON_EMOJI = ['👍', '❤️', '😂', '🎉']

// ── Status dot ────────────────────────────────────────────────────────────────
function StatusDot({ status, size = 8 }: { status: Presence; size?: number }) {
  const base = 'flex items-center justify-center rounded-full ring-1 ring-surface'
  const dim = { width: size, height: size }
  if (status === 'online') return <span className={`${base} bg-green-500`} style={dim} />
  if (status === 'busy') return <span className={`${base} bg-red-500`} style={dim} />
  if (status === 'away') {
    return (
      <span className={`${base} bg-yellow-400`} style={dim}>
        <Clock size={Math.round(size * 0.67)} className="text-white" strokeWidth={2.5} />
      </span>
    )
  }
  return <span className={`${base} border-2 border-neutral-400 bg-transparent`} style={dim} />
}

// ── Avatar helpers ────────────────────────────────────────────────────────────
function makeProfileCard(p: Person) {
  return (
    <ProfileCard
      name={p.name}
      subtitle={p.role}
      status={p.status}
      avatar={{ alt: p.name, color: p.color, src: p.avatar }}
      fields={[
        { label: 'Role', value: p.role },
        { label: 'Email', value: p.email },
      ]}
      actions={<ProfileCardDefaultActions />}
    />
  )
}

function PersonAvatar({ person, size = 32, dotSize = 8 }: { person: Person; size?: number; dotSize?: number }) {
  return (
    <div className="relative inline-flex shrink-0">
      <Avatar src={person.avatar} alt={person.name} color={person.color} size={size} hoverCard={makeProfileCard(person)} />
      <span className="absolute -bottom-0.5 -right-0.5 z-10">
        <StatusDot status={person.status} size={dotSize} />
      </span>
    </div>
  )
}

function GroupAvatar({ size = 32 }: { size?: number }) {
  return (
    <Avatar
      icon={MessagesSquare}
      size={size}
      shape="circle"
      className="[&>div]:!bg-[var(--color-neutral-6)] [&>div]:!text-[var(--on-emphasis)]"
    />
  )
}

function MutedAvatar({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-divider bg-white"
      style={{ width: size, height: size }}
    >
      <BellOff size={Math.round(size * 0.5)} className="text-fg-secondary" />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Settings modal
// ════════════════════════════════════════════════════════════════════════════
function SettingsModal({
  open,
  onOpenChange,
  showPreview,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  showPreview: boolean
  onConfirm: (v: boolean) => void
}) {
  const [draft, setDraft] = useState(showPreview)
  useEffect(() => { if (open) setDraft(showPreview) }, [open, showPreview])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[480px] p-0 overflow-hidden">
        <div className="flex h-full min-h-0">
          <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-divider bg-surface p-3">
            <p className="px-2 pb-1 pt-0.5 text-caption font-semibold uppercase tracking-wide text-fg-secondary">Settings</p>
            <button type="button" className="flex w-full items-center gap-2 rounded-md bg-neutral-selected px-2 py-1.5 text-left text-body font-medium text-foreground">
              <MessagesSquare size={15} />
              Chats
            </button>
          </nav>
          <div className="flex min-w-0 min-h-0 flex-1 flex-col">
            <DialogHeader className="border-b border-divider px-6 py-4">
              <DialogTitle>Chats list</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between gap-4 rounded-lg py-3">
                <div>
                  <p className="text-body font-medium">Show message previews for chats</p>
                  <p className="text-caption text-fg-secondary mt-0.5">Display the latest message below each chat name</p>
                </div>
                <Switch checked={draft} onCheckedChange={setDraft} aria-label="Show message previews for chats" />
              </div>
            </div>
            <DialogFooter className="border-t border-divider px-6 py-3">
              <Button variant="text" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => { onConfirm(draft); onOpenChange(false) }}>Save changes</Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Nav rail
// ════════════════════════════════════════════════════════════════════════════
function Logo() {
  return (
    <svg width={28} height={28} viewBox="0 0 32 32" aria-label="TeaChat" role="img">
      <defs>
        <linearGradient id="teachat-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <path
        d="M16 3.2 Q16.9 3.2 17.7 3.7 L26.3 8.6 Q27.1 9.1 27.1 10.1 L27.1 21.9 Q27.1 22.9 26.3 23.4 L17.7 28.3 Q16.9 28.8 16 28.8 Q15.1 28.8 14.3 28.3 L5.7 23.4 Q4.9 22.9 4.9 21.9 L4.9 10.1 Q4.9 9.1 5.7 8.6 L14.3 3.7 Q15.1 3.2 16 3.2 Z"
        fill="url(#teachat-logo)"
      />
    </svg>
  )
}

function NavRail({ unreadCount, onOpenSettings }: { unreadCount: number; onOpenSettings: () => void }) {
  const [tab, setTab] = useState<'home' | 'chat'>('chat')
  const moreLabelId = useId()

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center border-r border-divider bg-surface px-2 py-2">
      <div className="flex h-10 items-center justify-center">
        <Logo />
      </div>
      <div className="w-8 py-1"><Separator /></div>
      <div className="flex flex-col gap-1 py-1">
        <NavBtn icon={Home} label="Home" active={tab === 'home'} onClick={() => setTab('home')} />
        <NavBtn
          icon={MessageCircle}
          label="Chat"
          active={tab === 'chat'}
          onClick={() => setTab('chat')}
          overlayBadge={unreadCount > 0 ? <Badge variant="critical" count={unreadCount} max={99} className="!bg-[#EC540F]" /> : undefined}
        />
      </div>
      <div className="mt-auto flex flex-col items-center gap-1 py-1">
        {/* More menu — single RIGHT tooltip; aria-labelledby (not string aria-label) avoids DS auto top-tooltip */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="text" size="md" iconOnly startIcon={MoreHorizontal} aria-labelledby={moreLabelId} className="!h-8 !w-8 !min-w-0 !p-0" />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" avoidCollisions={false}>More</TooltipContent>
            <span id={moreLabelId} className="sr-only">More</span>
          </Tooltip>
          <DropdownMenuContent align="end" side="right" sideOffset={8}>
            <DropdownMenuItem startIcon={Settings} onSelect={onOpenSettings}>Settings</DropdownMenuItem>
            <DropdownMenuItem startIcon={HelpCircle}>Help</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem startIcon={LogOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Avatar src={ME.avatar} alt={ME.name} color={ME.color} size={32} hoverCard={makeProfileCard(ME)} />
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
            <Button variant="text" size="sm" iconOnly startIcon={Plus} aria-label="Add" title="" />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8} className="w-52 p-1">
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

function Section({ label, open, onToggle, trailing }: { label: string; open: boolean; onToggle: () => void; trailing?: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-1 p-1">
      <IconBtnSm
        icon={open ? ChevronDown : ChevronRight}
        label={open ? 'Collapse' : 'Expand'}
        onClick={onToggle}
        className="!h-5 !w-5 !min-w-0 !p-0"
        style={{ color: 'var(--color-neutral-7)' }}
      />
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 truncate text-left hover:text-foreground"
        style={{ fontSize: 12, fontWeight: 500, lineHeight: '130%', color: 'var(--color-neutral-7)' }}
      >
        {label}
      </button>
      {trailing}
    </div>
  )
}

function RoomMoreMenu({
  room,
  isMuted,
  isFavorite,
  onToggleMute,
  onToggleFavorite,
}: {
  room: Room
  isMuted: boolean
  isFavorite: boolean
  onToggleMute: () => void
  onToggleFavorite: () => void
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="text" size="sm" iconOnly startIcon={MoreHorizontal} aria-label="More" title="" className="!h-6 !w-6 !min-w-0 !p-0" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More</TooltipContent>
      </Tooltip>
      {/* side="bottom" sideOffset=8 — dropdown below trigger with 8px gap; collision avoidance keeps it on-screen near viewport edges */}
      <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
        <DropdownMenuItem startIcon={isMuted ? Bell : BellOff} onSelect={onToggleMute}>
          {isMuted ? 'Unmute' : 'Mute'}
        </DropdownMenuItem>
        <DropdownMenuItem startIcon={Star} onSelect={onToggleFavorite}>
          {isFavorite ? 'Unfavorite' : 'Favorite'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem startIcon={ExternalLink}>Open in new tab</DropdownMenuItem>
        <DropdownMenuItem startIcon={AppWindow}>Open in new window</DropdownMenuItem>
        {room.type === 'general' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem startIcon={LogOut} className="text-fg-error">Leave</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// RoomRow — two-line preview. Right-side time + badge are shrink-0 to prevent clipping on resize.
function RoomRow({
  room,
  active,
  isMuted,
  isFavorite,
  onSelect,
  onToggleMute,
  onToggleFavorite,
  showPreview,
}: {
  room: Room
  active: boolean
  isMuted: boolean
  isFavorite: boolean
  onSelect: (id: string) => void
  onToggleMute: (id: string) => void
  onToggleFavorite: (id: string) => void
  showPreview: boolean
}) {
  const latestMsg = room.messages[room.messages.length - 1]
  const latestAuthor = latestMsg?.author === 'me' ? 'You' : (PEOPLE[latestMsg?.author]?.name.split(' ')[0] ?? '')
  const previewText = latestMsg ? `${latestAuthor}: ${latestMsg.text}` : ''
  const avatarSize = showPreview ? 32 : 20
  const isUnread = room.unread && !isMuted
  const titleStyle: React.CSSProperties = isUnread
    ? { fontSize: 14, fontWeight: 700, lineHeight: '150%', color: 'var(--color-neutral-9)' }
    : { fontSize: 14, fontWeight: 400, lineHeight: '150%', color: 'var(--color-neutral-8)' }
  const timeStyle: React.CSSProperties = { fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-7)' }
  const subtitleStyle: React.CSSProperties = isUnread
    ? { fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-9)' }
    : { fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-8)' }

  return (
    <div
      className={`group relative flex cursor-pointer items-center gap-2 rounded-[4px] px-2 ${
        showPreview ? 'py-2' : 'py-1.5'
      } ${active ? 'bg-neutral-selected' : 'hover:bg-neutral-hover'}`}
      onClick={() => onSelect(room.id)}
    >
      {/* Avatar */}
      {isMuted ? (
        <MutedAvatar size={avatarSize} />
      ) : room.type === 'dm' && room.person ? (
        <PersonAvatar person={room.person} size={avatarSize} dotSize={showPreview ? 8 : 6} />
      ) : (
        <GroupAvatar size={avatarSize} />
      )}

      {/* Text content — min-w-0 flex-1 allows truncation without clipping right-side items */}
      {showPreview ? (
        <div className="min-w-0 flex-1">
          {/* Line 1: name (flex-1 truncate) + time (shrink-0, always visible) */}
          <div className="flex items-baseline gap-1">
            <span className="min-w-0 flex-1 truncate" style={titleStyle}>
              {room.title}
            </span>
            <span className="shrink-0 group-hover:invisible" style={timeStyle}>
              {latestMsg?.time ?? ''}
            </span>
          </div>
          {/* Line 2: preview (flex-1 truncate) + unread dot (shrink-0) */}
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate" style={subtitleStyle}>
              {previewText}
            </p>
            {isUnread && (
              <span className="shrink-0 group-hover:invisible">
                <Badge dot variant="critical" className="!bg-[#EC540F]" />
              </span>
            )}
          </div>
        </div>
      ) : (
        <span className="min-w-0 flex-1 truncate" style={titleStyle}>
          {room.title}
        </span>
      )}

      {/* Hover: 24×24 more button, box right edge 12px from divider (right-1 = 4px inside the row's 8px right padding).
          invisible (not hidden) keeps a measurable box so Radix anchors the dropdown correctly; overlays date/time + badge. */}
      <div
        className="absolute right-1 top-1/2 -translate-y-1/2 invisible group-hover:visible [&:has([data-state=open])]:visible"
        onClick={(e) => e.stopPropagation()}
      >
        <RoomMoreMenu
          room={room}
          isMuted={isMuted}
          isFavorite={isFavorite}
          onToggleMute={() => onToggleMute(room.id)}
          onToggleFavorite={() => onToggleFavorite(room.id)}
        />
      </div>
    </div>
  )
}

// Small floor only (avatar + padding) so RoomRow width adapts freely to the ResizeHandle drag
const CHAT_LIST_MIN = 120
const CHAT_LIST_MAX = 480

function ChatList({
  rooms,
  activeId,
  onSelect,
  onCollapse,
  width,
  onWidthChange,
  showPreview,
  mutedIds,
  favOrder,
  onToggleMute,
  onToggleFavorite,
}: {
  rooms: Room[]
  activeId: string
  onSelect: (id: string) => void
  onCollapse: () => void
  width: number
  onWidthChange: (w: number) => void
  showPreview: boolean
  mutedIds: Set<string>
  favOrder: string[]
  onToggleMute: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const [openFav, setOpenFav] = useState(true)
  const [openChats, setOpenChats] = useState(true)
  const [dragging, setDragging] = useState(false)

  const favSet = new Set(favOrder)
  const favorites = favOrder.map((id) => rooms.find((r) => r.id === id)!).filter(Boolean)
  const chats = rooms.filter((r) => !favSet.has(r.id))

  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    setDragging(true)
    const onMove = (ev: PointerEvent) => {
      onWidthChange(Math.max(CHAT_LIST_MIN, Math.min(CHAT_LIST_MAX, startW + (ev.clientX - startX))))
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <aside className="relative flex shrink-0 flex-col bg-surface" style={{ width }}>
      <header className="flex items-center border-b border-divider px-3" style={{ paddingTop: 10, paddingBottom: 10 }}>
        <h2 className="flex-1 truncate" style={{ fontSize: 16, fontWeight: 500, lineHeight: '130%', color: 'var(--color-neutral-9)' }}>Chats</h2>
        <div className="flex items-center gap-2">
          <AddPopover />
          <ListBtn icon={Search} label="Search" />
          <ListBtn icon={PanelLeftClose} label="Collapse sidebar" onClick={onCollapse} />
        </div>
      </header>

      {/* [&_[data-radix-scroll-area-viewport]>div]:!block — override Radix's inner display:table wrapper
          so rows are constrained to the aside width and truncate instead of overflowing past the divider */}
      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
        {/* px-2 container + row's px-2 → date/time & badge sit 16px from the right divider */}
        <div className="px-2 pb-3">
          <Section label="Favorites" open={openFav} onToggle={() => setOpenFav((v) => !v)} />
          {openFav && favorites.map((r) => (
            <RoomRow
              key={r.id} room={r} active={r.id === activeId}
              isMuted={mutedIds.has(r.id)} isFavorite={true}
              onSelect={onSelect} onToggleMute={onToggleMute} onToggleFavorite={onToggleFavorite}
              showPreview={showPreview}
            />
          ))}
          <Section
            label="Chats" open={openChats} onToggle={() => setOpenChats((v) => !v)}
            trailing={<IconBtnSm icon={Plus} label="Add chat" className="!h-6 !w-6 !min-w-0 !p-0" style={{ color: 'var(--color-neutral-7)' }} />}
          />
          {openChats && chats.map((r) => (
            <RoomRow
              key={r.id} room={r} active={r.id === activeId}
              isMuted={mutedIds.has(r.id)} isFavorite={false}
              onSelect={onSelect} onToggleMute={onToggleMute} onToggleFavorite={onToggleFavorite}
              showPreview={showPreview}
            />
          ))}
        </div>
      </ScrollArea>

      <ResizeHandle direction="horizontal" position="end" isResizing={dragging} aria-label="拖曳調整聊天列表寬度" onPointerDown={startResize} className="[&>span]:!bg-[var(--color-neutral-4)]" />
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
        {/* 28px tall, 4px side padding, 18px icons */}
        <button
          type="button"
          aria-label="Teams call"
          className="flex h-7 items-center gap-1 rounded-md px-1 text-fg-secondary hover:bg-neutral-hover"
        >
          <Video size={18} />
          <ChevronDown size={18} />
        </button>
      </TooltipTrigger>
      <TooltipContent>Teams call</TooltipContent>
    </Tooltip>
  )
}

function RoomInfoButton({ count }: { count: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* 28px tall, 4px side padding, 18px icon; badge h20 px4 py2 12px/130% medium */}
        <button
          type="button"
          aria-label="Room information"
          className="flex h-7 items-center gap-1 rounded-md px-1 text-fg-secondary hover:bg-neutral-hover"
        >
          <Users size={18} />
          <span
            className="flex h-5 items-center rounded-md bg-muted font-medium text-fg-secondary"
            style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, fontSize: 12, lineHeight: '130%' }}
          >
            {count}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>Room information</TooltipContent>
    </Tooltip>
  )
}

// Header more menu — mute/unmute + full-width toggle aware
function HeaderMoreMenu({
  type,
  isMuted,
  onToggleMute,
  isFullWidth,
  onToggleFullWidth,
}: {
  type: 'dm' | 'general'
  isMuted: boolean
  onToggleMute: () => void
  isFullWidth: boolean
  onToggleFullWidth: () => void
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="text" size="sm" iconOnly startIcon={MoreHorizontal} aria-label="More" title="" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
        {type === 'general' && (
          <>
            <DropdownMenuItem startIcon={Users}>Room information</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {/* Full width — inline Switch toggle; onSelect prevents menu close on click */}
        <DropdownMenuItem
          startIcon={Maximize2}
          onSelect={(e) => { e.preventDefault(); onToggleFullWidth() }}
        >
          <span className="flex flex-1 items-center justify-between gap-6">
            Full width
            <Switch
              checked={isFullWidth}
              onCheckedChange={onToggleFullWidth}
              aria-label="Full width"
              onClick={(e) => e.stopPropagation()}
            />
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem startIcon={isMuted ? Bell : BellOff} onSelect={onToggleMute}>
          {isMuted ? 'Unmute' : 'Mute'}
        </DropdownMenuItem>
        <DropdownMenuItem startIcon={Star}>Favorite</DropdownMenuItem>
        {type === 'general' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem startIcon={LogOut} className="text-fg-error">Leave</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ConversationHeader — shows mute overlay on avatar when room is muted
function ConversationHeader({
  room,
  listOpen,
  onExpandList,
  isMuted,
  onToggleMute,
  isFullWidth,
  onToggleFullWidth,
}: {
  room: Room
  listOpen: boolean
  onExpandList: () => void
  isMuted: boolean
  onToggleMute: () => void
  isFullWidth: boolean
  onToggleFullWidth: () => void
}) {
  const memberCount = room.memberKeys?.length ?? 0

  // When muted: 32×32 white bg + gray BellOff icon fully replaces the avatar
  const roomAvatar = isMuted ? (
    <MutedAvatar size={32} />
  ) : room.type === 'dm' && room.person ? (
    <PersonAvatar person={room.person} size={32} />
  ) : (
    <GroupAvatar size={32} />
  )

  return (
    <header className="flex items-center gap-2 py-2 px-4 border-b border-divider bg-surface shrink-0">
      {!listOpen && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="text" size="sm" iconOnly startIcon={PanelLeftOpen} aria-label="Expand sidebar" title="" onClick={onExpandList} />
            </TooltipTrigger>
            <TooltipContent>Expand sidebar</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-6" />
        </>
      )}
      {roomAvatar}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <h1 className="truncate" style={{ fontSize: 16, fontWeight: 500, lineHeight: '130%' }}>{room.title}</h1>
        {room.type === 'general' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="text" size="sm" iconOnly startIcon={Pencil} aria-label="Edit chatroom name" title="" />
            </TooltipTrigger>
            <TooltipContent>Edit name</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-2">
        <TeamsCallButton />
        {room.type === 'general' && <RoomInfoButton count={memberCount} />}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="text" size="sm" iconOnly startIcon={Search} aria-label="Search" title="" />
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>
        <HeaderMoreMenu type={room.type} isMuted={isMuted} onToggleMute={onToggleMute} isFullWidth={isFullWidth} onToggleFullWidth={onToggleFullWidth} />
      </div>
    </header>
  )
}

// Message status icon (outside bubble)
function MsgStatusIcon({ status }: { status: MsgStatus }) {
  if (status === 'sending') return <Clock size={16} className="text-fg-secondary" />
  if (status === 'sent') return <Check size={16} className="text-fg-secondary" />
  return <CheckCheck size={16} className="text-primary" />
}

// Reaction bar more menu — different actions for mine vs other
function ReactionMoreMenu({
  mine,
  room,
}: {
  mine: boolean
  room: Room
}) {
  // Derive member count and read members for "Read by" (prototype: all non-me members read)
  const memberCount = room.type === 'general'
    ? (room.memberKeys?.length ?? 1)
    : 1
  const readCount = memberCount  // prototype: everyone has read

  const readMembers = room.type === 'general'
    ? (room.memberKeys ?? []).map((k) => PEOPLE[k]?.name.split(' ')[0]).filter(Boolean)
    : room.person ? [room.person.name.split(' ')[0]] : []

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="text" size="sm" iconOnly startIcon={MoreHorizontal} aria-label="More actions" title="" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
        {mine ? (
          <>
            <DropdownMenuItem startIcon={Reply}>Reply with quote</DropdownMenuItem>
            <DropdownMenuItem startIcon={Copy}>Copy</DropdownMenuItem>
            <DropdownMenuItem startIcon={Pin}>Pin</DropdownMenuItem>
            <DropdownMenuItem startIcon={Forward}>Forward</DropdownMenuItem>
            <DropdownMenuItem startIcon={Trash2} className="text-fg-error">Delete</DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Read by — hover opens submenu with reader list */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Read by {readCount} of {memberCount}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent sideOffset={8}>
                {readMembers.map((name) => (
                  <DropdownMenuItem key={name}>{name}</DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : (
          <>
            <DropdownMenuItem startIcon={Copy}>Copy</DropdownMenuItem>
            <DropdownMenuItem startIcon={Pin}>Pin</DropdownMenuItem>
            <DropdownMenuItem startIcon={Forward}>Forward</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ReactionBar({ onOpenThread, mine, room, hideReplyInThread }: { onOpenThread: () => void; mine: boolean; room: Room; hideReplyInThread?: boolean }) {
  return (
    <div className="absolute -top-4 right-2 z-[8] flex items-center gap-0.5 rounded-lg border border-divider bg-surface-raised p-0.5 shadow-md invisible group-hover/msg:visible [&:has([data-state=open])]:visible">
      {COMMON_EMOJI.map((e) => (
        <Tooltip key={e}>
          <TooltipTrigger asChild>
            <button type="button" aria-label={`React ${e}`} className="rounded-md px-1.5 py-1 text-body hover:bg-neutral-hover">{e}</button>
          </TooltipTrigger>
          <TooltipContent>{e}</TooltipContent>
        </Tooltip>
      ))}
      <IconBtnSm icon={SmilePlus} label="Add reaction" />
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      {!hideReplyInThread && <IconBtnSm icon={MessagesSquare} label="Reply in thread" onClick={onOpenThread} />}
      <IconBtnSm icon={Reply} label="Reply with quote" />
      <ReactionMoreMenu mine={mine} room={room} />
    </div>
  )
}

function MessageBubble({
  message,
  isLastMine,
  onOpenThread,
  room,
  isInThread,
}: {
  message: Message
  isLastMine: boolean
  onOpenThread: (m: Message) => void
  room: Room
  isInThread?: boolean
}) {
  const mine = message.author === 'me'
  const author = mine ? null : PEOPLE[message.author] ?? null
  const replyCount = message.threadMessages?.length ?? message.replies ?? 0
  const latestReplyTime = message.threadMessages?.length
    ? message.threadMessages[message.threadMessages.length - 1].time
    : null

  // Bubble (shared) — text + images + reactions
  // max-w-full (not w-fit) so the bubble never exceeds the column width; hugging
  // for short messages comes from the column's items-start/items-end (shrink-to-
  // fit), NOT fit-content — fit-content pulls a wide table's max-content and
  // overflows. min-w-0 lets it shrink below content so the table scrolls inside.
  const bubble = (
    <div className="relative max-w-full min-w-0">
      <ReactionBar onOpenThread={() => onOpenThread(message)} mine={mine} room={room} hideReplyInThread={isInThread} />
      <div
        className={`rounded-xl p-3 text-body max-w-full min-w-0 ${mine ? 'text-foreground' : 'bg-muted text-foreground'}`}
        style={mine ? { backgroundColor: '#EBEEFF' } : undefined}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        {message.images && message.images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="rounded-lg object-cover"
                style={{ width: 200, maxWidth: '100%', aspectRatio: '3 / 2' }}
              />
            ))}
          </div>
        )}
        {message.table && message.table.length > 0 && (() => {
          const cols = message.table[0].length
          const single = cols === 1
          return (
            <div
              className="scroll-hover mt-2 overflow-auto rounded-lg border"
              style={{ maxHeight: 320, width: 'fit-content', maxWidth: '100%', borderColor: 'var(--color-neutral-4)', backgroundColor: 'white' }}
            >
              <table className="border-collapse" style={{ width: single ? '100%' : 'max-content' }}>
                  <tbody>
                    {message.table.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="border align-top"
                            style={{
                              borderColor: 'var(--color-neutral-4)',
                              padding: '4px 8px',
                              fontSize: 12,
                              fontWeight: ri === 0 ? 600 : 400,
                              lineHeight: '130%',
                              minWidth: 24,
                              height: 24,
                              maxWidth: single ? undefined : 120,
                              wordBreak: 'break-word',
                              color: 'var(--color-foreground)',
                              backgroundColor: 'white',
                            }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          )
        })()}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className="flex h-6 items-center gap-1 rounded-full border bg-surface px-2 py-1 hover:bg-neutral-hover"
                style={{ borderColor: 'var(--color-neutral-5)' }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{r.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-8)' }}>{r.count}</span>
              </button>
            ))}
            <button
              type="button"
              aria-label="Add reaction"
              className="flex h-6 items-center rounded-full border bg-surface px-2 py-1 hover:bg-neutral-hover"
              style={{ borderColor: 'var(--color-neutral-5)', color: 'var(--color-neutral-7)' }}
            >
              <SmilePlus size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // Thread replies link (main area only)
  const threadLink = !isInThread && replyCount > 0 ? (
    <div className={`mt-0.5 flex items-center gap-1 ${mine ? 'justify-end' : ''}`}>
      {!mine && (
        <div
          className="shrink-0 border-l border-b rounded-bl-[8px]"
          style={{ width: 24, height: 12, borderColor: 'var(--color-neutral-4)' }}
        />
      )}
      <button
        type="button"
        className="flex items-center gap-1 hover:underline"
        style={{ color: 'var(--color-primary)' }}
        onClick={() => onOpenThread(message)}
      >
        <MessagesSquare size={16} style={{ color: 'var(--color-primary)' }} />
        <span style={{ fontSize: 12, fontWeight: 500, lineHeight: '130%', color: 'var(--color-primary)' }}>{replyCount} replies</span>
        {latestReplyTime && (
          <span style={{ fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-7)', marginLeft: 4 }}>{latestReplyTime}</span>
        )}
      </button>
    </div>
  ) : null

  // ── Thread panel layout (narrow, simpler — no MessageArea margin rules) ──
  if (isInThread) {
    return (
      <div className={`group/msg flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-start gap-2 ${mine ? 'flex-row-reverse' : ''} max-w-[85%]`}>
          {!mine && author && (
            <div className="mt-0.5 shrink-0">
              <PersonAvatar person={author} size={32} />
            </div>
          )}
          <div className="flex flex-col gap-1 min-w-0">
            {mine && (
              <div className="flex justify-end pr-1">
                <span style={{ fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-7)' }}>{message.time}</span>
              </div>
            )}
            {!mine && author && (
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-7)' }}>{author.name}</span>
                <span style={{ fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-7)' }}>{message.time}</span>
              </div>
            )}
            {bubble}
          </div>
        </div>
      </div>
    )
  }

  // ── MessageArea layout (precise margin spec 3b) ──
  // Status icon column: 16×16, always reserved (mine). Empty box keeps the 16px width.
  const statusCol = (
    <div className="shrink-0 flex flex-col justify-end" style={{ width: 16, marginLeft: 4 }}>
      <div className="pb-1 flex items-center justify-center" style={{ width: 16, height: 16 }}>
        {isLastMine && message.msgStatus ? <MsgStatusIcon status={message.msgStatus} /> : null}
      </div>
    </div>
  )

  if (mine) {
    // bubble left edge ≥ 96px from region left; status icon right edge 20px from region right
    return (
      <div className="group/msg flex w-full justify-end" style={{ paddingLeft: 96, paddingRight: 20 }}>
        <div className="flex items-end min-w-0">
          <div className="flex flex-1 flex-col gap-1 min-w-0 items-end">
            <div className="flex justify-end pr-1">
              <span style={{ fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-7)' }}>{message.time}</span>
            </div>
            {bubble}
            {threadLink}
          </div>
          {statusCol}
        </div>
      </div>
    )
  }

  // other: avatar at region left; bubble right edge ≤ region right − 96px
  return (
    <div className="group/msg flex w-full" style={{ paddingRight: 96 }}>
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {author && (
          <div className="mt-0.5 shrink-0">
            <PersonAvatar person={author} size={32} />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1 min-w-0 items-start">
          {author && (
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-7)' }}>{author.name}</span>
              <span style={{ fontSize: 12, fontWeight: 400, lineHeight: '130%', color: 'var(--color-neutral-7)' }}>{message.time}</span>
            </div>
          )}
          {bubble}
          {threadLink}
        </div>
      </div>
    </div>
  )
}

function MessageArea({ room, onOpenThread, fullWidth }: { room: Room; onOpenThread: (m: Message) => void; fullWidth: boolean }) {
  const lastMineId = [...room.messages].reverse().find((m) => m.author === 'me')?.id ?? null
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [room.messages.length])

  // Plain overflow div (not DS ScrollArea): Radix Viewport wraps children in a
  // `display:table; min-width:100%` box that grows to a wide table's max-content,
  // which defeats any percentage-based width cap on the bubble. A plain scroll
  // container has a definite width (= its flex parent), so the min-w-0 flex chain
  // caps each bubble and a wide table scrolls horizontally inside its own bubble.
  return (
    <div className="scroll-hover min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div className="px-4 py-4">
        <div
          className="mx-auto flex flex-col gap-3 min-w-0"
          style={fullWidth ? undefined : { maxWidth: 960 }}
        >
          {room.messages.map((m) => (
            <MessageBubble key={m.id} message={m} isLastMine={m.id === lastMineId} onOpenThread={onOpenThread} room={room} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

// InputBox — no top separator; single-line: textarea + buttons on same row;
// multiline: textarea full-width on top, buttons row below
function InputBox({ fullWidth, onSend }: { fullWidth: boolean; onSend: (text: string) => void }) {
  const [value, setValue] = useState('')
  const [multiline, setMultiline] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const scrollH = el.scrollHeight
    // whole input box max height 280px → cap textarea growth (leaves room for padding + buttons)
    el.style.height = `${Math.min(scrollH, 232)}px`
    setMultiline(value.includes('\n') || scrollH > 44)
  }, [value])

  function send() {
    if (!value.trim()) return
    onSend(value.trim())
    setValue('')
    setMultiline(false)
  }

  const hasValue = value.trim().length > 0

  const btn24 = '!h-6 !w-6 !min-w-0 !p-0'
  const actionButtons = (
    <div className="flex shrink-0 items-center gap-2">
      <IconBtnSm icon={Type} label="Rich editor" className={btn24} />
      <IconBtnSm icon={Smile} label="Emoji" className={btn24} />
      <IconBtnSm icon={Plus} label="Attach files" className={btn24} />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tooltip>
        <TooltipTrigger asChild>
          {/* empty → text (no bg, dark stroke) initial state; has value → primary filled */}
          <Button variant={hasValue ? 'primary' : 'text'} size="sm" iconOnly startIcon={Send} aria-label="Send" title="" onClick={send} className={btn24} />
        </TooltipTrigger>
        <TooltipContent>Send</TooltipContent>
      </Tooltip>
    </div>
  )

  return (
    <div className="shrink-0 bg-surface" style={{ paddingTop: 8, paddingBottom: 16, paddingLeft: 56, paddingRight: 56 }}>
      {/* ON: full-width, 56px sides; OFF: max 880px centered, 56px sides when narrower */}
      <div className="mx-auto w-full" style={fullWidth ? undefined : { maxWidth: 880 }}>
        <div
          className="rounded-lg border bg-canvas"
          style={{
            paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 8,
            maxHeight: 280, overflow: 'hidden',
            borderColor: hasValue ? 'var(--color-primary-hover)' : 'var(--color-border)',
          }}
        >
          {multiline ? (
            <>
              <Textarea
                ref={ref}
                rows={1}
                variant="bare"
                placeholder="Type a message"
                aria-label="Type a message"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                className="!resize-none !border-0 !p-0 w-full max-h-[232px] overflow-y-auto"
              />
              <div className="mt-1.5 flex items-center justify-end">
                {actionButtons}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Textarea
                ref={ref}
                rows={1}
                variant="bare"
                placeholder="Type a message"
                aria-label="Type a message"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                className="!resize-none !border-0 !p-0 min-w-0 flex-1 max-h-[232px] overflow-y-auto"
              />
              {actionButtons}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Thread panel ──────────────────────────────────────────────────────────────
const THREAD_MIN = 320
const THREAD_MAX = 720

function ThreadInputBox() {
  const [value, setValue] = useState('')
  const [alsoSend, setAlsoSend] = useState(true)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [value])

  const hasValue = value.trim().length > 0
  return (
    <div className="bg-surface px-3 py-2 shrink-0">
      <div className="rounded-lg border border-border bg-canvas px-3 py-2 focus-within:border-border-hover">
        <Textarea
          ref={ref}
          rows={1}
          variant="bare"
          placeholder="Reply in thread..."
          aria-label="Reply in thread"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="!resize-none !border-0 !px-0 !py-0 max-h-32"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <label className="flex flex-1 cursor-pointer items-center gap-1.5 text-caption text-fg-secondary select-none">
            <input
              type="checkbox"
              checked={alsoSend}
              onChange={(e) => setAlsoSend(e.target.checked)}
              className="rounded border-border accent-[var(--color-primary)]"
            />
            Also send to chatroom
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={hasValue ? 'primary' : 'text'} size="sm" iconOnly startIcon={Send} aria-label="Send reply" title="" className="!h-6 !w-6 !min-w-0 !p-0" />
            </TooltipTrigger>
            <TooltipContent>Send</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

function ThreadPanel({
  message,
  room,
  width,
  onWidthChange,
  expanded,
  onExpand,
  onCollapse,
  onClose,
}: {
  message: Message
  room: Room
  width?: number
  onWidthChange: (w: number) => void
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onClose: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const author = message.author === 'me' ? ME : (PEOPLE[message.author] ?? null)
  const mine = message.author === 'me'

  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = width ?? 480
    setDragging(true)
    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX
      onWidthChange(Math.max(THREAD_MIN, Math.min(THREAD_MAX, startW + delta)))
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className="relative flex shrink-0 flex-col bg-canvas"
      style={expanded ? { flex: 1 } : { width: width ?? 480 }}
    >
      {!expanded && (
        <ResizeHandle direction="horizontal" position="start" isResizing={dragging} aria-label="拖曳調整 Thread 面板寬度" onPointerDown={startResize} className="[&>span]:!bg-[var(--color-neutral-4)]" />
      )}

      {/* Panel header */}
      <div className="flex items-center border-b border-divider bg-surface px-3 py-2 shrink-0">
        <h2 className="flex-1 font-semibold" style={{ fontSize: 15 }}>Thread</h2>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="text" size="sm" iconOnly startIcon={expanded ? Minimize2 : Maximize2} aria-label={expanded ? 'Collapse thread' : 'Expand thread'} title="" onClick={expanded ? onCollapse : onExpand} />
            </TooltipTrigger>
            <TooltipContent>{expanded ? 'Collapse' : 'Expand'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="text" size="sm" iconOnly startIcon={X} aria-label="Close thread" title="" onClick={onClose} />
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Parent message */}
          <MessageBubble
            message={message}
            isLastMine={message.author === 'me'}
            onOpenThread={() => {}}
            room={room}
            isInThread
          />
          {/* Thread replies */}
          {message.threadMessages && message.threadMessages.length > 0 && (
            <>
              {(() => {
                const threadMsgs = message.threadMessages!
                const lastMineId = [...threadMsgs].reverse().find((m) => m.author === 'me')?.id ?? null
                return threadMsgs.map((tm) => (
                  <MessageBubble
                    key={tm.id}
                    message={tm}
                    isLastMine={tm.id === lastMineId}
                    onOpenThread={() => {}}
                    room={room}
                    isInThread
                  />
                ))
              })()}
            </>
          )}
        </div>
      </ScrollArea>

      <ThreadInputBox />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Conversation wrapper
// ════════════════════════════════════════════════════════════════════════════
function Conversation({
  room,
  listOpen,
  onExpandList,
  isMuted,
  onToggleMute,
  fullWidth,
  onToggleFullWidth,
  onSend,
}: {
  room: Room
  listOpen: boolean
  onExpandList: () => void
  isMuted: boolean
  onToggleMute: () => void
  fullWidth: boolean
  onToggleFullWidth: () => void
  onSend: (text: string) => void
}) {
  const [threadMessage, setThreadMessage] = useState<Message | null>(null)
  const [threadExpanded, setThreadExpanded] = useState(false)
  const [threadWidth, setThreadWidth] = useState(480)

  useEffect(() => {
    setThreadMessage(null)
    setThreadExpanded(false)
  }, [room.id])

  return (
    <section className="flex min-w-0 flex-1 overflow-hidden bg-canvas">
      {!threadExpanded && (
        <div className="flex min-w-0 flex-1 flex-col">
          <ConversationHeader
            room={room}
            listOpen={listOpen}
            onExpandList={onExpandList}
            isMuted={isMuted}
            onToggleMute={onToggleMute}
            isFullWidth={fullWidth}
            onToggleFullWidth={onToggleFullWidth}
          />
          <MessageArea room={room} onOpenThread={setThreadMessage} fullWidth={fullWidth} />
          <InputBox key={room.id} fullWidth={fullWidth} onSend={onSend} />
        </div>
      )}
      {threadMessage && (
        <ThreadPanel
          message={threadMessage}
          room={room}
          width={threadExpanded ? undefined : threadWidth}
          onWidthChange={setThreadWidth}
          expanded={threadExpanded}
          onExpand={() => setThreadExpanded(true)}
          onCollapse={() => setThreadExpanded(false)}
          onClose={() => { setThreadMessage(null); setThreadExpanded(false) }}
        />
      )}
    </section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS)
  const [activeId, setActiveId] = useState<string>(INITIAL_ROOMS[0].id)
  const [listOpen, setListOpen] = useState(true)
  const [listWidth, setListWidth] = useState(320)
  const [showPreview, setShowPreview] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set())
  const [fullWidth, setFullWidth] = useState(true)
  const [favOrder, setFavOrder] = useState<string[]>(
    INITIAL_ROOMS.filter((r) => r.section === 'favorites').map((r) => r.id)
  )

  const current = rooms.find((r) => r.id === activeId) ?? rooms[0]
  const unreadCount = rooms.filter((r) => r.unread && !mutedIds.has(r.id)).length

  function handleToggleMute(id: string) {
    setMutedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleToggleFavorite(id: string) {
    const isFav = favOrder.includes(id)
    if (isFav) setFavOrder((prev) => prev.filter((x) => x !== id))
    else setFavOrder((prev) => [...prev, id])
  }

  function handleSend(text: string) {
    const now = new Date()
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const newMsg: Message = { id: `sent-${Date.now()}`, author: 'me', text, time, msgStatus: 'sending' }
    setRooms((prev) => prev.map((r) =>
      r.id === activeId ? { ...r, messages: [...r.messages, newMsg] } : r
    ))
  }

  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={200}>
      <div className="flex h-screen w-full overflow-hidden bg-canvas text-foreground">
        <NavRail unreadCount={unreadCount} onOpenSettings={() => setSettingsOpen(true)} />
        {listOpen && (
          <ChatList
            rooms={rooms}
            activeId={activeId}
            onSelect={setActiveId}
            onCollapse={() => setListOpen(false)}
            width={listWidth}
            onWidthChange={setListWidth}
            showPreview={showPreview}
            mutedIds={mutedIds}
            favOrder={favOrder}
            onToggleMute={handleToggleMute}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        <Conversation
          room={current}
          listOpen={listOpen}
          onExpandList={() => setListOpen(true)}
          fullWidth={fullWidth}
          onToggleFullWidth={() => setFullWidth((v) => !v)}
          isMuted={mutedIds.has(current.id)}
          onToggleMute={() => handleToggleMute(current.id)}
          onSend={handleSend}
        />
      </div>
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        showPreview={showPreview}
        onConfirm={setShowPreview}
      />
    </TooltipProvider>
  )
}
