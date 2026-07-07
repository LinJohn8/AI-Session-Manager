# AI Session Manager

AI Session Manager is a local-first macOS web tool for reviewing, filtering, previewing, and safely removing AI coding-agent session files.

It currently supports local session files from:

- Codex: `~/.codex/sessions`
- Claude Code: `~/.claude/projects`
- OpenClaw agents: `~/.openclaw/agents/*/sessions`

OpenClaw files named like `*.jsonl.deleted.*` are also shown and marked as `marked deleted`, because they may still occupy disk space.

## Features

- Scan local JSONL sessions without uploading data anywhere.
- Filter by source: Codex, Claude Code, OpenClaw.
- Search by title, path, workspace, model, and first message.
- Preview sessions in three modes:
  - `Readable`: hides system/tool noise and cleans environment context.
  - `All records`: shows every parsed record.
  - `Tools`: shows tool calls and command outputs.
- Move selected sessions to macOS Trash instead of hard-deleting them.
- Remove matching Codex rows from `~/.codex/session_index.jsonl` and keep a backup in the same Trash batch.

## Requirements

- macOS
- Node.js 18+

This project is designed around common macOS locations for Codex, Claude Code, OpenClaw, and `~/.Trash`.

## Quick Start

```bash
npm start
```

Open:

```text
http://127.0.0.1:4747
```

You can override the port:

```bash
PORT=8787 npm start
```

## Safety Notes

AI sessions can contain prompts, file paths, command output, tokens accidentally pasted by users, or private project information. Review before publishing logs or screenshots.

Deletion is implemented as a move into:

```text
~/.Trash/CodexSessionCommand
```

For Codex sessions, the tool also backs up and rewrites:

```text
~/.codex/session_index.jsonl
```

## Support

PayPal:

[https://www.paypal.com/paypalme/HWSLandDFTX8](https://www.paypal.com/paypalme/HWSLandDFTX8)

QR codes:

| WeChat Pay | Alipay |
| --- | --- |
| ![WeChat Pay QR](public/assets/wechat-pay-qr.png) | ![Alipay QR](public/assets/alipay-qr.png) |

## Repository

[https://github.com/LinJohn8/AI-Session-Manager](https://github.com/LinJohn8/AI-Session-Manager)

## License

MIT
