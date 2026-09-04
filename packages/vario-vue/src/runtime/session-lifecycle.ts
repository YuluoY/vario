import { ErrorCodes, VarioError } from '@variojs/core'
import type { PageSession, SessionStatus } from './page-session.js'

export function assertSessionActive(session: PageSession): void {
  if (session.status === 'disposed') {
    throw new VarioError('Session disposed', ErrorCodes.SESSION_DISPOSED)
  }
}

export function pauseSession(session: PageSession): SessionStatus {
  session.pause()
  return session.status
}

export function activateSession(session: PageSession): SessionStatus {
  session.activate()
  return session.status
}

export function deactivateSession(session: PageSession): SessionStatus {
  session.deactivate()
  return session.status
}

export function resumeSession(session: PageSession): SessionStatus {
  session.resume()
  return session.status
}

export function disposeSession(session: PageSession): SessionStatus {
  session.dispose()
  session.dispose()
  return session.status
}

export function sessionResourceCounts(session: PageSession) {
  return {
    timers: session.timers.size,
    subscriptions: session.subscriptions.length,
    executions: session.executions.size,
    memo: session.memo.stats().size,
    refs: session.renderer?.refsRegistry.size ?? 0,
    disposed: session.status === 'disposed'
  }
}
