# AI Session Manager

AI Session Manager 是一个本地优先的桌面会话管理工具，用来查看、筛选、预览并安全清理 AI 编程代理留下的 session 文件。

当前支持：

- Codex：`~/.codex/sessions`
- Claude Code：`~/.claude/projects`
- OpenClaw agents：`~/.openclaw/agents/*/sessions`

如果 OpenClaw 里还有 `*.jsonl.deleted.*` 这类“已经标记删除但仍留在磁盘上”的文件，也会显示出来，并标记为 `marked deleted`。

## 功能

- 只在本机扫描 JSONL session，不上传任何数据。
- 按来源筛选：Codex、Claude Code、OpenClaw。
- 按标题、路径、工作目录、模型、首条消息搜索。
- 三种预览模式：
  - `可读对话`：默认视图，隐藏系统和工具噪音，并清理环境上下文。
  - `全量记录`：显示所有解析出的记录。
  - `工具记录`：只看工具调用、命令和输出摘要。
- 勾选 session 后移动到 macOS 废纸篓或 Windows 回收站，不做不可恢复的硬删除。
- 删除 Codex session 时，会同步移除 `~/.codex/session_index.jsonl` 中对应索引，并保存备份。
- 将已选择的 Codex session 复制或剪切到另一个 `.codex` / `sessions` 目录，并为目标补写 `session_index.jsonl`。

## 环境要求

- macOS 或 Windows
- Node.js 18+

主要目标仍然是 macOS，但也支持构建 Windows 单文件 `.exe`。session 扫描基于当前用户的 home 目录，所以当 Codex、Claude Code、OpenClaw 把数据放在 `~/.codex`、`~/.claude`、`~/.openclaw` 时，macOS 和 Windows 都可以使用。

## Codex 账号与迁移

在同一个 macOS 用户下，Codex 的 JSONL 对话通常都在：

```text
~/.codex/sessions
```

但 Codex 界面能不能显示某个对话，还会受到本地索引和状态文件影响，例如：

```text
~/.codex/session_index.jsonl
```

所以会出现“文件还在，但当前登录账号或当前窗口看不到”的情况。不同 macOS 用户、不同机器，或使用了自定义 `CODEX_HOME` / 独立配置目录时，session 才更可能真的在不同位置。

左侧的 `Codex 迁移` 可以把勾选的 Codex session 复制或剪切到目标目录。目标可以填写另一个 Codex 主目录：

```text
~/.codex
```

也可以直接填写它的 sessions 目录：

```text
~/.codex/sessions
```

复制/剪切时，工具会保留原来的日期目录结构，并尽量为目标补写 `session_index.jsonl`。如果目标索引里已经有同一个 session id，会跳过，避免重复导入。

需要注意：`Codex 迁移` 只能移动本地 JSONL 文件并尽量补写本地索引，不能解决不同 Codex 登录账号之间的权限、云端状态或产品侧账号隔离问题。如果迁移后目标账号仍然看不到旧会话，至少可以用这个工具定位到对应的 `.jsonl` session 文件；找到后，把该 session 文件或文件内容直接交给 AI，就能让 AI 读取并整理之前的聊天记录。

## 启动

```bash
npm start
```

打开：

```text
http://127.0.0.1:4747
```

也可以指定端口：

```bash
PORT=8787 npm start
```

开发模式会自动打开浏览器：

```bash
npm run dev
```

## Windows `.exe`

构建 Windows 单文件可执行程序：

```bash
npm install
npm run build:win
```

输出文件：

```text
dist/AI-Session-Manager.exe
```

双击 `.exe` 后，会启动本地服务并自动打开默认浏览器。

在 Windows 上也可以直接运行：

```powershell
.\scripts\build-windows.ps1
```

或者：

```cmd
scripts\build-windows.cmd
```

仓库里也添加了 GitHub Actions 的 `Windows EXE` 工作流。推送到 GitHub 后，可以手动运行 workflow，或者推送到 `main`，然后下载 `AI-Session-Manager-windows-x64` artifact。

Windows 构建使用 `caxa`，会把项目和 Node.js runtime 一起打包；双击 exe 后会运行 `server.js --open` 并自动打开浏览器。

## 安全说明

AI session 可能包含提示词、文件路径、命令输出、用户误粘贴的 token 或私人项目信息。公开日志或截图前请先检查。

macOS 上删除操作会移动到：

```text
~/.Trash/AI Session Manager
```

Windows 上会直接进入系统回收站。删除清单和 Codex 索引备份会保存在：

```text
%LOCALAPPDATA%\AI Session Manager\Delete Records
```

旧版本在 Windows 上曾经把文件移动到下面这个应用内目录；如果你之前删除后在回收站里找不到，可以先检查这里：

```text
%LOCALAPPDATA%\AI Session Manager\Trash
```

对于 Codex session，工具还会备份并重写：

```text
~/.codex/session_index.jsonl
```

## 支持作者

PayPal：

[https://www.paypal.com/paypalme/HWSLandDFTX8](https://www.paypal.com/paypalme/HWSLandDFTX8)

二维码：

| 微信支付 | 支付宝 |
| --- | --- |
| ![微信支付二维码](public/assets/wechat-pay-qr.png) | ![支付宝二维码](public/assets/alipay-qr.png) |

## 仓库

[https://github.com/LinJohn8/AI-Session-Manager](https://github.com/LinJohn8/AI-Session-Manager)

## License

MIT
