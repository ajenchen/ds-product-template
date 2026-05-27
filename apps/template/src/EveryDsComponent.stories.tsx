// @anatomy-exempt: exhaustive minimal-prop render — all verified-API renderable components
/**
 * EveryDsComponent.stories.tsx — render EVERY public DS component default state
 *
 * Per user 2026-05-27 verbatim「請你他媽不要抽樣,把全部都檢查驗證完成」永久 codify.
 * 之前抽 32 render「複雜 prop API 需 real-prop story,本 smoke 不負責」= reject scope。
 * 本 fix:per-component grep DS source real *Props interface,每個寫驗證後 minimal real props。
 */

import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import * as DS from '@qijenchen/design-system'
import { Home, Settings } from 'lucide-react'

const meta: Meta = {
  title: 'Apps/template/Every DS Component',
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj

const Box = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <section data-testid={`comp-${name}`} className="p-2 border border-divider rounded-md mb-2 min-h-[60px]">
    <h3 className="text-caption text-fg-secondary mb-1">{name}</h3>
    <div>{children}</div>
  </section>
)

export const EveryComponent: Story = {
  name: '所有 DS 元件 default render(per-component verified API)',
  render: () => {
    const [checked, setChecked] = useState(false)
    const [radioVal, setRadioVal] = useState('a')
    const [segVal, setSegVal] = useState('list')
    const [stepsVal, setStepsVal] = useState('s1')
    return (
      <DS.TooltipProvider delayDuration={500} skipDelayDuration={300}>
      <div className="p-6 grid grid-cols-3 gap-3" data-testid="every-ds-components">

        {/* ── Atomic ───────────────────────────────────── */}
        <Box name="Avatar"><DS.Avatar alt="A" color="blue" /></Box>
        <Box name="ItemAvatar"><DS.ItemAvatar alt="I" color="green" /></Box>
        <Box name="Badge"><DS.Badge /></Box>
        <Box name="Button-primary"><DS.Button>Primary</DS.Button></Box>
        <Box name="Button-secondary"><DS.Button variant="secondary">Secondary</DS.Button></Box>
        <Box name="Button-text"><DS.Button variant="text">Text</DS.Button></Box>
        <Box name="Tag"><DS.Tag>Tag</DS.Tag></Box>
        <Box name="Chip"><DS.ChipGroup type="single"><DS.Chip value="x">Chip</DS.Chip></DS.ChipGroup></Box>
        <Box name="Separator"><DS.Separator /></Box>
        <Box name="ItemIcon"><DS.ItemIcon icon={Home} /></Box>
        <Box name="ItemLabel"><DS.ItemLabel>Label</DS.ItemLabel></Box>

        {/* ── Form basics ───────────────────────────────── */}
        <Box name="Input"><DS.Input placeholder="Input" /></Box>
        <Box name="Textarea"><DS.Textarea placeholder="Textarea" rows={2} /></Box>
        <Box name="NumberInput"><DS.NumberInput defaultValue={5} /></Box>
        <Box name="LinkInput"><DS.LinkInput placeholder="https://" /></Box>
        <Box name="Checkbox"><DS.Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} /></Box>
        <Box name="Switch"><DS.Switch /></Box>
        <Box name="Slider"><DS.Slider defaultValue={[50]} max={100} /></Box>
        <Box name="Rating"><DS.Rating /></Box>
        <Box name="RadioGroup">
          <DS.RadioGroup value={radioVal} onValueChange={setRadioVal}>
            <DS.RadioGroupItem value="a" id="r-a" />
            <DS.RadioGroupItem value="b" id="r-b" />
          </DS.RadioGroup>
        </Box>
        <Box name="SegmentedControl">
          <DS.SegmentedControl value={segVal} onValueChange={setSegVal}>
            <DS.SegmentedControlItem value="list">List</DS.SegmentedControlItem>
            <DS.SegmentedControlItem value="grid">Grid</DS.SegmentedControlItem>
          </DS.SegmentedControl>
        </Box>
        <Box name="SelectionItem">
          <DS.SelectionItem control={<DS.Checkbox />} label="Selection item" />
        </Box>

        {/* ── Display ───────────────────────────────────── */}
        <Box name="Alert"><DS.Alert title="Title" variant="info">Alert</DS.Alert></Box>
        <Box name="Notice"><DS.Notice title="Title" variant="info">Notice</DS.Notice></Box>
        <Box name="Empty"><DS.Empty title="Empty" /></Box>
        <Box name="Skeleton"><DS.Skeleton className="h-4 w-32" /></Box>
        <Box name="ProgressBar"><DS.ProgressBar value={60} /></Box>
        <Box name="CircularProgress"><DS.CircularProgress value={60} size={32} /></Box>
        <Box name="AspectRatio"><DS.AspectRatio ratio={1}><div className="bg-neutral-3 w-full h-full" /></DS.AspectRatio></Box>
        <Box name="Breadcrumb">
          <DS.Breadcrumb>
            <DS.BreadcrumbList>
              <DS.BreadcrumbItem><DS.BreadcrumbLink href="#">Home</DS.BreadcrumbLink></DS.BreadcrumbItem>
              <DS.BreadcrumbSeparator />
              <DS.BreadcrumbItem><DS.BreadcrumbPage>Current</DS.BreadcrumbPage></DS.BreadcrumbItem>
            </DS.BreadcrumbList>
          </DS.Breadcrumb>
        </Box>
        <Box name="DescriptionList">
          <DS.DescriptionList>
            <DS.DescriptionItem label="ID">X-001</DS.DescriptionItem>
          </DS.DescriptionList>
        </Box>

        {/* ── Interactive composite ─────────────────────── */}
        <Box name="Accordion">
          <DS.Accordion type="single" collapsible>
            <DS.AccordionItem value="a"><DS.AccordionTrigger>Q</DS.AccordionTrigger><DS.AccordionContent>A</DS.AccordionContent></DS.AccordionItem>
          </DS.Accordion>
        </Box>
        <Box name="Tabs">
          <DS.Tabs defaultValue="a"><DS.TabsList><DS.TabsTrigger value="a">A</DS.TabsTrigger></DS.TabsList></DS.Tabs>
        </Box>
        <Box name="Steps">
          <DS.Steps value={stepsVal} onValueChange={setStepsVal}>
            <DS.StepItem value="s1">Step 1</DS.StepItem>
            <DS.StepItem value="s2">Step 2</DS.StepItem>
          </DS.Steps>
        </Box>
        <Box name="DatePicker"><DS.DatePicker /></Box>
        <Box name="TimePicker"><DS.TimePicker /></Box>

        {/* ── Overlay triggers ──────────────────────────── */}
        <Box name="Tooltip">
          <DS.Tooltip><DS.TooltipTrigger asChild><DS.Button>T</DS.Button></DS.TooltipTrigger><DS.TooltipContent>tip</DS.TooltipContent></DS.Tooltip>
        </Box>
        <Box name="Popover">
          <DS.Popover><DS.PopoverTrigger asChild><DS.Button>P</DS.Button></DS.PopoverTrigger><DS.PopoverContent>pop</DS.PopoverContent></DS.Popover>
        </Box>
        <Box name="Dialog">
          <DS.Dialog><DS.DialogTrigger asChild><DS.Button>D</DS.Button></DS.DialogTrigger></DS.Dialog>
        </Box>
        <Box name="Sheet">
          <DS.Sheet><DS.SheetTrigger asChild><DS.Button>S</DS.Button></DS.SheetTrigger></DS.Sheet>
        </Box>
        <Box name="DropdownMenu">
          <DS.DropdownMenu><DS.DropdownMenuTrigger asChild><DS.Button>DM</DS.Button></DS.DropdownMenuTrigger></DS.DropdownMenu>
        </Box>
        <Box name="HoverCard">
          <DS.HoverCard><DS.HoverCardTrigger asChild><DS.Button>HC</DS.Button></DS.HoverCardTrigger></DS.HoverCard>
        </Box>
        <Box name="NameCard">
          <DS.NameCard name="Alan Chen" subtitle="Designer" avatar={{ alt: 'Alan', color: 'blue' }} />
        </Box>
        <Box name="Coachmark"><DS.Coachmark><DS.Button>?</DS.Button></DS.Coachmark></Box>

        {/* ── Selection / collection ────────────────────── */}
        <Box name="Combobox">
          <DS.Combobox options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} placeholder="Pick" />
        </Box>
        <Box name="Select">
          <DS.Select options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} placeholder="Pick" />
        </Box>
        <Box name="SelectMenu">
          <DS.SelectMenu options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}><DS.Button>Open menu</DS.Button></DS.SelectMenu>
        </Box>
        <Box name="PeoplePicker">
          <DS.PeoplePicker people={[{ name: 'Alan', description: 'Designer' }]} placeholder="Pick person" />
        </Box>
        <Box name="TreeView">
          <DS.TreeView>
            <DS.TreeItem id="root" label="Root">
              <DS.TreeItem id="child" label="Child" />
            </DS.TreeItem>
          </DS.TreeView>
        </Box>
        <Box name="Command">
          <DS.Command><DS.CommandInput placeholder="Type" /><DS.CommandList><DS.CommandEmpty>No</DS.CommandEmpty></DS.CommandList></DS.Command>
        </Box>
        <Box name="MenuItem"><DS.MenuItem startIcon={Settings}>Menu</DS.MenuItem></Box>

        {/* ── File ──────────────────────────────────────── */}
        <Box name="FileItem"><DS.FileItem name="file.txt" /></Box>
        <Box name="FileUpload"><DS.FileUpload accept="image/*" /></Box>
        <Box name="FileViewer">
          <DS.FileViewer files={[{ id: '1', name: 'doc.pdf', mimeType: 'application/pdf', url: '' }]} />
        </Box>

        {/* ── Layout / utility ──────────────────────────── */}
        <Box name="ScrollArea"><DS.ScrollArea className="h-16"><div className="h-32">scroll me</div></DS.ScrollArea></Box>
        <Box name="Field">
          <DS.Field>
            <DS.FieldLabel>Label</DS.FieldLabel>
            <DS.Input placeholder="value" />
          </DS.Field>
        </Box>
        <Box name="FieldControlGroup">
          <DS.FieldControlGroup>
            <DS.Input placeholder="left" />
            <DS.Input placeholder="right" />
          </DS.FieldControlGroup>
        </Box>
        <Box name="Carousel">
          <DS.Carousel><DS.CarouselContent><DS.CarouselItem>Slide 1</DS.CarouselItem></DS.CarouselContent></DS.Carousel>
        </Box>
        <Box name="OverflowIndicator">
          <DS.OverflowIndicator count={2}>
            <DS.Tag>Tag 1</DS.Tag>
            <DS.Tag>Tag 2</DS.Tag>
          </DS.OverflowIndicator>
        </Box>
        <Box name="BulkActionBar">
          <DS.BulkActionBar selection={['a', 'b']} onClear={() => {}} />
        </Box>

        {/* ── DataTable / Chart minimal ─────────────────── */}
        <Box name="DataTable">
          <DS.DataTable
            columns={[{ accessorKey: 'name', header: 'Name' }]}
            data={[{ name: 'Row 1' }, { name: 'Row 2' }]}
          />
        </Box>
        <Box name="ChartContainer">
          <DS.ChartContainer config={{ a: { label: 'A', color: 'var(--color-blue-6)' } }}>
            <div className="h-16 w-full bg-neutral-2" />
          </DS.ChartContainer>
        </Box>

        {/* ── Calendar / DateGrid ───────────────────────── */}
        <Box name="Calendar"><DS.Calendar /></Box>
        <Box name="DateGrid"><DS.DateGrid /></Box>

        {/* ── Provider / functional ─────────────────────── */}
        <Box name="Toaster"><DS.Toaster /></Box>
        <Box name="toast(fn)"><DS.Button onClick={() => DS.toast({ title: 'Hi' })}>fire toast</DS.Button></Box>

        <p className="text-caption text-fg-secondary col-span-3 mt-4">
          Rendered: ALL renderable DS components with verified-API minimal props
          (per user 2026-05-27「禁抽樣 全部都驗證」directive)。
          Sub-components (TabsList / DialogTrigger / etc.) are composed inside their compound parent above.
          Full prop API + variant matrix audit → DS Storybook
          (<a href="https://ajenchen.github.io/design-system/">link</a>)。
        </p>
      </div>
      </DS.TooltipProvider>
    )
  },
}
