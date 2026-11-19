import { buildPublicProfileLink, domainConfig } from '../config/domainConfig.js';
import { createUuid } from './codiceDatabase.js';

const REQUEST_TIMEOUT_MS = 8000;
const IDB_NAME = 'codice_multiuser_db_v1';
const IDB_VERSION = 1;

const STORAGE_KEYS = {
  supabaseUrl: 'codice_supabase_url',
  supabaseKey: 'codice_supabase_anon_key',
  envUrl: 'VITE_SUPABASE_URL',
  envKey: 'VITE_SUPABASE_ANON_KEY',
  supabaseSession: 'codice_supabase_session_v1',
  forceLocal: 'codice_backend_force_local',
};

export const PRIVACY_LEVELS = [
  {
    id: 'public',
    label: 'Público',
    description: 'Qualquer leitor no Códice pode ver seu perfil e estante.',
  },
  {
    id: 'followers',
    label: 'Apenas Seguidores',
    description: 'Somente quem segue você acompanha suas atividades.',
  },
  {
    id: 'private',
    label: 'Privado',
    description: 'Modo arquivo pessoal: visível apenas para você.',
  },
];

export class BackendError extends Error {
  constructor(message, { code = 'BACKEND_ERROR', status = 0, userMessage } = {}) {
    super(message || userMessage || 'Erro ao comunicar com o backend.');
    this.name = 'BackendError';
    this.code = code;
    this.status = status;
    this.userMessage = userMessage || this.message;
  }
}

export function normalizePrivacyLevel(value) {
  if (value === 'followers' || value === 'private' || value === 'public') {
    return value;
  }
  return 'public';
}

export function normalizeHandle(rawHandle, fallbackSeed = 'leitor') {
  const cleanedRaw = String(rawHandle || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_.-]/g, '');

  const base =
    cleanedRaw.length >= 2
      ? cleanedRaw
      : String(fallbackSeed || 'leitor')
          .toLowerCase()
          .replace(/[^a-z0-9_.-]/g, '') || 'leitor';

  return `@${base.slice(0, 32)}`;
}

function buildInitials(displayName, fallback = 'LC') {
  const words = String(displayName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  const clean = String(displayName || fallback).trim();
  return (clean.slice(0, 2) || fallback).toUpperCase();
}

export function normalizeFrontendProfile(rawProfile = {}) {
  const defaults = domainConfig.ui.profile;
  const handle = normalizeHandle(
    rawProfile.handle || defaults.handle,
    rawProfile.displayName || rawProfile.display_name || 'leitor'
  );
  const displayName =
    String(
      rawProfile.displayName ??
        rawProfile.display_name ??
        handle.replace(/^@/, '') ??
        defaults.displayName
    ).trim() || defaults.displayName;
  const publicLink = buildPublicProfileLink(handle);

  const rawLinkLabel = rawProfile.linkLabel ?? rawProfile.link_label;
  const rawLinkUrl = rawProfile.linkUrl ?? rawProfile.link_url;

  return {
    id: rawProfile.id || createUuid(),
    email: typeof rawProfile.email === 'string' ? rawProfile.email.trim().toLowerCase() : '',
    handle,
    displayName,
    avatarInitials:
      rawProfile.avatarInitials ??
      rawProfile.avatar_initials ??
      buildInitials(displayName, defaults.avatarInitials),
    avatarUrl: rawProfile.avatarUrl ?? rawProfile.avatar_url ?? '',
    coverUrl: rawProfile.coverUrl ?? rawProfile.banner_url ?? '',
    bio: rawProfile.bio !== undefined ? String(rawProfile.bio) : '',
    linkLabel: rawLinkLabel || publicLink.label,
    linkUrl: rawLinkUrl || publicLink.url,
    age: rawProfile.age || '',
    readerFocus: rawProfile.readerFocus ?? rawProfile.reader_focus ?? 'Leitor Casual',
    annualGoal: Math.max(
      1,
      Number(rawProfile.annualGoal ?? rawProfile.annual_goal) || 12
    ),
    preferredFormat:
      rawProfile.preferredFormat ?? rawProfile.preferred_format ?? 'Livro Físico',
    preferredCriterion:
      rawProfile.preferredCriterion ?? rawProfile.preferred_criterion ?? 'Enredo e Ritmo',
    preferredAtmosphere:
      rawProfile.preferredAtmosphere ?? rawProfile.preferred_atmosphere ?? 'Tinta OLED',
    favoriteGenres: Array.isArray(rawProfile.favoriteGenres ?? rawProfile.favorite_genres)
      ? rawProfile.favoriteGenres ?? rawProfile.favorite_genres
      : [],
    privacyLevel: normalizePrivacyLevel(
      rawProfile.privacyLevel ?? rawProfile.privacy_level
    ),
    allowWallPosts:
      (rawProfile.allowWallPosts ?? rawProfile.allow_wall_posts) !== undefined
        ? Boolean(rawProfile.allowWallPosts ?? rawProfile.allow_wall_posts)
        : true,
    allowComments:
      (rawProfile.allowComments ?? rawProfile.allow_comments) !== undefined
        ? Boolean(rawProfile.allowComments ?? rawProfile.allow_comments)
        : true,
    allowDms:
      (rawProfile.allowDms ?? rawProfile.allow_dms) !== undefined
        ? Boolean(rawProfile.allowDms ?? rawProfile.allow_dms)
        : true,
    gamificationEnabled:
      (rawProfile.gamificationEnabled ?? rawProfile.gamification_enabled) !== undefined
        ? Boolean(rawProfile.gamificationEnabled ?? rawProfile.gamification_enabled)
        : true,
    activeTitleBadge:
      typeof (rawProfile.activeTitleBadge ?? rawProfile.active_title_badge) === 'string'
        ? rawProfile.activeTitleBadge ?? rawProfile.active_title_badge
        : '',
    onboardingCompleted:
      (rawProfile.onboardingCompleted ?? rawProfile.onboarding_completed) !== undefined
        ? Boolean(rawProfile.onboardingCompleted ?? rawProfile.onboarding_completed)
        : true,
    isLocalOnly: rawProfile.isLocalOnly !== undefined ? Boolean(rawProfile.isLocalOnly) : true,
    createdAt: rawProfile.createdAt ?? rawProfile.created_at ?? new Date().toISOString(),
    updatedAt: rawProfile.updatedAt ?? rawProfile.updated_at ?? new Date().toISOString(),
  };
}

export function toSqlProfileRow(profile = {}) {
  const norm = normalizeFrontendProfile(profile);
  return {
    id: norm.id,
    handle: norm.handle,
    display_name: norm.displayName,
    bio: norm.bio,
    avatar_url: norm.avatarUrl,
    banner_url: norm.coverUrl,
    privacy_level: norm.privacyLevel,
    allow_wall_posts: norm.allowWallPosts,
    allow_comments: norm.allowComments,
    allow_dms: norm.allowDms,
    gamification_enabled: norm.gamificationEnabled,
    active_title_badge: norm.activeTitleBadge,
    annual_goal: norm.annualGoal,
    avatar_initials: norm.avatarInitials,
    link_label: norm.linkLabel,
    link_url: norm.linkUrl,
    reader_focus: norm.readerFocus,
    preferred_format: norm.preferredFormat,
    preferred_criterion: norm.preferredCriterion,
    preferred_atmosphere: norm.preferredAtmosphere,
    favorite_genres: norm.favoriteGenres,
    onboarding_completed: norm.onboardingCompleted,
  };
}

export function fromSqlProfileRow(row = {}, extra = {}) {
  return normalizeFrontendProfile({
    ...row,
    ...extra,
    isLocalOnly: false,
  });
}

export function canInteractWithProfile(
  targetProfile = {},
  { viewerId = null, isFollower = false } = {}
) {
  const targetId = targetProfile?.id || null;
  const isOwner = Boolean(viewerId && targetId && viewerId === targetId);
  const privacy = normalizePrivacyLevel(
    targetProfile?.privacyLevel ?? targetProfile?.privacy_level
  );
  const allowWall =
    (targetProfile?.allowWallPosts ?? targetProfile?.allow_wall_posts) !== false;
  const allowComments =
    (targetProfile?.allowComments ?? targetProfile?.allow_comments) !== false;
  const allowDms =
    (targetProfile?.allowDms ?? targetProfile?.allow_dms) !== false;

  const canView =
    isOwner ||
    privacy === 'public' ||
    (privacy === 'followers' && Boolean(isFollower));

  return {
    isOwner,
    privacyLevel: privacy,
    canView,
    canFollow: !isOwner && privacy !== 'private',
    canPostWall: isOwner || (canView && allowWall),
    canComment: isOwner || (canView && allowComments),
    canSendDm: !isOwner && canView && allowDms,
  };
}

function readEnvValue(key) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return String(import.meta.env[key]).trim();
    }
  } catch {
    // Ambiente sem import.meta.env
  }
  try {
    if (typeof globalThis !== 'undefined' && globalThis.process?.env?.[key]) {
      return String(globalThis.process.env[key]).trim();
    }
  } catch {
    // Sem process.env
  }
  return '';
}

function readLocalStorageValue(key) {
  try {
    if (typeof localStorage === 'undefined') return '';
    return String(localStorage.getItem(key) || '').trim();
  } catch {
    return '';
  }
}

function writeLocalStorageValue(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null || value === undefined || value === '') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, String(value));
    }
  } catch {
    // Ignora storage indisponível
  }
}

function validateHttpUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function getSupabaseConfig() {
  const envUrl = validateHttpUrl(readEnvValue('VITE_SUPABASE_URL'));
  const envKey = readEnvValue('VITE_SUPABASE_ANON_KEY');

  const lsUrl = validateHttpUrl(
    readLocalStorageValue(STORAGE_KEYS.envUrl) ||
      readLocalStorageValue(STORAGE_KEYS.supabaseUrl)
  );
  const lsKey =
    readLocalStorageValue(STORAGE_KEYS.envKey) ||
    readLocalStorageValue(STORAGE_KEYS.supabaseKey);

  const url = envUrl || lsUrl;
  const anonKey = envKey || lsKey;
  const configured = Boolean(url && anonKey);
  const source = envUrl && envKey ? 'env' : lsUrl && lsKey ? 'localStorage' : 'none';

  return {
    configured,
    url,
    anonKey,
    source,
  };
}

export function isSupabaseConfigured() {
  return getSupabaseConfig().configured;
}

export function saveSupabaseConfig({ url, anonKey }) {
  const validUrl = validateHttpUrl(url);
  const cleanKey = String(anonKey || '').trim();
  if (!validUrl) {
    throw new BackendError('URL do Supabase inválida.', {
      code: 'INVALID_SUPABASE_URL',
      userMessage: 'Informe uma URL válida do projeto Supabase (ex.: https://xyz.supabase.co).',
    });
  }
  if (cleanKey.length < 16) {
    throw new BackendError('Chave anon inválida.', {
      code: 'INVALID_SUPABASE_KEY',
      userMessage: 'Informe uma VITE_SUPABASE_ANON_KEY válida.',
    });
  }
  writeLocalStorageValue(STORAGE_KEYS.supabaseUrl, validUrl);
  writeLocalStorageValue(STORAGE_KEYS.supabaseKey, cleanKey);
  writeLocalStorageValue(STORAGE_KEYS.forceLocal, '');
  return getSupabaseConfig();
}

export function clearSupabaseConfig() {
  writeLocalStorageValue(STORAGE_KEYS.supabaseUrl, '');
  writeLocalStorageValue(STORAGE_KEYS.supabaseKey, '');
  writeLocalStorageValue(STORAGE_KEYS.envUrl, '');
  writeLocalStorageValue(STORAGE_KEYS.envKey, '');
  writeLocalStorageValue(STORAGE_KEYS.supabaseSession, '');
}

export function isForceLocalMode() {
  return readLocalStorageValue(STORAGE_KEYS.forceLocal) === 'true';
}

export function setForceLocalMode(forceLocal) {
  writeLocalStorageValue(STORAGE_KEYS.forceLocal, forceLocal ? 'true' : '');
}

export function getBackendMode() {
  const cfg = getSupabaseConfig();
  if (cfg.configured && !isForceLocalMode()) {
    return 'supabase';
  }
  return 'local';
}

// ----------------------------------------------------------------------------
// Hash local com sal por conta (SHA-256 via WebCrypto + fallback determinístico)
// ----------------------------------------------------------------------------
function generateSaltHex(lengthBytes = 16) {
  try {
    if (globalThis.crypto?.getRandomValues) {
      const buf = new Uint8Array(lengthBytes);
      globalThis.crypto.getRandomValues(buf);
      return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fallback
  }
  let out = '';
  for (let i = 0; i < lengthBytes * 2; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

async function computeSaltedHash(password, saltHex) {
  const rawInput = `${saltHex}:${String(password || '')}`;
  try {
    if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
      const encoded = new TextEncoder().encode(rawInput);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
      const hashHex = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, '0')
      ).join('');
      return `${saltHex}:${hashHex}`;
    }
  } catch {
    // Fallback em ambientes sem SubtleCrypto
  }

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < rawInput.length; i += 1) {
    const c = rawInput.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return `${saltHex}:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

async function createPasswordRecord(password) {
  const saltHex = generateSaltHex(16);
  return computeSaltedHash(password, saltHex);
}

async function verifyPasswordRecord(password, storedHash) {
  if (!storedHash || !String(storedHash).includes(':')) return false;
  const [saltHex] = String(storedHash).split(':');
  const candidate = await computeSaltedHash(password, saltHex);
  return candidate === storedHash;
}

// ----------------------------------------------------------------------------
// Camada IndexedDB + Fallback automático em Memória (Node / Private Mode)
// ----------------------------------------------------------------------------
const STORE_NAMES = ['accounts', 'profiles', 'workspaces', 'meta'];

const memoryTables = {
  accounts: new Map(),
  profiles: new Map(),
  workspaces: new Map(),
  meta: new Map(),
};

export function resetBackendMemoryForTests() {
  STORE_NAMES.forEach((store) => {
    memoryTables[store].clear();
  });
  writeLocalStorageValue(STORAGE_KEYS.supabaseSession, '');
  writeLocalStorageValue(STORAGE_KEYS.forceLocal, '');
}

let dbPromiseCache = null;

function openIndexedDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromiseCache) {
    return dbPromiseCache;
  }
  dbPromiseCache = new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('accounts')) {
          db.createObjectStore('accounts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('workspaces')) {
          db.createObjectStore('workspaces', { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = () => {
        dbPromiseCache = null;
        resolve(null);
      };
    } catch {
      dbPromiseCache = null;
      resolve(null);
    }
  });
  return dbPromiseCache;
}

async function storeGet(storeName, key) {
  if (!key) return null;
  const db = await openIndexedDb();
  if (!db) {
    const val = memoryTables[storeName].get(String(key));
    return val ? structuredCloneSafe(val) : null;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function storeGetAll(storeName) {
  const db = await openIndexedDb();
  if (!db) {
    return Array.from(memoryTables[storeName].values()).map(structuredCloneSafe);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
    req.onerror = () => reject(req.error);
  });
}

async function storePut(storeName, record) {
  const keyField =
    storeName === 'workspaces' ? 'userId' : storeName === 'meta' ? 'key' : 'id';
  const db = await openIndexedDb();
  if (!db) {
    memoryTables[storeName].set(String(record[keyField]), structuredCloneSafe(record));
    return record;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

function structuredCloneSafe(value) {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

async function getActiveMetaSession() {
  const metaRow = await storeGet('meta', 'active_local_session');
  return metaRow?.value || null;
}

async function setActiveMetaSession(sessionValue) {
  await storePut('meta', {
    key: 'active_local_session',
    value: sessionValue || null,
  });
}

async function saveLocalWorkspace(userId, workspace = {}) {
  if (!userId) return;
  const nowIso = new Date().toISOString();
  if (workspace.profile) {
    const existingProfile = await storeGet('profiles', userId);
    const mergedProfile = normalizeFrontendProfile({
      ...existingProfile,
      ...workspace.profile,
      id: userId,
      updatedAt: nowIso,
    });
    await storePut('profiles', mergedProfile);
  }

  const existingWs = await storeGet('workspaces', userId);
  await storePut('workspaces', {
    userId,
    items: Array.isArray(workspace.items)
      ? workspace.items
      : existingWs?.items || [],
    posts: Array.isArray(workspace.posts)
      ? workspace.posts
      : existingWs?.posts || [],
    streak:
      workspace.streak && typeof workspace.streak === 'object'
        ? workspace.streak
        : existingWs?.streak || { count: 0, lastDate: null, history: [] },
    readingSessions: Array.isArray(workspace.readingSessions)
      ? workspace.readingSessions
      : existingWs?.readingSessions || [],
    updatedAt: nowIso,
  });
}

async function loadLocalWorkspace(userId) {
  const ws = await storeGet('workspaces', userId);
  return {
    items: Array.isArray(ws?.items) ? ws.items : [],
    posts: Array.isArray(ws?.posts) ? ws.posts : [],
    streak: ws?.streak || { count: 0, lastDate: null, history: [] },
    readingSessions: Array.isArray(ws?.readingSessions) ? ws.readingSessions : [],
  };
}

// ----------------------------------------------------------------------------
// Cliente Supabase REST / Auth via fetch nativo (zero dependência obrigatória)
// ----------------------------------------------------------------------------
function loadStoredSupabaseSession() {
  const raw = readLocalStorageValue(STORAGE_KEYS.supabaseSession);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.access_token ? parsed : null;
  } catch {
    return null;
  }
}

function saveStoredSupabaseSession(session) {
  if (!session) {
    writeLocalStorageValue(STORAGE_KEYS.supabaseSession, '');
    return;
  }
  const normalized = {
    access_token: session.access_token,
    refresh_token: session.refresh_token || '',
    expires_at:
      session.expires_at ||
      (session.expires_in
        ? Math.floor(Date.now() / 1000) + Number(session.expires_in)
        : Math.floor(Date.now() / 1000) + 3600),
    user: session.user || null,
  };
  writeLocalStorageValue(STORAGE_KEYS.supabaseSession, JSON.stringify(normalized));
  return normalized;
}

function mapSupabaseHttpError(status, payload, fallbackMessage) {
  const rawMsg = String(
    payload?.error_description || payload?.msg || payload?.message || payload?.error || ''
  );
  const lower = rawMsg.toLowerCase();

  if (status === 400 || status === 422) {
    if (lower.includes('invalid login credentials') || lower.includes('invalid_grant')) {
      return new BackendError(rawMsg, {
        code: 'INVALID_CREDENTIALS',
        status,
        userMessage: 'E-mail ou senha incorretos.',
      });
    }
    if (lower.includes('already registered') || lower.includes('already exists')) {
      return new BackendError(rawMsg, {
        code: 'EMAIL_TAKEN',
        status,
        userMessage: 'Este e-mail já está cadastrado.',
      });
    }
    if (lower.includes('password')) {
      return new BackendError(rawMsg, {
        code: 'WEAK_PASSWORD',
        status,
        userMessage: 'A senha precisa ter pelo menos 6 caracteres.',
      });
    }
    if (lower.includes('email not confirmed')) {
      return new BackendError(rawMsg, {
        code: 'EMAIL_NOT_CONFIRMED',
        status,
        userMessage: 'Confirme seu e-mail antes de entrar.',
      });
    }
  }
  if (status === 401 || status === 403) {
    return new BackendError(rawMsg, {
      code: 'UNAUTHORIZED',
      status,
      userMessage: 'Sessão expirada ou sem permissão. Entre novamente.',
    });
  }
  if (status === 409) {
    return new BackendError(rawMsg, {
      code: 'CONFLICT',
      status,
      userMessage: 'Este @handle já está em uso por outro leitor.',
    });
  }
  if (status === 429) {
    return new BackendError(rawMsg, {
      code: 'RATE_LIMITED',
      status,
      userMessage: 'Muitas tentativas seguidas. Aguarde alguns instantes e tente de novo.',
    });
  }
  return new BackendError(rawMsg || fallbackMessage, {
    code: 'REMOTE_ERROR',
    status,
    userMessage: fallbackMessage || 'Não foi possível concluir a operação no servidor.',
  });
}

async function supabaseFetchJson(path, { method = 'GET', body, token, extraHeaders = {} } = {}) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) {
    throw new BackendError('Supabase não configurado.', {
      code: 'SUPABASE_NOT_CONFIGURED',
      userMessage: 'Servidor Supabase não configurado neste ambiente.',
    });
  }

  const endpoint = new URL(path.replace(/^\/+/, ''), `${cfg.url}/`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token || cfg.anonKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    const response = await fetch(endpoint.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      throw mapSupabaseHttpError(
        response.status,
        payload,
        'Erro ao comunicar com o Supabase.'
      );
    }

    return payload;
  } catch (err) {
    if (err instanceof BackendError) throw err;
    if (err?.name === 'AbortError') {
      throw new BackendError('Timeout na conexão com Supabase.', {
        code: 'TIMEOUT',
        userMessage: 'O servidor demorou para responder (8s). Tente novamente ou continue em Modo Local.',
      });
    }
    throw new BackendError(err?.message || 'Erro de rede', {
      code: 'NETWORK_ERROR',
      userMessage: 'Sem conexão com o servidor. Verifique sua internet ou continue em Modo Local.',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function ensureFreshSupabaseSession() {
  const session = loadStoredSupabaseSession();
  if (!session) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (!session.expires_at || session.expires_at - 60 > nowSec) {
    return session;
  }
  if (!session.refresh_token) {
    saveStoredSupabaseSession(null);
    return null;
  }

  try {
    const refreshed = await supabaseFetchJson('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: session.refresh_token },
    });
    if (refreshed?.access_token) {
      return saveStoredSupabaseSession(refreshed);
    }
  } catch {
    saveStoredSupabaseSession(null);
  }
  return null;
}

async function fetchRemoteProfileById(userId, accessToken) {
  const params = new URLSearchParams({
    id: `eq.${userId}`,
    select: '*',
  });
  const rows = await supabaseFetchJson(`/rest/v1/profiles?${params.toString()}`, {
    method: 'GET',
    token: accessToken,
  });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function upsertRemoteProfile(profile, accessToken) {
  const sqlRow = toSqlProfileRow(profile);
  const rows = await supabaseFetchJson('/rest/v1/profiles', {
    method: 'POST',
    token: accessToken,
    body: sqlRow,
    extraHeaders: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
  });
  return Array.isArray(rows) && rows[0] ? rows[0] : sqlRow;
}

// ----------------------------------------------------------------------------
// API Pública Unificada do Backend Híbrido
// ----------------------------------------------------------------------------
export async function listLocalProfiles() {
  const [profiles, accounts, workspaces, activeMeta] = await Promise.all([
    storeGetAll('profiles'),
    storeGetAll('accounts'),
    storeGetAll('workspaces'),
    getActiveMetaSession(),
  ]);

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const wsById = new Map(workspaces.map((w) => [w.userId, w]));
  const activeId = activeMeta?.userId || null;

  return profiles
    .map((prof) => {
      const account = accountById.get(prof.id);
      const ws = wsById.get(prof.id);
      return {
        id: prof.id,
        handle: prof.handle,
        displayName: prof.displayName,
        avatarInitials: prof.avatarInitials,
        avatarUrl: prof.avatarUrl || '',
        email: account?.email || prof.email || '',
        privacyLevel: normalizePrivacyLevel(prof.privacyLevel),
        gamificationEnabled: prof.gamificationEnabled !== false,
        activeTitleBadge: prof.activeTitleBadge || '',
        workCount: Array.isArray(ws?.items) ? ws.items.length : 0,
        isActive: prof.id === activeId,
        hasPassword: Boolean(account?.passwordHash),
        updatedAt: prof.updatedAt || prof.createdAt || '',
      };
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
}

export async function bootstrapBackend({
  profile = null,
  items = [],
  posts = [],
  streak = null,
  readingSessions = [],
} = {}) {
  const mode = getBackendMode();

  if (mode === 'supabase') {
    const session = await ensureFreshSupabaseSession();
    if (session?.user?.id) {
      try {
        const remoteRow = await fetchRemoteProfileById(
          session.user.id,
          session.access_token
        );
        if (remoteRow) {
          const syncedProfile = fromSqlProfileRow(remoteRow, {
            email: session.user.email || '',
          });
          await saveLocalWorkspace(syncedProfile.id, {
            profile: syncedProfile,
            items,
            posts,
            streak,
            readingSessions,
          });
          return {
            mode: 'supabase',
            authenticated: true,
            user: {
              id: session.user.id,
              email: session.user.email || '',
              mode: 'supabase',
            },
            profile: syncedProfile,
          };
        }
      } catch {
        // Fallback gracioso offline se o servidor falhar na inicialização
      }
    }
  }

  // Motor Local Multiusuário no IndexedDB
  const existingAccounts = await storeGetAll('accounts');
  const existingMeta = await getActiveMetaSession();

  if (existingAccounts.length === 0) {
    const initialId =
      profile?.id && profile.id !== 'local-primary' ? profile.id : createUuid();
    const normProfile = normalizeFrontendProfile({
      ...profile,
      id: initialId,
      isLocalOnly: true,
      onboardingCompleted:
        profile?.onboardingCompleted !== undefined
          ? Boolean(profile.onboardingCompleted)
          : false,
    });
    const nowIso = new Date().toISOString();

    await storePut('accounts', {
      id: initialId,
      email: normProfile.email || '',
      handle: normProfile.handle,
      passwordHash: null,
      isLocalOnly: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await saveLocalWorkspace(initialId, {
      profile: normProfile,
      items,
      posts,
      streak,
      readingSessions,
    });
    await setActiveMetaSession({
      userId: initialId,
      mode: 'local',
      loggedInAt: nowIso,
    });

    return {
      mode: 'local',
      authenticated: true,
      user: {
        id: initialId,
        email: normProfile.email || '',
        handle: normProfile.handle,
        mode: 'local',
      },
      profile: normProfile,
    };
  }

  const activeId = existingMeta?.signedOut
    ? null
    : existingMeta?.userId || existingAccounts[0]?.id || null;
  const activeProfile = activeId ? await storeGet('profiles', activeId) : null;
  if (activeProfile) {
    return {
      mode: 'local',
      authenticated: true,
      user: {
        id: activeProfile.id,
        email: activeProfile.email || '',
        handle: activeProfile.handle,
        mode: 'local',
      },
      profile: activeProfile,
    };
  }

  return {
    mode: 'local',
    authenticated: false,
    user: null,
    profile: null,
  };
}

export async function getCurrentBackendSession() {
  const mode = getBackendMode();
  if (mode === 'supabase') {
    const session = await ensureFreshSupabaseSession();
    if (session?.user?.id) {
      const localMirror = await storeGet('profiles', session.user.id);
      return {
        mode: 'supabase',
        authenticated: true,
        user: {
          id: session.user.id,
          email: session.user.email || '',
          mode: 'supabase',
        },
        profile: localMirror || null,
      };
    }
    return {
      mode: 'supabase',
      authenticated: false,
      user: null,
      profile: null,
    };
  }

  const activeMeta = await getActiveMetaSession();
  if (!activeMeta?.userId) {
    return { mode: 'local', authenticated: false, user: null, profile: null };
  }
  const prof = await storeGet('profiles', activeMeta.userId);
  const acc = await storeGet('accounts', activeMeta.userId);
  if (!prof || !acc) {
    return { mode: 'local', authenticated: false, user: null, profile: null };
  }
  return {
    mode: 'local',
    authenticated: true,
    user: {
      id: acc.id,
      email: acc.email || '',
      handle: prof.handle,
      mode: 'local',
    },
    profile: prof,
  };
}

function validateSignUpFields({ email, password, handle, displayName }) {
  const cleanName = String(displayName || '').trim();
  if (cleanName.length < 2) {
    throw new BackendError('Nome curto.', {
      code: 'INVALID_DISPLAY_NAME',
      userMessage: 'Informe um nome com pelo menos 2 caracteres.',
    });
  }

  const rawHandleClean = String(handle || '').trim().replace(/^@+/, '');
  if (rawHandleClean.length < 2) {
    throw new BackendError('Handle curto.', {
      code: 'INVALID_HANDLE',
      userMessage: 'Escolha um @handle com pelo menos 2 caracteres (letras ou números).',
    });
  }
  const normalizedHandle = normalizeHandle(rawHandleClean, cleanName);

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new BackendError('E-mail inválido.', {
      code: 'INVALID_EMAIL',
      userMessage: 'Digite um endereço de e-mail válido.',
    });
  }

  const cleanPassword = String(password || '');
  if (cleanPassword.length < 6) {
    throw new BackendError('Senha curta.', {
      code: 'WEAK_PASSWORD',
      userMessage: 'A senha precisa ter pelo menos 6 caracteres.',
    });
  }

  return {
    displayName: cleanName,
    handle: normalizedHandle,
    email: cleanEmail,
    password: cleanPassword,
  };
}

export async function signUpAccount({
  email,
  password,
  handle,
  displayName,
  currentWorkspace = null,
}) {
  const valid = validateSignUpFields({ email, password, handle, displayName });
  const mode = getBackendMode();

  if (mode === 'supabase') {
    const authRes = await supabaseFetchJson('/auth/v1/signup', {
      method: 'POST',
      body: {
        email: valid.email,
        password: valid.password,
        data: {
          handle: valid.handle,
          display_name: valid.displayName,
        },
      },
    });

    const authUser = authRes?.user || null;
    const accessToken = authRes?.access_token || authRes?.session?.access_token || '';
    const sessionObj = accessToken
      ? saveStoredSupabaseSession(authRes.session || authRes)
      : null;

    const baseProfile = normalizeFrontendProfile({
      id: authUser?.id || createUuid(),
      email: valid.email,
      handle: valid.handle,
      displayName: valid.displayName,
      onboardingCompleted: true,
      isLocalOnly: false,
    });

    let syncedProfile = baseProfile;
    if (sessionObj?.access_token && authUser?.id) {
      try {
        const remoteRow = await upsertRemoteProfile(
          baseProfile,
          sessionObj.access_token
        );
        syncedProfile = fromSqlProfileRow(remoteRow, { email: valid.email });
      } catch {
        // Trigger handle_new_user já provisiona o perfil base no Supabase
      }
      await saveLocalWorkspace(syncedProfile.id, {
        profile: syncedProfile,
        items: [],
        posts: [],
        streak: { count: 0, lastDate: null, history: [] },
        readingSessions: [],
      });
    }

    return {
      mode: 'supabase',
      authenticated: Boolean(sessionObj && authUser),
      requiresEmailConfirmation: !sessionObj,
      user: authUser
        ? { id: authUser.id, email: valid.email, mode: 'supabase' }
        : null,
      profile: syncedProfile,
      workspace: {
        items: [],
        posts: [],
        streak: { count: 0, lastDate: null, history: [] },
        readingSessions: [],
      },
    };
  }

  // Motor Local Multiusuário no IndexedDB
  const [accounts, profiles, activeMeta] = await Promise.all([
    storeGetAll('accounts'),
    storeGetAll('profiles'),
    getActiveMetaSession(),
  ]);

  if (accounts.some((acc) => acc.email && acc.email.toLowerCase() === valid.email)) {
    throw new BackendError('E-mail já cadastrado.', {
      code: 'EMAIL_TAKEN',
      userMessage: 'Já existe um perfil local cadastrado com este e-mail.',
    });
  }
  if (
    profiles.some(
      (prof) => String(prof.handle || '').toLowerCase() === valid.handle.toLowerCase()
    )
  ) {
    throw new BackendError('Handle em uso.', {
      code: 'HANDLE_TAKEN',
      userMessage: `O identificador ${valid.handle} já está em uso neste dispositivo.`,
    });
  }

  if (activeMeta?.userId && currentWorkspace) {
    await saveLocalWorkspace(activeMeta.userId, currentWorkspace);
  }

  const userId = createUuid();
  const nowIso = new Date().toISOString();
  const passwordHash = await createPasswordRecord(valid.password);

  const newProfile = normalizeFrontendProfile({
    id: userId,
    email: valid.email,
    handle: valid.handle,
    displayName: valid.displayName,
    onboardingCompleted: true,
    isLocalOnly: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  await storePut('accounts', {
    id: userId,
    email: valid.email,
    handle: valid.handle,
    passwordHash,
    isLocalOnly: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const emptyWorkspace = {
    items: [],
    posts: [],
    streak: { count: 0, lastDate: null, history: [] },
    readingSessions: [],
  };

  await saveLocalWorkspace(userId, {
    profile: newProfile,
    ...emptyWorkspace,
  });

  await setActiveMetaSession({
    userId,
    mode: 'local',
    loggedInAt: nowIso,
  });

  return {
    mode: 'local',
    authenticated: true,
    requiresEmailConfirmation: false,
    user: {
      id: userId,
      email: valid.email,
      handle: valid.handle,
      mode: 'local',
    },
    profile: newProfile,
    workspace: emptyWorkspace,
  };
}

export async function signInAccount({
  identifier,
  email,
  password,
  currentWorkspace = null,
}) {
  const loginId = String(identifier ?? email ?? '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!loginId) {
    throw new BackendError('Identificador ausente.', {
      code: 'MISSING_IDENTIFIER',
      userMessage: 'Informe seu e-mail ou @handle para entrar.',
    });
  }

  const mode = getBackendMode();

  if (mode === 'supabase') {
    if (!loginId.includes('@') || loginId.startsWith('@')) {
      throw new BackendError('Login Supabase requer e-mail.', {
        code: 'EMAIL_REQUIRED',
        userMessage: 'No modo Supabase, entre usando seu endereço de e-mail completo.',
      });
    }
    if (!cleanPassword) {
      throw new BackendError('Senha ausente.', {
        code: 'MISSING_PASSWORD',
        userMessage: 'Informe sua senha para entrar.',
      });
    }

    const tokenRes = await supabaseFetchJson(
      '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        body: {
          email: loginId,
          password: cleanPassword,
        },
      }
    );

    const sessionObj = saveStoredSupabaseSession(tokenRes);
    const authUser = tokenRes?.user || sessionObj?.user;
    if (!authUser?.id || !sessionObj?.access_token) {
      throw new BackendError('Resposta de sessão incompleta.', {
        code: 'AUTH_FAILED',
        userMessage: 'Não foi possível iniciar a sessão no Supabase.',
      });
    }

    let remoteRow = await fetchRemoteProfileById(
      authUser.id,
      sessionObj.access_token
    );
    if (!remoteRow) {
      const seedProfile = normalizeFrontendProfile({
        id: authUser.id,
        email: loginId,
        handle:
          authUser.user_metadata?.handle ||
          normalizeHandle(loginId.split('@')[0]),
        displayName:
          authUser.user_metadata?.display_name || loginId.split('@')[0],
        onboardingCompleted: true,
        isLocalOnly: false,
      });
      remoteRow = await upsertRemoteProfile(seedProfile, sessionObj.access_token);
    }

    const syncedProfile = fromSqlProfileRow(remoteRow, { email: loginId });
    const existingWs = await loadLocalWorkspace(syncedProfile.id);

    await saveLocalWorkspace(syncedProfile.id, {
      profile: syncedProfile,
      ...existingWs,
    });

    return {
      mode: 'supabase',
      authenticated: true,
      user: {
        id: authUser.id,
        email: loginId,
        mode: 'supabase',
      },
      profile: syncedProfile,
      workspace: existingWs,
    };
  }

  // Motor Local Multiusuário no IndexedDB
  const [accounts, profiles, activeMeta] = await Promise.all([
    storeGetAll('accounts'),
    storeGetAll('profiles'),
    getActiveMetaSession(),
  ]);

  const normalizedLoginHandle = loginId.startsWith('@')
    ? loginId
    : `@${loginId}`;

  const matchedProfile = profiles.find(
    (p) => String(p.handle || '').toLowerCase() === normalizedLoginHandle
  );
  const matchedAccount =
    accounts.find((a) => a.email && a.email.toLowerCase() === loginId) ||
    (matchedProfile ? accounts.find((a) => a.id === matchedProfile.id) : null);

  if (!matchedAccount) {
    throw new BackendError('Conta local não encontrada.', {
      code: 'USER_NOT_FOUND',
      userMessage: 'Nenhuma conta encontrada com este e-mail ou @handle.',
    });
  }

  if (matchedAccount.passwordHash) {
    const validPass = await verifyPasswordRecord(
      cleanPassword,
      matchedAccount.passwordHash
    );
    if (!validPass) {
      throw new BackendError('Senha incorreta.', {
        code: 'INVALID_CREDENTIALS',
        userMessage: 'Senha incorreta para este perfil.',
      });
    }
  }

  if (activeMeta?.userId && currentWorkspace && activeMeta.userId !== matchedAccount.id) {
    await saveLocalWorkspace(activeMeta.userId, currentWorkspace);
  }

  const targetProfile =
    (await storeGet('profiles', matchedAccount.id)) ||
    normalizeFrontendProfile({
      id: matchedAccount.id,
      handle: matchedAccount.handle,
      email: matchedAccount.email,
      isLocalOnly: true,
    });
  const targetWorkspace = await loadLocalWorkspace(matchedAccount.id);

  await setActiveMetaSession({
    userId: matchedAccount.id,
    mode: 'local',
    loggedInAt: new Date().toISOString(),
  });

  return {
    mode: 'local',
    authenticated: true,
    user: {
      id: matchedAccount.id,
      email: matchedAccount.email || '',
      handle: targetProfile.handle,
      mode: 'local',
    },
    profile: targetProfile,
    workspace: targetWorkspace,
  };
}

export async function switchLocalProfile(targetUserId, { currentWorkspace = null } = {}) {
  if (!targetUserId) {
    throw new BackendError('Perfil de destino inválido.', {
      code: 'INVALID_PROFILE_ID',
      userMessage: 'Selecione um perfil válido para alternar.',
    });
  }

  setForceLocalMode(true);
  const activeMeta = await getActiveMetaSession();

  if (activeMeta?.userId && currentWorkspace && activeMeta.userId !== targetUserId) {
    await saveLocalWorkspace(activeMeta.userId, currentWorkspace);
  }

  const [targetProfile, existingAccount] = await Promise.all([
    storeGet('profiles', targetUserId),
    storeGet('accounts', targetUserId),
  ]);

  if (!targetProfile) {
    throw new BackendError('Perfil não encontrado.', {
      code: 'PROFILE_NOT_FOUND',
      userMessage: 'Este perfil local não foi encontrado no dispositivo.',
    });
  }

  let targetAccount = existingAccount;
  if (!targetAccount) {
    const nowIso = new Date().toISOString();
    targetAccount = {
      id: targetProfile.id,
      email: targetProfile.email || '',
      handle: targetProfile.handle,
      passwordHash: null,
      isLocalOnly: false,
      createdAt: targetProfile.createdAt || nowIso,
      updatedAt: nowIso,
    };
    await storePut('accounts', targetAccount);
  }

  const targetWorkspace = await loadLocalWorkspace(targetUserId);

  await setActiveMetaSession({
    userId: targetUserId,
    mode: 'local',
    loggedInAt: new Date().toISOString(),
  });

  return {
    mode: 'local',
    authenticated: true,
    user: {
      id: targetProfile.id,
      email: targetAccount.email || targetProfile.email || '',
      handle: targetProfile.handle,
      mode: 'local',
    },
    profile: targetProfile,
    workspace: targetWorkspace,
  };
}

export async function continueInLocalMode({ currentWorkspace = null } = {}) {
  setForceLocalMode(true);
  const activeMeta = await getActiveMetaSession();

  if (activeMeta?.userId) {
    const [prof, acc] = await Promise.all([
      storeGet('profiles', activeMeta.userId),
      storeGet('accounts', activeMeta.userId),
    ]);
    if (prof) {
      if (currentWorkspace) {
        await saveLocalWorkspace(prof.id, currentWorkspace);
      }
      const ws = await loadLocalWorkspace(prof.id);
      return {
        mode: 'local',
        authenticated: true,
        user: {
          id: prof.id,
          email: acc?.email || prof.email || '',
          handle: prof.handle,
          mode: 'local',
        },
        profile: prof,
        workspace: ws,
      };
    }
  }

  const existingProfiles = await storeGetAll('profiles');
  if (existingProfiles.length > 0) {
    return switchLocalProfile(existingProfiles[0].id, { currentWorkspace });
  }

  const boot = await bootstrapBackend(currentWorkspace || {});
  const ws = boot.user?.id ? await loadLocalWorkspace(boot.user.id) : {
    items: currentWorkspace?.items || [],
    posts: currentWorkspace?.posts || [],
    streak: currentWorkspace?.streak || { count: 0, lastDate: null, history: [] },
    readingSessions: currentWorkspace?.readingSessions || [],
  };

  return {
    mode: 'local',
    authenticated: Boolean(boot.user),
    user: boot.user,
    profile: boot.profile,
    workspace: ws,
  };
}

export async function signOutAccount({ currentWorkspace = null } = {}) {
  const supabaseSession = loadStoredSupabaseSession();
  const activeMeta = await getActiveMetaSession();
  const saveTargetId = supabaseSession?.user?.id || activeMeta?.userId || null;

  if (saveTargetId && currentWorkspace) {
    await saveLocalWorkspace(saveTargetId, currentWorkspace);
  }

  if (supabaseSession?.access_token && isSupabaseConfigured()) {
    try {
      await supabaseFetchJson('/auth/v1/logout', {
        method: 'POST',
        token: supabaseSession.access_token,
      });
    } catch {
      // Ignora erro de rede ao desconectar remotamente
    }
  }

  saveStoredSupabaseSession(null);
  await setActiveMetaSession({
    userId: null,
    signedOut: true,
    loggedInAt: null,
  });

  return {
    mode: getBackendMode(),
    authenticated: false,
    user: null,
  };
}

export async function updateActiveProfileInBackend(profileData) {
  if (!profileData || typeof profileData !== 'object') return null;
  const mode = getBackendMode();

  if (mode === 'supabase') {
    const session = await ensureFreshSupabaseSession();
    if (session?.user?.id && session?.access_token) {
      const normalized = normalizeFrontendProfile({
        ...profileData,
        id: session.user.id,
        email: session.user.email || profileData.email || '',
        isLocalOnly: false,
      });
      await saveLocalWorkspace(normalized.id, { profile: normalized });
      try {
        const row = await upsertRemoteProfile(normalized, session.access_token);
        return fromSqlProfileRow(row, { email: normalized.email });
      } catch {
        // Mantém espelho local atualizado mesmo se offline
        return normalized;
      }
    }
  }

  const activeMeta = await getActiveMetaSession();
  const targetId = activeMeta?.userId || profileData.id;
  if (!targetId) return normalizeFrontendProfile(profileData);

  const normalized = normalizeFrontendProfile({
    ...profileData,
    id: targetId,
  });
  await saveLocalWorkspace(targetId, { profile: normalized });
  return normalized;
}

export async function syncActiveWorkspaceToBackend(workspace = {}) {
  const mode = getBackendMode();
  let targetUserId = null;

  if (mode === 'supabase') {
    const session = loadStoredSupabaseSession();
    targetUserId = session?.user?.id || null;
  }
  if (!targetUserId) {
    const activeMeta = await getActiveMetaSession();
    targetUserId = activeMeta?.userId || null;
  }
  if (!targetUserId) return;

  await saveLocalWorkspace(targetUserId, workspace);
}
