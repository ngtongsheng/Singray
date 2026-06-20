import type { Settings, SingrayApi, SongListItem, SongMeta } from '../../../shared/types'

// ponytail: dev-only fixtures — just enough for the renderer to mount in a
// plain browser (no Electron, so `window.singray` is undefined). Reads return
// canned data; writes are no-ops. Not a faithful backend — grow a fixture only
// when a screen actually needs it. Installed by main.tsx in DEV when the real
// bridge is absent.

const noop = (): void => {}
const unsub = (): (() => void) => noop

const settings: Settings = {
  libraryDir: 'C:\\Users\\dev\\Karaoke',
  pythonPath: '',
  monitorDeviceId: '',
  streamDeviceId: '',
  audioOutputMode: 'single',
  playerBarPinned: true,
  showWaveform: false,
  showBars: false,
  stemFormat: 'flac',
  libraryView: 'grid',
  languages: [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'English' }
  ],
  uiLanguage: '',
  llmBaseUrl: 'http://localhost:11434/v1',
  llmModel: '',
  llmApiKey: '',
  separationModel: '6_HP-Karaoke-UVR.pth',
  recordingFormat: 'webm',
  micDeviceId: '',
  micEnabled: false,
  micMonitor: true,
  micVolume: 1,
  micFxPreset: 'off',
  micFxAmount: 0.3
}

function song(id: string, title: string, artists: string[], language: string): SongListItem {
  return {
    schemaVersion: 1,
    id,
    title,
    artists,
    language,
    youtubeUrl: `https://youtu.be/${id}`,
    youtubeTitle: `${artists.join(', ')} - ${title}`,
    durationSec: 215,
    addedAt: '2026-06-01T12:00:00.000Z',
    favorite: false,
    tags: [],
    playCount: 0,
    lastPlayedAt: null,
    sings: [],
    sourceFile: null,
    separationModel: '6_HP-Karaoke-UVR.pth',
    enrichment: null,
    hasLyrics: true,
    error: null,
    ready: true
  }
}

const songs: SongListItem[] = [
  song('demo00001', 'Bohemian Rhapsody', ['Queen'], 'en'),
  song('demo00002', '月亮代表我的心', ['邓丽君'], 'zh')
]

const reject = (): Promise<never> =>
  Promise.reject(new Error('mock bridge: not available in browser dev'))

export function createMockBridge(): SingrayApi {
  return {
    library: {
      list: () => Promise.resolve(songs),
      delete: () => Promise.resolve(),
      updateMeta: (id, patch) => {
        const base = songs.find((s) => s.id === id) ?? songs[0]
        return Promise.resolve({ ...base, ...patch } as SongMeta)
      },
      openFolder: () => Promise.resolve()
    },
    lyrics: {
      get: () => Promise.resolve(null),
      save: () => Promise.resolve(),
      align: () => Promise.resolve([]),
      findLyrics: () => Promise.resolve([])
    },
    import: {
      probe: reject,
      probeFile: reject,
      pickFile: () => Promise.resolve(null),
      getPathForFile: () => '',
      search: () => Promise.resolve([]),
      start: () => Promise.resolve('demo-job'),
      retry: () => Promise.resolve(),
      onProgress: unsub
    },
    settings: {
      get: () => Promise.resolve(settings),
      set: (patch) => Promise.resolve({ ...settings, ...patch })
    },
    pipeline: {
      status: () =>
        Promise.resolve({
          ready: false,
          python: false,
          ffmpeg: false,
          gpu: false,
          pythonSource: 'none',
          ffmpegSource: 'none',
          installing: false
        }),
      install: () => Promise.resolve(),
      cancelInstall: () => Promise.resolve(),
      onInstallProgress: unsub,
      listModels: () => Promise.resolve(['6_HP-Karaoke-UVR.pth'])
    },
    llm: {
      test: reject,
      listModels: () => Promise.resolve([]),
      enrichProbe: (probe) =>
        Promise.resolve({ title: probe.title, artist: probe.artist ?? '', source: 'heuristic' }),
      cleanMeta: (input) =>
        Promise.resolve({ title: input.title, artist: input.artist, source: 'heuristic' }),
      cleanLyrics: (input) => Promise.resolve(input.text)
    },
    audio: {
      url: (id, track) => `karaoke://${id}/${track}`,
      thumbUrl: (id) => `karaoke://${id}/thumb.jpg`
    },
    recordings: {
      save: () => Promise.resolve('mock://recording'),
      list: () => Promise.resolve([]),
      delete: () => Promise.resolve(),
      reveal: () => Promise.resolve()
    },
    window: {
      minimize: noop,
      toggleMaximize: noop,
      close: noop,
      isMaximized: () => Promise.resolve(false),
      onMaximizedChange: unsub,
      openExternal: noop
    },
    onLibraryChanged: unsub
  }
}
