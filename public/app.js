const state = {
  sessions: [],
  filtered: [],
  selected: new Set(),
  activePath: null,
  source: "all",
  query: "",
  previewSession: null,
  previewMode: "readable",
};

const els = {
  refreshBtn: document.querySelector("#refreshBtn"),
  deleteSelectedBtn: document.querySelector("#deleteSelectedBtn"),
  countMetric: document.querySelector("#countMetric"),
  sizeMetric: document.querySelector("#sizeMetric"),
  selectedMetric: document.querySelector("#selectedMetric"),
  searchInput: document.querySelector("#searchInput"),
  segments: [...document.querySelectorAll(".segment")],
  unindexedOnly: document.querySelector("#unindexedOnly"),
  hideSameWorkspace: document.querySelector("#hideSameWorkspace"),
  sortSelect: document.querySelector("#sortSelect"),
  trashRoot: document.querySelector("#trashRoot"),
  codexRoot: document.querySelector("#codexRoot"),
  transferTarget: document.querySelector("#transferTarget"),
  copySelectedBtn: document.querySelector("#copySelectedBtn"),
  moveSelectedBtn: document.querySelector("#moveSelectedBtn"),
  selectVisible: document.querySelector("#selectVisible"),
  visibleCount: document.querySelector("#visibleCount"),
  rows: document.querySelector("#sessionRows"),
  previewEmpty: document.querySelector("#previewEmpty"),
  previewContent: document.querySelector("#previewContent"),
  previewSource: document.querySelector("#previewSource"),
  previewTitle: document.querySelector("#previewTitle"),
  previewDetails: document.querySelector("#previewDetails"),
  messageStream: document.querySelector("#messageStream"),
  deleteOneBtn: document.querySelector("#deleteOneBtn"),
  modeButtons: [...document.querySelectorAll(".mode-button")],
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmText: document.querySelector("#confirmText"),
  confirmList: document.querySelector("#confirmList"),
  toast: document.querySelector("#toast"),
};

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function sourceLabel(source) {
  if (source === "codex") return "Codex";
  if (source === "claude") return "Claude Code";
  return "OpenClaw";
}

function searchableText(session) {
  return [
    session.title,
    session.id,
    session.path,
    session.relativePath,
    session.cwd,
    session.firstUserText,
    session.firstAssistantText,
    session.provider,
    session.model,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 5200);
}

function applyFilters() {
  const query = state.query.trim().toLowerCase();
  state.filtered = state.sessions.filter((session) => {
    if (state.source !== "all" && session.source !== state.source) return false;
    if (els.unindexedOnly.checked && !(session.source === "codex" && !session.indexed)) return false;
    if (els.hideSameWorkspace.checked && session.sameWorkspace) return false;
    if (query && !searchableText(session).includes(query)) return false;
    return true;
  });

  const sort = els.sortSelect.value;
  state.filtered.sort((a, b) => {
    if (sort === "size") return (b.sizeBytes || 0) - (a.sizeBytes || 0);
    if (sort === "messages") return (b.messageCount || 0) - (a.messageCount || 0);
    if (sort === "source") return `${a.source}${a.title}`.localeCompare(`${b.source}${b.title}`);
    return new Date(b.lastTimestamp || b.mtime) - new Date(a.lastTimestamp || a.mtime);
  });

  render();
}

function renderMetrics() {
  const totalSize = state.sessions.reduce((sum, session) => sum + (session.sizeBytes || 0), 0);
  const selectedCodexCount = selectedSessions([...state.selected]).filter((session) => session.source === "codex").length;
  els.countMetric.textContent = state.sessions.length;
  els.sizeMetric.textContent = formatBytes(totalSize);
  els.selectedMetric.textContent = state.selected.size;
  els.deleteSelectedBtn.disabled = state.selected.size === 0;
  els.copySelectedBtn.disabled = selectedCodexCount === 0;
  els.moveSelectedBtn.disabled = selectedCodexCount === 0;
  els.visibleCount.textContent = `${state.filtered.length} visible`;
  els.selectVisible.checked = state.filtered.length > 0 && state.filtered.every((s) => state.selected.has(s.path));
}

function renderRows() {
  els.rows.textContent = "";
  const fragment = document.createDocumentFragment();

  for (const session of state.filtered) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `session-row ${state.activePath === session.path ? "active" : ""}`;
    row.dataset.path = session.path;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selected.has(session.path);
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSelected(session.path, checkbox.checked);
    });

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "row-title";
    title.innerHTML = `<span>${escapeHtml(session.title || session.id)}</span><span>${formatBytes(session.sizeBytes)}</span>`;

    const sub = document.createElement("div");
    sub.className = "row-sub";
    sub.textContent = `${formatDate(session.lastTimestamp)} · ${session.messageCount || 0} messages · ${session.cwd || "no cwd"}`;

    const p = document.createElement("div");
    p.className = "row-path";
    p.textContent = session.path;

    const badges = document.createElement("div");
    badges.className = "badge-line";
    badges.append(
      badge(sourceLabel(session.source), session.source),
    );
    if (session.source === "codex") {
      badges.append(badge(session.indexed ? "indexed" : "unindexed", session.indexed ? "" : "warn"));
    }
    if (session.sameWorkspace) badges.append(badge("current cwd", "warn"));
    if (session.markedDeleted) badges.append(badge("marked deleted", "warn"));
    if (session.error) badges.append(badge("read error", "warn"));

    body.append(title, sub, p, badges);
    row.append(checkbox, body);
    row.addEventListener("click", () => loadPreview(session.path));
    fragment.append(row);
  }

  els.rows.append(fragment);
}

function badge(text, className = "") {
  const span = document.createElement("span");
  span.className = `badge ${className}`.trim();
  span.textContent = text;
  return span;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toggleSelected(path, checked) {
  if (checked) state.selected.add(path);
  else state.selected.delete(path);
  renderMetrics();
}

function render() {
  renderMetrics();
  renderRows();
}

async function fetchJson(url, options) {
  const res = await fetch(url, { cache: "no-store", ...(options || {}) });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500) || "Invalid JSON response"}`);
  }
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadSessions() {
  els.rows.innerHTML = `<div class="session-row"><div></div><div>正在扫描本机 session...</div></div>`;
  const data = await fetchJson("/api/sessions");
  state.sessions = data.sessions;
  els.trashRoot.textContent = data.trashRoot;
  const codexRoot = data.roots.find((root) => root.source === "codex");
  els.codexRoot.textContent = codexRoot ? `当前：${codexRoot.root}` : "当前：未找到 Codex root";
  state.selected.clear();
  applyFilters();
}

async function loadPreview(path, mode = "readable") {
  state.activePath = path;
  state.previewMode = mode;
  renderRows();
  els.previewEmpty.classList.add("hidden");
  els.previewContent.classList.remove("hidden");
  els.previewTitle.textContent = "加载中...";
  els.messageStream.textContent = "";
  syncModeButtons();

  try {
    const data = await fetchJson(`/api/session?path=${encodeURIComponent(path)}&mode=${encodeURIComponent(mode)}`);
    state.previewSession = data.session;
    state.previewMode = data.session.previewMode || mode;
    syncModeButtons();
    renderPreview(data.session);
  } catch (error) {
    els.previewTitle.textContent = "读取失败";
    els.messageStream.textContent = [
      error.message,
      "",
      "Path:",
      path,
      "",
      "Tip: If this keeps happening, exit the tray app and start dist/AI-Session-Manager.exe again.",
    ].join("\n");
  }
}

function renderPreview(session) {
  els.previewSource.className = `source-pill ${session.source}`;
  els.previewSource.textContent = sourceLabel(session.source);
  els.previewTitle.textContent = session.title || session.id;
  els.deleteOneBtn.onclick = () => confirmDelete([session.path]);

  const details = [
    ["ID", session.id],
    ["路径", session.path],
    ["cwd", session.cwd || "-"],
    ["更新", session.lastTimestamp ? new Date(session.lastTimestamp).toLocaleString("zh-CN") : "-"],
    ["大小", formatBytes(session.sizeBytes)],
    ["记录", `${session.messageCount || 0} 对话, ${session.toolCount || 0} 工具, ${session.systemCount || 0} 系统`],
    ["模型", [session.provider, session.model].filter(Boolean).join(" / ") || "-"],
    ["Codex state", session.codexStateIndexed ? session.codexStatePath : "-"],
  ];

  els.previewDetails.textContent = "";
  for (const [key, value] of details) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = value;
    els.previewDetails.append(dt, dd);
  }

  renderMessages(session);
}

function renderMessages(session) {
  els.messageStream.textContent = "";
  const fragment = document.createDocumentFragment();
  const messages = session.messages || [];

  for (const message of messages) {
    const node = document.createElement("section");
    const role = message.category === "system"
      ? "system"
      : message.category === "tool"
        ? "tool"
        : message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : "tool";
    node.className = `message ${role}`;
    const bodyText = state.previewMode === "all" ? (message.text || "") : (message.displayText || message.text || "");
    node.innerHTML = `
      <div class="message-head">
        <span>${escapeHtml(roleLabel(role, message))}</span>
        <span>${escapeHtml(formatDate(message.timestamp))}</span>
      </div>
      <div class="message-body">${escapeHtml(bodyText)}</div>
    `;
    fragment.append(node);
  }

  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "message system";
    empty.textContent = "????????????";
    fragment.append(empty);
  }

  if (session.messageLimitReached) {
    const limit = document.createElement("p");
    limit.className = "message system";
    limit.textContent = `????? ${session.previewLimit || messages.length} ??`;
    fragment.append(limit);
  }

  els.messageStream.append(fragment);
  els.messageStream.scrollTop = els.messageStream.scrollHeight;
}

function roleLabel(role, message) {
  if (role === "assistant") return "AI";
  if (role === "user") return "??";
  if (role === "tool") return message.kind || "??";
  return message.kind || "??";
}

function syncModeButtons() {
  els.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.previewMode);
  });
}

function selectedSessions(paths) {
  const byPath = new Map(state.sessions.map((session) => [session.path, session]));
  return paths.map((path) => byPath.get(path)).filter(Boolean);
}

function confirmDelete(paths) {
  const uniquePaths = [...new Set(paths)];
  const sessions = selectedSessions(uniquePaths);
  if (!sessions.length) return;

  const totalSize = sessions.reduce((sum, session) => sum + (session.sizeBytes || 0), 0);
  els.confirmText.textContent = `将 ${sessions.length} 个 session 移到废纸篓，合计 ${formatBytes(totalSize)}。Codex 索引中对应的条目也会移除。`;
  els.confirmList.textContent = "";
  for (const session of sessions.slice(0, 12)) {
    const item = document.createElement("div");
    item.className = "confirm-item";
    item.textContent = `${sourceLabel(session.source)} · ${session.title || session.id}`;
    els.confirmList.append(item);
  }
  if (sessions.length > 12) {
    const extra = document.createElement("div");
    extra.className = "confirm-item";
    extra.textContent = `...还有 ${sessions.length - 12} 个`;
    els.confirmList.append(extra);
  }

  els.confirmDialog.showModal();
  els.confirmDialog.onclose = async () => {
    if (els.confirmDialog.returnValue !== "confirm") return;
    await deletePaths(uniquePaths);
  };
}

async function deletePaths(paths) {
  try {
    const data = await fetchJson("/api/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paths }),
    });

    showToast(`已移动 ${data.deleted.length} 个 session 到 ${data.trashBatchDir}`);
    state.selected.clear();
    if (paths.includes(state.activePath)) {
      state.activePath = null;
      state.previewSession = null;
      els.previewContent.classList.add("hidden");
      els.previewEmpty.classList.remove("hidden");
    }
    await loadSessions();
  } catch (error) {
    showToast(`删除失败：${error.message}`);
  }
}

function selectedCodexPaths() {
  const byPath = new Map(state.sessions.map((session) => [session.path, session]));
  return [...state.selected].filter((itemPath) => byPath.get(itemPath)?.source === "codex");
}

async function transferSelected(mode) {
  const paths = selectedCodexPaths();
  const targetPath = els.transferTarget.value.trim();
  if (!paths.length) {
    showToast("请先选择 Codex session。");
    return;
  }
  if (!targetPath) {
    showToast("请填写目标 .codex 或 sessions 路径。");
    return;
  }

  if (mode === "move") {
    const confirmed = window.confirm(`将 ${paths.length} 个 Codex session 剪切到目标路径。源文件会在复制成功后从当前 Codex 目录移除，继续吗？`);
    if (!confirmed) return;
  }

  try {
    const data = await fetchJson("/api/codex-transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paths, targetPath, mode }),
    });

    const action = mode === "move" ? "剪切" : "复制";
    showToast(`${action}完成：${data.copied.length} 个成功，${data.skipped.length} 个跳过，${data.failed.length} 个失败。`);
    if (mode === "move") {
      state.selected.clear();
      state.activePath = null;
      state.previewSession = null;
      els.previewContent.classList.add("hidden");
      els.previewEmpty.classList.remove("hidden");
    }
    await loadSessions();
  } catch (error) {
    showToast(`迁移失败：${error.message}`);
  }
}

els.refreshBtn.addEventListener("click", () => loadSessions().catch((error) => showToast(error.message)));
els.deleteSelectedBtn.addEventListener("click", () => confirmDelete([...state.selected]));
els.copySelectedBtn.addEventListener("click", () => transferSelected("copy"));
els.moveSelectedBtn.addEventListener("click", () => transferSelected("move"));
els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  applyFilters();
});
els.segments.forEach((button) => {
  button.addEventListener("click", () => {
    state.source = button.dataset.source;
    els.segments.forEach((segment) => segment.classList.toggle("active", segment === button));
    applyFilters();
  });
});
els.unindexedOnly.addEventListener("change", applyFilters);
els.hideSameWorkspace.addEventListener("change", applyFilters);
els.sortSelect.addEventListener("change", applyFilters);
els.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!state.activePath) return;
    loadPreview(state.activePath, button.dataset.mode).catch((error) => showToast(error.message));
  });
});
els.selectVisible.addEventListener("change", (event) => {
  for (const session of state.filtered) {
    if (event.target.checked) state.selected.add(session.path);
    else state.selected.delete(session.path);
  }
  render();
});

loadSessions().catch((error) => showToast(error.message));
