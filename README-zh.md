# AI Session Manager

AI Session Manager 是一个面向 macOS 的本地会话管理工具，用来查看、筛选、预览并安全清理 AI 编程代理留下的 session 文件。

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
- 勾选 session 后移动到 macOS 废纸篓，不做不可恢复的硬删除。
- 删除 Codex session 时，会同步移除 `~/.codex/session_index.jsonl` 中对应索引，并保存备份。

## 环境要求

- macOS
- Node.js 18+

这个项目主要围绕 macOS 上 Codex、Claude Code、OpenClaw 和 `~/.Trash` 的常见目录设计。

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

## 安全说明

AI session 可能包含提示词、文件路径、命令输出、用户误粘贴的 token 或私人项目信息。公开日志或截图前请先检查。

删除操作会移动到：

```text
~/.Trash/CodexSessionCommand
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
