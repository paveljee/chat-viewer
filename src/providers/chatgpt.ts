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

interface BranchInfo {
  index: number;
  path: ChatGptNode[];
  isMain: boolean;
}

interface VersionInfo {
  version: number;
  total: number;
}

interface RenderEntry {
  node: ChatGptNode;
  thinkingBlocks: string[];
  toolResults: ChatGptNode[];
  acceptsToolResults: boolean;
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
  const branchData = buildBranchData(conversation);
  const versionInfo = buildVersionInfo(conversation);
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
  for (const entry of buildRenderEntries(nodes)) {
    sections.push("__________");
    sections.push(renderMessage(entry, visibleIndex, options, branchData, versionInfo));
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

function renderMessage(
  entry: RenderEntry,
  index: number,
  options: RenderOptions,
  branchData: {
    branchMap: Map<ChatGptNode, number>;
    mainNodes: Set<ChatGptNode>;
  },
  versionInfo: Map<ChatGptNode, VersionInfo>
): string {
  const { node } = entry;
  const message = node.message;
  if (!message) return "";

  const role = roleName(message);
  const headerLines = [`## ${index} - ${role}`];
  const branchNumber = branchData.branchMap.get(node) ?? "?";
  const branchKind = branchData.mainNodes.has(node) ? "Main" : "Side";
  const version = versionInfo.get(node);

  headerLines.push(`*Branch:* ${branchNumber} | ${branchKind}`);

  if (version) {
    headerLines.push(`*Version:* ${version.version} of ${version.total}`);
  }

  if (message.recipient && message.recipient !== "all") {
    headerLines.push(`*Recipient:* \`${message.recipient}\``);
  }

  if (message.channel) {
    headerLines.push(`*Channel:* \`${message.channel}\``);
  }

  headerLines.push(`*Created:* ${formatDate(message.create_time, options.timeZone)}`);

  return [
    formatHeaderLines(headerLines),
    ...entry.thinkingBlocks,
    renderContent(message),
    renderMetadata(message),
    ...entry.toolResults.map((toolNode) => renderGroupedToolResult(toolNode, options.timeZone))
  ].filter(Boolean).join("\n\n");
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
  const thoughts = thoughtText(content);
  if (!thoughts) return "";

  return `<details>\n<summary>ChatGPT thinking</summary>\n\n${thoughts}\n\n</details>`;
}

function renderMetadata(message: ChatGptMessage): string {
  const metadata = message.metadata;
  if (!metadata) return "";

  const sections = [
    renderSearchQueries(metadata),
    renderSearchResultGroups(metadata),
    renderContentReferences(metadata),
    renderCitations(metadata)
  ].filter((section) => section.length > 0);

  return sections.join("\n\n");
}

function renderGroupedToolResult(node: ChatGptNode, timeZone: string | undefined): string {
  const message = node.message;
  if (!message) return "";

  return [
    `**Grouped ${roleName(message)} Result**`,
    `*Created:* ${formatDate(message.create_time, timeZone)}`,
    renderContent(message),
    renderMetadata(message)
  ].filter(Boolean).join("\n\n");
}

function renderSearchQueries(metadata: Record<string, unknown>): string {
  const searchModelQueries = metadata.search_model_queries;
  if (!isRecord(searchModelQueries)) return "";

  const queries = asArray(searchModelQueries.queries).filter((query): query is string => typeof query === "string");
  if (queries.length === 0) return "";

  return ["**Search Queries:**", "", ...queries.map((query, index) => `${index + 1}. ${query}`)].join("\n");
}

function renderSearchResultGroups(metadata: Record<string, unknown>): string {
  const groups = asArray(metadata.search_result_groups).filter(isSearchResultGroup);
  if (groups.length === 0) return "";

  const lines = [`**Search Results (${groups.reduce((count, group) => count + group.entries.length, 0)} found)**`, ""];

  for (const group of groups) {
    lines.push(`*Domain:* ${group.domain}`);
    for (const entry of group.entries) {
      lines.push(`- [${entry.title}](${entry.url})`);
      if (entry.snippet) lines.push(`  ${entry.snippet}`);
      if (entry.attribution) lines.push(`  *Source:* ${entry.attribution}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function renderContentReferences(metadata: Record<string, unknown>): string {
  const refs = asArray(metadata.content_references).filter(isRecord);
  if (refs.length === 0) return "";

  const lines = ["**Content References:**", ""];

  refs.forEach((ref, index) => {
    const matchedText = asString(ref.matched_text);
    const alt = asString(ref.alt);
    const items = asArray(ref.items).filter(isReferenceItem);

    lines.push(`${index + 1}. ${matchedText ? `\`${matchedText}\`` : "reference"}`);
    if (alt) lines.push(`   *Rendered as:* ${alt}`);
    for (const item of items) {
      lines.push(`   - [${item.title}](${item.url})`);
      const supportingWebsites = asArray(item.supporting_websites).filter(isSupportingWebsite);
      for (const supporting of supportingWebsites) {
        lines.push(`     - Supporting: [${supporting.title}](${supporting.url})`);
      }
    }
  });

  return lines.join("\n");
}

function renderCitations(metadata: Record<string, unknown>): string {
  const citations = asArray(metadata.citations).filter(isRecord);
  if (citations.length === 0) return "";

  const lines = ["**Citations:**", ""];

  citations.forEach((citation, index) => {
    const title = isRecord(citation.metadata) ? asString(citation.metadata.title) : undefined;
    const url = asString(citation.url) ?? (isRecord(citation.metadata) ? asString(citation.metadata.url) : undefined);
    const label = title ?? url ?? "citation";

    lines.push(`${index + 1}. ${url ? `[${label}](${url})` : label}`);
  });

  return lines.join("\n");
}

function shouldSkipMessage(message: ChatGptMessage): boolean {
  if (message.author?.role === "system") return true;
  if (message.content && asString(message.content.content_type) === "user_editable_context") return true;
  if (message.content && asString(message.content.content_type) === "thoughts" && !thoughtText(message.content)) return true;
  if (message.metadata?.is_visually_hidden_from_conversation === true) return true;

  return false;
}

function buildRenderEntries(nodes: ChatGptNode[]): RenderEntry[] {
  const entries: RenderEntry[] = [];
  let pendingThinkingBlocks: string[] = [];

  for (const node of nodes) {
    const message = node.message;
    if (!message) continue;

    if (message.content && asString(message.content.content_type) === "thoughts") {
      const renderedThinking = renderThoughts(message.content);
      if (renderedThinking) {
        pendingThinkingBlocks.push(renderedThinking);
      }
      continue;
    }

    if (shouldSkipMessage(message)) continue;

    const lastEntry = entries.at(-1);
    if (message.author?.role === "tool" && lastEntry?.acceptsToolResults) {
      lastEntry.toolResults.push(node);
      continue;
    }

    const acceptsToolResults = message.author?.role === "assistant" && message.recipient !== undefined && message.recipient !== "all";
    entries.push({
      node,
      thinkingBlocks: pendingThinkingBlocks,
      toolResults: [],
      acceptsToolResults
    });
    pendingThinkingBlocks = [];
  }

  if (pendingThinkingBlocks.length > 0 && entries.length > 0) {
    entries[entries.length - 1]?.thinkingBlocks.push(...pendingThinkingBlocks);
  }

  return entries;
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

function buildBranchData(conversation: ChatGptConversation): {
  branches: BranchInfo[];
  branchMap: Map<ChatGptNode, number>;
  mainNodes: Set<ChatGptNode>;
} {
  const roots = Object.values(conversation.mapping).filter((node) => !node.parent || !conversation.mapping[node.parent]);
  const leafPaths = collectLeafPaths(conversation, roots.sort(compareNodes));
  const currentNode = conversation.current_node ? conversation.mapping[conversation.current_node] : undefined;
  const mainPath = currentNode ? buildPath(conversation, currentNode) : (leafPaths[0] ?? []);
  const mainLeaf = mainPath.at(-1);
  const mainNodes = new Set(mainPath);
  const branches = leafPaths
    .map((path) => ({
      path,
      isMain: mainLeaf !== undefined && path.at(-1) === mainLeaf
    }))
    .sort(compareBranches)
    .map((branch, index) => ({
      ...branch,
      index: index + 1
    }));
  const branchMap = new Map<ChatGptNode, number>();

  for (const branch of branches) {
    for (const node of branch.path) {
      if (!branchMap.has(node)) {
        branchMap.set(node, branch.index);
      }
    }
  }

  const mainBranch = branches.find((branch) => branch.isMain);
  if (mainBranch) {
    for (const node of mainBranch.path) {
      branchMap.set(node, mainBranch.index);
    }
  }

  return { branches, branchMap, mainNodes };
}

function collectLeafPaths(conversation: ChatGptConversation, roots: ChatGptNode[]): ChatGptNode[][] {
  const paths: ChatGptNode[][] = [];

  const visit = (node: ChatGptNode, path: ChatGptNode[]) => {
    const nextPath = [...path, node];
    const children = (node.children ?? []).map((childId) => conversation.mapping[childId]).filter((child): child is ChatGptNode => child !== undefined);

    if (children.length === 0) {
      paths.push(nextPath);
      return;
    }

    children.sort(compareNodes).forEach((child) => visit(child, nextPath));
  };

  roots.forEach((root) => visit(root, []));

  return paths;
}

function buildPath(conversation: ChatGptConversation, leaf: ChatGptNode): ChatGptNode[] {
  const path: ChatGptNode[] = [];
  let current: ChatGptNode | undefined = leaf;

  while (current) {
    path.unshift(current);
    current = current.parent ? conversation.mapping[current.parent] : undefined;
  }

  return path;
}

function compareBranches(a: { path: ChatGptNode[] }, b: { path: ChatGptNode[] }): number {
  const aFirst = firstVisibleNode(a.path) ?? a.path[0];
  const bFirst = firstVisibleNode(b.path) ?? b.path[0];

  if (!aFirst || !bFirst) return a.path.length - b.path.length;
  return compareNodes(aFirst, bFirst);
}

function firstVisibleNode(path: ChatGptNode[]): ChatGptNode | undefined {
  return path.find((node) => node.message && !shouldSkipMessage(node.message));
}

function buildVersionInfo(conversation: ChatGptConversation): Map<ChatGptNode, VersionInfo> {
  const versionInfo = new Map<ChatGptNode, VersionInfo>();

  for (const node of Object.values(conversation.mapping)) {
    const siblings = (node.children ?? []).map((childId) => conversation.mapping[childId]).filter((child): child is ChatGptNode => {
      return child?.message !== undefined && child.message !== null && !shouldSkipMessage(child.message);
    });

    if (siblings.length <= 1) continue;

    siblings.sort(compareNodes);
    siblings.forEach((sibling, index) => {
      versionInfo.set(sibling, {
        version: index + 1,
        total: siblings.length
      });
    });
  }

  return versionInfo;
}

function isSearchResultGroup(value: unknown): value is {
  domain: string;
  entries: Array<{
    title: string;
    url: string;
    snippet?: string;
    attribution?: string;
  }>;
} {
  if (!isRecord(value) || typeof value.domain !== "string") return false;

  const entries = asArray(value.entries);
  return entries.every((entry) => isRecord(entry) && typeof entry.title === "string" && typeof entry.url === "string");
}

function isReferenceItem(value: unknown): value is {
  title: string;
  url: string;
  supporting_websites?: unknown;
} {
  return isRecord(value) && typeof value.title === "string" && typeof value.url === "string";
}

function isSupportingWebsite(value: unknown): value is { title: string; url: string } {
  return isRecord(value) && typeof value.title === "string" && typeof value.url === "string";
}

function thoughtText(content: Record<string, unknown>): string {
  return asArray(content.thoughts)
    .map((thought) => {
      if (!isRecord(thought)) return "";
      return asString(thought.content) ?? asString(thought.summary) ?? "";
    })
    .filter((text) => text.length > 0)
    .join("\n\n");
}
