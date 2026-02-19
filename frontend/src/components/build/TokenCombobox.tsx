"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TokenComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** When true, treats value as comma-separated tokens and suggests for the last segment. */
  multi?: boolean;
};

export function TokenCombobox({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  disabled,
  multi,
}: TokenComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { query, filtered } = getFiltered(value, options, multi);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current && !wrapperRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const showDropdown = open && filtered.length > 0 && query.length > 0;

  useLayoutEffect(() => {
    if (!showDropdown || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, [showDropdown, value]);

  function selectOption(option: string) {
    if (multi) {
      const parts = value.split(",").map((s) => s.trim());
      parts[parts.length - 1] = option;
      onChange(parts.join(", ") + ", ");
    } else {
      onChange(option);
    }
    setOpen(false);
    setHighlightIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || filtered.length === 0) {
      if (e.key === "ArrowDown" && filtered.length > 0) {
        setOpen(true);
        setHighlightIndex(0);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          selectOption(filtered[highlightIndex]);
        }
        break;
      case "Escape":
        setOpen(false);
        setHighlightIndex(-1);
        break;
    }
  }

  return (
    <div ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.length > 0 && filtered.length > 0) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      {showDropdown
        ? createPortal(
            <ul
              ref={listRef}
              style={dropdownStyle}
              className="z-[9999] max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              {filtered.map((option, idx) => (
                <li
                  key={option}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(option);
                  }}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  className={`cursor-pointer px-3 py-1.5 font-mono text-xs ${
                    idx === highlightIndex
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option}
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

function getFiltered(
  value: string,
  options: string[],
  multi?: boolean,
): { query: string; filtered: string[] } {
  const query = multi
    ? (value.split(",").pop()?.trim() ?? "")
    : value.trim();

  if (!query) return { query, filtered: [] };

  const lower = query.toLowerCase();
  const filtered = options.filter((opt) => opt.toLowerCase().includes(lower));
  return { query, filtered: filtered.slice(0, 30) };
}
