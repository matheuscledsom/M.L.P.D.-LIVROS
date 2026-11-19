import { Film, ImagePlus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { domainConfig } from '../config/domainConfig';
import { compressImageFile } from '../utils/imageUtils';
import { MediaCarousel } from './MediaCarousel';

export function JournalComposerModal({
  isOpen,
  onClose,
  items = [],
  initialItemId = null,
  onPublish,
}) {
  const backlogItems = useMemo(() => {
    const active = items.filter((item) => item.inBacklog);
    return [...active].sort((a, b) => {
      if (a.status === 'playing' && b.status !== 'playing') return -1;
      if (b.status === 'playing' && a.status !== 'playing') return 1;
      return 0;
    });
  }, [items]);

  const [selectedItemId, setSelectedItemId] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState([]);
  const [videoInput, setVideoInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const defaultId =
      initialItemId || backlogItems[0]?.id || '';
    setSelectedItemId(defaultId);
    setTitle('');
    setCaption('');
    setMedia([]);
    setVideoInput('');
  }, [isOpen, initialItemId, backlogItems]);

  if (!isOpen) return null;

  const { journalComposer } = domainConfig.ui.profile;
  const selectedItem =
    backlogItems.find((item) => item.id === selectedItemId) ?? null;

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    setIsProcessing(true);
    try {
      const compressed = await Promise.all(
        files.map(async (file, index) => {
          const url = await compressImageFile(file, {
            maxWidth: 960,
            maxHeight: 960,
            quality: 0.72,
          });
          return {
            id: `img-${Date.now()}-${index}`,
            type: 'image',
            url,
          };
        })
      );
      setMedia((prev) => [...prev, ...compressed]);
    } catch {
      // Ignora imagens inválidas
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddVideo = () => {
    const cleanUrl = videoInput.trim();
    if (!cleanUrl) return;
    setMedia((prev) => [
      ...prev,
      { id: `vid-${Date.now()}`, type: 'video', url: cleanUrl },
    ]);
    setVideoInput('');
  };

  const handleRemoveSlide = (slideId) => {
    setMedia((prev) => prev.filter((slide) => slide.id !== slideId));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onPublish({
      itemId: selectedItem?.id || null,
      itemTitle: selectedItem?.title || '',
      itemSnapshot: selectedItem
        ? {
            id: selectedItem.id,
            title: selectedItem.title,
            coverUrl: selectedItem.coverUrl || null,
            palette: selectedItem.palette,
            monogram: selectedItem.monogram,
            format: selectedItem[domainConfig.cardFields.primary],
          }
        : null,
      title: title.trim(),
      caption: caption.trim(),
      media,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-x border-t border-line bg-card p-5 pb-8 shadow-2xl no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">
            {journalComposer.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={domainConfig.ui.detail.closeLabel}
            className="rounded-full p-1 text-muted hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {backlogItems.length > 0 ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                {journalComposer.itemLabel}
              </span>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full rounded-xl border border-line bg-app px-3 py-2.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
              >
                {backlogItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="rounded-xl border border-line bg-app px-3 py-2.5 text-xs text-muted">
              {journalComposer.noItemsHint}
            </p>
          )}

          {/* Mídias e Preview Carrossel */}
          <div className="space-y-2.5">
            <span className="block text-xs font-medium text-muted">
              {journalComposer.mediaLabel}
            </span>

            {media.length > 0 && (
              <MediaCarousel
                media={media}
                onRemoveSlide={handleRemoveSlide}
                aspectClass="aspect-[4/3]"
              />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
              >
                <ImagePlus className="h-4 w-4" />
                {isProcessing ? 'Comprimindo...' : journalComposer.addPhotosLabel}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Film className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
                <input
                  type="url"
                  value={videoInput}
                  onChange={(e) => setVideoInput(e.target.value)}
                  placeholder={journalComposer.videoUrlPlaceholder}
                  className="w-full rounded-xl border border-line bg-app py-2 pl-8 pr-3 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleAddVideo}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-line bg-app px-3 py-2 text-xs font-medium text-ink hover:border-accent"
              >
                <Plus className="h-3.5 w-3.5 text-accent" />
                {journalComposer.addVideoLabel}
              </button>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              {journalComposer.postTitleLabel}
            </span>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={journalComposer.postTitlePlaceholder}
              className="w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              {journalComposer.captionLabel}
            </span>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={journalComposer.captionPlaceholder}
              className="w-full resize-none rounded-xl border border-line bg-app px-3 py-2.5 text-xs leading-relaxed text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isProcessing || !title.trim()}
          className="mt-5 w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-45"
        >
          {journalComposer.publishLabel}
        </button>
      </form>
    </div>
  );
}
