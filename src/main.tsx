import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { prepareDurableStorage, startDurableStorageSync } from './lib/durableStore'

// In the Android app, restore the budget from durable app storage if the WebView's storage was
// cleared, before App.tsx reads any saved data (it reads at import time).
async function start() {
  await prepareDurableStorage()
  startDurableStorageSync()
  const { default: App } = await import('./App.tsx')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
