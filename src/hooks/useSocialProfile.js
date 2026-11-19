import { useCallback, useEffect, useState } from 'react';
import { buildPublicProfileLink, domainConfig } from '../config/domainConfig';

const PROFILE_KEY = domainConfig.profileStorageKey;
const POSTS_KEY = domainConfig.postsStorageKey;

function getDefaultProfile() {
  const { profile } = domainConfig.ui;
  return {
    displayName: profile.displayName,
    handle: profile.handle,
    avatarInitials: profile.avatarInitials,
    avatarUrl: profile.avatarUrl || '',
    coverUrl: profile.coverUrl || '',
    bio: profile.bio,
    linkLabel: profile.linkLabel,
    linkUrl: profile.linkUrl,
    age: '',
    readerFocus: 'Leitor Casual',
    annualGoal: 12,
    preferredFormat: 'Livro Físico',
    preferredCriterion: 'Enredo e Ritmo',
    preferredAtmosphere: 'Tinta OLED',
    favoriteGenres: [],
    onboardingCompleted: false,
  };
}

function loadProfile() {
  const fallback = getDefaultProfile();
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const merged = {
      ...fallback,
      ...parsed,
      annualGoal: Math.max(1, Number(parsed.annualGoal) || fallback.annualGoal),
      favoriteGenres: Array.isArray(parsed.favoriteGenres)
        ? parsed.favoriteGenres
        : [],
      onboardingCompleted:
        parsed.onboardingCompleted !== undefined
          ? Boolean(parsed.onboardingCompleted)
          : Boolean(parsed.displayName && parsed.displayName !== fallback.displayName),
    };

    if (!merged.linkLabel || /^mlpd\.livros\//i.test(merged.linkLabel)) {
      const publicLink = buildPublicProfileLink(merged.handle);
      merged.linkLabel = publicLink.label;
      merged.linkUrl = publicLink.url;
    }

    return merged;
  } catch {
    return fallback;
  }
}

function loadPosts() {
  try {
    const raw = localStorage.getItem(POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useSocialProfile() {
  const [profile, setProfile] = useState(loadProfile);
  const [posts, setPosts] = useState(loadPosts);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Ignora erro caso quota de storage esteja cheia
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
    } catch {
      // Ignora erro caso quota de storage esteja cheia
    }
  }, [posts]);

  const updateProfile = useCallback((updates) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates };
      if (updates.displayName !== undefined && !updates.avatarInitials) {
        const words = String(updates.displayName || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        next.avatarInitials =
          words.length >= 2
            ? `${words[0][0]}${words[1][0]}`.toUpperCase()
            : String(updates.displayName || 'AK').slice(0, 2).toUpperCase();
      }
      if (updates.handle && !updates.handle.startsWith('@')) {
        next.handle = `@${updates.handle.trim()}`;
      }
      if (
        updates.handle !== undefined &&
        updates.linkLabel === undefined &&
        (!prev.linkLabel || /^codice\.app\/@/i.test(prev.linkLabel))
      ) {
        const publicLink = buildPublicProfileLink(next.handle);
        next.linkLabel = publicLink.label;
        next.linkUrl = publicLink.url;
      }
      if (updates.annualGoal !== undefined) {
        next.annualGoal = Math.max(1, Number(updates.annualGoal) || 12);
      }
      return next;
    });
  }, []);

  const addPost = useCallback((postData) => {
    const newPost = {
      id: `post-${Date.now()}`,
      itemId: postData.itemId || null,
      itemTitle: postData.itemTitle || '',
      itemSnapshot: postData.itemSnapshot || null,
      progressMarker: String(postData.progressMarker || '').trim(),
      title: String(postData.title || '').trim(),
      caption: String(postData.caption || '').trim(),
      media: Array.isArray(postData.media) ? postData.media : [],
      comments: [],
      createdAt: new Date().toISOString(),
    };

    setPosts((prev) => [newPost, ...prev]);
    return newPost;
  }, []);

  const deletePost = useCallback((postId) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  }, []);

  const addPostComment = useCallback((postId, text) => {
    const cleanText = String(text || '').trim();
    if (!cleanText) return;

    const newComment = {
      id: `comment-${Date.now()}`,
      text: cleanText,
      createdAt: new Date().toISOString(),
    };

    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, comments: [...(post.comments || []), newComment] }
          : post
      )
    );
  }, []);

  const deletePostComment = useCallback((postId, commentId) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: (post.comments || []).filter((c) => c.id !== commentId),
            }
          : post
      )
    );
  }, []);

  const restoreSocialBackup = useCallback(
    ({ profile: savedProfile, posts: savedPosts }) => {
      if (savedProfile && typeof savedProfile === 'object') {
        setProfile({
          ...getDefaultProfile(),
          ...savedProfile,
          onboardingCompleted: true,
        });
      } else {
        setProfile((prev) => ({ ...prev, onboardingCompleted: true }));
      }
      if (Array.isArray(savedPosts)) {
        setPosts(savedPosts);
      }
    },
    []
  );

  return {
    profile,
    posts,
    updateProfile,
    addPost,
    deletePost,
    addPostComment,
    deletePostComment,
    restoreSocialBackup,
  };
}
