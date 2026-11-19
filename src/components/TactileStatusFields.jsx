import { BookOpen, Calendar, FileText, Star } from 'lucide-react';
import { domainConfig } from '../config/domainConfig';
import {
  calculatePageProgress,
  calculateSmartRating,
  createDefaultReviewCriteria,
  getCompletionPace,
  getVerdictForScore,
} from '../utils/backlogHelpers';

function QuickPageButtons({ currentPage, totalPages, onAddPages }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {domainConfig.tactileOptions.quickPages.map((inc) => {
        const current = Math.max(0, Number(currentPage) || 0);
        const total = Number(totalPages) || 0;
        const nextPage = total > 0 ? Math.min(total, current + inc) : current + inc;

        return (
          <button
            key={inc}
            type="button"
            onClick={() => onAddPages(nextPage)}
            className="rounded-lg border border-line bg-card px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent/15"
          >
            +{inc} págs
          </button>
        );
      })}
    </div>
  );
}

export function TactileStatusFields({
  item,
  onChange,
  showJournalAction = true,
  onOpenJournal = null,
}) {
  const { ui, tactileOptions } = domainConfig;
  const { detail } = ui;

  const status = item.status || domainConfig.ui.add.defaultNewStatus;

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
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-ink'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  {hype.label}
                </button>
              );
            })}
          </div>
        </div>

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
                    progress: calculatePageProgress(item.currentPage, val),
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
                      progress: calculatePageProgress(item.currentPage, preset.value),
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
      </div>
    );
  }

  if (status === 'playing') {
    const currentPage = Math.max(0, Number(item.currentPage) || 0);
    const totalPages = Number(item.totalPages) || 0;
    const progressValue = calculatePageProgress(currentPage, totalPages);

    const handleCurrentPageChange = (nextVal) => {
      const parsed = Math.max(0, Number(nextVal) || 0);
      onChange({
        currentPage: parsed,
        progress: calculatePageProgress(parsed, item.totalPages),
      });
    };

    const handleTotalPagesChange = (rawVal) => {
      const nextTotal = rawVal === '' ? null : Math.max(0, Number(rawVal) || 0);
      onChange({
        totalPages: nextTotal,
        progress: calculatePageProgress(currentPage, nextTotal),
      });
    };

    return (
      <div className="space-y-4">
        <label className="flex items-center justify-between rounded-xl border border-line bg-app px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-subtle">
            <Calendar className="h-3.5 w-3.5" />
            {detail.startDateLabel}
          </span>
          <input
            type="date"
            value={item.startDate || ''}
            onChange={(e) => onChange({ startDate: e.target.value || null })}
            className="bg-transparent text-right text-xs font-medium text-ink focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-line bg-app px-3 py-2">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-subtle">
              <BookOpen className="h-3 w-3" />
              {detail.currentPageLabel}
            </span>
            <div className="mt-1 flex items-center justify-between gap-1">
              <input
                type="number"
                min="0"
                value={item.currentPage ?? 0}
                onChange={(e) => handleCurrentPageChange(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-ink focus:outline-none"
              />
              <span className="text-[11px] text-subtle">pág</span>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-app px-3 py-2">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-subtle">
              <FileText className="h-3 w-3" />
              {detail.totalPagesLabel}
            </span>
            <div className="mt-1 flex items-center justify-between gap-1">
              <input
                type="number"
                min="0"
                placeholder="0"
                value={item.totalPages ?? ''}
                onChange={(e) => handleTotalPagesChange(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-subtle focus:outline-none"
              />
              <span className="text-[11px] text-subtle">págs</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-app px-3 py-2">
          <span className="text-[11px] text-muted">Somar rápido</span>
          <QuickPageButtons
            currentPage={currentPage}
            totalPages={totalPages}
            onAddPages={handleCurrentPageChange}
          />
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

        {showJournalAction && onOpenJournal && (
          <button
            type="button"
            onClick={onOpenJournal}
            className="w-full rounded-xl border border-accent/50 bg-accent/15 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-accent/25"
          >
            {detail.journalButtonLabel}
          </button>
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
    const pace = getCompletionPace(
      item.startDate,
      item.completedDate,
      totalPages
    );

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
              ? 'border-amber-400/60 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.18)]'
              : 'border-line bg-app text-muted hover:text-ink'
          }`}
        >
          <span className="flex items-center gap-2">
            <Star
              className={`h-4 w-4 ${
                item.isPlatinum
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-subtle'
              }`}
            />
            {detail.lifeFavoriteLabel}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              item.isPlatinum
                ? 'bg-amber-400/20 text-amber-300'
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

          {pace && (
            <div className="inline-flex w-full items-center justify-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent">
              {pace.label}
            </div>
          )}
        </div>

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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-muted">
          {detail.dropReasonLabel}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tactileOptions.dropReasons.map((reason) => {
            const isSelected = item.dropReason === reason;
            return (
              <button
                key={reason}
                type="button"
                onClick={() =>
                  onChange({ dropReason: isSelected ? null : reason })
                }
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-400'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                {reason}
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
                  progress: calculatePageProgress(nextPage, item.totalPages),
                });
              }}
              className="w-full bg-transparent text-sm font-medium text-ink focus:outline-none"
            />
            <span className="text-[11px] text-subtle">pág</span>
          </div>
        </div>
      </div>
    </div>
  );
}
