"use client";

import { useRef, useState, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";

export const SEARCH_INPUT_ID = "bmap-search-input";

interface Props {
  onSearch: (query: string) => void;
  onClear: () => void;
  onSuggest: (query: string) => Promise<string[]>;
}

export default function SearchBar({ onSearch, onClear, onSuggest }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasText, setHasText] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((value: string) => {
    setHasText(value.length > 0);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSuggestions([]);
      setShowDrop(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSuggesting(true);
      const results = await onSuggest(value.trim());
      setSuggesting(false);
      setSuggestions(results);
      setShowDrop(results.length > 0);
    }, 350);
  }, [onSuggest]);

  const submit = (keyword?: string) => {
    const q = keyword ?? inputRef.current?.value?.trim();
    if (!q) return;
    setSuggestions([]);
    setShowDrop(false);
    onSearch(q);
  };

  const clear = () => {
    if (inputRef.current) inputRef.current.value = "";
    setHasText(false);
    setSuggestions([]);
    setShowDrop(false);
    onClear();
  };

  const handleSelect = (name: string) => {
    if (inputRef.current) inputRef.current.value = name;
    setHasText(true);
    setSuggestions([]);
    setShowDrop(false);
    onSearch(name);
  };

  return (
    <div className="relative flex-1">
      <div className="flex items-center bg-white rounded-full shadow-sm border border-zinc-200 px-3 py-2 gap-2">
        <Search className="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          ref={inputRef}
          id={SEARCH_INPUT_ID}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setShowDrop(false);
          }}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          placeholder="搜索地址、店铺…"
          className="flex-1 text-sm outline-none bg-transparent min-w-0"
          autoComplete="off"
        />
        {suggesting && <Loader2 className="w-4 h-4 animate-spin text-zinc-300 shrink-0" />}
        {hasText && !suggesting && (
          <button onMouseDown={(e) => { e.preventDefault(); clear(); }}>
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        )}
        <button
          onMouseDown={(e) => { e.preventDefault(); submit(); }}
          className="text-sm text-blue-500 font-medium shrink-0"
        >
          搜索
        </button>
      </div>

      {showDrop && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-zinc-100 overflow-hidden z-50">
          {suggestions.map((name, i) => (
            <button
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(name); }}
              className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 border-b border-zinc-50 last:border-0 truncate"
            >
              <Search className="w-3 h-3 inline mr-2 text-zinc-300" />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
