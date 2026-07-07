# AI Session Manager

AI Session Manager is a local-first desktop web tool for reviewing, filtering, previewing, and safely removing AI coding-agent session files.

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

- macOS or Windows
- Node.js 18+

The primary target is macOS, but a Windows `.exe` build is supported. Session discovery uses the current user's home directory, so common paths such as `~/.codex`, `~/.claude`, and `~/.openclaw` work on both macOS and Windows when those tools store data there.

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

Development mode opens the browser automatically:

```bash
npm run dev
```

## Windows `.exe`

Build a single-file Windows executable:

```bash
npm install
npm run build:win
```

The output is:

```text
dist/AI-Session-Manager.exe
```

Double-clicking the `.exe` starts the local server and opens the default browser automatically.

On Windows you can also run:

```powershell
.\scripts\build-windows.ps1
```

or:

```cmd
scripts\build-windows.cmd
```

GitHub Actions also includes a `Windows EXE` workflow. After pushing to GitHub, run the workflow or push to `main`, then download the `AI-Session-Manager-windows-x64` artifact.

The Windows build uses `caxa`, which bundles the app with a Node.js runtime and starts `server.js --open` when the executable is launched.

## Safety Notes

AI sessions can contain prompts, file paths, command output, tokens accidentally pasted by users, or private project information. Review before publishing logs or screenshots.

Deletion is implemented as a move into:

```text
~/.Trash/AI Session Manager
```

On Windows, files are moved into:

```text
%LOCALAPPDATA%\AI Session Manager\Trash
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
