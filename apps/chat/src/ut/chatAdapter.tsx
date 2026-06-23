// 把 TeaChat chat prototype 包成「測試模型 A」的變體 —— 薄薄一層 adapter:
// 引擎(@imethan0254/ut-model-a)不認識 chat,靠這裡把 <App> 接上 variant.render + onAction。
import App, { type ChatVariantConfig, type ChatAction } from '../App'
import type { UTVariant } from '@imethan0254/ut-model-a'

export type { ChatAction } from '../App'

/** 每個變體 = 一組 ChatVariantConfig;把 prototype 渲染出來並把操作事件吐回引擎。 */
export function chatVariant(label: string, config: ChatVariantConfig): UTVariant<ChatAction> {
  return { label, render: ({ onAction }) => <App config={config} onAction={onAction} /> }
}
