import { useCallback, useEffect, useState } from 'react';
import { domainConfig } from '../config/domainConfig';
import { getStreakState, getTodayLocalISO } from '../utils/backlogHelpers';

const STREAK_KEY = domainConfig.streakStorageKey;

const DEFAULT_STREAK = {
  count: 0,
  lastDate: null,
  history: [],
};

function loadStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return DEFAULT_STREAK;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_STREAK;
    return {
      count: Math.max(0, Number(parsed.count) || 0),
      lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : null,
      history: Array.isArray(parsed.history) ? parsed.history.slice(-90) : [],
    };
  } catch {
    return DEFAULT_STREAK;
  }
}

export function useReadingStreak() {
  const [streakData, setStreakData] = useState(loadStreak);
  const [todayIso, setTodayIso] = useState(getTodayLocalISO);

  useEffect(() => {
    try {
      localStorage.setItem(STREAK_KEY, JSON.stringify(streakData));
    } catch {
      // Ignora erro caso quota de storage esteja indisponível
    }
  }, [streakData]);

  useEffect(() => {
    const syncDate = () => setTodayIso(getTodayLocalISO());
    window.addEventListener('focus', syncDate);
    document.addEventListener('visibilitychange', syncDate);
    return () => {
      window.removeEventListener('focus', syncDate);
      document.removeEventListener('visibilitychange', syncDate);
    };
  }, []);

  const registerToday = useCallback(() => {
    const today = getTodayLocalISO();
    setTodayIso(today);

    setStreakData((prev) => {
      const state = getStreakState(prev, today);
      if (state.loggedToday) return prev;

      const nextCount =
        state.status === 'active' || state.status === 'paused'
          ? prev.count + 1
          : 1;

      const nextHistory = Array.from(new Set([...(prev.history || []), today]))
        .sort()
        .slice(-90);

      return {
        count: nextCount,
        lastDate: today,
        history: nextHistory,
      };
    });
  }, []);

  const restoreStreakBackup = useCallback((savedStreak) => {
    if (!savedStreak || typeof savedStreak !== 'object') return;
    setStreakData({
      count: Math.max(0, Number(savedStreak.count) || 0),
      lastDate: typeof savedStreak.lastDate === 'string' ? savedStreak.lastDate : null,
      history: Array.isArray(savedStreak.history) ? savedStreak.history.slice(-90) : [],
    });
  }, []);

  const state = getStreakState(streakData, todayIso);

  return {
    streakData,
    streakCount: state.effectiveCount,
    streakStatus: state.status,
    loggedToday: state.loggedToday,
    isPaused: state.isPaused,
    history: streakData.history,
    registerToday,
    restoreStreakBackup,
  };
}
