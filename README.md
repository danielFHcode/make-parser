# Make Parse

See [packages/core/README.md](packages/core/README.md).

## Project Structure

Packages at [packages/](packages/), this isn't a full fledged monorepo but we do use npm workspaces and have commands in the central [packages.json](package.json) so you can run `pnpm build` and `pnpm run` across all packages at once.

**Please format you're files with prettier if you're planning on contributing.** If you don't have prettier set up with your editor you can run `pnpm exec format:watch` in the project root for a similar formatting on save functionality.
