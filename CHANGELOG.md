# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1](https://github.com/kaban-board/kaban/compare/v0.3.0...v0.3.1) (2026-01-27)


### Features

* build release binaries for homebrew ([c9b217c](https://github.com/kaban-board/kaban/commit/c9b217cae6fe80a8a6ee857ed77814abb1c2f85c))

## [0.3.0](https://github.com/kaban-board/kaban/compare/v0.2.18...v0.3.0) (2026-01-26)


### ⚠ BREAKING CHANGES

* **hook:** None - new functionality only

### Features

* add MCP server, TUI, Zod schemas, and libsql support ([79c2a16](https://github.com/kaban-board/kaban/commit/79c2a166b1110a08ccbdff25b1536c9b866d3c23))
* add Taskfile for install/update/uninstall ([99d0f70](https://github.com/kaban-board/kaban/commit/99d0f7019ac679a6ee1e61f7600643ba8b53a714))
* **cli:** add --assign flag to move command ([0f18e7c](https://github.com/kaban-board/kaban/commit/0f18e7cfa2b1fa05aac7c5eb9834580fee825e76))
* **cli:** add 'add' command for creating tasks ([483b266](https://github.com/kaban-board/kaban/commit/483b266fbbd23a1fad14bddfe203115cecc5a72f))
* **cli:** add 'list' command with filters ([a660ad7](https://github.com/kaban-board/kaban/commit/a660ad7934bbadbd32f2bc750c66ba80e67a3644))
* **cli:** add 'move' and 'done' commands ([227a5f8](https://github.com/kaban-board/kaban/commit/227a5f88c6329db07d61e45bfd11af3757b76cfc))
* **cli:** add 'status' command for board overview ([a65a2f0](https://github.com/kaban-board/kaban/commit/a65a2f0337e4f6a839ff4a10f01449d4052b6918))
* **cli:** add archive MCP tools ([7349aeb](https://github.com/kaban-board/kaban/commit/7349aeb14c9ebbdcad5f0112e06747ac5cd27761))
* **cli:** add archive, restore, purge, reset commands ([50641e0](https://github.com/kaban-board/kaban/commit/50641e077c78226c23a6f7391c86db2b8583fc87))
* **cli:** add assign command for task assignment ([896f989](https://github.com/kaban-board/kaban/commit/896f989186550c64d932f7690c6b55e45f38f492))
* **cli:** add dependency MCP tools ([5ecee45](https://github.com/kaban-board/kaban/commit/5ecee454a1a4ccbff535688feffa347afd99a801))
* **cli:** add description support to add command ([e5d24b7](https://github.com/kaban-board/kaban/commit/e5d24b7081cfa592daaf4e7e61d112187f77da3c))
* **cli:** add init command ([751d644](https://github.com/kaban-board/kaban/commit/751d644a7ba4f25c4b77027c1a6665f6bcabcd08))
* **cli:** add kaban_add_task_checked MCP tool ([5426f7d](https://github.com/kaban-board/kaban/commit/5426f7dbf863d798ea882a6d6aa9c4bc167ad241))
* **cli:** add search command ([7b8b399](https://github.com/kaban-board/kaban/commit/7b8b3995e5ec2e4c4f39ab37abc5233f016fa848))
* **cli:** add sorting and assignee filter to list command ([11220d2](https://github.com/kaban-board/kaban/commit/11220d2641dc66583177a9813d0b4798743ddd86))
* **core:** add addDependency and removeDependency methods ([63ea147](https://github.com/kaban-board/kaban/commit/63ea1478cc8ec1c0cc5e504d9e959df22b795c4f))
* **core:** add addTaskChecked method with duplicate detection ([3a7d44f](https://github.com/kaban-board/kaban/commit/3a7d44fcbd2c24a4b09b4e5d94e744a2c8ffd30c))
* **core:** add archive migration with FTS5 support ([b2dc5e9](https://github.com/kaban-board/kaban/commit/b2dc5e996bc42c3e667378012d1d5e04b30908db))
* **core:** add archived columns to tasks schema ([afd749d](https://github.com/kaban-board/kaban/commit/afd749dcc40e2e5af798ab481b60dd8f65d079b7))
* **core:** add archived fields to Task schema ([5502452](https://github.com/kaban-board/kaban/commit/5502452dd9ab116b91a971a32f08712b86215cfc))
* **core:** add archiveTasks method to TaskService ([b74c998](https://github.com/kaban-board/kaban/commit/b74c998631d19c869ba8d3769d6926ab818be2bf))
* **core:** add BoardService for board management ([a7d42f4](https://github.com/kaban-board/kaban/commit/a7d42f47b9e9484ae9799bac1b4185de598d7079))
* **core:** add createdBy filter to listTasks ([a1acf66](https://github.com/kaban-board/kaban/commit/a1acf66b39b19fd80d13a75793dadcfcbae45e28))
* **core:** add createdBy parameter to AddTaskInputSchema ([44484db](https://github.com/kaban-board/kaban/commit/44484db7e2daf5b92b26550934434db6aef3f45d))
* **core:** add database schema with Drizzle ([d00cb92](https://github.com/kaban-board/kaban/commit/d00cb92695acbf96d238c1044feed20e1ddf631c))
* **core:** add drizzle-kit migration system ([2d3fe23](https://github.com/kaban-board/kaban/commit/2d3fe236938af89d9a38f90c55cf3fb08f2cfdcb))
* **core:** add findSimilarTasks method for duplicate detection ([55c7c7b](https://github.com/kaban-board/kaban/commit/55c7c7b5fa06768ce9c5ca9e2447875ba88285ec))
* **core:** add getArchiveStats method to TaskService ([6b92f32](https://github.com/kaban-board/kaban/commit/6b92f32677aee5d54427c07a869ccdef6776d799))
* **core:** add getTerminalColumns method to BoardService ([0d485a1](https://github.com/kaban-board/kaban/commit/0d485a19cd02743d7c013c7160e31d909a448f0b))
* **core:** add input validation utilities ([d72e715](https://github.com/kaban-board/kaban/commit/d72e715f8d148cc4cea73a8feba4097ac369df1c))
* **core:** add Jaccard similarity utility for duplicate detection ([5cef1c6](https://github.com/kaban-board/kaban/commit/5cef1c6d74bae5193db62bb979b2821111a962ca))
* **core:** add moveTask with WIP limit enforcement ([008fd32](https://github.com/kaban-board/kaban/commit/008fd32d2eea7d0e745c9f79147b17f23954cf68))
* **core:** add optimistic locking to updateTask ([fa377ca](https://github.com/kaban-board/kaban/commit/fa377caed2eecc26653bb670a1b6cbdb520ae1ce))
* **core:** add pluggable SQLite adapter with bun:sqlite support ([111180d](https://github.com/kaban-board/kaban/commit/111180d97cd357f181a04c0de4783bee246460d2))
* **core:** add purgeArchive and resetBoard methods ([fb7a7ee](https://github.com/kaban-board/kaban/commit/fb7a7eef34063a357fadb2c273c9202b3b7c1919))
* **core:** add restoreTask method to TaskService ([2988ba4](https://github.com/kaban-board/kaban/commit/2988ba4bffece9a458c67b3a54492d9ee9b10a55))
* **core:** add searchArchive method with FTS5 support ([26c9619](https://github.com/kaban-board/kaban/commit/26c961978ca45faec05f98b14b09209997982c12))
* **core:** add TaskService with basic CRUD ([c695a5c](https://github.com/kaban-board/kaban/commit/c695a5c09d2967700e2542095ed206c4ecc81549))
* **core:** add type definitions ([ed9b7e0](https://github.com/kaban-board/kaban/commit/ed9b7e0b0a8e459ee20f3e83217f4809cbeef11c))
* **core:** add validateDependencies method to TaskService ([852c616](https://github.com/kaban-board/kaban/commit/852c616dc67def151865335b88e68836499782ca))
* **core:** add validateDeps option to moveTask method ([f924c4c](https://github.com/kaban-board/kaban/commit/f924c4c45e7b8b7082c82ff02b1bfe9abc83f8c8))
* **core:** export archive and duplicate detection types ([df39e8f](https://github.com/kaban-board/kaban/commit/df39e8fc9c1102e22017608310d959c7d96a1ba5))
* **core:** filter archived tasks from listTasks by default ([9e3205e](https://github.com/kaban-board/kaban/commit/9e3205e58f8477507e769ef5ce595af4477f6c97))
* **core:** support createdBy parameter in addTask ([6b31dd3](https://github.com/kaban-board/kaban/commit/6b31dd3d5e5e91f556d433004c8a2c7e4bf3ad38))
* **hook:** add TodoWrite sync hook for Claude Code ([edb18c8](https://github.com/kaban-board/kaban/commit/edb18c85cf38a26df4ad87d3c72cabb6556932b5))
* **mcp:** add assignee filter to kaban_list_tasks ([73d99fe](https://github.com/kaban-board/kaban/commit/73d99fea70b48186d4952d5892cad28f4c160ab3))
* **mcp:** add kaban_init tool and create project documentation ([55f7c21](https://github.com/kaban-board/kaban/commit/55f7c214af36e020317fffbfde02cf5d5dbe0c75))
* **mcp:** add parameter aliasing and improve TUI runtime detection ([2a8b489](https://github.com/kaban-board/kaban/commit/2a8b48962c6cd94789b4d6fa05888f2b06136bd9))
* **mcp:** add parameter aliasing and improve TUI runtime detection ([7a3e8e6](https://github.com/kaban-board/kaban/commit/7a3e8e6c0429d286524d44a1db0dd1289e147a9a)), closes [#1](https://github.com/kaban-board/kaban/issues/1)
* npm publishing with [@kaban-board](https://github.com/kaban-board) scope, release workflow, landing page updates ([805b071](https://github.com/kaban-board/kaban/commit/805b071ff0078e6658e5e53e8a8e8b59a91ef629))
* **tui:** add archive/restore support with Tab view toggle ([befea36](https://github.com/kaban-board/kaban/commit/befea369680c9f9ef33e55e85d59792fceed1c67))
* **tui:** add boar icon to header and fix modal bugs ([e1e9fb5](https://github.com/kaban-board/kaban/commit/e1e9fb51282285ca1f3401b802c050fc67d5a9c3))
* **tui:** add boar icon to header and fix modal bugs ([944ebdd](https://github.com/kaban-board/kaban/commit/944ebdd7f4af902e4b42a777984066b23d733960))
* **tui:** add database polling for live sync with CLI ([022235a](https://github.com/kaban-board/kaban/commit/022235add0f21aa89184d6e93793fb03cec87a1c))
* **tui:** add task management modals and button navigation ([ecd02f6](https://github.com/kaban-board/kaban/commit/ecd02f67e725d56f2993a95964320be1696c4cb0))


### Bug Fixes

* **ci:** add id-token permission for npm OIDC publish ([6fb46ce](https://github.com/kaban-board/kaban/commit/6fb46ce1a9fc606e5ea9d5a2df263ad174c0144b))
* **ci:** add kaban to PATH for hook integration tests ([e4f928f](https://github.com/kaban-board/kaban/commit/e4f928f170cc238690c1aee228732e64b72e72f6))
* **ci:** restore publish job in release-please workflow ([64d84a3](https://github.com/kaban-board/kaban/commit/64d84a3c49afe3274b469ca7ec1b328665dd0f32))
* **ci:** split release-please and publish workflows ([1d6cdbd](https://github.com/kaban-board/kaban/commit/1d6cdbd122d08d1faf7d744a5000077375b979d8))
* **cli:** add duplicate detection to 'kaban add' command ([dab4bee](https://github.com/kaban-board/kaban/commit/dab4bee6f581a877d30cbc5c806cf494221693af))
* **cli:** change build target from node to bun ([5a8c440](https://github.com/kaban-board/kaban/commit/5a8c440789c7d37a77463b16ae4314cfa0ec317e))
* **cli:** decouple TUI dependency to allow nodejs install without bun errors ([632ec04](https://github.com/kaban-board/kaban/commit/632ec041cef3bd223094bf6507309b53172db8c8))
* **cli:** default archive to terminal column when using --older-than ([0705531](https://github.com/kaban-board/kaban/commit/07055312caec1d1d14997c742f68e24e3ed93886))
* **cli:** fix hook subprocess command and JSON response parsing ([c88c60a](https://github.com/kaban-board/kaban/commit/c88c60a095f36613d83ae83d45fee54954751be8))
* **cli:** make move --assign atomic (assign after move) ([56dacf7](https://github.com/kaban-board/kaban/commit/56dacf7d7a24cfab2280e136a3544aa55e3f1fd9))
* **cli:** make tui command work in production ([80d8c4e](https://github.com/kaban-board/kaban/commit/80d8c4e4a8a4c81d958eee32a813ee13575b9ff3))
* **cli:** resolve lint errors in search and archive commands ([61a231d](https://github.com/kaban-board/kaban/commit/61a231d0cdb0da12adbb2cf9eadc61db924b3765))
* **cli:** use static import for package.json to ensure bundling ([2d34382](https://github.com/kaban-board/kaban/commit/2d34382942b9c9dd97445065f4282272f788df91))
* **core:** add missing test for restoreTask invalid column ([29365f5](https://github.com/kaban-board/kaban/commit/29365f528546e80e6f247a656047a49e7783e3fd))
* **core:** enable db driver switching and fix nodejs compatibility ([9c6ba93](https://github.com/kaban-board/kaban/commit/9c6ba93e7788a77b5d6e328e9bcece5b1b1817fa))
* **core:** export jaccardSimilarity from package index ([b1402a7](https://github.com/kaban-board/kaban/commit/b1402a754548005c8e96956bdb2f9eddf83ce89d))
* **core:** fully isolate bun adapter in separate entry point for TUI ([7f5ce38](https://github.com/kaban-board/kaban/commit/7f5ce38216400d8b8f804d59f239e4bb39c00b3e))
* **core:** handle legacy databases in migration system ([9515f16](https://github.com/kaban-board/kaban/commit/9515f16ea9ef14407f33c86b7e584dfe4a9ab13a))
* **core:** implement build-time exclusion of LibSQL for TUI binary ([1071ba1](https://github.com/kaban-board/kaban/commit/1071ba1398ebb131f5c80c3e7acf19485f7d5eb1))
* **core:** update tests for new migration system ([5fbe562](https://github.com/kaban-board/kaban/commit/5fbe562b2e4832213d89333cb22aea3ad2eb5ec0))
* correct homebrew download url ([b07dcf6](https://github.com/kaban-board/kaban/commit/b07dcf627c48b12aa6494ff8f4bb2c7ba6c46d5f))
* correct homebrew workflow repo link ([eb6c99d](https://github.com/kaban-board/kaban/commit/eb6c99d19217b715c092a69436aa1f6ef5dd7fa8))
* move first, then assign only on success. ([56dacf7](https://github.com/kaban-board/kaban/commit/56dacf7d7a24cfab2280e136a3544aa55e3f1fd9))
* move marketplace to repo root ([ce66518](https://github.com/kaban-board/kaban/commit/ce6651846bb9b3b330053e26954e74bbdd64c2fe))
* **release:** use npm OIDC trusted publishing with bun pack ([01302c3](https://github.com/kaban-board/kaban/commit/01302c391c903bb2ae97e93864499f3b005127e0))
* **release:** use NPM_CONFIG_TOKEN env var for bun publish ([b2abc5c](https://github.com/kaban-board/kaban/commit/b2abc5c375f8c26ecc36717a8b7967b19c2a4f6d))
* **release:** use NPM_TOKEN for bun publish authentication ([d567daf](https://github.com/kaban-board/kaban/commit/d567daf188dc959b8a26dce762916b612159ed0e))
* **tui:** address code review issues from Oracle ([c232e66](https://github.com/kaban-board/kaban/commit/c232e663c628d5fc389a2de77b23987d19b80627))
* **tui:** exclude @libsql/client from compiled binary ([3f71a6f](https://github.com/kaban-board/kaban/commit/3f71a6f7de6806afb11387f66dcdcd156549b732))
* **tui:** make task list fill column height ([98d86d9](https://github.com/kaban-board/kaban/commit/98d86d915f54696ca423026639c339538674ea32))
* **tui:** show Restore button for archived tasks in view modal ([cacecb2](https://github.com/kaban-board/kaban/commit/cacecb2c1b4f128f7de2bb700d417a9b715f57b0))
* **tui:** use bun runtime instead of node to fix bunx compatibility ([da4fea7](https://github.com/kaban-board/kaban/commit/da4fea7d78cab547bb50f3722faf14188200efe0))
* **tui:** use consistent board.db database path ([cc2ae24](https://github.com/kaban-board/kaban/commit/cc2ae248267ca66a81887ef9146e30d537476b93))
* update author name to Aleksandr Beshkenadze ([e8d765b](https://github.com/kaban-board/kaban/commit/e8d765b4d4c9dd52f91aad7b7ae6ffe6fdf7d832))
* update marketplace owner info ([4c8fa56](https://github.com/kaban-board/kaban/commit/4c8fa56258883cb42a26333e96883ed765260a73))
* use bun publish for workspace:* resolution ([148a36b](https://github.com/kaban-board/kaban/commit/148a36bac782cd95ef31f280d5f101f75aa4f7d7))
* use GitHub release assets for homebrew ([99eebcc](https://github.com/kaban-board/kaban/commit/99eebcc673673d2854a0abfcbcdfbe4061ea6fa2))

## [0.2.17](https://github.com/kaban-board/kaban/compare/v0.2.16...v0.2.17) (2026-01-26)


### Bug Fixes

* use GitHub release assets for homebrew ([99eebcc](https://github.com/kaban-board/kaban/commit/99eebcc673673d2854a0abfcbcdfbe4061ea6fa2))

## [0.2.16](https://github.com/kaban-board/kaban/compare/v0.2.15...v0.2.16) (2026-01-26)


### Bug Fixes

* correct homebrew download url ([b07dcf6](https://github.com/kaban-board/kaban/commit/b07dcf627c48b12aa6494ff8f4bb2c7ba6c46d5f))

## [0.2.15](https://github.com/kaban-board/kaban/compare/v0.2.14...v0.2.15) (2026-01-26)


### Bug Fixes

* correct homebrew workflow repo link ([eb6c99d](https://github.com/kaban-board/kaban/commit/eb6c99d19217b715c092a69436aa1f6ef5dd7fa8))

## [0.2.14](https://github.com/kaban-board/kaban/compare/v0.2.13...v0.2.14) (2026-01-26)


### Features

* **tui:** add boar icon to header and fix modal bugs ([e1e9fb5](https://github.com/kaban-board/kaban/commit/e1e9fb51282285ca1f3401b802c050fc67d5a9c3))

## [0.2.13](https://github.com/beshkenadze/kaban/compare/v0.2.12...v0.2.13) (2026-01-26)


### Bug Fixes

* **core:** fully isolate bun adapter in separate entry point for TUI ([7f5ce38](https://github.com/beshkenadze/kaban/commit/7f5ce38216400d8b8f804d59f239e4bb39c00b3e))
* **core:** implement build-time exclusion of LibSQL for TUI binary ([1071ba1](https://github.com/beshkenadze/kaban/commit/1071ba1398ebb131f5c80c3e7acf19485f7d5eb1))

## [0.2.12](https://github.com/beshkenadze/kaban/compare/v0.2.11...v0.2.12) (2026-01-25)


### Bug Fixes

* **tui:** exclude @libsql/client from compiled binary ([3f71a6f](https://github.com/beshkenadze/kaban/commit/3f71a6f7de6806afb11387f66dcdcd156549b732))

## [0.2.11](https://github.com/beshkenadze/kaban/compare/v0.2.10...v0.2.11) (2026-01-25)


### Bug Fixes

* **cli:** use static import for package.json to ensure bundling ([2d34382](https://github.com/beshkenadze/kaban/commit/2d34382942b9c9dd97445065f4282272f788df91))

## [0.2.10](https://github.com/beshkenadze/kaban/compare/v0.2.9...v0.2.10) (2026-01-25)


### Bug Fixes

* **cli:** decouple TUI dependency to allow nodejs install without bun errors ([632ec04](https://github.com/beshkenadze/kaban/commit/632ec041cef3bd223094bf6507309b53172db8c8))

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
