import http from "node:http";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const PORT = Number(process.env.PORT || 4747);
const HOST = process.env.HOST || "127.0.0.1";
const REPOSITORY_URL = "https://github.com/LinJohn8/AI-Session-Manager";
const PAYPAL_URL = "https://www.paypal.com/paypalme/HWSLandDFTX8";
const APP_NAME = "AI Session Manager";
const IS_PACKAGED = Boolean(process.pkg);
const SHOULD_OPEN_BROWSER = process.argv.includes("--open") || process.env.AI_SESSION_MANAGER_OPEN === "1" || IS_PACKAGED;

const SEARCH_ROOTS = [
  {
    source: "codex",
    label: "Codex",
    root: path.join(HOME, ".codex", "sessions"),
  },
  {
    source: "openclaw",
    label: "OpenClaw",
    root: path.join(HOME, ".openclaw", "agents"),
  },
  {
    source: "claude",
    label: "Claude Code",
    root: path.join(HOME, ".claude", "projects"),
  },
];

const CODEX_INDEX = path.join(HOME, ".codex", "session_index.jsonl");
const CODEX_SESSIONS_ROOT = path.join(HOME, ".codex", "sessions");
function getAppTrashRoot() {
  if (process.platform === "darwin") {
    return path.join(HOME, ".Trash", "AI Session Manager");
  }

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
    return path.join(localAppData, "AI Session Manager", "Trash");
  }

  return path.join(HOME, ".local", "share", "AI Session Manager", "Trash");
}

const TRASH_ROOT = getAppTrashRoot();

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function jsonResponse(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function textResponse(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(text),
  });
  res.end(text);
}

function openBrowser(url) {
  const commands = {
    darwin: ["open", [url]],
    win32: ["cmd", ["/c", "start", "", url]],
    linux: ["xdg-open", [url]],
  };
  const [command, args] = commands[process.platform] || commands.linux;
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function compactText(value, max = 320) {
  if (value == null) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function stripBlock(text, tagName) {
  let next = text;
  const open = `<${tagName}>`;
  const close = `</${tagName}>`;

  while (next.includes(open)) {
    const start = next.indexOf(open);
    const end = next.indexOf(close, start);
    if (end === -1) break;
    next = `${next.slice(0, start)} ${next.slice(end + close.length)}`;
  }

  return next;
}

function cleanPreviewLabel(value) {
  let text = String(value || "");
  text = stripBlock(text, "environment_context");
  text = stripBlock(text, "system-reminder");
  return text
    .replace(/<environment_context>[\s\S]*?<\/filesystem>\s*(?:<\/environment_context>)?/g, " ")
    .replace(/<\|[^|]+?\|>/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarizeToolOutput(value) {
  const text = compactText(cleanPreviewLabel(value), 1200);
  const lines = text.split("\n").filter(Boolean);
  if (lines.length <= 10) return text;
  return [...lines.slice(0, 6), "...", ...lines.slice(-3)].join("\n");
}

function extractContentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      if (typeof item.text === "string") return item.text;
      if (typeof item.output_text === "string") return item.output_text;
      if (typeof item.input_text === "string") return item.input_text;
      if (item.type === "toolCall") return `[tool call] ${item.name || ""}`.trim();
      if (item.type === "toolResult") return `[tool result] ${item.toolName || ""}`.trim();
      if (item.type === "tool_use") {
        return `[tool call] ${item.name || ""} ${JSON.stringify(item.input || {})}`.trim();
      }
      if (item.type === "tool_result") {
        return `[tool result] ${typeof item.content === "string" ? item.content : JSON.stringify(item.content || "")}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === "number") return new Date(value).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function pathsEqual(a, b) {
  return path.resolve(a) === path.resolve(b);
}

function allowedRootFor(filePath) {
  const resolved = path.resolve(filePath);
  return SEARCH_ROOTS.find((root) => isInside(resolved, root.root) || resolved === root.root);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findJsonlFiles(root) {
  if (!(await fileExists(root))) return [];

  const files = [];
  const queue = [root];

  while (queue.length) {
    const current = queue.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        queue.push(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".jsonl") || entry.name.includes(".jsonl.deleted."))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function readCodexIndex() {
  const index = new Map();
  if (!(await fileExists(CODEX_INDEX))) return index;

  const rl = readline.createInterface({
    input: createReadStream(CODEX_INDEX, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      if (item.id) index.set(item.id, item);
    } catch {
      // Ignore malformed index rows; the session files are the source of truth.
    }
  }

  return index;
}

function applyObjectMetadata(obj, metadata) {
  if (obj.type === "session_meta" && obj.payload) {
    metadata.id ||= obj.payload.session_id || obj.payload.id;
    metadata.cwd ||= obj.payload.cwd;
    metadata.provider ||= obj.payload.model_provider;
    metadata.originator ||= obj.payload.originator;
    metadata.createdAt ||= toIso(obj.payload.timestamp);
  }

  if (obj.type === "session") {
    metadata.id ||= obj.id;
    metadata.cwd ||= obj.cwd;
    metadata.createdAt ||= toIso(obj.timestamp);
  }

  if (obj.sessionId) metadata.id ||= obj.sessionId;
  if (obj.cwd) metadata.cwd ||= obj.cwd;
  if (obj.version) metadata.originator ||= `Claude Code ${obj.version}`;
  if (obj.gitBranch) metadata.gitBranch ||= obj.gitBranch;

  if (obj.type === "model_change") {
    metadata.provider ||= obj.provider;
    metadata.model ||= obj.modelId;
  }
}

function messageFromObject(obj, source) {
  if (source === "codex") {
    if (obj.type === "event_msg" && obj.payload?.type === "user_message") {
      const rawText = obj.payload.message || "";
      const displayText = cleanPreviewLabel(rawText);
      return {
        role: "user",
        text: rawText,
        displayText,
        timestamp: toIso(obj.timestamp),
        kind: "message",
        category: displayText ? "conversation" : "system",
      };
    }

    if (obj.type === "response_item") {
      const payload = obj.payload || {};
      if (payload.type === "message") {
        const rawText = extractContentText(payload.content);
        const role = payload.role || "assistant";
        const displayText = cleanPreviewLabel(rawText);
        return {
          role,
          text: rawText,
          displayText,
          timestamp: toIso(obj.timestamp),
          kind: "message",
          category: displayText && (role === "user" || role === "assistant") ? "conversation" : "system",
          phase: payload.phase,
        };
      }

      if (payload.type === "function_call") {
        const rawText = `${payload.name || "function_call"} ${payload.arguments || ""}`;
        return {
          role: "tool",
          text: rawText,
          displayText: `[tool call] ${rawText}`,
          timestamp: toIso(obj.timestamp),
          kind: "tool_call",
          category: "tool",
        };
      }

      if (payload.type === "function_call_output") {
        const rawText = payload.output || "";
        return {
          role: "tool",
          text: rawText,
          displayText: summarizeToolOutput(rawText),
          timestamp: toIso(obj.timestamp),
          kind: "tool_result",
          category: "tool",
        };
      }
    }
  }

  if (source === "openclaw" && obj.type === "message" && obj.message) {
    const message = obj.message;
    const rawText = extractContentText(message.content);
    const role = message.role || "unknown";
    return {
      role,
      text: rawText,
      displayText: cleanPreviewLabel(rawText),
      timestamp: toIso(message.timestamp || obj.timestamp),
      kind: "message",
      category: role === "toolResult" ? "tool" : role === "user" || role === "assistant" ? "conversation" : "system",
      provider: message.provider,
      model: message.model,
    };
  }

  if (source === "claude") {
    if (obj.type === "user" || obj.type === "assistant") {
      const message = obj.message || {};
      const rawText = extractContentText(message.content);
      const hasToolUse = Array.isArray(message.content) && message.content.some((item) => item?.type === "tool_use");
      const hasToolResult = Array.isArray(message.content) && message.content.some((item) => item?.type === "tool_result");
      const role = message.role || obj.type;
      const category = hasToolUse || hasToolResult || role === "tool" ? "tool" : "conversation";
      return {
        role,
        text: rawText,
        displayText: category === "tool" ? summarizeToolOutput(rawText) : cleanPreviewLabel(rawText),
        timestamp: toIso(obj.timestamp),
        kind: hasToolUse ? "tool_call" : hasToolResult ? "tool_result" : "message",
        category,
        provider: "anthropic",
        model: message.model,
      };
    }

    if (obj.type === "progress" || obj.type === "queue-operation" || obj.type === "file-history-snapshot") {
      const rawText = obj.type === "file-history-snapshot"
        ? "file history snapshot"
        : JSON.stringify(obj.data || obj.content || obj.operation || obj);
      return {
        role: "system",
        text: rawText,
        displayText: summarizeToolOutput(rawText),
        timestamp: toIso(obj.timestamp),
        kind: obj.type,
        category: "system",
      };
    }
  }

  return null;
}

async function parseSessionFile(filePath, source, options = {}) {
  const { full = false, maxMessages = 1000 } = options;
  const stat = await fs.stat(filePath);
  const metadata = {
    id: null,
    title: null,
    cwd: null,
    provider: null,
    model: null,
    originator: null,
    createdAt: null,
    firstTimestamp: null,
    lastTimestamp: null,
    messageCount: 0,
    toolCount: 0,
    invalidRows: 0,
    systemCount: 0,
  };
  const messages = [];
  let firstUserText = "";
  let firstAssistantText = "";
  let lineCount = 0;

  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineCount += 1;
    if (!line.trim()) continue;

    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      metadata.invalidRows += 1;
      continue;
    }

    applyObjectMetadata(obj, metadata);
    const timestamp = toIso(obj.timestamp || obj.payload?.timestamp || obj.message?.timestamp);
    if (timestamp) {
      metadata.firstTimestamp ||= timestamp;
      metadata.lastTimestamp = timestamp;
    }

    const msg = messageFromObject(obj, source);
    if (!msg || !msg.text) continue;

    if (msg.category === "tool" || msg.kind?.startsWith("tool")) metadata.toolCount += 1;
    else if (msg.category === "system") metadata.systemCount += 1;
    else metadata.messageCount += 1;

    if (msg.role === "user" && !firstUserText) {
      firstUserText = compactText(cleanPreviewLabel(msg.text), 280);
    }
    if (msg.role === "assistant" && !firstAssistantText) {
      firstAssistantText = compactText(cleanPreviewLabel(msg.text), 280);
    }

    if (full && messages.length < maxMessages) {
      messages.push({
        ...msg,
        text: msg.text.length > 24000 ? `${msg.text.slice(0, 24000)}\n\n[truncated]` : msg.text,
        displayText: (msg.displayText || msg.text).length > 12000
          ? `${(msg.displayText || msg.text).slice(0, 12000)}\n\n[truncated]`
          : (msg.displayText || msg.text),
      });
    }
  }

  const root = allowedRootFor(filePath);
  const relativePath = root ? path.relative(root.root, filePath) : filePath;
  const fallbackId = path.basename(filePath).replace(/\.jsonl(?:\.deleted\..+)?$/, "");
  const displayId = metadata.id || fallbackId;

  return {
    path: filePath,
    relativePath,
    source,
    id: displayId,
    title: metadata.title,
    cwd: metadata.cwd,
    provider: metadata.provider,
    model: metadata.model,
    originator: metadata.originator,
    createdAt: metadata.createdAt,
    firstTimestamp: metadata.firstTimestamp || metadata.createdAt || stat.birthtime.toISOString(),
    lastTimestamp: metadata.lastTimestamp || stat.mtime.toISOString(),
    sizeBytes: stat.size,
    markedDeleted: filePath.includes(".jsonl.deleted."),
    mtime: stat.mtime.toISOString(),
    lineCount,
    messageCount: metadata.messageCount,
    toolCount: metadata.toolCount,
    systemCount: metadata.systemCount,
    invalidRows: metadata.invalidRows,
    firstUserText,
    firstAssistantText,
    messages,
    messageLimitReached: full && metadata.messageCount + metadata.toolCount > messages.length,
  };
}

async function getSessions() {
  const index = await readCodexIndex();
  const allFiles = [];

  for (const root of SEARCH_ROOTS) {
    const files = await findJsonlFiles(root.root);
    allFiles.push(...files.map((file) => ({ file, source: root.source })));
  }

  const sessions = [];
  for (const item of allFiles) {
    try {
      const session = await parseSessionFile(item.file, item.source);
      const indexItem = item.source === "codex" ? index.get(session.id) : null;
      if (indexItem) {
        session.title = indexItem.thread_name || session.title;
        session.indexed = true;
        session.indexUpdatedAt = indexItem.updated_at || null;
      } else {
        session.indexed = false;
      }
      session.title ||= session.firstUserText || session.id;
      session.sameWorkspace = session.cwd === process.cwd();
      sessions.push(session);
    } catch (error) {
      sessions.push({
        path: item.file,
        source: item.source,
        id: path.basename(item.file, ".jsonl"),
        title: "Unreadable session",
        error: error.message,
      });
    }
  }

  sessions.sort((a, b) => new Date(b.lastTimestamp || b.mtime) - new Date(a.lastTimestamp || a.mtime));
  return {
    sessions,
    roots: SEARCH_ROOTS,
    codexIndex: CODEX_INDEX,
    trashRoot: TRASH_ROOT,
  };
}

async function parseRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function uniqueDestination(destination) {
  if (!(await fileExists(destination))) return destination;
  const dir = path.dirname(destination);
  const ext = path.extname(destination);
  const base = path.basename(destination, ext);
  let attempt = 2;
  while (true) {
    const candidate = path.join(dir, `${base}-${attempt}${ext}`);
    if (!(await fileExists(candidate))) return candidate;
    attempt += 1;
  }
}

function expandHome(rawPath) {
  const value = String(rawPath || "").trim();
  if (!value) return "";
  if (value === "~") return HOME;
  if (value.startsWith("~/") || value.startsWith("~\\")) return path.join(HOME, value.slice(2));
  return value;
}

function resolveCodexTarget(rawTarget) {
  const expanded = expandHome(rawTarget);
  if (!expanded) {
    throw new Error("Target Codex path is required.");
  }

  const absolute = path.resolve(expanded);
  const normalized = path.normalize(absolute);
  const sessionsRoot = path.basename(normalized) === "sessions"
    ? normalized
    : path.join(normalized, "sessions");
  const codexHome = path.dirname(sessionsRoot);

  return {
    codexHome,
    sessionsRoot,
    indexPath: path.join(codexHome, "session_index.jsonl"),
  };
}

async function readJsonlIndex(indexPath) {
  const index = new Map();
  if (!(await fileExists(indexPath))) return index;

  const rl = readline.createInterface({
    input: createReadStream(indexPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      if (item.id) index.set(item.id, item);
    } catch {
      // Preserve malformed rows by appending new index records instead of rewriting.
    }
  }

  return index;
}

async function pruneCodexIndex(sessionIds, trashBatchDir) {
  if (!sessionIds.size || !(await fileExists(CODEX_INDEX))) {
    return { changed: false, removed: 0 };
  }

  const original = await fs.readFile(CODEX_INDEX, "utf8");
  const kept = [];
  let removed = 0;

  for (const line of original.split(/\n/)) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      if (item.id && sessionIds.has(item.id)) {
        removed += 1;
        continue;
      }
    } catch {
      // Keep malformed rows untouched.
    }
    kept.push(line);
  }

  if (!removed) return { changed: false, removed: 0 };

  const backupDir = path.join(trashBatchDir, "codex-index-backup");
  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(path.join(backupDir, "session_index.before-delete.jsonl"), original);
  const next = kept.length ? `${kept.join("\n")}\n` : "";
  const tmp = `${CODEX_INDEX}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, next);
  await fs.rename(tmp, CODEX_INDEX);

  return { changed: true, removed };
}

async function deleteSessions(paths) {
  if (!Array.isArray(paths) || !paths.length) {
    throw new Error("No session paths provided.");
  }

  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const batchDir = path.join(TRASH_ROOT, now);
  await fs.mkdir(batchDir, { recursive: true });

  const deleted = [];
  const failed = [];
  const codexIds = new Set();

  for (const rawPath of paths) {
    const filePath = path.resolve(String(rawPath));
    const root = allowedRootFor(filePath);

    if (!root) {
      failed.push({ path: filePath, error: "Path is outside allowed session roots." });
      continue;
    }

    try {
      const summary = await parseSessionFile(filePath, root.source);
      if (root.source === "codex" && summary.id) codexIds.add(summary.id);

      const destination = await uniqueDestination(
        path.join(batchDir, root.source, path.relative(root.root, filePath)),
      );
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(filePath, destination);
      deleted.push({
        path: filePath,
        destination,
        source: root.source,
        id: summary.id,
        title: summary.title || summary.firstUserText || summary.id,
        sizeBytes: summary.sizeBytes,
      });
    } catch (error) {
      failed.push({ path: filePath, error: error.message });
    }
  }

  const index = await pruneCodexIndex(codexIds, batchDir);
  const manifest = {
    deletedAt: new Date().toISOString(),
    deleted,
    failed,
    index,
  };
  await fs.writeFile(path.join(batchDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  return {
    trashBatchDir: batchDir,
    deleted,
    failed,
    index,
  };
}

async function appendCodexIndexRows(indexPath, rows) {
  if (!rows.length) return { changed: false, added: 0 };
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  await fs.appendFile(indexPath, `${body}\n`);
  return { changed: true, added: rows.length };
}

async function transferCodexSessions({ paths, targetPath, mode = "copy" }) {
  if (!Array.isArray(paths) || !paths.length) {
    throw new Error("No session paths provided.");
  }

  if (!["copy", "move"].includes(mode)) {
    throw new Error("Transfer mode must be copy or move.");
  }

  const target = resolveCodexTarget(targetPath);
  if (pathsEqual(target.sessionsRoot, CODEX_SESSIONS_ROOT)) {
    throw new Error("Target Codex sessions directory is the same as the current one.");
  }

  const sourceIndex = await readCodexIndex();
  const targetIndex = await readJsonlIndex(target.indexPath);
  const copied = [];
  const moved = [];
  const skipped = [];
  const failed = [];
  const indexRows = [];
  const sourceIdsToPrune = new Set();

  await fs.mkdir(target.sessionsRoot, { recursive: true });

  for (const rawPath of paths) {
    const filePath = path.resolve(String(rawPath));
    const root = allowedRootFor(filePath);

    if (!root || root.source !== "codex") {
      failed.push({ path: filePath, error: "Only current Codex session files can be transferred." });
      continue;
    }

    try {
      const summary = await parseSessionFile(filePath, "codex");
      if (targetIndex.has(summary.id)) {
        skipped.push({
          path: filePath,
          id: summary.id,
          title: summary.title || summary.firstUserText || summary.id,
          reason: "Target index already contains this session id.",
        });
        continue;
      }

      const relative = path.relative(CODEX_SESSIONS_ROOT, filePath);
      const destination = await uniqueDestination(path.join(target.sessionsRoot, relative));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(filePath, destination);

      const sourceIndexItem = sourceIndex.get(summary.id);
      indexRows.push({
        id: summary.id,
        thread_name: sourceIndexItem?.thread_name || summary.title || summary.firstUserText || summary.id,
        updated_at: sourceIndexItem?.updated_at || summary.lastTimestamp || new Date().toISOString(),
      });
      targetIndex.set(summary.id, true);

      const item = {
        path: filePath,
        destination,
        id: summary.id,
        title: summary.title || summary.firstUserText || summary.id,
        sizeBytes: summary.sizeBytes,
      };
      copied.push(item);

      if (mode === "move") {
        await fs.unlink(filePath);
        sourceIdsToPrune.add(summary.id);
        moved.push(item);
      }
    } catch (error) {
      failed.push({ path: filePath, error: error.message });
    }
  }

  const targetIndexResult = await appendCodexIndexRows(target.indexPath, indexRows);
  let sourceIndexResult = { changed: false, removed: 0 };
  if (mode === "move" && sourceIdsToPrune.size) {
    const now = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(TRASH_ROOT, `codex-transfer-${now}`);
    sourceIndexResult = await pruneCodexIndex(sourceIdsToPrune, backupDir);
  }

  const manifest = {
    transferredAt: new Date().toISOString(),
    mode,
    target,
    copied,
    moved,
    skipped,
    failed,
    targetIndex: targetIndexResult,
    sourceIndex: sourceIndexResult,
  };
  const manifestDir = path.join(target.codexHome, "ai-session-manager-transfer-manifests");
  await fs.mkdir(manifestDir, { recursive: true });
  await fs.writeFile(
    path.join(manifestDir, `transfer-${Date.now()}.json`),
    JSON.stringify(manifest, null, 2),
  );

  return manifest;
}

async function handleApi(req, res, pathname, searchParams) {
  try {
    if (req.method === "GET" && pathname === "/api/sessions") {
      return jsonResponse(res, 200, await getSessions());
    }

    if (req.method === "GET" && pathname === "/api/session") {
      const filePath = path.resolve(searchParams.get("path") || "");
      const root = allowedRootFor(filePath);
      if (!root) return jsonResponse(res, 403, { error: "Path is outside allowed session roots." });

      const index = await readCodexIndex();
      const session = await parseSessionFile(filePath, root.source, { full: true });
      const indexItem = root.source === "codex" ? index.get(session.id) : null;
      if (indexItem) {
        session.title = indexItem.thread_name || session.title;
        session.indexed = true;
        session.indexUpdatedAt = indexItem.updated_at || null;
      }
      session.title ||= session.firstUserText || session.id;
      return jsonResponse(res, 200, { session });
    }

    if (req.method === "POST" && pathname === "/api/delete") {
      const body = await parseRequestBody(req);
      return jsonResponse(res, 200, await deleteSessions(body.paths));
    }

    if (req.method === "POST" && pathname === "/api/codex-transfer") {
      const body = await parseRequestBody(req);
      return jsonResponse(res, 200, await transferCodexSessions(body));
    }

    return jsonResponse(res, 404, { error: "Unknown API endpoint." });
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message });
  }
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(__dirname, "public", path.normalize(safePath).replace(/^(\.\.[/\\])+/, ""));
  const publicRoot = path.join(__dirname, "public");

  if (!filePath.startsWith(publicRoot)) {
    return textResponse(res, 403, "Forbidden");
  }

  try {
    const content = await fs.readFile(filePath);
    const contentType = MIME_TYPES.get(path.extname(filePath)) || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    res.end(content);
  } catch {
    textResponse(res, 404, "Not found");
  }
}

async function scanAndPrint() {
  const data = await getSessions();
  const totalSize = data.sessions.reduce((sum, session) => sum + (session.sizeBytes || 0), 0);
  console.log(JSON.stringify({
    count: data.sessions.length,
    totalSizeBytes: totalSize,
    roots: data.roots,
    trashRoot: data.trashRoot,
    sessions: data.sessions.map((session) => ({
      source: session.source,
      id: session.id,
      title: session.title,
      path: session.path,
      sizeBytes: session.sizeBytes,
      lastTimestamp: session.lastTimestamp,
    })),
  }, null, 2));
}

if (process.argv.includes("--scan")) {
  await scanAndPrint();
} else {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, res, url.pathname, url.searchParams);
    }
    return serveStatic(res, url.pathname);
  });

  server.listen(PORT, HOST, () => {
    const localUrl = `http://${HOST}:${PORT}`;
    console.log([
      "",
      APP_NAME,
      "Local-first desktop session manager for Codex, Claude Code, and OpenClaw.",
      `Open: ${localUrl}`,
      `GitHub: ${REPOSITORY_URL}`,
      `Support: ${PAYPAL_URL}`,
      "QR support images are available in public/assets/.",
      "",
    ].join("\n"));

    if (SHOULD_OPEN_BROWSER) {
      openBrowser(localUrl);
    }
  });
}
