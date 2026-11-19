import {
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  RotateCcw,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import { domainConfig } from '../config/domainConfig';
import {
  calculateWorkProgress,
  calculateSmartRating,
  createDefaultReviewCriteria,
  formatAbntReference,
  getCompletionPace,
  getDropReasonMeta,
  getVerdictForScore,
} from '../utils/backlogHelpers';
import { useToast } from '../context/ToastContext';
import { playTactileSound } from '../utils/soundEffects';
import {
  SpoilerFreeRecapAction,
  SynthesisReviewAction,
} from './GeminiItemActions';
import { VectorIcon } from './VectorIcon';

function QuickPageButtons({ item, onChange }) {
  const current = Math.max(0, Number(item.currentPage) || 0);
  const total = Number(item.totalPages) || 0;

  return (
    <div className="flex flex-wrap gap-1.5">
      {domainConfig.tactileOptions.quickPages.map((inc) => {
        const nextPage = total > 0 ? Math.min(total, current + inc) : current + inc;
        return (
          <button
            key={inc}
            type="button"
            onClick={() => {
              playTactileSound('page');
              onChange({
                currentPage: nextPage,
                progress: calculateWorkProgress({
                  ...item,
                  currentPage: nextPage,
                }),
              });
            }}
            className="rounded-lg border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent/15"
          >
            +{inc}
          </button>
        );
      })}
    </div>
  );
}

function QuickMangaButtons({ item, onChange }) {
  const currentChapter = Math.max(0, Number(item.currentChapter) || 0);
  const totalChapters = Number(item.totalChapters) || 0;
  const currentVolume = Math.max(0, Number(item.currentVolume) || 0);
  const totalVolumes = Number(item.totalVolumes) || 0;

  const addChapters = (inc) => {
    const nextChapter =
      totalChapters > 0
        ? Math.min(totalChapters, currentChapter + inc)
        : currentChapter + inc;
    playTactileSound('page');
    onChange({
      currentChapter: nextChapter,
      progress: calculateWorkProgress({
        ...item,
        currentChapter: nextChapter,
      }),
    });
  };

  const addVolume = () => {
    const nextVolume =
      totalVolumes > 0
        ? Math.min(totalVolumes, currentVolume + 1)
        : currentVolume + 1;
    playTactileSound('page');
    onChange({
      currentVolume: nextVolume,
      progress: calculateWorkProgress({
        ...item,
        currentVolume: nextVolume,
      }),
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {domainConfig.tactileOptions.quickChapters.map((inc) => (
        <button
          key={inc}
          type="button"
          onClick={() => addChapters(inc)}
          className="rounded-lg border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent/15"
        >
          +{inc} {inc === 1 ? 'Cap' : 'Caps'}
        </button>
      ))}
      <button
        type="button"
        onClick={addVolume}
        className="rounded-lg border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent/15"
      >
        +1 Vol
      </button>
    </div>
  );
}

function BookMetadataBlock({ item, onChange }) {
  const { detail } = domainConfig.ui;
  const status = item.status || domainConfig.ui.add.defaultNewStatus;

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-app p-3.5">
      {status !== 'queued' && (
        <div>
          <p className="mb-2 text-[11px] font-medium text-muted">
            {detail.formatTitle}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {domainConfig.bookFormats.map((format) => {
              const isSelected = item.format === format;
              return (
                <button
                  key={format}
                  type="button"
                  onClick={() => onChange({ format })}
                  className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-ink'
                      : 'border-line bg-card text-muted hover:text-ink'
                  }`}
                >
                  {format}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-subtle">
            {detail.publisherLabel}
          </span>
          <input
            type="text"
            value={item.publisher || ''}
            onChange={(e) => onChange({ publisher: e.target.value })}
            placeholder="Ex: Aleph"
            className="w-full rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-subtle">
            {detail.isbnLabel}
          </span>
          <input
            type="text"
            value={item.isbn || ''}
            onChange={(e) => onChange({ isbn: e.target.value })}
            placeholder="Ex: 9788576573135"
            className="w-full rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-subtle">
            {detail.translatorLabel}
          </span>
          <input
            type="text"
            value={item.translator || ''}
            onChange={(e) => onChange({ translator: e.target.value })}
            placeholder="Opcional"
            className="w-full rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-subtle">
            {detail.seriesVolumeLabel}
          </span>
          <input
            type="text"
            value={item.seriesVolume || ''}
            onChange={(e) => onChange({ seriesVolume: e.target.value })}
            placeholder="Ex: Vol. 1"
            className="w-full rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}

function MangaMetadataBlock({ item, onChange }) {
  const { detail } = domainConfig.ui;

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-app p-3.5">
      <div>
        <p className="mb-2 text-[11px] font-medium text-muted">
          {detail.mangaOriginLabel}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {domainConfig.mangaOrigins.map((origin) => {
            const isSelected = (item.demographicOrigin || 'Mangá') === origin;
            return (
              <button
                key={origin}
                type="button"
                onClick={() => onChange({ demographicOrigin: origin })}
                className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line bg-card text-muted hover:text-ink'
                }`}
              >
                {origin}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium text-muted">
          {detail.mangaPubStatusLabel}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {domainConfig.mangaPubStatuses.map((pubStatus) => {
            const isSelected =
              (item.publicationStatus || 'Em lançamento') === pubStatus;
            return (
              <button
                key={pubStatus}
                type="button"
                onClick={() => onChange({ publicationStatus: pubStatus })}
                className={`rounded-xl border px-2.5 py-2 text-center text-[11px] font-medium transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line bg-card text-muted hover:text-ink'
                }`}
              >
                {pubStatus}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AcademicMetadataAndAbntBlock({ item, onChange }) {
  const { detail } = domainConfig.ui;
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const generatedAbnt = formatAbntReference(item);
  const displayedAbnt =
    item.abntReference && item.abntReference.trim()
      ? item.abntReference
      : generatedAbnt;

  const handleCopyAbnt = async () => {
    if (!displayedAbnt) return;
    try {
      await navigator.clipboard.writeText(displayedAbnt);
      setCopied(true);
      showToast({ message: 'Referência ABNT copiada', type: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const temp = document.createElement('textarea');
      temp.value = displayedAbnt;
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        showToast({ message: 'Referência ABNT copiada', type: 'success' });
        setTimeout(() => setCopied(false), 2000);
      } finally {
        temp.remove();
      }
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-app p-3.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 block">
          <span className="mb-1 block text-[10px] font-medium text-subtle">
            {detail.authorsLabel}
          </span>
          <input
            type="text"
            value={item.author || ''}
            onChange={(e) => onChange({ author: e.target.value })}
            placeholder="Ex: Gil, Antonio Carlos; Lakatos, Eva"
            className="w-full rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-subtle">
            {detail.institutionLabel}
          </span>
          <input
            type="text"
            value={item.institution || ''}
            onChange={(e) => onChange({ institution: e.target.value })}
            placeholder="Ex: USP / Revista..."
            className="w-full rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-subtle">
            {detail.yearLabel}
          </span>
          <input
            type="number"
            value={item.releaseYear ?? ''}
            onChange={(e) =>
              onChange({
                releaseYear: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="Ex: 2024"
            className="w-full rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>

        <label className="col-span-2 block">
          <span className="mb-1 block text-[10px] font-medium text-subtle">
            {detail.keywordsLabel}
          </span>
          <input
            type="text"
            value={item.keywords || ''}
            onChange={(e) => onChange({ keywords: e.target.value })}
            placeholder="Separadas por vírgula (ex: Metodologia, TCC)"
            className="w-full rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      <label className="block border-t border-line pt-3">
        <span className="mb-1 block text-[11px] font-medium text-muted">
          {detail.fichamentoNotesLabel}
        </span>
        <textarea
          rows={3}
          value={item.fichamento || ''}
          onChange={(e) => onChange({ fichamento: e.target.value })}
          placeholder={detail.fichamentoNotesPlaceholder}
          className="w-full resize-none rounded-xl border border-line bg-card px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </label>

      <div className="space-y-2 rounded-xl border border-accent/30 bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-ink">
            {detail.abntTitle}
          </span>
          <div className="flex items-center gap-1.5">
            {item.abntReference && item.abntReference !== generatedAbnt && (
              <button
                type="button"
                onClick={() => onChange({ abntReference: '' })}
                title={detail.abntResetLabel}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-medium text-muted hover:text-ink"
              >
                <RotateCcw className="h-3 w-3" />
                {detail.abntResetLabel}
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyAbnt}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  {detail.abntCopiedLabel}
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  {detail.abntCopyLabel}
                </>
              )}
            </button>
          </div>
        </div>

        <textarea
          rows={2}
          value={displayedAbnt}
          onChange={(e) => onChange({ abntReference: e.target.value })}
          className="w-full resize-none rounded-lg border border-line bg-app px-2.5 py-2 text-[11px] leading-relaxed text-muted focus:border-accent focus:text-ink focus:outline-none"
        />
      </div>
    </div>
  );
}

function WorkTypeMetadataBlock({ item, onChange }) {
  const workType = item.workType || 'book';
  if (workType === 'manga') {
    return <MangaMetadataBlock item={item} onChange={onChange} />;
  }
  if (workType === 'academic') {
    return <AcademicMetadataAndAbntBlock item={item} onChange={onChange} />;
  }
  return <BookMetadataBlock item={item} onChange={onChange} />;
}

export function TactileStatusFields({
  item,
  onChange,
  showJournalAction = true,
  onOpenJournal = null,
  showAiActions = false,
  geminiKey = '',
  linkedPosts = [],
  onOpenGeminiSettings = null,
}) {
  const { ui, tactileOptions } = domainConfig;
  const { detail } = ui;

  const status = item.status || domainConfig.ui.add.defaultNewStatus;
  const workType = item.workType || 'book';

  if (status === 'queued') {
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted">
            {detail.hypeLabel}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {tactileOptions.hypeLevels.map((hype) => {
              const isSelected = item.hype === hype.id;
              return (
                <button
                  key={hype.id}
                  type="button"
                  onClick={() =>
                    onChange({ hype: isSelected ? null : hype.id })
                  }
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-ink'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  <VectorIcon
                    name={hype.icon}
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isSelected ? 'text-accent' : 'text-subtle'
                    }`}
                  />
                  <span>{hype.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {workType === 'book' && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted">
              {detail.accessLabel}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tactileOptions.accessOptions.map((access) => {
                const isSelected = item.access === access;
                return (
                  <button
                    key={access}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onChange({ access: null, isWishlist: false });
                      } else if (access === 'Wishlist') {
                        onChange({ access, isWishlist: true });
                      } else {
                        onChange({ access, format: access, isWishlist: false });
                      }
                    }}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {access}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {workType === 'manga' ? (
          <div className="grid grid-cols-2 gap-2.5">
            <label className="rounded-xl border border-line bg-app px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wider text-subtle">
                {detail.totalVolumesLabel}
              </span>
              <input
                type="number"
                min="0"
                placeholder="—"
                value={item.totalVolumes ?? ''}
                onChange={(e) =>
                  onChange({
                    totalVolumes:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="mt-1 w-full bg-transparent text-sm font-medium text-ink placeholder:text-subtle focus:outline-none"
              />
            </label>

            <label className="rounded-xl border border-line bg-app px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wider text-subtle">
                {detail.totalChaptersLabel}
              </span>
              <input
                type="number"
                min="0"
                placeholder="—"
                value={item.totalChapters ?? ''}
                onChange={(e) =>
                  onChange({
                    totalChapters:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="mt-1 w-full bg-transparent text-sm font-medium text-ink placeholder:text-subtle focus:outline-none"
              />
            </label>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted">
                {detail.estimatedPagesLabel}
              </p>
              <div className="flex items-center gap-1 rounded-lg border border-line bg-app px-2 py-1">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={item.totalPages ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value);
                    onChange({
                      totalPages: val,
                      progress: calculateWorkProgress({
                        ...item,
                        totalPages: val,
                      }),
                    });
                  }}
                  className="w-14 bg-transparent text-right text-xs font-medium text-ink placeholder:text-subtle focus:outline-none"
                />
                <span className="text-[11px] text-subtle">págs</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {tactileOptions.pagePresets.map((preset) => {
                const isSelected = Number(item.totalPages) === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() =>
                      onChange({
                        totalPages: preset.value,
                        progress: calculateWorkProgress({
                          ...item,
                          totalPages: preset.value,
                        }),
                      })
                    }
                    className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <WorkTypeMetadataBlock item={item} onChange={onChange} />
      </div>
    );
  }

  if (status === 'playing') {
    const progressValue = calculateWorkProgress(item);
    const currentPage = Math.max(0, Number(item.currentPage) || 0);
    const totalPages = Number(item.totalPages) || 0;
    const currentVolume = Math.max(0, Number(item.currentVolume) || 0);
    const currentChapter = Math.max(0, Number(item.currentChapter) || 0);
    const academicMode = item.academicProgressMode || 'pages';

    return (
      <div className="space-y-4">
        <label className="flex items-center justify-between rounded-xl border border-line bg-app px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-subtle">
            <Calendar className="h-3.5 w-3.5 text-accent" />
            {detail.startDateLabel}
          </span>
          <input
            type="date"
            value={item.startDate || ''}
            onChange={(e) => onChange({ startDate: e.target.value || null })}
            className="bg-transparent text-right text-xs font-medium text-ink focus:outline-none"
          />
        </label>

        {workType === 'academic' && (
          <div className="flex items-center justify-between rounded-xl border border-line bg-app p-1.5">
            <span className="px-2 text-[11px] font-medium text-muted">
              {detail.academicProgressModeLabel}
            </span>
            <div className="flex gap-1">
              {domainConfig.academicProgressModes.map((mode) => {
                const isSelected = academicMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        academicProgressMode: mode.id,
                        progress: calculateWorkProgress({
                          ...item,
                          academicProgressMode: mode.id,
                        }),
                      })
                    }
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      isSelected
                        ? 'bg-accent text-accent-ink'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {workType === 'manga' ? (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-line bg-app px-3 py-2">
                <span className="block text-[10px] uppercase tracking-wider text-subtle">
                  {detail.currentVolumeLabel}
                </span>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={item.currentVolume ?? 0}
                    onChange={(e) => {
                      const nextVol = Math.max(0, Number(e.target.value) || 0);
                      onChange({
                        currentVolume: nextVol,
                        progress: calculateWorkProgress({
                          ...item,
                          currentVolume: nextVol,
                        }),
                      });
                    }}
                    className="w-12 bg-transparent text-sm font-semibold text-ink focus:outline-none"
                  />
                  <span className="text-[11px] text-subtle">/</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="—"
                    value={item.totalVolumes ?? ''}
                    onChange={(e) => {
                      const nextTotal =
                        e.target.value === '' ? null : Number(e.target.value);
                      onChange({
                        totalVolumes: nextTotal,
                        progress: calculateWorkProgress({
                          ...item,
                          totalVolumes: nextTotal,
                        }),
                      });
                    }}
                    className="w-12 bg-transparent text-xs text-muted placeholder:text-subtle focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-line bg-app px-3 py-2">
                <span className="block text-[10px] uppercase tracking-wider text-subtle">
                  {detail.currentChapterLabel}
                </span>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={item.currentChapter ?? 0}
                    onChange={(e) => {
                      const nextChap = Math.max(0, Number(e.target.value) || 0);
                      onChange({
                        currentChapter: nextChap,
                        progress: calculateWorkProgress({
                          ...item,
                          currentChapter: nextChap,
                        }),
                      });
                    }}
                    className="w-12 bg-transparent text-sm font-semibold text-ink focus:outline-none"
                  />
                  <span className="text-[11px] text-subtle">/</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="—"
                    value={item.totalChapters ?? ''}
                    onChange={(e) => {
                      const nextTotal =
                        e.target.value === '' ? null : Number(e.target.value);
                      onChange({
                        totalChapters: nextTotal,
                        progress: calculateWorkProgress({
                          ...item,
                          totalChapters: nextTotal,
                        }),
                      });
                    }}
                    className="w-12 bg-transparent text-xs text-muted placeholder:text-subtle focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-app px-3 py-2">
              <span className="text-[11px] text-muted">Somar rápido</span>
              <QuickMangaButtons item={item} onChange={onChange} />
            </div>

            <div className="rounded-2xl border border-line bg-app p-3.5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-muted">
                  {detail.progressLabel}
                </span>
                <span className="font-semibold text-accent">
                  Vol. {currentVolume} · Cap. {currentChapter}
                  {progressValue > 0 ? ` · ${progressValue}%` : ''}
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>

              <label className="mt-3 block">
                <span className="mb-1 block text-[11px] text-muted">
                  {detail.checkpointLabel}
                </span>
                <input
                  type="text"
                  value={item.checkpoint || ''}
                  onChange={(e) => onChange({ checkpoint: e.target.value })}
                  placeholder="Ex: Arco de Shibuya"
                  className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>
            </div>
          </>
        ) : workType === 'academic' && academicMode === 'fichamento' ? (
          <div className="space-y-3 rounded-2xl border border-line bg-app p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted">
                {detail.fichamentoStagesLabel}
              </span>
              <span className="font-semibold text-accent">{progressValue}%</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${progressValue}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {domainConfig.fichamentoStages.map((stage) => {
                const steps = item.fichamentoSteps || {};
                const checked = Boolean(steps[stage.id]);
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => {
                      const nextSteps = { ...steps, [stage.id]: !checked };
                      onChange({
                        fichamentoSteps: nextSteps,
                        progress: calculateWorkProgress({
                          ...item,
                          fichamentoSteps: nextSteps,
                        }),
                      });
                    }}
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11px] font-medium transition-colors ${
                      checked
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-card text-muted hover:text-ink'
                    }`}
                  >
                    <CheckCircle2
                      className={`h-3.5 w-3.5 shrink-0 ${
                        checked ? 'text-accent' : 'text-subtle'
                      }`}
                    />
                    <span className="truncate">{stage.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">
                {detail.checkpointLabel}
              </span>
              <input
                type="text"
                value={item.checkpoint || ''}
                onChange={(e) => onChange({ checkpoint: e.target.value })}
                placeholder="Ex: Seção 3.2 — Metodologia"
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-line bg-app px-3 py-2">
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-subtle">
                  <BookOpen className="h-3 w-3 text-accent" />
                  {detail.currentPageLabel}
                </span>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <input
                    type="number"
                    min="0"
                    value={item.currentPage ?? 0}
                    onChange={(e) => {
                      const nextPage = Math.max(0, Number(e.target.value) || 0);
                      onChange({
                        currentPage: nextPage,
                        progress: calculateWorkProgress({
                          ...item,
                          currentPage: nextPage,
                        }),
                      });
                    }}
                    className="w-full bg-transparent text-sm font-medium text-ink focus:outline-none"
                  />
                  <span className="text-[11px] text-subtle">pág</span>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-app px-3 py-2">
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-subtle">
                  <FileText className="h-3 w-3 text-accent" />
                  {detail.totalPagesLabel}
                </span>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={item.totalPages ?? ''}
                    onChange={(e) => {
                      const nextTotal =
                        e.target.value === ''
                          ? null
                          : Math.max(0, Number(e.target.value) || 0);
                      onChange({
                        totalPages: nextTotal,
                        progress: calculateWorkProgress({
                          ...item,
                          totalPages: nextTotal,
                        }),
                      });
                    }}
                    className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-subtle focus:outline-none"
                  />
                  <span className="text-[11px] text-subtle">págs</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-app px-3 py-2">
              <span className="text-[11px] text-muted">Somar rápido</span>
              <QuickPageButtons item={item} onChange={onChange} />
            </div>

            <div className="rounded-2xl border border-line bg-app p-3.5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-muted">
                  {detail.progressLabel}
                </span>
                <span className="font-semibold text-accent">
                  {totalPages > 0
                    ? `${currentPage}/${totalPages} págs · ${progressValue}%`
                    : `${currentPage} págs · ${progressValue}%`}
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>

              <label className="mt-3 block">
                <span className="mb-1 block text-[11px] text-muted">
                  {detail.checkpointLabel}
                </span>
                <input
                  type="text"
                  value={item.checkpoint || ''}
                  onChange={(e) => onChange({ checkpoint: e.target.value })}
                  placeholder={detail.checkpointPlaceholder}
                  className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>
            </div>
          </>
        )}

        <WorkTypeMetadataBlock item={item} onChange={onChange} />

        {showJournalAction && onOpenJournal && (
          <button
            type="button"
            onClick={onOpenJournal}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/15 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-accent/25"
          >
            <Camera className="h-4 w-4 text-accent" />
            {detail.journalButtonLabel}
          </button>
        )}

        {showAiActions && (
          <SpoilerFreeRecapAction
            item={item}
            linkedPosts={linkedPosts}
            geminiKey={geminiKey}
            onOpenGeminiSettings={onOpenGeminiSettings}
          />
        )}
      </div>
    );
  }

  if (status === 'completed') {
    const criteria =
      item.reviewCriteria || createDefaultReviewCriteria(item.rating ?? 80);
    const liveScore = calculateSmartRating(criteria);
    const activeVerdict = item.verdict || getVerdictForScore(liveScore);
    const totalPages = Number(item.totalPages) || Number(item.currentPage) || 0;
    const pace =
      workType === 'manga'
        ? null
        : getCompletionPace(item.startDate, item.completedDate, totalPages);

    const updateCriterion = (key, val) => {
      const nextCriteria = { ...criteria, [key]: val };
      const score = calculateSmartRating(nextCriteria);
      onChange({
        reviewCriteria: nextCriteria,
        rating: score,
        verdict: getVerdictForScore(score),
      });
    };

    const ignoreCharacters = Boolean(
      criteria.ignoreCharacters ?? criteria.ignoreStory
    );

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => onChange({ isPlatinum: !item.isPlatinum })}
          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-xs font-semibold transition-all ${
            item.isPlatinum
              ? 'border-accent/60 bg-accent/15 text-ink shadow-[0_0_20px_rgba(139,92,246,0.16)]'
              : 'border-line bg-app text-muted hover:text-ink'
          }`}
        >
          <span className="flex items-center gap-2">
            <Star
              className={`h-4 w-4 ${
                item.isPlatinum ? 'fill-current text-accent' : 'text-subtle'
              }`}
            />
            {detail.lifeFavoriteLabel}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              item.isPlatinum
                ? 'bg-accent text-accent-ink'
                : 'bg-card text-subtle'
            }`}
          >
            {item.isPlatinum ? 'Ativo' : 'Off'}
          </span>
        </button>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">
            {detail.completionTypeLabel}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tactileOptions.completionTypes.map((type) => {
              const isSelected = item.completionType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onChange({ completionType: type })}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-ink'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="rounded-xl border border-line bg-app px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wider text-subtle">
                {detail.startDateLabel}
              </span>
              <input
                type="date"
                value={item.startDate || ''}
                onChange={(e) => onChange({ startDate: e.target.value || null })}
                className="mt-1 w-full bg-transparent text-xs font-medium text-ink focus:outline-none"
              />
            </label>

            <label className="rounded-xl border border-line bg-app px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wider text-subtle">
                {detail.completedDateLabel}
              </span>
              <input
                type="date"
                value={item.completedDate || ''}
                onChange={(e) =>
                  onChange({ completedDate: e.target.value || null })
                }
                className="mt-1 w-full bg-transparent text-xs font-medium text-ink focus:outline-none"
              />
            </label>
          </div>

          {workType === 'manga' ? (
            <div className="grid grid-cols-2 gap-2.5">
              <label className="rounded-xl border border-line bg-app px-3 py-2">
                <span className="block text-[10px] uppercase tracking-wider text-subtle">
                  {detail.totalVolumesLabel}
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={item.totalVolumes ?? ''}
                  onChange={(e) => {
                    const nextTotal =
                      e.target.value === '' ? null : Number(e.target.value);
                    onChange({
                      totalVolumes: nextTotal,
                      currentVolume: nextTotal || 0,
                    });
                  }}
                  className="mt-1 w-full bg-transparent text-sm font-semibold text-ink placeholder:text-subtle focus:outline-none"
                />
              </label>

              <label className="rounded-xl border border-line bg-app px-3 py-2">
                <span className="block text-[10px] uppercase tracking-wider text-subtle">
                  {detail.totalChaptersLabel}
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={item.totalChapters ?? ''}
                  onChange={(e) => {
                    const nextTotal =
                      e.target.value === '' ? null : Number(e.target.value);
                    onChange({
                      totalChapters: nextTotal,
                      currentChapter: nextTotal || 0,
                    });
                  }}
                  className="mt-1 w-full bg-transparent text-sm font-semibold text-ink placeholder:text-subtle focus:outline-none"
                />
              </label>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-app px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-subtle">
                {detail.totalPagesLabel}
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={item.totalPages ?? ''}
                  onChange={(e) => {
                    const nextTotal =
                      e.target.value === '' ? null : Number(e.target.value);
                    onChange({
                      totalPages: nextTotal,
                      currentPage: nextTotal || 0,
                    });
                  }}
                  className="w-16 bg-transparent text-right text-sm font-semibold text-ink placeholder:text-subtle focus:outline-none"
                />
                <span className="text-xs text-subtle">págs</span>
              </div>
            </div>
          )}

          {pace && (
            <div className="inline-flex w-full items-center justify-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent">
              {pace.label}
            </div>
          )}
        </div>

        <WorkTypeMetadataBlock item={item} onChange={onChange} />

        <div className="space-y-3 rounded-2xl border border-line bg-app p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-ink">
                {detail.smartReviewTitle}
              </p>
              <p className="text-[10px] text-subtle">{detail.finalScoreLabel}</p>
            </div>
            <span className="rounded-xl border border-accent/40 bg-accent/15 px-3 py-1 text-base font-bold text-ink">
              {liveScore}
              <span className="text-[11px] font-normal text-muted">/100</span>
            </span>
          </div>

          <div className="space-y-2.5">
            {tactileOptions.reviewCriteria.map((criterion) => {
              const isExcluded = criterion.canExclude && ignoreCharacters;
              const val =
                criteria[criterion.key] ??
                (criterion.key === 'plot'
                  ? criteria.gameplay
                  : criterion.key === 'characters'
                    ? criteria.story
                    : criterion.key === 'writing'
                      ? criteria.audiovisual
                      : undefined) ??
                80;

              return (
                <div key={criterion.key}>
                  {!isExcluded && (
                    <>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="text-muted">{criterion.label}</span>
                        <span className="font-semibold text-ink">{val}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={val}
                        onChange={(e) =>
                          updateCriterion(criterion.key, Number(e.target.value))
                        }
                        className="w-full cursor-pointer accent-accent"
                      />
                    </>
                  )}
                  {criterion.canExclude && (
                    <label
                      className={`flex cursor-pointer items-center gap-2 text-[11px] text-muted ${
                        isExcluded ? 'py-1' : 'mt-1.5'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={ignoreCharacters}
                        onChange={(e) =>
                          updateCriterion('ignoreCharacters', e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-line bg-card accent-accent"
                      />
                      <span>{detail.nonFictionToggleLabel}</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-1">
            <p className="mb-2 text-[11px] font-medium text-muted">
              {detail.verdictLabel}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tactileOptions.verdicts.map((verdict) => {
                const isSelected = activeVerdict === verdict.id;
                return (
                  <button
                    key={verdict.id}
                    type="button"
                    onClick={() => onChange({ verdict: verdict.id })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      isSelected
                        ? verdict.badgeClass
                        : 'border-line bg-card text-muted hover:text-ink'
                    }`}
                  >
                    {verdict.id}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {showAiActions && (
          <SynthesisReviewAction
            item={item}
            linkedPosts={linkedPosts}
            geminiKey={geminiKey}
            onApplyText={onChange}
            onOpenGeminiSettings={onOpenGeminiSettings}
          />
        )}
      </div>
    );
  }

  const activeDropMeta = getDropReasonMeta(item.dropReason);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-muted">
          {detail.dropReasonLabel}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tactileOptions.dropReasons.map((reason) => {
            const isSelected = activeDropMeta?.id === reason.id;
            return (
              <button
                key={reason.id}
                type="button"
                onClick={() =>
                  onChange({ dropReason: isSelected ? null : reason.id })
                }
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-400'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                <VectorIcon
                  name={reason.icon}
                  className={`h-3.5 w-3.5 ${
                    isSelected ? 'text-rose-400' : 'text-accent'
                  }`}
                />
                {reason.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="rounded-xl border border-line bg-app px-3 py-2">
          <span className="block text-[10px] uppercase tracking-wider text-subtle">
            {detail.dropDateLabel}
          </span>
          <input
            type="date"
            value={item.dropDate || ''}
            onChange={(e) => onChange({ dropDate: e.target.value || null })}
            className="mt-1 w-full bg-transparent text-xs font-medium text-ink focus:outline-none"
          />
        </label>

        {workType === 'manga' ? (
          <div className="rounded-xl border border-line bg-app px-3 py-2">
            <span className="block text-[10px] uppercase tracking-wider text-subtle">
              Vol. / Cap. parado
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                value={item.currentVolume ?? 0}
                onChange={(e) => {
                  const nextVol = Math.max(0, Number(e.target.value) || 0);
                  onChange({
                    currentVolume: nextVol,
                    progress: calculateWorkProgress({
                      ...item,
                      currentVolume: nextVol,
                    }),
                  });
                }}
                placeholder="Vol"
                className="w-10 bg-transparent text-sm font-medium text-ink focus:outline-none"
              />
              <span className="text-xs text-subtle">·</span>
              <input
                type="number"
                min="0"
                value={item.currentChapter ?? 0}
                onChange={(e) => {
                  const nextChap = Math.max(0, Number(e.target.value) || 0);
                  onChange({
                    currentChapter: nextChap,
                    progress: calculateWorkProgress({
                      ...item,
                      currentChapter: nextChap,
                    }),
                  });
                }}
                placeholder="Cap"
                className="w-10 bg-transparent text-sm font-medium text-ink focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-app px-3 py-2">
            <span className="block text-[10px] uppercase tracking-wider text-subtle">
              {detail.stoppedPageLabel}
            </span>
            <div className="mt-1 flex items-center justify-between gap-1">
              <input
                type="number"
                min="0"
                value={item.currentPage ?? 0}
                onChange={(e) => {
                  const nextPage = Math.max(0, Number(e.target.value) || 0);
                  onChange({
                    currentPage: nextPage,
                    progress: calculateWorkProgress({
                      ...item,
                      currentPage: nextPage,
                    }),
                  });
                }}
                className="w-full bg-transparent text-sm font-medium text-ink focus:outline-none"
              />
              <span className="text-[11px] text-subtle">pág</span>
            </div>
          </div>
        )}
      </div>

      <WorkTypeMetadataBlock item={item} onChange={onChange} />
    </div>
  );
}
