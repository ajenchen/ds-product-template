// 變體 adapter（消費端,薄薄一層）—— 把 chat prototype 針對「訊息區寬度」的各設計變體
// 包進鎖定引擎 @imethan0254/ut-model-a 的 UTVariant。引擎不認識 chat,靠這層 + onAction 串接。
import App, { type ChatVariantConfig, type ChatAction } from '../App'
import type { UTVariant, Localized } from '@imethan0254/ut-model-a'

// 讓 story 端能拿到 prototype 自己的 Action union（給 task.check 判定型別用）。
export type { ChatAction } from '../App'

/** 用一組 config 產生一個「訊息區寬度」測試變體。label 可給單一字串或 { zh, en } 雙語。 */
export function messageWidthVariant(label: Localized, config: ChatVariantConfig): UTVariant<ChatAction> {
  return { label, render: ({ onAction }) => <App config={config} onAction={onAction} /> }
}
