import {
  BookMarked,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import {
  ACQUISITION_TYPES,
  CONSERVATION_STATES,
  suggestLibraryClassification,
} from '../utils/catalogingClassification';

export function LibraryCatalogSection({
  item,
  onChange,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const filledFieldsCount = [
    item.cdu_cdd,
    item.cutter,
    item.callNumber,
    item.edition,
    item.publicationPlace,
    item.language,
    item.seriesName,
    item.physicalLocation,
    item.acquisitionType,
    item.conservationState,
    item.advisor,
    item.issn,
    item.doi,
    item.originalTitle,
    item.loanedTo,
    item.loanedAt,
  ].filter((v) => v !== undefined && v !== null && String(v).trim() !== '').length;

  const suggestion = suggestLibraryClassification(item);

  const handleSuggestEmptyOnly = () => {
    const updates = {};
    if (!String(item.cdu_cdd || '').trim()) {
      updates.cdu_cdd = suggestion.cdu_cdd;
    }
    if (!String(item.cutter || '').trim()) {
      updates.cutter = suggestion.cutter;
    }
    if (!String(item.callNumber || '').trim()) {
      const nextCdd = updates.cdu_cdd || item.cdu_cdd || suggestion.cdu_cdd;
      const nextCutter = updates.cutter || item.cutter || suggestion.cutter;
      updates.callNumber = [nextCdd, nextCutter].filter(Boolean).join(' ');
    }
    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-app overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex min-h-[44px] w-full items-center justify-between px-3.5 py-3 text-left transition-colors hover:bg-card/60"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-ink">
          <BookMarked className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <span>Catalogação Bibliotecária (CDD / Cutter)</span>
          {filledFieldsCount > 0 && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              {filledFieldsCount}
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted" strokeWidth={1.5} />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted" strokeWidth={1.5} />
        )}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-line px-3.5 py-3.5">
          {/* Bloco CDD / Cutter / Número de Chamada */}
          <div className="space-y-2.5 rounded-xl border border-line bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-ink">
                  Classificação e Chamada
                </p>
                <p className="truncate text-[10px] text-subtle">
                  Sugestão automática: {suggestion.cddLabel} · {suggestion.callNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSuggestEmptyOnly}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                Preencher vazios
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-subtle">
                  CDD / CDU
                </span>
                <input
                  type="text"
                  value={item.cdu_cdd || ''}
                  onChange={(e) => onChange({ cdu_cdd: e.target.value })}
                  placeholder={suggestion.cdu_cdd}
                  className="w-full rounded-xl border border-line bg-app px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-subtle">
                  Cutter
                </span>
                <input
                  type="text"
                  value={item.cutter || ''}
                  onChange={(e) => onChange({ cutter: e.target.value })}
                  placeholder={suggestion.cutter}
                  className="w-full rounded-xl border border-line bg-app px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-subtle">
                  Chamada
                </span>
                <input
                  type="text"
                  value={item.callNumber || ''}
                  onChange={(e) => onChange({ callNumber: e.target.value })}
                  placeholder={suggestion.callNumber}
                  className="w-full rounded-xl border border-line bg-app px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>
            </div>
          </div>

          {/* Publicação, Edição e Identificadores */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-subtle">
                Local de Publicação
              </span>
              <input
                type="text"
                value={item.publicationPlace || ''}
                onChange={(e) => onChange({ publicationPlace: e.target.value })}
                placeholder="Ex: São Paulo"
                className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-subtle">
                Edição
              </span>
              <input
                type="text"
                value={item.edition || ''}
                onChange={(e) => onChange({ edition: e.target.value })}
                placeholder="Ex: 2ª ed."
                className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-subtle">
                Idioma
              </span>
              <input
                type="text"
                value={item.language || ''}
                onChange={(e) => onChange({ language: e.target.value })}
                placeholder="Ex: Português"
                className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-subtle">
                Orientador(a)
              </span>
              <input
                type="text"
                value={item.advisor || ''}
                onChange={(e) => onChange({ advisor: e.target.value })}
                placeholder="Para TCC / Pesquisa"
                className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-subtle">
                Série / Coleção
              </span>
              <input
                type="text"
                value={item.seriesName || ''}
                onChange={(e) => onChange({ seriesName: e.target.value })}
                placeholder="Ex: Crônicas de Duna"
                className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-subtle">
                Nº na Série
              </span>
              <input
                type="text"
                value={item.seriesIndex || ''}
                onChange={(e) => onChange({ seriesIndex: e.target.value })}
                placeholder="Ex: 1"
                className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-subtle">
                DOI
              </span>
              <input
                type="text"
                value={item.doi || ''}
                onChange={(e) => onChange({ doi: e.target.value })}
                placeholder="10.xxxx/..."
                className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-subtle">
                ISSN
              </span>
              <input
                type="text"
                value={item.issn || ''}
                onChange={(e) => onChange({ issn: e.target.value })}
                placeholder="Ex: 1234-5678"
                className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>
          </div>

          {/* Localização Física, Origem e Conservação */}
          <div className="space-y-3 border-t border-line pt-3">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-subtle">
                <MapPin className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                Localização Física (Estante / Prateleira / Pasta)
              </span>
              <input
                type="text"
                value={item.physicalLocation || ''}
                onChange={(e) => onChange({ physicalLocation: e.target.value })}
                placeholder="Ex: Estante Sala · Prateleira 2"
                className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            {/* Edição Bilíngue & Controle de Empréstimo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="block sm:col-span-3">
                <span className="mb-1 block text-[10px] font-medium text-subtle">
                  Título Original (Edição Bilíngue / Idioma Nativo)
                </span>
                <input
                  type="text"
                  value={item.originalTitle || ''}
                  onChange={(e) => onChange({ originalTitle: e.target.value })}
                  placeholder="Ex: The Trial / Der Process"
                  className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] font-medium text-subtle">
                  Emprestado para
                </span>
                <input
                  type="text"
                  value={item.loanedTo || ''}
                  onChange={(e) => onChange({ loanedTo: e.target.value })}
                  placeholder="Nome do amigo ou colega"
                  className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-subtle">
                  Data do empréstimo
                </span>
                <input
                  type="date"
                  value={item.loanedAt || ''}
                  onChange={(e) => onChange({ loanedAt: e.target.value || null })}
                  className="w-full rounded-xl border border-line bg-card px-2.5 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                />
              </label>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-medium text-subtle">
                Origem / Aquisição
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {ACQUISITION_TYPES.map((type) => {
                  const isSelected = item.acquisitionType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        onChange({
                          acquisitionType: isSelected ? '' : type,
                        })
                      }
                      className={`min-h-[36px] rounded-xl border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/15 text-ink'
                          : 'border-line bg-card text-muted hover:text-ink'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-medium text-subtle">
                Estado de Conservação
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CONSERVATION_STATES.map((state) => {
                  const isSelected = item.conservationState === state;
                  return (
                    <button
                      key={state}
                      type="button"
                      onClick={() =>
                        onChange({
                          conservationState: isSelected ? '' : state,
                        })
                      }
                      className={`min-h-[36px] rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/15 text-ink'
                          : 'border-line bg-card text-muted hover:text-ink'
                      }`}
                    >
                      {state}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
