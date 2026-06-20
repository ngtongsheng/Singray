# Changelog

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
