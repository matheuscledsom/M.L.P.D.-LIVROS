import { Building2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  normalizePublisherName,
  searchBrazilianPublishers,
} from '../data/brazilianPublishers';

export function PublisherAutocomplete({
  value = '',
  onChange,
  label = 'Editora',
  placeholder = 'Ex: Companhia das Letras',
  category = 'all',
  className = '',
  inputClassName = '',
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(
    () => searchBrazilianPublishers(value, { category, limit: 8 }),
    [value, category]
  );

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleSelect = (publisherName) => {
    onChange?.(publisherName);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      setActiveIndex(0);
      return;
    }
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex].name);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <span className="mb-1 block text-[10px] font-medium text-subtle">
          {label}
        </span>
      )}
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
          }
          value={value || ''}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            const normalized = normalizePublisherName(value);
            if (normalized && normalized !== value) {
              onChange?.(normalized);
            }
          }}
          onChange={(e) => {
            onChange?.(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={
            inputClassName ||
            'w-full rounded-[4px] border border-line bg-card px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none'
          }
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-52 overflow-y-auto divide-y divide-line rounded-[4px] border border-line bg-card no-scrollbar"
        >
          {suggestions.map((pub, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={pub.name}
                id={`${listboxId}-opt-${index}`}
                role="option"
                aria-selected={isActive}
              >
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(pub.name);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex min-h-[38px] w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isActive
                      ? 'bg-elevated text-accent'
                      : 'text-ink hover:bg-elevated/60'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5 font-medium truncate">
                    <Building2
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isActive ? 'text-accent' : 'text-subtle'
                      }`}
                      strokeWidth={1.5}
                    />
                    <span className="truncate">{pub.name}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted">
                    {pub.category}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
