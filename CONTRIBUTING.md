# Contributing

## Setup

Requires [bun](https://bun.sh) ≥ 1.1.

```sh
git clone https://github.com/tagcache/tagcache
cd tagcache
bun install
```

## Common tasks

```sh
bun run test        # run vitest across all packages
bun run typecheck   # tsc --noEmit per package
bun run build       # tsup per package
bun run size        # size-limit per package (enforces bundle budgets)
```

## Adding a changeset

Every user-facing change needs a [changeset](https://github.com/changesets/changesets):

```sh
bun changeset
```

Select affected packages and semver bump (patch / minor / major). The release workflow opens a "version packages" PR that bumps versions and generates changelogs. Merging that PR triggers publishing to npm via OIDC.

## Size budgets

Each package has a hard bundle size limit enforced by `size-limit`. CI fails if a package exceeds its budget. Check `packages/<name>/package.json` under `size-limit`.

## Architecture

See [CONTEXT.md](./CONTEXT.md) for design decisions, package layout, and roadmap.
