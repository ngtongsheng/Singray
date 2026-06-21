# Changelog

## [1.0.1](https://github.com/ngtongsheng/Singray/compare/singray-v1.0.0...singray-v1.0.1) (2026-06-21)


### Bug Fixes

* ad-hoc sign macOS app so it isn't "damaged" on launch ([#126](https://github.com/ngtongsheng/Singray/issues/126)) ([c8141f8](https://github.com/ngtongsheng/Singray/commit/c8141f863a8bb3882481b6c16f0144a1ef3f2343)), closes [#125](https://github.com/ngtongsheng/Singray/issues/125)

## [1.0.0](https://github.com/ngtongsheng/Singray/compare/singray-v0.3.0...singray-v1.0.0) (2026-06-20)


### Features

* multi-artist metadata cleanup, artwork crop preview, recordings seed script ([#118](https://github.com/ngtongsheng/Singray/issues/118)) ([9dcd15d](https://github.com/ngtongsheng/Singray/commit/9dcd15dc3a8a3bba33f835860bd649e7c9e20e47))


### Miscellaneous Chores

* cut v1.0.0 ([52675a6](https://github.com/ngtongsheng/Singray/commit/52675a6259a388b0dba97f7d67fcf052c8529755))

## [0.3.0](https://github.com/ngtongsheng/Singray/compare/singray-v0.2.0...singray-v0.3.0) (2026-06-20)


### Features

* access song recordings from player page ([#102](https://github.com/ngtongsheng/Singray/issues/102)) ([8e545eb](https://github.com/ngtongsheng/Singray/commit/8e545eb1153c01283bcca4ac005a2d95b048312c)), closes [#67](https://github.com/ngtongsheng/Singray/issues/67)
* AI Assist — provider presets + strict model dropdown ([#94](https://github.com/ngtongsheng/Singray/issues/94)) ([c95059c](https://github.com/ngtongsheng/Singray/commit/c95059c521d371d9322129a67200bc7c9d0e39bb))
* hover tooltip on truncated Add Song search-result titles ([#95](https://github.com/ngtongsheng/Singray/issues/95)) ([3630858](https://github.com/ngtongsheng/Singray/commit/3630858294d959157fdb2615d9c3f6ad4a746385)), closes [#62](https://github.com/ngtongsheng/Singray/issues/62)
* lead-in countdown to first lyric word on play-from-start ([#71](https://github.com/ngtongsheng/Singray/issues/71)) ([#99](https://github.com/ngtongsheng/Singray/issues/99)) ([20b5abe](https://github.com/ngtongsheng/Singray/commit/20b5abeba19d014e66b6d40a8ce48402c8481660))
* Library flex layout (only grid/list scrolls) + ScrollArea app-wide ([#93](https://github.com/ngtongsheng/Singray/issues/93)) ([20d6cbd](https://github.com/ngtongsheng/Singray/commit/20d6cbdc44b3ad81c4118c0e75cfd78efdfc6344)), closes [#60](https://github.com/ngtongsheng/Singray/issues/60)
* multi-artist support for songs (artists[] + migration + multi-select) ([#96](https://github.com/ngtongsheng/Singray/issues/96)) ([445a9e9](https://github.com/ngtongsheng/Singray/commit/445a9e933b94ff2ac3a326b8d49e7f90807c4e8f)), closes [#63](https://github.com/ngtongsheng/Singray/issues/63)
* pre-record prep dialog — mic picker, level meter, countdown ([#65](https://github.com/ngtongsheng/Singray/issues/65)) ([#97](https://github.com/ngtongsheng/Singray/issues/97)) ([ec1306f](https://github.com/ngtongsheng/Singray/commit/ec1306fe3803de7aaa45767c674159c4b907a95a))
* Recording mini-player bottom bar on Recordings screen ([#66](https://github.com/ngtongsheng/Singray/issues/66)) ([#98](https://github.com/ngtongsheng/Singray/issues/98)) ([5994dc1](https://github.com/ngtongsheng/Singray/commit/5994dc1b1c7ec59ef21f5fa68093a12536e099fb))
* song thumbnail change via upload + iTunes online search ([#104](https://github.com/ngtongsheng/Singray/issues/104)) ([955c960](https://github.com/ngtongsheng/Singray/commit/955c960e91c67ca8aca4d950d7e3a1669e9d537b)), closes [#69](https://github.com/ngtongsheng/Singray/issues/69)
* YouTube nocookie iframe preview in Add Song dialog ([#101](https://github.com/ngtongsheng/Singray/issues/101)) ([886844b](https://github.com/ngtongsheng/Singray/commit/886844b9ee7cb719347a85dccf48e9612473473d)), closes [#64](https://github.com/ngtongsheng/Singray/issues/64)


### Bug Fixes

* remove stray dev-round note from dual output-mode label ([#90](https://github.com/ngtongsheng/Singray/issues/90)) ([3ed1966](https://github.com/ngtongsheng/Singray/commit/3ed19665310b6c54e519eb6bcd71b60162f9dc44)), closes [#59](https://github.com/ngtongsheng/Singray/issues/59)
* robustness nits — audio cleanup, exit code, import finalize ([#107](https://github.com/ngtongsheng/Singray/issues/107)) ([a0ce209](https://github.com/ngtongsheng/Singray/commit/a0ce209ad03ef458a7e86f4ba1597d8391f2cf2f)), closes [#74](https://github.com/ngtongsheng/Singray/issues/74)
* **ux:** lyric creator flow — exit nav guard, color legend, text orientation, i18n dev warning ([#100](https://github.com/ngtongsheng/Singray/issues/100)) ([99d1252](https://github.com/ngtongsheng/Singray/commit/99d125289fc2510cb9d107d3b6e7279f35f23ab0)), closes [#78](https://github.com/ngtongsheng/Singray/issues/78)


### Performance Improvements

* reuse freq buffer in Soundwave + fix pipeline error messages ([#77](https://github.com/ngtongsheng/Singray/issues/77)) ([#110](https://github.com/ngtongsheng/Singray/issues/110)) ([afd0150](https://github.com/ngtongsheng/Singray/commit/afd01508c674f849facb36b744c21413b0c77e4f))

## [0.2.0](https://github.com/ngtongsheng/Singray/compare/singray-v0.1.0...singray-v0.2.0) (2026-06-20)


### Features

* add react-scan dev perf overlay ([#48](https://github.com/ngtongsheng/Singray/issues/48)) ([b0adf2d](https://github.com/ngtongsheng/Singray/commit/b0adf2d8265f63817b43749d2dddfdc8208e6593))
* add showGradient prop to LyricRenderer, hide in review ([f08f339](https://github.com/ngtongsheng/Singray/commit/f08f33901065519f06460b01296ecf3be5fe9e11))
* adopt shadcn Card, AspectRatio, ScrollArea ([#46](https://github.com/ngtongsheng/Singray/issues/46)) ([92a9997](https://github.com/ngtongsheng/Singray/commit/92a9997015b8a9f37c0c944dc168297ef5a5476d))
* immer produce for import-progress Map + lyrics stamp/undo ([#25](https://github.com/ngtongsheng/Singray/issues/25)) ([#53](https://github.com/ngtongsheng/Singray/issues/53)) ([37cf84a](https://github.com/ngtongsheng/Singray/commit/37cf84ab402dd83badd42fa18cd022112cba2590))
* nav-stack in AppContext + Alt+left/right back/forward hotkeys ([#47](https://github.com/ngtongsheng/Singray/issues/47)) ([330cd9f](https://github.com/ngtongsheng/Singray/commit/330cd9f3517f6f54d7d3d8f94fd41deefdd1fbdb))
* R3.REC2 Recordings view — list, play, delete, reveal ([#27](https://github.com/ngtongsheng/Singray/issues/27)) ([#54](https://github.com/ngtongsheng/Singray/issues/54)) ([ec1f4da](https://github.com/ngtongsheng/Singray/commit/ec1f4da7520cfd65a507e107a1b9347143f74dc4))
* release-please for versioning, changelog, exe release ([#38](https://github.com/ngtongsheng/Singray/issues/38)) ([ca04ded](https://github.com/ngtongsheng/Singray/commit/ca04dedcec33775633bf5cf74c1ae0eab3301926)), closes [#6](https://github.com/ngtongsheng/Singray/issues/6)
* RHF + zodResolver on all forms ([#22](https://github.com/ngtongsheng/Singray/issues/22)) ([#50](https://github.com/ngtongsheng/Singray/issues/50)) ([7f88cc7](https://github.com/ngtongsheng/Singray/commit/7f88cc7d99994e3a02a67dc52d65e9e815db623e))
* shadcn/ui + Radix foundation, rename tokens to shadcn vars ([#37](https://github.com/ngtongsheng/Singray/issues/37)) ([549be52](https://github.com/ngtongsheng/Singray/commit/549be52924d6879fa46beb416fa35e7f87b9bb45))
* TanStack Pacer useDebouncer for URL probe + lyrics autosave ([#24](https://github.com/ngtongsheng/Singray/issues/24)) ([#52](https://github.com/ngtongsheng/Singray/issues/52)) ([c947275](https://github.com/ngtongsheng/Singray/commit/c9472754e5dccd057a8622c4d6491214a0a49aa5))
* update dependencies to latest ([#39](https://github.com/ngtongsheng/Singray/issues/39)) ([dfaa991](https://github.com/ngtongsheng/Singray/commit/dfaa9918f59f6504a444f425154f4e8b7b668ab4)), closes [#7](https://github.com/ngtongsheng/Singray/issues/7)
* user-selectable UVR separation model ([06b3694](https://github.com/ngtongsheng/Singray/commit/06b369493fabf7cfc206aefbf71ca3dc5ab6ec19))
* wrap IPC reads/mutations with react-query ([#49](https://github.com/ngtongsheng/Singray/issues/49)) ([28bc289](https://github.com/ngtongsheng/Singray/commit/28bc2891d4f8d59dfaebb359d059be31ece72ddb))
* zod schemas as source of truth for shared contracts + external APIs ([#51](https://github.com/ngtongsheng/Singray/issues/51)) ([12f5f27](https://github.com/ngtongsheng/Singray/commit/12f5f276de3155f2d3a85d6a488fb4ff133764a5)), closes [#23](https://github.com/ngtongsheng/Singray/issues/23)


### Bug Fixes

* audit pipeline.py, clean up dead import + stale stem refs ([#42](https://github.com/ngtongsheng/Singray/issues/42)) ([d154f59](https://github.com/ngtongsheng/Singray/commit/d154f598033ae15973e8c69ddda8160f959ec534)), closes [#11](https://github.com/ngtongsheng/Singray/issues/11)
* dev-only mock window.singray bridge for browser ([#31](https://github.com/ngtongsheng/Singray/issues/31)) ([a8405a0](https://github.com/ngtongsheng/Singray/commit/a8405a0c9e94af37ede96e66868bc9221665ae40)), closes [#12](https://github.com/ngtongsheng/Singray/issues/12)
* enableMapSet() for Immer + ErrorBoundary to prevent blank screen on Add Song ([#82](https://github.com/ngtongsheng/Singray/issues/82)) ([16f1292](https://github.com/ngtongsheng/Singray/commit/16f1292bba336af5bfa68ae6322af505a679e164))
* Select.Item with empty-string value renders blank trigger ([#86](https://github.com/ngtongsheng/Singray/issues/86)) ([b847c2b](https://github.com/ngtongsheng/Singray/commit/b847c2bd1e81a7ad1cba4943dfec4eac1586db89)), closes [#58](https://github.com/ngtongsheng/Singray/issues/58)
* stop click propagation from Radix portal menu to card ([#83](https://github.com/ngtongsheng/Singray/issues/83)) ([33e42af](https://github.com/ngtongsheng/Singray/commit/33e42af7f8076d38b00f1763a0ae1272ee8abc15)), closes [#57](https://github.com/ngtongsheng/Singray/issues/57)


### Performance Improvements

* cut unnecessary rerenders/recomputes across Player, Library, LyricCreator ([99a5890](https://github.com/ngtongsheng/Singray/commit/99a58901ce319f8757da99ef6de363d22724b0b5))
