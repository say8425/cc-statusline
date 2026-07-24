# Changelog

## [4.1.0](https://github.com/say8425/cc-statusline/compare/v4.0.0...v4.1.0) (2026-07-24)


### Features

* clickable folder links + PR status/CI badge ([8da01a4](https://github.com/say8425/cc-statusline/commit/8da01a42ed1b020526d624bcd5753ce4e3fc5d8d))


### Bug Fixes

* **deps:** repo audit — update deps to current, sync docs, align CI ([#61](https://github.com/say8425/cc-statusline/issues/61)) ([e08a099](https://github.com/say8425/cc-statusline/commit/e08a099ef56ffb474e4cf88457ae9b16974a3789))

## [4.0.0](https://github.com/say8425/cc-statusline/compare/v3.2.0...v4.0.0) (2026-07-20)


### ⚠ BREAKING CHANGES

* the diff viewer is no longer embedded in cc-statusline. The diff engine and browser viewer now live in the separately published @say8425/diffdeck package, added as a runtime dependency and spawned as the diff daemon; the in-repo `--diff-server` mode and the `@pierre/*` viewer internals are gone. `bunx @say8425/cc-statusline` pulls diffdeck automatically, so no action is needed for that path, but anything that drove the embedded server directly or pinned `@pierre/*` must switch to diffdeck.

### Features

* cut over to published @say8425/diffdeck for the diff viewer ([#55](https://github.com/say8425/cc-statusline/issues/55)) ([7c59e5f](https://github.com/say8425/cc-statusline/commit/7c59e5ffce144275f929583f1daa749d622a32b1))

## [3.2.0](https://github.com/say8425/cc-statusline/compare/v3.1.0...v3.2.0) (2026-07-06)


### Features

* inline image diffs, viewer UI polish, and oxlint/oxfmt migration ([#50](https://github.com/say8425/cc-statusline/issues/50)) ([c2b4f7d](https://github.com/say8425/cc-statusline/commit/c2b4f7dbe295446ee509a01d69214081d8ac2d3a))
* show model effort and ultracode status ([#52](https://github.com/say8425/cc-statusline/issues/52)) ([5450db4](https://github.com/say8425/cc-statusline/commit/5450db4d31e549e74b036b0596fc10c7cdbf652f))

## [3.1.0](https://github.com/say8425/cc-statusline/compare/v3.0.0...v3.1.0) (2026-07-05)


### Features

* clickable local diff viewer with search, copy, and toolbar ([#48](https://github.com/say8425/cc-statusline/issues/48)) ([620fbd5](https://github.com/say8425/cc-statusline/commit/620fbd59e0bbf81d40b9d80cdf6c8e1fcb08217d))

## [3.0.0](https://github.com/say8425/cc-statusline/compare/v2.2.0...v3.0.0) (2026-04-13)


### ⚠ BREAKING CHANGES

* TypeScript upgraded from v5 to v6. Contributors must use TypeScript 6+ for type checking.

### Miscellaneous Chores

* upgrade dev dependencies ([#46](https://github.com/say8425/cc-statusline/issues/46)) ([6b0880d](https://github.com/say8425/cc-statusline/commit/6b0880d99e362eb16e485b35f46f39ffd6cb52f1))

## [2.2.0](https://github.com/say8425/cc-statusline/compare/v2.1.1...v2.2.0) (2026-04-10)


### Features

* use workspace.git_worktree and context_window.used_percentage from JSON input ([635383a](https://github.com/say8425/cc-statusline/commit/635383ab6feb0f5cf5d544b11f52c045ac5c5679)), closes [#42](https://github.com/say8425/cc-statusline/issues/42)

## [2.1.1](https://github.com/say8425/cc-statusline/compare/v2.1.0...v2.1.1) (2026-03-21)


### Bug Fixes

* add min length and even length check for hex detection ([7e0815c](https://github.com/say8425/cc-statusline/commit/7e0815ce610e2595898dda306db41db16a0fd677))
* parse hex-encoded macOS Keychain credentials for --show-usage ([b890984](https://github.com/say8425/cc-statusline/commit/b89098453f1130944b5dc9aa07fd5c674fff00e1)), closes [#37](https://github.com/say8425/cc-statusline/issues/37)
* use Unix timestamp for resets_at and bump to 3.0.0 ([e330847](https://github.com/say8425/cc-statusline/commit/e3308475f62805fdbb17238f99a2eb59b3ea8bb4))


### Reverts

* restore version to 2.1.0 for release-please ([d6e679b](https://github.com/say8425/cc-statusline/commit/d6e679bcffe186f596167104f8a2336a852a50f0))

## [2.1.0](https://github.com/say8425/cc-statusline/compare/v2.0.2...v2.1.0) (2026-02-24)


### Features

* add worktree detection with git-common-dir ([f9e2a7d](https://github.com/say8425/cc-statusline/commit/f9e2a7df06f4d79ce190454ddd5269f0841a98d0))
* display worktree name with dedicated 🌲 emoji ([894be35](https://github.com/say8425/cc-statusline/commit/894be35200eb3d13b5e3f7787f5fe7293c160d7a))

## [2.0.2](https://github.com/say8425/cc-statusline/compare/v2.0.1...v2.0.2) (2026-02-13)


### Bug Fixes

* add build step before npm publish ([9e0eced](https://github.com/say8425/cc-statusline/commit/9e0ecedcb86f1e4376be7275e9bbad3a1faca462))

## [2.0.1](https://github.com/say8425/cc-statusline/compare/v2.0.0...v2.0.1) (2026-02-13)


### Bug Fixes

* use dist/index.js as bin entry for bunx compatibility ([f4c744d](https://github.com/say8425/cc-statusline/commit/f4c744df15916226a77b18ae5512cc1f382ae932)), closes [#28](https://github.com/say8425/cc-statusline/issues/28)

## [2.0.0](https://github.com/say8425/cc-statusline/compare/v2.0.0...v2.0.0) (2026-02-12)


### Features

* add --plan option for different subscription tiers ([3542e82](https://github.com/say8425/cc-statusline/commit/3542e827fb121a36e82b0ff015b0ae9122ca23d1))
* add biome check hook for auto-formatting ([ab72260](https://github.com/say8425/cc-statusline/commit/ab72260ccf833be1db2b870738c2fb2460f27fb9))
* add limit reset timer display ([a69505f](https://github.com/say8425/cc-statusline/commit/a69505fa99bea23763aeec475f7f92fed53080bf))
* add review-comments skill for PR comment handling ([e40ef1b](https://github.com/say8425/cc-statusline/commit/e40ef1b914f62d804c9234569f3e2bfe23ad5896))
* add usage metrics line with block usage and burn rate ([80b307d](https://github.com/say8425/cc-statusline/commit/80b307d27c3ea7f14968336817045b3b489a3816))
* initial release of cc-statusline ([455ca05](https://github.com/say8425/cc-statusline/commit/455ca05fe700770f11e5c03b8d85900c67877036))
* restore git diff display with file count ([461a8eb](https://github.com/say8425/cc-statusline/commit/461a8eb4c0f0c95531771d1f1fab52bb00c2a8e7)), closes [#5](https://github.com/say8425/cc-statusline/issues/5)
* switch to npmjs.org and support bunx execution ([4ca6cde](https://github.com/say8425/cc-statusline/commit/4ca6cdef2dda1fc1d61cc4eaff98e65369c085f1))
* 리셋 시각 표시 변경 및 7일 리셋 시간 추가 ([6671578](https://github.com/say8425/cc-statusline/commit/6671578b7050508ac677a5299495635b57b2c16d))


### Bug Fixes

* address PR review comments ([f2bb2dc](https://github.com/say8425/cc-statusline/commit/f2bb2dca08363dc6c0261485dedde823ccc56630))
* align block cost calculation with /usage by correcting pricing and limits ([7362c7c](https://github.com/say8425/cc-statusline/commit/7362c7c22021892c7f9b55cb4d4e521b26ab4434))
* **ci:** checkout release tag for publish job ([3e75054](https://github.com/say8425/cc-statusline/commit/3e75054ef512c547f37b86a33a48d4808eca65f9))
* **ci:** handle empty pr output in release workflow ([dd4cf9f](https://github.com/say8425/cc-statusline/commit/dd4cf9f3ff0d552695231ee8711834ecdf037d96))
* **ci:** use gh pr list for reliable PR number lookup ([6d48fc2](https://github.com/say8425/cc-statusline/commit/6d48fc25cac24316fab5e359d415452871275e11))
* **ci:** use merge commit instead of squash ([eb7837f](https://github.com/say8425/cc-statusline/commit/eb7837f34c8429956759a8e27cc839ca75b48a84))
* **ci:** use rebase merge strategy ([702bb0d](https://github.com/say8425/cc-statusline/commit/702bb0d8a72d0a3a5644d541f9d63538a9f24b25))
* parse transcript directly for immediate context update ([6e44f5a](https://github.com/say8425/cc-statusline/commit/6e44f5a261490f259101dd751b22ee3c6b1e8450))
* use latest transcript file for immediate context update ([f1803c6](https://github.com/say8425/cc-statusline/commit/f1803c6e9852dc12bb83aa260dfcc2d9654c60d7))


### Performance Improvements

* use simdjson for faster JSONL parsing ([b9acfe2](https://github.com/say8425/cc-statusline/commit/b9acfe2fbc52e8a2f7d4362ffebe922b3bdb575d))


### Miscellaneous Chores

* release 2.0.0 ([370735c](https://github.com/say8425/cc-statusline/commit/370735c13f0eda599adb94ff432e4982204e048e))

## [1.4.0](https://github.com/say8425/cc-statusline/compare/v1.3.0...v1.4.0) (2026-02-03)


### Features

* add --plan option for different subscription tiers ([3542e82](https://github.com/say8425/cc-statusline/commit/3542e827fb121a36e82b0ff015b0ae9122ca23d1))
* add biome check hook for auto-formatting ([ab72260](https://github.com/say8425/cc-statusline/commit/ab72260ccf833be1db2b870738c2fb2460f27fb9))
* add limit reset timer display ([a69505f](https://github.com/say8425/cc-statusline/commit/a69505fa99bea23763aeec475f7f92fed53080bf))
* add review-comments skill for PR comment handling ([e40ef1b](https://github.com/say8425/cc-statusline/commit/e40ef1b914f62d804c9234569f3e2bfe23ad5896))
* add usage metrics line with block usage and burn rate ([80b307d](https://github.com/say8425/cc-statusline/commit/80b307d27c3ea7f14968336817045b3b489a3816))


### Bug Fixes

* address PR review comments ([f2bb2dc](https://github.com/say8425/cc-statusline/commit/f2bb2dca08363dc6c0261485dedde823ccc56630))


### Performance Improvements

* use simdjson for faster JSONL parsing ([b9acfe2](https://github.com/say8425/cc-statusline/commit/b9acfe2fbc52e8a2f7d4362ffebe922b3bdb575d))

## [1.3.0](https://github.com/say8425/cc-statusline/compare/v1.2.0...v1.3.0) (2026-01-29)


### Features

* restore git diff display with file count ([461a8eb](https://github.com/say8425/cc-statusline/commit/461a8eb4c0f0c95531771d1f1fab52bb00c2a8e7)), closes [#5](https://github.com/say8425/cc-statusline/issues/5)

## [1.2.0](https://github.com/say8425/cc-statusline/compare/v1.1.1...v1.2.0) (2026-01-25)


### Features

* initial release of cc-statusline ([455ca05](https://github.com/say8425/cc-statusline/commit/455ca05fe700770f11e5c03b8d85900c67877036))
* switch to npmjs.org and support bunx execution ([4ca6cde](https://github.com/say8425/cc-statusline/commit/4ca6cdef2dda1fc1d61cc4eaff98e65369c085f1))


### Bug Fixes

* **ci:** checkout release tag for publish job ([3e75054](https://github.com/say8425/cc-statusline/commit/3e75054ef512c547f37b86a33a48d4808eca65f9))
* **ci:** handle empty pr output in release workflow ([dd4cf9f](https://github.com/say8425/cc-statusline/commit/dd4cf9f3ff0d552695231ee8711834ecdf037d96))
* **ci:** use gh pr list for reliable PR number lookup ([6d48fc2](https://github.com/say8425/cc-statusline/commit/6d48fc25cac24316fab5e359d415452871275e11))
* **ci:** use merge commit instead of squash ([eb7837f](https://github.com/say8425/cc-statusline/commit/eb7837f34c8429956759a8e27cc839ca75b48a84))
* **ci:** use rebase merge strategy ([702bb0d](https://github.com/say8425/cc-statusline/commit/702bb0d8a72d0a3a5644d541f9d63538a9f24b25))
* parse transcript directly for immediate context update ([6e44f5a](https://github.com/say8425/cc-statusline/commit/6e44f5a261490f259101dd751b22ee3c6b1e8450))
* use latest transcript file for immediate context update ([f1803c6](https://github.com/say8425/cc-statusline/commit/f1803c6e9852dc12bb83aa260dfcc2d9654c60d7))

## [1.1.0](https://github.com/say8425/cc-statusline/compare/v1.0.0...v1.1.0) (2026-01-24)


### Features

* switch to npmjs.org and support bunx execution ([4ca6cde](https://github.com/say8425/cc-statusline/commit/4ca6cdef2dda1fc1d61cc4eaff98e65369c085f1))

## 1.0.0 (2026-01-20)


### Features

* initial release of cc-statusline ([455ca05](https://github.com/say8425/cc-statusline/commit/455ca05fe700770f11e5c03b8d85900c67877036))


### Bug Fixes

* parse transcript directly for immediate context update ([6e44f5a](https://github.com/say8425/cc-statusline/commit/6e44f5a261490f259101dd751b22ee3c6b1e8450))
* use latest transcript file for immediate context update ([f1803c6](https://github.com/say8425/cc-statusline/commit/f1803c6e9852dc12bb83aa260dfcc2d9654c60d7))
