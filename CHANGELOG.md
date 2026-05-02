# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-05-02

### Changed

- Bumped `humantone` SDK dependency to ^0.0.2 (adds retry on idempotent GETs, X-Request-Id header fallback, response coercion validators, errorCodes on constructor errors).

### Added

- `invalid_response_shape` errorCode mapping in `mapError` for the new SDK coercion-failure path.

## [0.0.1] - 2026-04-27

### Added

- Initial release.
- Three MCP tools: `humanize`, `detect_ai`, `get_account`.
- Stdio transport via `@modelcontextprotocol/sdk`.
- API key configuration via `HUMANTONE_API_KEY` environment variable.
- Error mapping from `humantone` SDK errors to user-friendly MCP responses.
- Compatible with Claude Desktop, Cursor, Cline, and other MCP clients.

[0.0.2]: https://github.com/humantone/humantone-mcp/releases/tag/v0.0.2
[0.0.1]: https://github.com/humantone/humantone-mcp/releases/tag/v0.0.1
