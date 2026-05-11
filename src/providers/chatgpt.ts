import type { RenderOptions } from "../types";
import { asArray, asNumber, asString, formatDate, formatHeaderLines, isRecord, jsonBlock } from "../shared";

interface ChatGptConversation {
  id?: string;
  conversation_id?: string;
  title?: string;
  create_time?: number;
  update_time?: number;
  current_node?: string;
  mapping: Record<string, ChatGptNode>;
}

interface ChatGptNode {
  id?: string;
  parent?: string;
  children?: string[];
  message?: ChatGptMessage | null;
}

interface ChatGptMessage {
  id?: string;
  author?: {
    role?: string;
    name?: string;
  };
  recipient?: string;
  channel?: string | null;
  create_time?: number;
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function isChatGptExport(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every((entry) => isChatGptConversation(entry));
  }

  return isChatGptConversation(value);
}

export function renderChatGpt(value: unknown, options: RenderOptions = {}): string {
  const conversations = Array.isArray(value) ? value : [value];
  const rendered = conversations.map((conversation) => renderChatGptConversation(parseConversation(conversation), options));

  return rendered.join("\n\n__________\n\n");
}

function parseConversation(value: unknown): ChatGptConversation {
  if (!isChatGptConversation(value)) {
    throw new Error("Expected a ChatGPT conversation export.");
  }

  return value;
}

function isChatGptConversation(value: unknown): value is ChatGptConversation {
  return isRecord(value) && isRecord(value.mapping);
}

function renderChatGptConversation(conversation: ChatGptConversation, options: RenderOptions): string {
  const nodes = orderedNodes(conversation);
  const model = extractModel(nodes);
  const id = conversation.id ?? conversation.conversation_id ?? "unknown";
  const title = conversation.title ?? "ChatGPT Conversation";
  const sections: string[] = [];
  const headerLines = [
    `*URL:* https://chatgpt.com/c/${id}`,
    `*Created:* ${formatDate(conversation.create_time, options.timeZone)}`,
    `*Updated:* ${formatDate(conversation.update_time, options.timeZone)}`
  ];

  if (model) {
    headerLines.push(`*Model:* \`${model}\``);
  }

  sections.push(`${formatHeaderLines(headerLines)}\n\n# ${title}`);

  let visibleIndex = 0;
  for (const node of nodes) {
    if (!node.message || shouldSkipMessage(node.message)) continue;
    sections.push("__________");
    sections.push(renderMessage(node, visibleIndex, options));
    visibleIndex += 1;
  }

  return sections.join("\n\n");
}

function orderedNodes(conversation: ChatGptConversation): ChatGptNode[] {
  const roots = Object.entries(conversation.mapping)
    .filter(([, node]) => !node.parent || !conversation.mapping[node.parent])
    .map(([, node]) => node);

  const out: ChatGptNode[] = [];
  const seen = new Set<ChatGptNode>();

  const visit = (node: ChatGptNode) => {
    if (seen.has(node)) return;
    seen.add(node);
    out.push(node);

    for (const childId of node.children ?? []) {
      const child = conversation.mapping[childId];
      if (child) visit(child);
    }
  };

  roots.sort(compareNodes).forEach(visit);

  for (const node of Object.values(conversation.mapping).sort(compareNodes)) {
    if (!seen.has(node)) visit(node);
  }

  return out;
}

function renderMessage(node: ChatGptNode, index: number, options: RenderOptions): string {
  const message = node.message;
  if (!message) return "";

  const role = roleName(message);
  const headerLines = [`## ${index} - ${role}`];

  if (message.recipient && message.recipient !== "all") {
    headerLines.push(`*Recipient:* \`${message.recipient}\``);
  }

  if (message.channel) {
    headerLines.push(`*Channel:* \`${message.channel}\``);
  }

  headerLines.push(`*Created:* ${formatDate(message.create_time, options.timeZone)}`);

  return [formatHeaderLines(headerLines), renderContent(message)].filter(Boolean).join("\n\n");
}

function renderContent(message: ChatGptMessage): string {
  const content = message.content;
  if (!content) return "";

  const contentType = asString(content.content_type) ?? "unknown";

  switch (contentType) {
    case "text":
      return asArray(content.parts).map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join("\n");

    case "multimodal_text":
      return asArray(content.parts).map(renderMultimodalPart).join("\n");

    case "code":
      return [`\`\`\`${asString(content.language) ?? ""}`, asString(content.text) ?? "", "```"].join("\n");

    case "execution_output":
      return [`**Execution Output:**`, "```", asString(content.text) ?? "", "```"].join("\n");

    case "thoughts":
      return renderThoughts(content);

    case "reasoning_recap":
      return `<details>\n<summary>Reasoning recap</summary>\n\n${asString(content.content) ?? ""}\n\n</details>`;

    default:
      return [`**Unsupported ChatGPT content:** \`${contentType}\``, jsonBlock(content)].join("\n\n");
  }
}

function renderMultimodalPart(part: unknown): string {
  if (typeof part === "string") return part;
  if (!isRecord(part)) return JSON.stringify(part);

  const contentType = asString(part.content_type);
  if (contentType === "image_asset_pointer") {
    const pointer = asString(part.asset_pointer) ?? asString(part.url) ?? "";
    return `![image](${pointer})`;
  }

  if (contentType === "audio_transcription") {
    return `[audio] ${asString(part.text) ?? ""}`;
  }

  return jsonBlock(part);
}

function renderThoughts(content: Record<string, unknown>): string {
  const thoughts = asArray(content.thoughts)
    .map((thought) => {
      if (!isRecord(thought)) return "";
      return asString(thought.content) ?? asString(thought.summary) ?? "";
    })
    .filter((text) => text.length > 0)
    .join("\n\n");

  return `<details>\n<summary>ChatGPT thinking</summary>\n\n${thoughts}\n\n</details>`;
}

function shouldSkipMessage(message: ChatGptMessage): boolean {
  if (message.author?.role === "system") return true;
  if (message.content && asString(message.content.content_type) === "user_editable_context") return true;
  if (message.metadata?.is_visually_hidden_from_conversation === true) return true;

  return false;
}

function roleName(message: ChatGptMessage): string {
  const role = message.author?.role;
  if (role === "assistant") return "ChatGPT";
  if (role === "user") return "Human";
  if (role === "tool") return message.author?.name ? `Tool (${message.author.name})` : "Tool";
  return role ?? "Unknown";
}

function extractModel(nodes: ChatGptNode[]): string | undefined {
  for (const node of nodes) {
    const modelSlug = node.message?.metadata ? asString(node.message.metadata.model_slug) : undefined;
    if (modelSlug) return modelSlug;
  }

  return undefined;
}

function compareNodes(a: ChatGptNode, b: ChatGptNode): number {
  const aTime = asNumber(a.message?.create_time) ?? Number.MAX_SAFE_INTEGER;
  const bTime = asNumber(b.message?.create_time) ?? Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;

  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}
