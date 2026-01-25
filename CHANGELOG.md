# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.9](https://github.com/beshkenadze/kaban/compare/v0.2.8...v0.2.9) (2026-01-25)


### Bug Fixes

* **core:** enable db driver switching and fix nodejs compatibility ([9c6ba93](https://github.com/beshkenadze/kaban/commit/9c6ba93e7788a77b5d6e328e9bcece5b1b1817fa))

## [0.2.8](https://github.com/beshkenadze/kaban/compare/v0.2.7...v0.2.8) (2026-01-25)


### Bug Fixes

* **cli:** fix hook subprocess command and JSON response parsing ([c88c60a](https://github.com/beshkenadze/kaban/commit/c88c60a095f36613d83ae83d45fee54954751be8))

## [0.2.7](https://github.com/beshkenadze/kaban/compare/v0.2.6...v0.2.7) (2026-01-25)


### Features

* **cli:** add --assign flag to move command ([0f18e7c](https://github.com/beshkenadze/kaban/commit/0f18e7cfa2b1fa05aac7c5eb9834580fee825e76))
* **cli:** add archive MCP tools ([7349aeb](https://github.com/beshkenadze/kaban/commit/7349aeb14c9ebbdcad5f0112e06747ac5cd27761))
* **cli:** add archive, restore, purge, reset commands ([50641e0](https://github.com/beshkenadze/kaban/commit/50641e077c78226c23a6f7391c86db2b8583fc87))
* **cli:** add assign command for task assignment ([896f989](https://github.com/beshkenadze/kaban/commit/896f989186550c64d932f7690c6b55e45f38f492))
* **cli:** add dependency MCP tools ([5ecee45](https://github.com/beshkenadze/kaban/commit/5ecee454a1a4ccbff535688feffa347afd99a801))
* **cli:** add kaban_add_task_checked MCP tool ([5426f7d](https://github.com/beshkenadze/kaban/commit/5426f7dbf863d798ea882a6d6aa9c4bc167ad241))
* **cli:** add search command ([7b8b399](https://github.com/beshkenadze/kaban/commit/7b8b3995e5ec2e4c4f39ab37abc5233f016fa848))
* **core:** add addDependency and removeDependency methods ([63ea147](https://github.com/beshkenadze/kaban/commit/63ea1478cc8ec1c0cc5e504d9e959df22b795c4f))
* **core:** add addTaskChecked method with duplicate detection ([3a7d44f](https://github.com/beshkenadze/kaban/commit/3a7d44fcbd2c24a4b09b4e5d94e744a2c8ffd30c))
* **core:** add archive migration with FTS5 support ([b2dc5e9](https://github.com/beshkenadze/kaban/commit/b2dc5e996bc42c3e667378012d1d5e04b30908db))
* **core:** add archived columns to tasks schema ([afd749d](https://github.com/beshkenadze/kaban/commit/afd749dcc40e2e5af798ab481b60dd8f65d079b7))
* **core:** add archived fields to Task schema ([5502452](https://github.com/beshkenadze/kaban/commit/5502452dd9ab116b91a971a32f08712b86215cfc))
* **core:** add archiveTasks method to TaskService ([b74c998](https://github.com/beshkenadze/kaban/commit/b74c998631d19c869ba8d3769d6926ab818be2bf))
* **core:** add createdBy filter to listTasks ([a1acf66](https://github.com/beshkenadze/kaban/commit/a1acf66b39b19fd80d13a75793dadcfcbae45e28))
* **core:** add createdBy parameter to AddTaskInputSchema ([44484db](https://github.com/beshkenadze/kaban/commit/44484db7e2daf5b92b26550934434db6aef3f45d))
* **core:** add drizzle-kit migration system ([2d3fe23](https://github.com/beshkenadze/kaban/commit/2d3fe236938af89d9a38f90c55cf3fb08f2cfdcb))
* **core:** add findSimilarTasks method for duplicate detection ([55c7c7b](https://github.com/beshkenadze/kaban/commit/55c7c7b5fa06768ce9c5ca9e2447875ba88285ec))
* **core:** add getArchiveStats method to TaskService ([6b92f32](https://github.com/beshkenadze/kaban/commit/6b92f32677aee5d54427c07a869ccdef6776d799))
* **core:** add getTerminalColumns method to BoardService ([0d485a1](https://github.com/beshkenadze/kaban/commit/0d485a19cd02743d7c013c7160e31d909a448f0b))
* **core:** add Jaccard similarity utility for duplicate detection ([5cef1c6](https://github.com/beshkenadze/kaban/commit/5cef1c6d74bae5193db62bb979b2821111a962ca))
* **core:** add purgeArchive and resetBoard methods ([fb7a7ee](https://github.com/beshkenadze/kaban/commit/fb7a7eef34063a357fadb2c273c9202b3b7c1919))
* **core:** add restoreTask method to TaskService ([2988ba4](https://github.com/beshkenadze/kaban/commit/2988ba4bffece9a458c67b3a54492d9ee9b10a55))
* **core:** add searchArchive method with FTS5 support ([26c9619](https://github.com/beshkenadze/kaban/commit/26c961978ca45faec05f98b14b09209997982c12))
* **core:** add validateDependencies method to TaskService ([852c616](https://github.com/beshkenadze/kaban/commit/852c616dc67def151865335b88e68836499782ca))
* **core:** add validateDeps option to moveTask method ([f924c4c](https://github.com/beshkenadze/kaban/commit/f924c4c45e7b8b7082c82ff02b1bfe9abc83f8c8))
* **core:** export archive and duplicate detection types ([df39e8f](https://github.com/beshkenadze/kaban/commit/df39e8fc9c1102e22017608310d959c7d96a1ba5))
* **core:** filter archived tasks from listTasks by default ([9e3205e](https://github.com/beshkenadze/kaban/commit/9e3205e58f8477507e769ef5ce595af4477f6c97))
* **core:** support createdBy parameter in addTask ([6b31dd3](https://github.com/beshkenadze/kaban/commit/6b31dd3d5e5e91f556d433004c8a2c7e4bf3ad38))
* **mcp:** add assignee filter to kaban_list_tasks ([73d99fe](https://github.com/beshkenadze/kaban/commit/73d99fea70b48186d4952d5892cad28f4c160ab3))
* **tui:** add archive/restore support with Tab view toggle ([befea36](https://github.com/beshkenadze/kaban/commit/befea369680c9f9ef33e55e85d59792fceed1c67))


### Bug Fixes

* **cli:** add duplicate detection to 'kaban add' command ([dab4bee](https://github.com/beshkenadze/kaban/commit/dab4bee6f581a877d30cbc5c806cf494221693af))
* **cli:** change build target from node to bun ([5a8c440](https://github.com/beshkenadze/kaban/commit/5a8c440789c7d37a77463b16ae4314cfa0ec317e))
* **cli:** default archive to terminal column when using --older-than ([0705531](https://github.com/beshkenadze/kaban/commit/07055312caec1d1d14997c742f68e24e3ed93886))
* **cli:** make move --assign atomic (assign after move) ([56dacf7](https://github.com/beshkenadze/kaban/commit/56dacf7d7a24cfab2280e136a3544aa55e3f1fd9))
* **cli:** resolve lint errors in search and archive commands ([61a231d](https://github.com/beshkenadze/kaban/commit/61a231d0cdb0da12adbb2cf9eadc61db924b3765))
* **core:** add missing test for restoreTask invalid column ([29365f5](https://github.com/beshkenadze/kaban/commit/29365f528546e80e6f247a656047a49e7783e3fd))
* **core:** export jaccardSimilarity from package index ([b1402a7](https://github.com/beshkenadze/kaban/commit/b1402a754548005c8e96956bdb2f9eddf83ce89d))
* **core:** handle legacy databases in migration system ([9515f16](https://github.com/beshkenadze/kaban/commit/9515f16ea9ef14407f33c86b7e584dfe4a9ab13a))
* **core:** update tests for new migration system ([5fbe562](https://github.com/beshkenadze/kaban/commit/5fbe562b2e4832213d89333cb22aea3ad2eb5ec0))
* move first, then assign only on success. ([56dacf7](https://github.com/beshkenadze/kaban/commit/56dacf7d7a24cfab2280e136a3544aa55e3f1fd9))
* **tui:** show Restore button for archived tasks in view modal ([cacecb2](https://github.com/beshkenadze/kaban/commit/cacecb2c1b4f128f7de2bb700d417a9b715f57b0))

## [0.2.6](https://github.com/beshkenadze/kaban/compare/v0.2.5...v0.2.6) (2026-01-20)


### Features

* **mcp:** add parameter aliasing and improve TUI runtime detection ([2a8b489](https://github.com/beshkenadze/kaban/commit/2a8b48962c6cd94789b4d6fa05888f2b06136bd9))
* **mcp:** add parameter aliasing and improve TUI runtime detection ([7a3e8e6](https://github.com/beshkenadze/kaban/commit/7a3e8e6c0429d286524d44a1db0dd1289e147a9a)), closes [#1](https://github.com/beshkenadze/kaban/issues/1)

## [0.2.5](https://github.com/beshkenadze/kaban/compare/v0.2.4...v0.2.5) (2026-01-20)


### Bug Fixes

* **ci:** restore publish job in release-please workflow ([64d84a3](https://github.com/beshkenadze/kaban/commit/64d84a3c49afe3274b469ca7ec1b328665dd0f32))

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
