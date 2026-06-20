import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FolderOpen, Pause, Play, Square, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RecordingItem } from '../../../shared/types'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import Titlebar from '../components/shared/Titlebar'
import { Container, IconButton, ScrollArea, Slider, Stack, Text } from '../components/ui'
import { useAppContext } from '../context/AppContext'
import { useLibrary } from '../hooks/useLibrary'

interface Props {
  songId?: string
}

function fmtDuration(sec: number | null): string {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtTimestamp(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
}

function Recordings({ songId }: Props): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { goBack } = useAppContext()
  const qc = useQueryClient()
  const { songs } = useLibrary()

  const queryKey = ['recordings', songId ?? 'all'] as const
  const { data: recordings = [], isPending } = useQuery({
    queryKey,
    queryFn: () => window.singray.recordings.list(songId)
  })

  const deleteMutation = useMutation({
    mutationFn: (path: string) => window.singray.recordings.delete(path),
    onSuccess: () => qc.invalidateQueries({ queryKey })
  })

  const [pendingDelete, setPendingDelete] = useState<RecordingItem | null>(null)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [dragPos, setDragPos] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  function togglePlay(rec: RecordingItem): void {
    if (playingUrl === rec.url) {
      audioRef.current?.pause()
      setPlayingUrl(null)
    } else {
      setCurrentTime(0)
      setDuration(0)
      setPlayingUrl(rec.url)
      // auto-play fires once src changes via useEffect in <audio>
    }
  }

  function songTitle(id: string): string {
    const song = songs.find((s) => s.id === id)
    return song ? `${song.title} — ${song.artist}` : id
  }

  const playingRec = recordings.find((r) => r.url === playingUrl) ?? null
  const playingSong = playingRec ? songs.find((s) => s.id === playingRec.songId) : undefined

  const title = songId
    ? (songs.find((s) => s.id === songId)?.title ?? t('recordings.title'))
    : t('recordings.title')

  return (
    <div className="relative h-full">
      <Titlebar>
        <IconButton
          onClick={goBack}
          title={t('common.backEsc')}
          className="app-no-drag text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
        </IconButton>
        <Text as="h1" variant="title">
          {title}
        </Text>
      </Titlebar>

      <Container pb={playingUrl ? 12 : 6}>
        {isPending ? (
          <Text variant="hint" className="py-12 text-center">
            {t('common.loading')}
          </Text>
        ) : recordings.length === 0 ? (
          <Text variant="hint" className="py-12 text-center">
            {t('recordings.empty')}
          </Text>
        ) : (
          <ScrollArea className="h-full">
            <Stack direction="column" gap={0} className="divide-y divide-border py-3">
              {recordings.map((rec) => (
                <Stack key={rec.path} justify="between" align="center" className="px-1 py-3">
                  <Stack direction="column" gap={0.5}>
                    {!songId && (
                      <Text as="span" variant="item">
                        {songTitle(rec.songId)}
                      </Text>
                    )}
                    <Text as="span" variant="hint" className="text-xs">
                      {fmtTimestamp(rec.timestamp, i18n.language)} · {fmtDuration(rec.durationSec)}
                    </Text>
                  </Stack>

                  <Stack gap={1}>
                    <IconButton
                      size="sm"
                      title={playingUrl === rec.url ? t('recordings.pause') : t('recordings.play')}
                      onClick={() => togglePlay(rec)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {playingUrl === rec.url ? (
                        <Square className="size-4" strokeWidth={1.5} />
                      ) : (
                        <Play className="size-4" strokeWidth={1.5} />
                      )}
                    </IconButton>
                    <IconButton
                      size="sm"
                      title={t('recordings.reveal')}
                      onClick={() => window.singray.recordings.reveal(rec.path)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <FolderOpen className="size-4" strokeWidth={1.5} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      title={t('recordings.delete')}
                      onClick={() => setPendingDelete(rec)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" strokeWidth={1.5} />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </ScrollArea>
        )}
      </Container>

      {playingUrl && playingRec && (
        <>
          {/* biome-ignore lint/a11y/useMediaCaption: personal recording playback — no caption track applies */}
          <audio
            ref={audioRef}
            src={playingUrl}
            autoPlay
            onEnded={() => setPlayingUrl(null)}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            className="hidden"
          />
          <Stack
            align="center"
            gap={3}
            className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-popover px-4 py-3"
          >
            <img
              src={window.singray.audio.thumbUrl(playingRec.songId)}
              alt=""
              className="size-10 shrink-0 rounded object-cover"
              draggable={false}
            />
            <Stack direction="column" gap={0} className="w-40 shrink-0 overflow-hidden">
              <Text as="span" variant="item" className="truncate">
                {playingSong?.title ?? playingRec.songId}
              </Text>
              <Text as="span" variant="hint" className="truncate text-xs">
                {playingSong?.artist ?? ''}
              </Text>
            </Stack>
            <IconButton
              title={paused ? t('recordings.play') : t('recordings.pause')}
              onClick={() => (paused ? audioRef.current?.play() : audioRef.current?.pause())}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              {paused ? (
                <Play className="size-4" strokeWidth={1.5} />
              ) : (
                <Pause className="size-4" strokeWidth={1.5} />
              )}
            </IconButton>
            <Text as="span" variant="hint" className="text-xs tabular-nums">
              {fmtDuration(dragPos ?? currentTime)}
            </Text>
            <Slider
              min={0}
              max={duration || 1}
              step={0.25}
              value={dragPos ?? currentTime}
              onChange={setDragPos}
              onCommit={(v) => {
                setDragPos(null)
                if (audioRef.current) audioRef.current.currentTime = v
              }}
              className="h-11 flex-1"
            />
            <Text as="span" variant="hint" className="text-xs tabular-nums">
              {fmtDuration(duration)}
            </Text>
          </Stack>
        </>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={t('recordings.deleteTitle')}
          body={t('recordings.deleteBody')}
          confirmLabel={t('common.delete')}
          onConfirm={() => {
            deleteMutation.mutate(pendingDelete.path)
            if (playingUrl === pendingDelete.url) {
              setPlayingUrl(null)
            }
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

export default Recordings
