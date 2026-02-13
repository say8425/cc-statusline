# Changelog

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
