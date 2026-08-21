## [3.0.14](https://github.com/GMOD/nclist-js/compare/v3.0.13...v3.0.14) (2026-08-21)

### Bug Fixes

- Take the shared-read-cache release that fixes abort, eviction and weighing ([3c357b7](https://github.com/GMOD/nclist-js/commit/3c357b73797dbe6c68d3bde8a2b5b37b62cd9f2e))

### Chores

- Render only the commit subject, and link the commit ([ec2087e](https://github.com/GMOD/nclist-js/commit/ec2087e69421408b4091e3ee0eaa21d1520b1b1c))
- Create a GitHub release for each published tag ([13535f0](https://github.com/GMOD/nclist-js/commit/13535f0b9f655012b1a1e779da9b58d2878d1301))
- Enforce type strippability in tsconfig, add missing lint rules ([fe461bc](https://github.com/GMOD/nclist-js/commit/fe461bcf2145a960a29ce3343948cc18aaf60481))
- Keep agent worktrees out of the toolchain's way ([00fe0bb](https://github.com/GMOD/nclist-js/commit/00fe0bb8ee78c21229e656e88cad34c5c2172c7f))

## [3.0.13](https://github.com/GMOD/nclist-js/compare/v3.0.12...v3.0.13) (2026-08-10)

## [3.0.12](https://github.com/GMOD/nclist-js/compare/v3.0.11...v3.0.12) (2026-08-10)

### Chores

- Share one eslint-plugin-unicorn opt-out list across the repos
- Turn off unicorn/prefer-early-return across the repos
- Drop prepublishOnly
- Add git-cliff for changelog generation
- Drop eslint-plugin-unicorn
- Type-check the tests and enforce prettier, as @gmod/bam does
- Let npm publish stop auto-correcting repository.url
- Exempt our own packages from the release quarantine
- Bump pnpm/action-setup to v6.0.10
- Run the test suite as `pnpm test --run`
- Gate preversion on format:check, as CI does
- Bring the typecheck gate up to the standard of its siblings
- Converge package.json on the shape its siblings use

### Documentation

- Backfill CHANGELOG.md from git history
- Mark breaking changes in the generated changelog

### Other Changes

- Revert "chore: converge package.json" — the CHANGELOG prettier step ([424412f](https://github.com/GMOD/nclist-js/commit/424412f447412d601c9d01f6bed03ec415b44e83))

### Refactoring

- Use @gmod/shared-read-cache, dropping two dependencies

## [3.0.11](https://github.com/GMOD/nclist-js/compare/v3.0.10...v3.0.11) (2026-07-25)

### Bug Fixes

- Update CI badge to reference `publish.yml` (it moved from `push.yml` when
  the workflows were merged in 3.0.9)
- Remove stale workflow query link from the CI badge

### Chores

- Ban TypeScript parameter properties, so the type-stripped output stays
  correct (parameter properties need real `tsc` emit, not just erasure)
- Set pnpm's `minimumReleaseAge` to 3 days, to avoid picking up freshly
  published (and possibly compromised) dependency versions
- Sha-pin GitHub Actions, take the pnpm version from `packageManager`
  instead of a separate `version:` input, bump CI to Node 24
- Pin the pnpm version, declare `sideEffects: false` for better tree-shaking

## [3.0.10](https://github.com/GMOD/nclist-js/compare/v3.0.9...v3.0.10) (2026-05-19)

- Rename the merged workflow back to `publish.yml` — npm's OIDC
  trusted-publishing config pins to that exact file path

## [3.0.9](https://github.com/GMOD/nclist-js/compare/v3.0.8...v3.0.9) (2026-05-19)

- Merge the publish workflow into `push.yml`, gated on the test job
  succeeding first

## [3.0.8](https://github.com/GMOD/nclist-js/compare/v3.0.7...v3.0.8) (2026-05-18)

- Remove dead code and simplify patterns: drop the unused `index` method
  from `LazyArray`, drop dead/commented-out setter code from
  `ArrayRepr`, inline `idfunc`/`parentfunc`/`childrenfunc` as closures in
  `decorateFeature`, and convert eslint-disabled index loops to `for...of`
- Fix the build-status badge and Codecov badge to point at `main` instead
  of `master`, and switch the README's publishing example from
  `npm version` to `pnpm version`
- Bump devDependencies; enable the `object-shorthand` and
  `@typescript-eslint/no-unnecessary-condition` lint rules; add
  `pnpm-workspace.yaml` with `allowBuilds: { unrs-resolver: true }` for
  pnpm 11's stricter build-script gating

## [3.0.7](https://github.com/GMOD/nclist-js/compare/v3.0.6...v3.0.7) (2026-04-27)

- Standardize `package.json`/`tsconfig.json`/build scripts to match the
  other GMOD packages: simplify `exports`, drop the redundant `module`
  field, restore `main` for CJS consumers, and rewrite `tsconfig.json` to
  target `es2022`/`nodenext` with `skipLibCheck`
- Replace `eslint-plugin-import` with `eslint-plugin-import-x`
- Remove unused dependencies
- Enable `noUncheckedIndexedAccess` in `tsconfig.json` for stricter
  array/object-access typing
- Add `express` and `get-port` as devDependencies (used by the test
  server but missing from `package.json`)
- Add a "Publishing" section to the README documenting trusted publishing
  via GitHub Actions

## [3.0.6](https://github.com/GMOD/nclist-js/compare/v3.0.5...v3.0.6) (2026-03-31)

- Reformat the README with Prettier

## [3.0.5](https://github.com/GMOD/nclist-js/compare/v3.0.4...v3.0.5) (2026-03-31)

- Fix NCList sometimes having a string `phase` field instead of a number
  ([#41](https://github.com/GMOD/nclist-js/pull/41))

## [3.0.4](https://github.com/GMOD/nclist-js/compare/v3.0.1...v3.0.4) (2025-12-17)

- Replace `quick-lru` with `@jbrowse/quick-lru`
- Bump `express` to v5 and other deps; sort imports; lint fixes

## [3.0.1](https://github.com/GMOD/nclist-js/compare/v3.0.0...v3.0.1) (2025-05-13)

- Add a `postbuild:es5` script that writes `dist/package.json` with
  `{"type": "commonjs"}`, so the CJS build isn't misparsed as ESM by
  Node's `dist/`-relative `package.json` resolution

## [3.0.0](https://github.com/GMOD/nclist-js/compare/v2.0.0...v3.0.0) (2025-04-30)

- Switch to a pure-ESM package build (`"type": "module"`, `exports` map,
  explicit `.ts` extensions in relative imports via
  `allowImportingTsExtensions`/`rewriteRelativeImportExtensions`) —
  breaking change, hence the major version bump
- Bump `@gmod/abortable-promise-cache`, `generic-filehandle2`, and other
  deps

## [2.0.0](https://github.com/GMOD/nclist-js/compare/v1.0.3...v2.0.0) (2024-12-12)

- Replace `generic-filehandle` with `generic-filehandle2` — breaking
  change for consumers passing a `generic-filehandle` `RemoteFile`, hence
  the major version bump
- Migrate the test runner from Jest to Vitest, and the linter config from
  `eslint-config-prettier`/`eslint-plugin-prettier` to
  `eslint-plugin-unicorn`
- Clean up source: use optional chaining (`?.`) in place of manual
  null checks, replace `.replace(regex, ...)` with `.replaceAll`, drop a
  stray `foo()` export, and decode `readFile`'s result with `TextDecoder`
  instead of assuming a string

## [1.0.3](https://github.com/GMOD/nclist-js/compare/v1.0.2...v1.0.3) (2024-07-23)

- Replace the `abortable-promise-cache` dependency with the GMOD-maintained
  `@gmod/abortable-promise-cache` fork
- Remove the unused `.eslintrc.json` (superseded by `eslint.config.mjs`)

## [1.0.2](https://github.com/GMOD/nclist-js/compare/v1.0.1...v1.0.2) (2024-06-21)

- Use the `@jridgewell/resolve-uri` library for URL resolution in NCList,
  and treat `ENOENT` in the error message (not just the error code) as a
  missing-file 404 ([#33](https://github.com/GMOD/nclist-js/pull/33))

## [1.0.1](https://github.com/GMOD/nclist-js/compare/v1.0.0...v1.0.1) (2024-06-21)

- Treat a `404` substring in the error message, not just `error.status`,
  as a missing file so `readJSON` falls back to its default content
- Fix a typo in `array_representation.ts`
- Bump deps

## [1.0.0](https://github.com/GMOD/nclist-js/compare/v0.2.2...v1.0.0) (2023-05-02)

- Remove node `url` module usage in favor of `new URL()`
  ([#32](https://github.com/GMOD/nclist-js/pull/32))
- Fix the API docs and the build-status badge; bump devDeps

## [0.2.2](https://github.com/GMOD/nclist-js/compare/v0.2.1...v0.2.2) (2022-03-30)

- Publish the `src` directory alongside `dist`/`esm` so source maps can
  resolve back to the original TypeScript
  ([#26](https://github.com/GMOD/nclist-js/pull/26))
- Bump deps

## [0.2.1](https://github.com/GMOD/nclist-js/compare/v0.2.0...v0.2.1) (2022-02-15)

- Republish of 0.2.0 (CHANGELOG.md only)

## [0.2.0](https://github.com/GMOD/nclist-js/compare/v0.1.1...v0.2.0) (2022-02-15)

- Migrate the build from Babel to `tsc`, emitting dual ESM (`esm/`) and
  CommonJS (`dist/`) output; move CI to GitHub Actions
  ([#25](https://github.com/GMOD/nclist-js/pull/25))
- Remove the Greenkeeper config; apply a handful of Dependabot dependency
  bumps (`mixin-deep`, `ini`, `dot-prop`)

## [0.1.1](https://github.com/GMOD/nclist-js/compare/v0.1.0...v0.1.1) (2019-12-12)

- Include `refName` in the feature ID, since the previous ID could
  otherwise collide across reference sequences

## [0.1.0](https://github.com/GMOD/nclist-js/compare/v0.0.2...v0.1.0) (2019-04-21)

- Cache `trackData.json` fetches

# 0.0.2 (2019-04-20)

- Initial release, with an adapter to the JBrowse 1 NCList data store
- Support compressed and uncompressed NCList stores
