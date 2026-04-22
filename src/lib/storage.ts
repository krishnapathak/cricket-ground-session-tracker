import { Session } from "@/lib/types";

const STORAGE_KEY = "cricket-practice-tracker/store";

interface StoredSessionState {
  activeSessionId: string | null;
  sessions: Session[];
}

function readStore(): StoredSessionState {
  if (typeof window === "undefined") {
    return { activeSessionId: null, sessions: [] };
  }

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);

    if (!value) {
      return { activeSessionId: null, sessions: [] };
    }

    const parsed = JSON.parse(value) as StoredSessionState;

    return {
      activeSessionId: parsed.activeSessionId ?? null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { activeSessionId: null, sessions: [] };
  }
}

function writeStore(store: StoredSessionState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function sortSessions(sessions: Session[]) {
  return [...sessions].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function loadSession(): Session | null {
  const store = readStore();

  return store.sessions.find((session) => session.id === store.activeSessionId) ?? null;
}

export function loadSessionHistory(): Session[] {
  return sortSessions(readStore().sessions);
}

export function saveSession(session: Session) {
  const store = readStore();
  const sessions = store.sessions.some((entry) => entry.id === session.id)
    ? store.sessions.map((entry) => (entry.id === session.id ? session : entry))
    : [session, ...store.sessions];
  const sortedSessions = sortSessions(sessions);

  writeStore({
    activeSessionId: session.id,
    sessions: sortedSessions,
  });

  return sortedSessions;
}

export function setActiveSession(sessionId: string | null) {
  const store = readStore();

  writeStore({
    ...store,
    activeSessionId: sessionId,
  });
}

export function clearSession() {
  const store = readStore();

  writeStore({
    ...store,
    activeSessionId: null,
  });
}

export function deleteSession(sessionId: string) {
  const store = readStore();
  const sessions = sortSessions(store.sessions.filter((session) => session.id !== sessionId));

  writeStore({
    activeSessionId: store.activeSessionId === sessionId ? null : store.activeSessionId,
    sessions,
  });

  return sessions;
}
