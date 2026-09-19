import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export const NATIVE_AUTH_CALLBACK_URL = 'com.leftly.app://auth/callback'

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

export function getAuthRedirectUrl() {
  return isNativePlatform() ? NATIVE_AUTH_CALLBACK_URL : window.location.origin
}

export async function downloadTextFile(filename: string, content: string, mimeType: string) {
  if (!isNativePlatform()) {
    const blob = new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    window.URL.revokeObjectURL(url)
    return
  }

  const path = `leftly-exports/${filename}`
  const file = await Filesystem.writeFile({
    path,
    data: content,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  })

  try {
    await Share.share({
      title: filename,
      files: [file.uri],
      dialogTitle: `Save or share ${filename}`,
    })
  } finally {
    await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined)
  }
}
