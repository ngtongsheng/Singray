/**
 * record-demo.mjs — Singray demo walkthrough recorder
 * Uses Playwright to control the app + ffmpeg gdigrab for screen capture.
 *
 * Run from singray-drive dir:
 *   node record-demo.mjs [output.mp4]
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { _electron as electron } from 'playwright-core'

const ROOT = 'C:\\Users\\PC\\Projects\\singray'
const WORKTREE = 'C:\\Users\\PC\\Projects\\singray-worktrees\\docs-88-demo-video'
const OUTPUT = process.argv[2] ?? 'C:\\Users\\PC\\Desktop\\singray-demo.mp4'

mkdirSync('shots', { recursive: true })

console.log(`Recording demo → ${OUTPUT}`)

const app = await electron.launch({
  executablePath: `${ROOT}/node_modules/electron/dist/electron.exe`,
  args: [WORKTREE]
})
const win = await app.firstWindow()
win.on('console', (msg) => {
  const t = msg.text()
  if (/Content Security Policy|font|Deprecation|electron|preload/i.test(t)) return
  console.log('[app]', t)
})
await win.waitForLoadState('domcontentloaded')

await app.evaluate(({ BrowserWindow }) => {
  const [w] = BrowserWindow.getAllWindows()
  w.setSize(1280, 800)
  w.center()
  w.setAlwaysOnTop(true) // keep above terminal/browser during recording
  w.focus()
})
await win.waitForTimeout(3000)
await win.screenshot({ path: 'shots/s01-library.png' })

// ── Start ffmpeg ────────────────────────────────────────────────────────────
console.log('Starting ffmpeg…')
// Get window position after centering so we can crop to the window area
const winBounds = await app.evaluate(({ BrowserWindow }) => {
  const [w] = BrowserWindow.getAllWindows()
  return w.getBounds()
})
console.log('Window bounds:', winBounds)

// Capture full desktop (DWM composites GPU content to desktop surface → gdigrab can see it)
// Crop to the window area
const ff = spawn(
  'ffmpeg',
  [
    '-y',
    '-f',
    'gdigrab',
    '-framerate',
    '30',
    '-i',
    'desktop',
    '-vf',
    `crop=${winBounds.width}:${winBounds.height}:${winBounds.x}:${winBounds.y},scale=1280:800:flags=lanczos`,
    '-c:v',
    'libx264',
    '-crf',
    '20',
    '-preset',
    'fast',
    '-pix_fmt',
    'yuv420p',
    OUTPUT
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] }
)
ff.on('error', (e) => console.error('ffmpeg error:', e.message))
await new Promise((r) => setTimeout(r, 1200))

// ── Scene 1: Library ────────────────────────────────────────────────────────
console.log('Scene 1: Library browse')
await win.waitForTimeout(1200)
// Pan through the library list
for (let i = 0; i < 4; i++) {
  await win.mouse.wheel(0, 100)
  await win.waitForTimeout(350)
}
await win.waitForTimeout(400)
for (let i = 0; i < 4; i++) {
  await win.mouse.wheel(0, -100)
  await win.waitForTimeout(350)
}
await win.waitForTimeout(700)

// ── Scene 2: Add Song dialog ─────────────────────────────────────────────────
console.log('Scene 2: Import dialog')
// Add Song button = primary button (bg-primary) in the titlebar
// In EN mode, title text is "Add Song" but let's use class-based selector for robustness
const addBtn = win.locator('button.bg-primary').first()
if ((await addBtn.count()) > 0) {
  await addBtn.click()
  await win.waitForTimeout(2500)
  await win.screenshot({ path: 'shots/s02-import.png' })
  await win.keyboard.press('Escape')
  await win.waitForTimeout(700)
}

// ── Scene 3: Player ──────────────────────────────────────────────────────────
console.log('Scene 3: Player')
const songs = await win.evaluate(() => window.singray.library.list())
const readySong = songs.find((s) => s.ready)
console.log(`Found ${songs.length} songs, first ready: ${readySong?.title ?? 'none'}`)

if (readySong) {
  // In list view: SongRow is a div/element with role="button"
  // In grid view: SongCard with role="button" and cursor-pointer when openable
  // Click first role="button" element in the content area (not Titlebar)
  const allRoleBtns = await win.locator('[role="button"]').all()
  console.log(`role=button elements: ${allRoleBtns.length}`)

  // Find the first one with cursor-pointer (song card in grid) or just first non-titlebar one
  let songBtn = null
  for (const btn of allRoleBtns) {
    const cls = (await btn.getAttribute('class')) ?? ''
    if (cls.includes('cursor-pointer') || cls.includes('SongRow') || cls.includes('group')) {
      songBtn = btn
      break
    }
  }
  // Fallback: first role=button
  if (!songBtn && allRoleBtns.length > 0) songBtn = allRoleBtns[0]

  if (songBtn) {
    await songBtn.click()
    await win.waitForTimeout(4000)
    await win.screenshot({ path: 'shots/s03-player.png' })

    const vp = win.viewportSize() ?? { width: 1280, height: 800 }
    // Poke control bar
    await win.mouse.move(vp.width / 2, vp.height - 60)
    await win.waitForTimeout(500)
    await win.screenshot({ path: 'shots/s04-player-bar.png' })

    // Press Space to play
    await win.keyboard.press('Space')
    await win.waitForTimeout(10000)
    await win.screenshot({ path: 'shots/s05-playing.png' })

    // Poke control bar again before pausing
    await win.mouse.move(vp.width / 2, vp.height - 60)
    await win.waitForTimeout(400)
    await win.keyboard.press('Space') // pause
    await win.waitForTimeout(600)

    // ── Scene 4: Recordings via More Actions menu ─────────────────────────
    console.log('Scene 4: Recordings')
    // Poke control bar to ensure it's visible, then find More Actions button by title
    await win.mouse.move(vp.width / 2, vp.height - 60)
    await win.waitForTimeout(300)

    // In English mode, the button title is "More actions"
    // Find the button by title attribute
    const moreBtn = win.locator('button[title="More actions"]').first()
    const moreBtnCount = await moreBtn.count()
    console.log(`More actions button count: ${moreBtnCount}`)

    if (moreBtnCount > 0) {
      // Move mouse to the button first to ensure it's visible
      const moreBtnBox = await moreBtn.boundingBox()
      if (moreBtnBox) {
        await win.mouse.move(
          moreBtnBox.x + moreBtnBox.width / 2,
          moreBtnBox.y + moreBtnBox.height / 2
        )
        await win.waitForTimeout(300)
      }
      await moreBtn.click()
      await win.waitForTimeout(800)
      await win.screenshot({ path: 'shots/s06-more-menu.png' })

      // Radix DropdownMenu item → role="menuitem"
      const menuItems = await win.locator('[role="menuitem"]').all()
      console.log(`Menu items: ${menuItems.length}`)
      if (menuItems.length > 0) {
        await menuItems[0].click()
        await win.waitForTimeout(2500)
        await win.screenshot({ path: 'shots/s07-recordings.png' })
        await win.keyboard.press('Escape')
        await win.waitForTimeout(800)
      } else {
        await win.keyboard.press('Escape')
        await win.waitForTimeout(400)
      }
    } else {
      console.warn('More actions button not found in player')
      // Debug: dump all button titles
      const allBtns = await win.locator('button[title]').all()
      for (const b of allBtns) {
        console.log('  button title:', await b.getAttribute('title'))
      }
    }

    // Back to library
    await win.keyboard.press('Escape')
    await win.waitForTimeout(1500)
    await win.screenshot({ path: 'shots/s08-back-library.png' })
  }
}

// ── Final pause on library ──────────────────────────────────────────────────
await win.waitForTimeout(2000)

// Stop ffmpeg gracefully
console.log('Stopping capture…')
ff.stdin.write('q')
ff.stdin.end()
await new Promise((resolve) => {
  const t = setTimeout(() => {
    try {
      ff.kill('SIGTERM')
    } catch {}
    resolve()
  }, 6000)
  ff.on('close', () => {
    clearTimeout(t)
    resolve()
  })
})

await app.close()
console.log(`Done → ${OUTPUT}`)
