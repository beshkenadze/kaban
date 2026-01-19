# Contributing to Kaban

Thanks for your interest in contributing to Kaban!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/beshkenadze/kaban
cd kaban

# Install dependencies
bun install

# Build all packages
bun run build

# Run linting
bun run lint

# Run tests
bun run test
```

## Project Structure

```
packages/
├── core/     # Database, services, schemas
├── cli/      # CLI commands and MCP server
└── tui/      # Terminal UI
```

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run `bun run lint` and `bun run test`
5. Commit with conventional commit messages (see below)
6. Push and open a Pull Request

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/) for automated releases. Your commit messages **directly control version bumping and changelog generation**.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types and Version Impact

| Type | Version Bump | Changelog Section | Example |
|------|--------------|-------------------|---------|
| `feat:` | **Minor** (0.2.0 → 0.3.0) | Features | `feat: add dark mode toggle` |
| `fix:` | **Patch** (0.2.0 → 0.2.1) | Bug Fixes | `fix: resolve crash on startup` |
| `perf:` | **Patch** | Performance | `perf: optimize database queries` |
| `deps:` | **Patch** | Dependencies | `deps: upgrade zod to v4` |
| `feat!:` | **Major** (0.2.0 → 1.0.0) | Features | `feat!: redesign API` |
| `docs:` | No bump | Hidden | `docs: update README` |
| `chore:` | No bump | Hidden | `chore: update gitignore` |
| `refactor:` | No bump | Hidden | `refactor: extract utils` |
| `test:` | No bump | Hidden | `test: add unit tests` |
| `ci:` | No bump | Hidden | `ci: fix workflow` |

### Breaking Changes

For breaking changes, either:

```bash
# Option 1: Add ! after type
git commit -m "feat!: remove deprecated API"

# Option 2: Add BREAKING CHANGE footer
git commit -m "feat: redesign config format

BREAKING CHANGE: config.json structure changed"
```

### Scope (Optional)

Add scope for clarity:

```bash
git commit -m "feat(cli): add hook status command"
git commit -m "fix(tui): handle empty board state"
git commit -m "perf(core): optimize task queries"
```

### Examples

```bash
# Feature (bumps minor version)
git commit -m "feat: add TodoWrite sync hook for Claude Code"

# Bug fix (bumps patch version)
git commit -m "fix: resolve symlink path for npm global installs"

# Multiple changes in one commit
git commit -m "feat(hook): add conflict resolution strategies

- Add todowrite_wins, kaban_wins, most_progressed strategies
- Add configurable cancelled task policy
- Add sync logging to ~/.claude/hooks/sync.log"
```

## Release Process

Releases are **fully automated** using [release-please](https://github.com/googleapis/release-please).

### How It Works

```
Push to main → release-please creates PR → Merge PR → Auto-publish
```

1. **Push conventional commits** to `main` branch
2. **release-please** automatically creates a "Release PR" with:
   - Bumped versions in all `package.json` files
   - Updated `CHANGELOG.md` with your commit messages
   - Git tag preparation
3. **Review and merge** the Release PR
4. **Automatic publishing**:
   - npm packages with OIDC provenance
   - GitHub Release with notes
   - Homebrew formula update

### Release PR Example

When you push `feat: add dark mode`, release-please creates a PR titled:

```
chore(main): release 0.3.0
```

The PR contains:
- Version bumps: `0.2.0` → `0.3.0` in all packages
- CHANGELOG.md update with "Features" section
- Ready to merge

### Manual Release (Emergency)

For urgent releases outside the normal flow:

1. Go to **Actions** → **Manual Release**
2. Click **Run workflow**
3. Enter version (e.g., `0.3.1`)
4. Optionally skip tests
5. Click **Run**

### Version Sync

All packages maintain the same version:
- `@kaban-board/core`
- `@kaban-board/cli`  
- `@kaban-board/tui`

## Code Style

- TypeScript strict mode
- Biome for linting and formatting
- No `any` types
- Run `bun run check` before committing

## Testing

```bash
# Run all tests
bun run test

# Run specific package tests
cd packages/cli && bun test
cd packages/core && bun test

# Type checking
bun run typecheck
```

## Questions?

Open an issue for questions or discussions.
