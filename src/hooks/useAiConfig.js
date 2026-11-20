import { useCallback, useState } from 'react';
import {
  clearAiKeyForProvider,
  getActiveExternalProviderInfo,
  loadAiKeys,
  loadAiPreferences,
  saveAiKeyForProvider,
  saveAiPreferences,
} from '../services/aiProvider';
import {
  loadGoogleBooksApiKey,
  saveGoogleBooksApiKey,
} from '../services/mediaApi';

export function useAiConfig() {
  const [keys, setKeys] = useState(() => ({
    ...loadAiKeys(),
    googleBooks: loadGoogleBooksApiKey(),
  }));
  const [preferences, setPreferences] = useState(loadAiPreferences);

  const saveProviderKey = useCallback((providerId, rawKey) => {
    if (providerId === 'googleBooks') {
      const clean = saveGoogleBooksApiKey(rawKey);
      setKeys((prev) => ({ ...prev, googleBooks: clean }));
      return clean;
    }
    const clean = saveAiKeyForProvider(providerId, rawKey);
    setKeys((prev) => ({ ...prev, [providerId]: clean }));
    return clean;
  }, []);

  const clearProviderKey = useCallback((providerId) => {
    if (providerId === 'googleBooks') {
      saveGoogleBooksApiKey('');
      setKeys((prev) => ({ ...prev, googleBooks: '' }));
      return;
    }
    clearAiKeyForProvider(providerId);
    setKeys((prev) => ({ ...prev, [providerId]: '' }));
  }, []);

  const updatePreferences = useCallback((nextPrefs) => {
    const saved = saveAiPreferences(nextPrefs);
    setPreferences(saved);
    return saved;
  }, []);

  const hasAnyAiKey = Boolean(keys.gemini || keys.groq || keys.openrouter);
  const activeProvider = getActiveExternalProviderInfo(keys, preferences);

  return {
    keys,
    preferences,
    hasAnyAiKey,
    hasGeminiKey: Boolean(keys.gemini),
    geminiKey: keys.gemini,
    activeProvider,
    saveProviderKey,
    clearProviderKey,
    updatePreferences,
  };
}
