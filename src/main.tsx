import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './lib/devSeed' // exposes window.__seedSyntheticClimbs / __clearSyntheticClimbs in dev/?test
import { ensureReminderRegistered, maybeFireDailyReminder } from './lib/notifications'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

void maybeFireDailyReminder()
void ensureReminderRegistered()
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void maybeFireDailyReminder()
})
