import { zodResolver } from '@hookform/resolvers/zod'
import { clsx as cx } from 'clsx'
import { Loader2, Search, Sparkles, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import type { ArtworkResult, Language, SongListItem } from '../../../../shared/types'
import { useLibrary } from '../../hooks/useLibrary'
import { useSettings } from '../../hooks/useSettings'
import ArtistChips from '../shared/ArtistChips'
import {
  AspectRatio,
  Button,
  Dialog,
  Field,
  IconButton,
  Input,
  Segmented,
  Select,
  Stack,
  Text
} from '../ui'

type EditView = 'details' | 'thumbnail'

const THUMB_ASPECT = 16 / 9

/** "object-fit: cover" sizing math for a natural image inside a fixed-aspect frame. */
function coverMetrics(natW: number, natH: number, frameW: number) {
  const frameH = frameW / THUMB_ASPECT
  const scale = Math.max(frameW / natW, frameH / natH)
  const dispW = natW * scale
  const dispH = natH * scale
  return {
    frameH,
    scale,
    dispW,
    dispH,
    maxX: Math.max(0, dispW - frameW),
    maxY: Math.max(0, dispH - frameH)
  }
}

const editMetaSchema = z.object({
  title: z.string().min(1),
  artists: z.array(z.string()),
  language: z.string()
})
type EditMetaValues = z.infer<typeof editMetaSchema>

interface Props {
  song: SongListItem
  onClose: () => void
}

function EditMetaDialog({ song, onClose }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const { songs } = useLibrary()
  const artistSuggestions = useMemo(
    () => [...new Set(songs.flatMap((s) => s.artists))].sort((a, b) => a.localeCompare(b)),
    [songs]
  )
  const languages = settings?.languages ?? []
  const [saving, setSaving] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanError, setCleanError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; artists: string[] } | null>(null)

  // Thumbnail state
  const [view, setView] = useState<EditView>('details')
  const [thumbVersion, setThumbVersion] = useState(song.thumbVersion)
  const [thumbQuery, setThumbQuery] = useState(
    [song.title, song.artists[0]].filter(Boolean).join(' ')
  )
  const [artworkResults, setArtworkResults] = useState<ArtworkResult[]>([])
  const [thumbSearching, setThumbSearching] = useState(false)
  const [thumbUpdating, setThumbUpdating] = useState(false)
  const [artworkError, setArtworkError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Staged thumbnail edit: nothing here is persisted until Save is clicked.
  const [pendingImage, setPendingImage] = useState<{ blobUrl: string; bytes: ArrayBuffer } | null>(
    null
  )
  const [pendingSourceUrl, setPendingSourceUrl] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [frameW, setFrameW] = useState(0)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const { control, handleSubmit, setValue, watch, formState } = useForm<EditMetaValues>({
    resolver: zodResolver(editMetaSchema),
    defaultValues: { title: song.title, artists: song.artists, language: song.language },
    mode: 'onChange'
  })

  const titleVal = watch('title')
  const artistsVal = watch('artists')

  const options = useMemo(() => {
    const opts = [...languages]
    if (!opts.some((l) => l.code === song.language) && song.language !== 'unknown')
      opts.push({ code: song.language, label: song.language })
    if (!opts.some((l) => l.code === 'unknown'))
      opts.push({ code: 'unknown', label: t('common.unknown') })
    return opts
  }, [languages, song.language, t])

  const cleanWithAi = async (): Promise<void> => {
    setCleaning(true)
    setCleanError(null)
    setPreview(null)
    try {
      const result = await window.singray.llm.cleanMeta({
        title: titleVal.trim(),
        artists: artistsVal.map((a) => a.trim()),
        youtubeTitle: song.youtubeTitle
      })
      setPreview({ title: result.title, artists: result.artists })
    } catch (err) {
      setCleanError(
        (err as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      )
    } finally {
      setCleaning(false)
    }
  }

  const applyPreview = (): void => {
    if (!preview) return
    setValue('title', preview.title)
    setValue('artists', preview.artists)
    setPreview(null)
  }

  const previewIsNoop =
    preview !== null &&
    preview.title === titleVal.trim() &&
    preview.artists.join(' ') === artistsVal.map((a) => a.trim()).join(' ')

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true)
    try {
      if (pendingImage) {
        const bytes = await cropPendingImage()
        if (bytes) {
          await window.singray.library.uploadThumb(song.id, bytes)
          setThumbVersion(Date.now())
        }
      }
      await window.singray.library.updateMeta(song.id, {
        title: data.title.trim(),
        artists: data.artists,
        language: data.language as Language
      })
      onClose()
    } finally {
      setSaving(false)
    }
  })

  const handleUploadThumb = (): void => {
    fileInputRef.current?.click()
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const bytes = await file.arrayBuffer()
    stagePendingImage(bytes)
  }

  const searchArtwork = async (): Promise<void> => {
    setThumbSearching(true)
    setArtworkResults([])
    try {
      const results = await window.singray.library.searchArtwork(thumbQuery)
      setArtworkResults(results)
    } finally {
      setThumbSearching(false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch once on mount, not on every thumbQuery edit
  useEffect(() => {
    void searchArtwork()
  }, [])

  // Revokes the previous blob URL whenever it's replaced, and on unmount.
  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.blobUrl)
    }
  }, [pendingImage])

  useEffect(() => {
    if (view !== 'thumbnail') return
    const measure = (): void => setFrameW(frameRef.current?.clientWidth ?? 0)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [view])

  const stagePendingImage = (bytes: ArrayBuffer, sourceUrl: string | null = null): void => {
    const blobUrl = URL.createObjectURL(new Blob([bytes]))
    setPendingImage({ blobUrl, bytes })
    setPendingSourceUrl(sourceUrl)
    setNaturalSize(null)
    setCropOffset({ x: 0, y: 0 })
  }

  const handlePendingImgLoad = (e: React.SyntheticEvent<HTMLImageElement>): void => {
    const img = e.currentTarget
    const w = img.naturalWidth
    const h = img.naturalHeight
    setNaturalSize({ w, h })
    const fw = frameRef.current?.clientWidth
    if (!fw) return
    const { maxX, maxY } = coverMetrics(w, h, fw)
    setCropOffset({ x: maxX / 2, y: maxY / 2 })
  }

  const onFramePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!pendingImage) return // nothing staged yet — frame click (not drag) handles upload
    dragRef.current = { x: e.clientX, y: e.clientY, ox: cropOffset.x, oy: cropOffset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onFramePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragRef.current || !naturalSize || !frameW) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    const { maxX, maxY } = coverMetrics(naturalSize.w, naturalSize.h, frameW)
    setCropOffset({
      x: Math.min(maxX, Math.max(0, dragRef.current.ox - dx)),
      y: Math.min(maxY, Math.max(0, dragRef.current.oy - dy))
    })
  }

  const onFramePointerUp = (): void => {
    dragRef.current = null
  }

  /** Renders the staged image through the current crop/pan into final JPEG bytes. */
  const cropPendingImage = async (): Promise<ArrayBuffer | null> => {
    if (!pendingImage || !naturalSize || !frameW) return null
    const { scale, frameH } = coverMetrics(naturalSize.w, naturalSize.h, frameW)
    const img = new Image()
    img.src = pendingImage.blobUrl
    if (!img.complete)
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = rej
      })
    const OUT_W = 960
    const OUT_H = Math.round(OUT_W / THUMB_ASPECT)
    const canvas = document.createElement('canvas')
    canvas.width = OUT_W
    canvas.height = OUT_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const srcScale = 1 / scale
    ctx.drawImage(
      img,
      cropOffset.x * srcScale,
      cropOffset.y * srcScale,
      frameW * srcScale,
      frameH * srcScale,
      0,
      0,
      OUT_W,
      OUT_H
    )
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', 0.92)
    )
    return blob.arrayBuffer()
  }

  const pickArtwork = async (url: string): Promise<void> => {
    setThumbUpdating(true)
    setArtworkError(null)
    try {
      const bytes = await window.singray.library.fetchArtworkBytes(url)
      stagePendingImage(bytes, url)
    } catch (err) {
      setArtworkError(
        (err as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      )
    } finally {
      setThumbUpdating(false)
    }
  }

  return (
    <Dialog label={t('editMeta.aria')} width="md" onClose={onClose}>
      <Stack direction="column" gap={6}>
        <Stack direction="column" gap={4}>
          <Stack justify="between" align="center">
            <Text as="h2" variant="title">
              {t('editMeta.title')}
            </Text>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'details', label: t('editMeta.tabDetails') },
                { value: 'thumbnail', label: t('editMeta.tabThumbnail') }
              ]}
            />
          </Stack>

          {view === 'details' && (
            <Stack direction="column" gap={3}>
              <Field label={t('common.title')}>
                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <Input
                      autoFocus
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={cleaning}
                      trailing={
                        cleaning && (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        )
                      }
                    />
                  )}
                />
              </Field>
              <Field label={t('common.artist')}>
                <Controller
                  name="artists"
                  control={control}
                  render={({ field }) => (
                    <ArtistChips
                      value={field.value}
                      onChange={field.onChange}
                      suggestions={artistSuggestions}
                      disabled={cleaning}
                    />
                  )}
                />
              </Field>
              <Field label={t('common.language')}>
                <Controller
                  name="language"
                  control={control}
                  render={({ field }) => (
                    <Select<string>
                      value={field.value}
                      onChange={field.onChange}
                      options={options.map((l) => ({ value: l.code, label: l.label }))}
                    />
                  )}
                />
              </Field>
            </Stack>
          )}

          {view === 'thumbnail' && (
            <Stack direction="column" gap={3}>
              <div
                ref={frameRef}
                onPointerDown={onFramePointerDown}
                onPointerMove={onFramePointerMove}
                onPointerUp={onFramePointerUp}
                onPointerLeave={onFramePointerUp}
                className={cx(
                  'group relative w-full touch-none select-none overflow-hidden rounded-md border border-border bg-muted',
                  pendingImage && 'cursor-grab active:cursor-grabbing'
                )}
                style={{ aspectRatio: THUMB_ASPECT }}
              >
                {pendingImage && naturalSize && frameW ? (
                  <img
                    src={pendingImage.blobUrl}
                    alt=""
                    draggable={false}
                    className="absolute select-none"
                    style={{
                      width: coverMetrics(naturalSize.w, naturalSize.h, frameW).dispW,
                      height: coverMetrics(naturalSize.w, naturalSize.h, frameW).dispH,
                      transform: `translate(${-cropOffset.x}px, ${-cropOffset.y}px)`
                    }}
                  />
                ) : (
                  <img
                    src={
                      pendingImage
                        ? pendingImage.blobUrl
                        : window.singray.audio.thumbUrl(song.id, thumbVersion || undefined)
                    }
                    alt=""
                    onLoad={pendingImage ? handlePendingImgLoad : undefined}
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                )}

                {!pendingImage && (
                  <button
                    type="button"
                    onClick={handleUploadThumb}
                    title={t('editMeta.thumbClickUpload')}
                    className="absolute inset-0 cursor-pointer"
                  >
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                      <Upload className="size-6 text-foreground" />
                    </span>
                  </button>
                )}

                {pendingImage && (
                  <IconButton
                    type="button"
                    size="xs"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleUploadThumb}
                    title={t('editMeta.thumbReplace')}
                    className="absolute right-2 bottom-2"
                  >
                    <Upload className="size-3.5" />
                  </IconButton>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />

              <Stack gap={2}>
                <Input
                  value={thumbQuery}
                  onChange={(e) => setThumbQuery(e.target.value)}
                  placeholder={t('editMeta.thumbSearchPlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void searchArtwork()
                  }}
                  className="flex-1"
                />
                <IconButton
                  onClick={searchArtwork}
                  disabled={thumbSearching}
                  title={t('editMeta.thumbSearch')}
                >
                  {thumbSearching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                </IconButton>
              </Stack>
              {thumbSearching && <Text variant="hint">{t('editMeta.thumbSearching')}</Text>}
              {!thumbSearching && artworkResults.length === 0 && thumbQuery && (
                <Text variant="hint">{t('editMeta.thumbNoResults')}</Text>
              )}
              {artworkResults.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {artworkResults.map((r) => (
                    <button
                      key={r.artworkUrl}
                      type="button"
                      title={`${r.trackName} — ${r.artistName}`}
                      onClick={() => void pickArtwork(r.artworkUrl)}
                      disabled={thumbUpdating}
                      className={cx(
                        'overflow-hidden rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50',
                        pendingSourceUrl === r.artworkUrl
                          ? 'ring-2 ring-primary'
                          : 'hover:ring-2 hover:ring-ring'
                      )}
                    >
                      <AspectRatio ratio={1}>
                        <img
                          src={r.artworkUrl}
                          alt={`${r.trackName} — ${r.artistName}`}
                          className="absolute inset-0 h-full w-full object-cover"
                          draggable={false}
                        />
                      </AspectRatio>
                    </button>
                  ))}
                </div>
              )}
              {artworkError && <Text variant="error">{artworkError}</Text>}
            </Stack>
          )}

          {view === 'details' && (cleanError || preview) && (
            <Stack direction="column" gap={2}>
              {cleanError && <Text variant="error">{cleanError}</Text>}
              {preview &&
                (previewIsNoop ? (
                  <Text variant="hint">{t('editMeta.noChanges')}</Text>
                ) : (
                  <Stack
                    direction="column"
                    gap={2}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <Text variant="hint">{t('editMeta.preview')}</Text>
                    <p className="text-sm">
                      {preview.title}
                      {preview.artists.length > 0 && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {preview.artists.join(', ')}
                        </span>
                      )}
                    </p>
                    <Stack gap={2}>
                      <Button variant="primary" size="sm" onClick={applyPreview}>
                        {t('editMeta.apply')}
                      </Button>
                      <Button size="sm" onClick={() => setPreview(null)}>
                        {t('editMeta.dismiss')}
                      </Button>
                    </Stack>
                  </Stack>
                ))}
            </Stack>
          )}
        </Stack>

        <Stack justify="between" align="center" gap={3}>
          {view === 'details' ? (
            <Button
              onClick={cleanWithAi}
              disabled={cleaning || !titleVal?.trim()}
              title={t('editMeta.cleanTip')}
            >
              {cleaning ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {t('editMeta.clean')}
            </Button>
          ) : (
            <span />
          )}
          <Stack gap={3}>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={onSubmit} disabled={!formState.isValid || saving}>
              {t('common.save')}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Dialog>
  )
}

export default EditMetaDialog
