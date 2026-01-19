# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.4](https://github.com/beshkenadze/kaban/compare/v0.2.3...v0.2.4) (2026-01-19)


### Bug Fixes

* **ci:** split release-please and publish workflows ([1d6cdbd](https://github.com/beshkenadze/kaban/commit/1d6cdbd122d08d1faf7d744a5000077375b979d8))

## [0.2.3](https://github.com/beshkenadze/kaban/compare/v0.2.2...v0.2.3) (2026-01-19)


### Bug Fixes

* **ci:** add id-token permission for npm OIDC publish ([6fb46ce](https://github.com/beshkenadze/kaban/commit/6fb46ce1a9fc606e5ea9d5a2df263ad174c0144b))

## [0.2.2](https://github.com/beshkenadze/kaban/compare/v0.2.1...v0.2.2) (2026-01-19)


### Bug Fixes

* **ci:** add kaban to PATH for hook integration tests ([e4f928f](https://github.com/beshkenadze/kaban/commit/e4f928f170cc238690c1aee228732e64b72e72f6))

## [0.2.1](https://github.com/beshkenadze/kaban/compare/v0.2.0...v0.2.1) (2026-01-19)


### Features

* **core:** add pluggable SQLite adapter with bun:sqlite support ([111180d](https://github.com/beshkenadze/kaban/commit/111180d97cd357f181a04c0de4783bee246460d2))


### Bug Fixes

* **cli:** make tui command work in production ([80d8c4e](https://github.com/beshkenadze/kaban/commit/80d8c4e4a8a4c81d958eee32a813ee13575b9ff3))

## [0.2.0] - 2026-01-19

### Added

- **TodoWrite Hook Integration** - Auto-sync Claude Code todos to Kaban board
  - `kaban hook install` - Install PostToolUse hook for Claude Code
  - `kaban hook uninstall` - Remove hook and optionally clean logs
  - `kaban hook status` - Check installation status and view sync activity
  - `kaban sync` - Sync TodoWrite JSON from stdin to Kaban board
- Beautiful CLI output with `@clack/prompts` for hook commands
- Sync logging to `~/.claude/hooks/sync.log`
- Conflict resolution strategies: `todowrite_wins`, `kaban_wins`, `most_progressed`
- Configurable cancelled task policy: `sync` or `ignore`

### Fixed

- Hook install now works correctly with npm/brew global installs (symlink resolution)
- Completed tasks now sync properly (was using non-existent command)
- Long task titles no longer create duplicates on subsequent syncs

### Technical

- Thin wrapper architecture: `kaban-hook` binary is only 312 bytes
- Node.js compatible: replaced all Bun-specific APIs with Node equivalents
- 42 integration tests for hook functionality

## [0.1.3] - 2026-01-17

### Fixed

- TUI uses bun runtime for bunx compatibility
- NPM publishing with OIDC trusted publishing

## [0.1.2] - 2026-01-17

### Added

- Landing page at beshkenadze.github.io/kaban
- Claude Code plugin marketplace support

### Fixed

- Workspace dependency resolution for npm publish

## [0.1.1] - 2026-01-16

### Added

- TUI database polling for live sync with CLI
- Description support in `add` command

### Fixed

- Consistent board.db database path

## [0.1.0] - 2026-01-15

### Added

- Initial release
- MCP server with 9 tools for AI agent integration
- Interactive TUI with vim-style navigation
- CLI commands: init, add, list, move, done, status
- SQLite-based portable storage
- WIP limits and Kanban best practices
- Agent tracking for tasks

[0.2.0]: https://github.com/beshkenadze/kaban/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/beshkenadze/kaban/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/beshkenadze/kaban/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/beshkenadze/kaban/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/beshkenadze/kaban/releases/tag/v0.1.0
