# humantone-mcp

Official Model Context Protocol server for [HumanTone](https://humantone.io). Use HumanTone's humanize and AI likelihood tools directly from Claude Desktop, Cursor, Cline, and other MCP clients. One API key, same credits you already use in the HumanTone web app.

HumanTone is an AI text humanizer that rewrites AI-generated content to sound more natural. This MCP server brings those tools into your AI assistant.

Early release (v0.0.x). Track updates on [GitHub](https://github.com/humantone/humantone-mcp/releases).

## Requirements

- Node.js 18 or later.
- A paid HumanTone plan with API access. Free trial accounts cannot use the API.
- An API key from [app.humantone.io/settings/api](https://app.humantone.io/settings/api).

## Installation

There is no install step. The MCP client downloads the package on first launch via `npx humantone-mcp`. Just add the configuration snippet for your client below.

## Configuration

### Claude Desktop

Config file location:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "humantone": {
      "command": "npx",
      "args": ["-y", "humantone-mcp"],
      "env": {
        "HUMANTONE_API_KEY": "ht_your_api_key_here"
      }
    }
  }
}
```

Restart Claude Desktop after editing the file.

### Cursor

Configure via Settings then MCP, or by editing `~/.cursor/mcp.json` directly.

```json
{
  "mcpServers": {
    "humantone": {
      "command": "npx",
      "args": ["-y", "humantone-mcp"],
      "env": {
        "HUMANTONE_API_KEY": "ht_your_api_key_here"
      }
    }
  }
}
```

Restart Cursor after editing the configuration.

### Cline (VSCode extension)

Configure via Cline Settings then MCP Servers, with the same snippet structure:

```json
{
  "mcpServers": {
    "humantone": {
      "command": "npx",
      "args": ["-y", "humantone-mcp"],
      "env": {
        "HUMANTONE_API_KEY": "ht_your_api_key_here"
      }
    }
  }
}
```

Restart VSCode after editing the configuration.

### Other MCP clients

humantone-mcp works with any MCP-compatible client, including VSCode with GitHub Copilot agent mode, Codex CLI, Gemini CLI, Continue.dev, Zed, Windsurf, JetBrains AI Assistant, and others. The configuration pattern is the same across clients: a command (`npx -y humantone-mcp`) with `HUMANTONE_API_KEY` in the environment.

See [humantone.io/docs/mcp/](https://humantone.io/docs/mcp/) for client-specific setup snippets and troubleshooting.

## Tools

- `humanize` rewrites text to sound more natural and human-written. Supports custom instructions for tone, audience, and terminology.
- `detect_ai` checks AI likelihood of text (0 to 100). Does not consume credits. 30 checks per day, shared with the HumanTone web app.
- `get_account` shows current plan, credits, and subscription status.

## Usage examples

Once configured, talk to your assistant naturally. Mentioning `humantone` or specific tool names in your message helps the model reliably route to the MCP tool, especially for humanize requests where the model could otherwise rewrite the text itself.

**Humanize:**

- "Use humantone to rewrite this draft so it reads more naturally: <paste your text>"
- "Run this through humantone with a formal corporate tone: <paste your text>"
- "Pass this to humantone, set level to advanced, and preserve the term Kubernetes intact: <paste your text>"

**Check AI likelihood:**

- "Use humantone's AI detector to score this paragraph: <paste your text>"
- "Check AI likelihood with humantone: <paste your text>"
- "Run this through humantone detect_ai: <paste your text>"

**Account status:**

- "How many HumanTone credits do I have left?"
- "What is my current HumanTone plan?"
- "When does my HumanTone subscription renew?"

## Troubleshooting

- **Tools do not appear in the assistant.** Confirm the JSON config has no syntax errors, then fully quit and reopen the client. A window refresh is not enough.
- **"Invalid API key format" error.** Keys are 67 characters: `ht_` followed by 64 hex characters. Generate a new one at [app.humantone.io/settings/api](https://app.humantone.io/settings/api) if unsure.
- **"Plan does not include API access" error.** Free trial accounts cannot use the API. View paid plans at [humantone.io/pricing](https://humantone.io/pricing/).
- **"npx: command not found".** Install Node.js 18 or later from [nodejs.org](https://nodejs.org).

## Links

- MCP setup guide for more clients: https://humantone.io/docs/mcp/
- API docs: https://humantone.io/docs/api/
- HumanTone Node SDK (used by this server): https://www.npmjs.com/package/humantone
- Get an API key: https://app.humantone.io/settings/api
- Issues: https://github.com/humantone/humantone-mcp/issues
- Author email: dev@humantone.io
- Product support: help@humantone.io

## License

MIT. Copyright (c) HumanTone.
