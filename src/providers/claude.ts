import type { RenderOptions } from "../types";
import { asArray, asString, formatDate, formatHeaderLines, isRecord, jsonBlock } from "../shared";

const ROOT_PARENT_UUID = "00000000-0000-4000-8000-000000000000";

interface ClaudeConversation {
  uuid: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  model?: string;
  current_leaf_message_uuid?: string;
  settings?: {
    enabled_monkeys_in_a_barrel?: boolean;
  };
  chat_messages: ClaudeMessage[];
}

interface ClaudeMessage {
  uuid: string;
  parent_message_uuid?: string;
  sender: string;
  index: number;
  created_at?: string;
  updated_at?: string;
  stop_reason?: string;
  content: ClaudeContent[];
  files?: unknown[];
  files_v2?: unknown[];
  attachments?: unknown[];
}

type ClaudeContent = Record<string, unknown> & {
  type?: string;
  text?: string;
  thinking?: string;
  summaries?: Array<{ summary?: string }>;
  name?: string;
  input?: unknown;
  content?: unknown;
};

interface TreeNode extends ClaudeMessage {
  children: TreeNode[];
}

interface BranchInfo {
  index: number;
  path: TreeNode[];
  isMain: boolean;
}

interface VersionInfo {
  version: number;
  total: number;
}

interface ArtifactState {
  title: string;
  type: string | undefined;
  language: string;
  fullContent: string;
  version: number;
}

interface ArtifactVersion {
  id: string;
  title: string;
  command: string;
  type: string | undefined;
  language: string;
  fullContent: string;
  version: number;
  updateInfo: string | undefined;
  branchIndex: number;
  isMainBranch: boolean;
  createdAt: string | undefined;
  status: string | undefined;
}

interface UpdateResult {
  content: string;
  info: string | undefined;
}

export function isClaudeConversation(value: unknown): value is ClaudeConversation {
  if (!isRecord(value)) return false;
  return Array.isArray(value.chat_messages) && typeof value.uuid === "string";
}

export function renderClaudeConversation(conversation: ClaudeConversation, options: RenderOptions = {}): string {
  const timeZone = options.timeZone;
  const { branches, mainUuids, messageBranchMap } = buildBranchData(conversation);
  const versionInfo = buildVersionInfo(conversation.chat_messages);
  const artifactIndex = buildArtifactIndex(branches, messageBranchMap);
  const messages = [...conversation.chat_messages].sort((a, b) => a.index - b.index);
  const sections: string[] = [];

  const headerLines = [
    `*URL:* https://claude.ai/chat/${conversation.uuid}`,
    `*Created:* ${formatDate(conversation.created_at, timeZone)}`,
    `*Updated:* ${formatDate(conversation.updated_at, timeZone)}`
  ];

  if (conversation.model) {
    headerLines.push(`*Model:* \`${conversation.model}\``);
  }

  sections.push(`${formatHeaderLines(headerLines)}\n\n# ${conversation.name ?? "Untitled"}`);

  for (const message of messages) {
    sections.push("__________");
    sections.push(renderMessage(message, {
      branches,
      mainUuids,
      messageBranchMap,
      versionInfo,
      artifactIndex,
      isCodeExecutionConversation: conversation.settings?.enabled_monkeys_in_a_barrel === true,
      timeZone
    }));
  }

  return sections.join("\n\n");
}

function parseClaudeConversation(value: unknown): ClaudeConversation {
  if (!isClaudeConversation(value)) {
    throw new Error("Expected a Claude conversation export.");
  }

  return value;
}

export function renderClaude(value: unknown, options: RenderOptions = {}): string {
  return renderClaudeConversation(parseClaudeConversation(value), options);
}

function renderMessage(
  message: ClaudeMessage,
  context: {
    branches: BranchInfo[];
    mainUuids: Set<string>;
    messageBranchMap: Map<string, number>;
    versionInfo: Map<string, VersionInfo>;
    artifactIndex: WeakMap<ClaudeContent, ArtifactVersion>;
    isCodeExecutionConversation: boolean;
    timeZone: string | undefined;
  }
): string {
  const role = message.sender === "human" ? "Human" : "Claude";
  const headerLines = [`## ${message.index} - ${role}`];
  const branchNumber = context.messageBranchMap.get(message.uuid) ?? "?";
  const branchKind = context.mainUuids.has(message.uuid) ? "Main" : "Side";

  headerLines.push(`*Branch:* ${branchNumber} | ${branchKind}`);

  const version = context.versionInfo.get(message.uuid);
  if (version) {
    headerLines.push(`*Version:* ${version.version} of ${version.total}`);
  }

  headerLines.push(`*Created:* ${formatDate(message.created_at, context.timeZone)}`);

  const parts = [formatHeaderLines(headerLines)];

  for (const content of message.content) {
    const rendered = renderContent(content, message, context);
    if (rendered !== undefined && rendered !== "") {
      parts.push(rendered);
    }
  }

  const files = [...asArray(message.files_v2), ...asArray(message.files), ...asArray(message.attachments)];
  for (const file of files) {
    parts.push(renderAttachedFile(file));
  }

  return parts.join("\n\n");
}

function renderContent(
  content: ClaudeContent,
  message: ClaudeMessage,
  context: {
    branches: BranchInfo[];
    artifactIndex: WeakMap<ClaudeContent, ArtifactVersion>;
    isCodeExecutionConversation: boolean;
    timeZone: string | undefined;
  }
): string | undefined {
  switch (content.type) {
    case "text":
      return content.text ?? "";

    case "thinking":
      return renderThinking(content, context.isCodeExecutionConversation);

    case "tool_use":
      return renderToolUse(content, context);

    case "tool_result":
      return renderToolResult(content);

    default:
      return renderUnknownContent(content, message);
  }
}

function renderThinking(content: ClaudeContent, isCodeExecutionConversation: boolean): string {
  const summaries = Array.isArray(content.summaries) ? content.summaries : [];
  const lastSummary = summaries.at(-1)?.summary;
  const summary = lastSummary ?? (isCodeExecutionConversation ? "Code Execution thinking" : "Thinking");
  const label = isCodeExecutionConversation ? "*[Code Execution Claude thinking...]*" : "*[Claude thinking...]*";

  return [
    "",
    `<details>\n<summary>${label} ${summary}</summary>\n`,
    content.thinking ?? "",
    "</details>"
  ].join("\n");
}

function renderToolUse(
  content: ClaudeContent,
  context: {
    artifactIndex: WeakMap<ClaudeContent, ArtifactVersion>;
    timeZone: string | undefined;
  }
): string {
  if (content.name === "web_search" && isRecord(content.input)) {
    const query = asString(content.input.query) ?? "";
    return `**🔍 Web Search:** \`${query}\``;
  }

  if (content.name === "artifacts" && isRecord(content.input)) {
    return renderArtifact(content.input, context.artifactIndex.get(content), context.timeZone);
  }

  const name = content.name ?? "tool";
  return [`**Tool Use:** \`${name}\``, jsonBlock(content.input ?? {})].join("\n\n");
}

function renderToolResult(content: ClaudeContent): string {
  if (content.name === "web_search") {
    const results = asArray(content.content).filter(isKnowledgeResult);
    const lines = [`**📚 Search Results (${results.length} found)**`, ""];

    results.forEach((result, index) => {
      lines.push(`${index + 1}. **[${result.title}]**`);
      if (isRecord(result.metadata) && typeof result.metadata.site_domain === "string") {
        lines.push(`   *Source:* ${result.url}`);
      }
      lines.push("");
    });

    return lines.join("\n");
  }

  return [`**Tool Result:** \`${content.name ?? "tool"}\``, jsonBlock(content.content ?? null)].join("\n\n");
}

function renderArtifact(input: Record<string, unknown>, version: ArtifactVersion | undefined, timeZone: string | undefined): string {
  const title = version?.title ?? asString(input.title) ?? "Artifact";
  const id = version?.id ?? asString(input.id);
  const command = version?.command ?? asString(input.command);
  const artifactContent = version?.fullContent ?? asString(input.content);
  const language = version?.language ?? asString(input.language) ?? "";
  const lines = ["<details>", `<summary>${title}</summary>`, ""];

  if (id) lines.push(`> *ID:* \`${id}\`  `);
  if (command) lines.push(`> *Command:* \`${command}\``);
  if (version) {
    lines.push(`> *Branch:* branch${version.branchIndex}${version.isMainBranch ? " (main)" : ""}  `);
    lines.push(`> *Version:* ${version.version}  `);
    if (version.createdAt) lines.push(`> *Created:* ${formatDate(version.createdAt, timeZone)}  `);
    if (version.updateInfo) lines.push(`> *Update Info:* ${version.updateInfo}  `);
    if (version.status) lines.push(`> *Status:* ${version.status}`);
  }
  if (id || command || version) lines.push("");

  if (artifactContent !== undefined) {
    lines.push(`\`\`\`${language}`);
    lines.push(artifactContent);
    lines.push("```");
    lines.push("");
  }

  lines.push("</details>");

  return lines.join("\n");
}

function renderAttachedFile(file: unknown): string {
  if (!isRecord(file)) {
    return ["**Attachment:**", jsonBlock(file)].join("\n\n");
  }

  const name = asString(file.file_name) ?? asString(file.name) ?? "unnamed";
  const id = asString(file.file_uuid) ?? asString(file.uuid) ?? asString(file.id);
  const lines = [`**File:** ${name}`];

  if (id) {
    lines.push(`*ID:* \`${id}\``);
  }

  return lines.join("  \n");
}

function renderUnknownContent(content: ClaudeContent, message: ClaudeMessage): string {
  const type = content.type ?? "unknown";
  return [
    `**Unsupported Claude content:** \`${type}\``,
    `*Message:* \`${message.uuid}\``,
    jsonBlock(content)
  ].join("\n\n");
}

function isKnowledgeResult(value: unknown): value is { title: string; url: string; metadata?: unknown } {
  return isRecord(value) && value.type === "knowledge" && typeof value.title === "string" && typeof value.url === "string";
}

function buildBranchData(conversation: ClaudeConversation): {
  branches: BranchInfo[];
  mainUuids: Set<string>;
  messageBranchMap: Map<string, number>;
} {
  const tree = buildTree(conversation.chat_messages);
  const leafPaths = collectLeafPaths(tree.roots);
  const mainPath = findMainPath(tree.nodeMap, conversation, leafPaths);
  const mainLeafUuid = mainPath.at(-1)?.uuid;
  const mainUuids = new Set(mainPath.map((message) => message.uuid));

  const branches = leafPaths
    .map((path) => ({ path, isMain: path.at(-1)?.uuid === mainLeafUuid }))
    .sort((a, b) => compareBranchPaths(a.path, b.path))
    .map((branch, index) => ({ ...branch, index: index + 1 }));

  const messageBranchMap = new Map<string, number>();
  for (const branch of branches) {
    for (const message of branch.path) {
      if (!messageBranchMap.has(message.uuid)) {
        messageBranchMap.set(message.uuid, branch.index);
      }
    }
  }

  const mainBranch = branches.find((branch) => branch.isMain);
  if (mainBranch) {
    for (const message of mainBranch.path) {
      messageBranchMap.set(message.uuid, mainBranch.index);
    }
  }

  return { branches, mainUuids, messageBranchMap };
}

function buildTree(messages: ClaudeMessage[]): { roots: TreeNode[]; nodeMap: Map<string, TreeNode> } {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const message of messages) {
    nodeMap.set(message.uuid, { ...message, children: [] });
  }

  for (const message of messages) {
    const node = nodeMap.get(message.uuid);
    if (!node) continue;

    const parentUuid = message.parent_message_uuid;
    const parent = parentUuid ? nodeMap.get(parentUuid) : undefined;
    if (!parent || parentUuid === ROOT_PARENT_UUID) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  sortTree(roots);

  return { roots, nodeMap };
}

function sortTree(nodes: TreeNode[]): void {
  nodes.sort((a, b) => compareMessages(a, b));
  for (const node of nodes) {
    sortTree(node.children);
  }
}

function collectLeafPaths(roots: TreeNode[]): TreeNode[][] {
  const paths: TreeNode[][] = [];

  const visit = (node: TreeNode, path: TreeNode[]) => {
    const nextPath = [...path, node];
    if (node.children.length === 0) {
      paths.push(nextPath);
      return;
    }

    for (const child of node.children) {
      visit(child, nextPath);
    }
  };

  for (const root of roots) {
    visit(root, []);
  }

  return paths;
}

function findMainPath(
  nodeMap: Map<string, TreeNode>,
  conversation: ClaudeConversation,
  leafPaths: TreeNode[][]
): TreeNode[] {
  if (conversation.current_leaf_message_uuid) {
    const currentLeaf = nodeMap.get(conversation.current_leaf_message_uuid);
    if (currentLeaf) {
      return buildPathFromNode(nodeMap, currentLeaf);
    }
  }

  const maxIndexPath = [...leafPaths].sort((a, b) => {
    const aIndex = a.at(-1)?.index ?? -1;
    const bIndex = b.at(-1)?.index ?? -1;
    return bIndex - aIndex;
  })[0];

  return maxIndexPath ?? [];
}

function buildPathFromNode(nodeMap: Map<string, TreeNode>, leaf: TreeNode): TreeNode[] {
  const path: TreeNode[] = [];
  let current: TreeNode | undefined = leaf;

  while (current) {
    path.unshift(current);
    const parentUuid = current.parent_message_uuid;
    if (!parentUuid || parentUuid === ROOT_PARENT_UUID) break;
    current = nodeMap.get(parentUuid);
  }

  return path;
}

function compareBranchPaths(a: TreeNode[], b: TreeNode[]): number {
  const aFirst = a[0];
  const bFirst = b[0];
  if (!aFirst || !bFirst) return a.length - b.length;
  return compareMessages(aFirst, bFirst);
}

function compareMessages(a: ClaudeMessage, b: ClaudeMessage): number {
  const indexDiff = a.index - b.index;
  if (indexDiff !== 0) return indexDiff;
  return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
}

function buildVersionInfo(messages: ClaudeMessage[]): Map<string, VersionInfo> {
  const groups = new Map<string, ClaudeMessage[]>();
  const versionInfo = new Map<string, VersionInfo>();

  for (const message of messages) {
    const parentUuid = message.parent_message_uuid;
    if (!parentUuid) continue;
    const siblings = groups.get(parentUuid) ?? [];
    siblings.push(message);
    groups.set(parentUuid, siblings);
  }

  for (const siblings of groups.values()) {
    if (siblings.length <= 1) continue;
    siblings.sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
    siblings.forEach((message, index) => {
      versionInfo.set(message.uuid, {
        version: index + 1,
        total: siblings.length
      });
    });
  }

  return versionInfo;
}

function buildArtifactIndex(branches: BranchInfo[], messageBranchMap: Map<string, number>): WeakMap<ClaudeContent, ArtifactVersion> {
  const artifactIndex = new WeakMap<ClaudeContent, ArtifactVersion>();

  for (const branch of branches) {
    const states = new Map<string, ArtifactState>();

    for (const message of branch.path) {
      for (const content of message.content) {
        if (content.type !== "tool_use" || content.name !== "artifacts" || !isRecord(content.input)) {
          continue;
        }

        const artifactVersion = applyArtifactCommand(content.input, states, branch, message);
        if (artifactVersion) {
          const renderedBranch = messageBranchMap.get(message.uuid);
          if (renderedBranch === undefined || renderedBranch === branch.index) {
            artifactIndex.set(content, artifactVersion);
          }
        }
      }
    }
  }

  return artifactIndex;
}

function applyArtifactCommand(
  input: Record<string, unknown>,
  states: Map<string, ArtifactState>,
  branch: BranchInfo,
  message: ClaudeMessage
): ArtifactVersion | undefined {
  const id = asString(input.id);
  if (!id) return undefined;

  const previous = states.get(id);
  const command = asString(input.command) ?? "unknown";
  const fallbackTitle = `Artifact ${id}`;
  let title = asString(input.title) ?? previous?.title ?? fallbackTitle;
  let type = asString(input.type) ?? previous?.type;
  let language = asString(input.language) ?? previous?.language ?? "";
  let fullContent = previous?.fullContent ?? "";
  let updateInfo: string | undefined;

  switch (command) {
    case "create":
      fullContent = asString(input.content) ?? "";
      title = asString(input.title) ?? fallbackTitle;
      type = asString(input.type);
      language = asString(input.language) ?? "";
      break;

    case "rewrite":
      fullContent = asString(input.content) ?? "";
      title = asString(input.title) ?? previous?.title ?? fallbackTitle;
      type = asString(input.type) ?? previous?.type;
      language = asString(input.language) ?? previous?.language ?? "";
      break;

    case "update": {
      const result = applyUpdate(fullContent, asString(input.old_str) ?? "", asString(input.new_str) ?? "");
      fullContent = result.content;
      updateInfo = result.info;
      break;
    }

    default:
      updateInfo = `Unknown artifact command: ${command}`;
      break;
  }

  const nextState: ArtifactState = {
    title,
    type,
    language,
    fullContent,
    version: (previous?.version ?? 0) + 1
  };
  states.set(id, nextState);

  return {
    id,
    title,
    command,
    type,
    language,
    fullContent,
    version: nextState.version,
    updateInfo,
    branchIndex: branch.index,
    isMainBranch: branch.isMain,
    createdAt: asString(input.stop_timestamp) ?? asString(input.start_timestamp) ?? message.created_at,
    status: message.stop_reason === "user_canceled" ? "CANCELED" : undefined
  };
}

function applyUpdate(previousContent: string, oldStr: string, newStr: string): UpdateResult {
  if (!previousContent || !oldStr) {
    if (newStr) {
      return {
        content: newStr + (previousContent ? `\n${previousContent}` : ""),
        info: "[WARNING: Added content to beginning - missing old_str or previousContent]"
      };
    }

    return {
      content: previousContent,
      info: "Cannot apply update: missing previousContent, oldStr, and newStr"
    };
  }

  const updatedContent = previousContent.replace(oldStr, newStr);
  if (updatedContent !== previousContent) {
    return {
      content: updatedContent,
      info: "Successfully applied update"
    };
  }

  if (newStr) {
    return {
      content: `${newStr}\n${previousContent}`,
      info: "[WARNING: Added content to beginning - old_str not found in content]"
    };
  }

  return {
    content: previousContent,
    info: "Update did not change content - old string not found"
  };
}
