// Force a valid ad-hoc code signature on the packaged macOS .app.
//
// We ship unsigned — no Apple Developer cert (DECISIONS.md "Code signing"), and
// the release workflow sets CSC_IDENTITY_AUTO_DISCOVERY=false so electron-builder
// skips its own signing step. That leaves the app carrying only Electron's
// default seal, which electron-builder's repackaging (asar, extra files)
// invalidates: `codesign --verify` reports "Sealed Resources=none". On Apple
// Silicon a *quarantined* download with a broken seal fails to launch with
// "Singray is damaged and can't be opened" — not the milder "unidentified
// developer" prompt (#125).
//
// Re-signing ad-hoc here produces a valid seal, so the app opens normally once
// the user clears quarantine (right-click → Open, or `xattr -dr`). This is not
// notarization — Gatekeeper still treats it as unsigned — it only makes the
// bundle structurally valid instead of "damaged".
//
// afterPack runs after the .app is assembled and before the .dmg is built, so
// the signed app is what ships. Skipped if `codesign` is unavailable (non-mac
// hosts), since a broken seal only matters when the artifact runs on macOS.
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  // Plain ad-hoc, deep: signs every nested Mach-O + framework with one identity
  // (`-`). No hardened runtime / entitlements — we don't notarize, and the
  // default ad-hoc sandbox already permits the JIT'd executable memory V8 needs.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
}
