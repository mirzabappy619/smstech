"use client";

/**
 * A select you can type into.
 *
 * The admin screens pick from lists that grew past what a native <select> is
 * usable for — a hundred products, three hundred parties — where finding a row
 * meant scrolling a dropdown. This filters as you type, keeps full keyboard
 * control, and shows everything when the box is empty.
 *
 * Deliberately not a native <select>: the filtering, the two-line options and
 * the "no match" state are not things a native control can render.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export interface SearchableOption {
	value: string;
	/** The searchable, primary text. */
	label: string;
	/** Second line — a SKU, a phone number, an outstanding balance. */
	hint?: string;
	/** Extra text that should match a search without being displayed. */
	keywords?: string;
	disabled?: boolean;
}

interface Props {
	options: SearchableOption[];
	value: string;
	onChange: (value: string) => void;
	/** Shown when nothing is selected. */
	placeholder?: string;
	/** Label for the "nothing selected" row. Omit to require a choice. */
	emptyLabel?: string;
	disabled?: boolean;
	className?: string;
	id?: string;
	"aria-label"?: string;
}

const FIELD =
	"w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold text-zinc-900 dark:text-white text-left";

/** Case-insensitive match on every typed term, across label, hint and keywords. */
export function matches(option: SearchableOption, query: string): boolean {
	if (!query) return true;
	const haystack = `${option.label} ${option.hint ?? ""} ${option.keywords ?? ""}`.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((term) => haystack.includes(term));
}

export default function SearchableSelect({
	options,
	value,
	onChange,
	placeholder = "Search…",
	emptyLabel,
	disabled,
	className = "",
	id,
	"aria-label": ariaLabel,
}: Props) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);

	const rootRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const generatedId = useId();
	const listId = `${id ?? generatedId}-listbox`;

	const selected = useMemo(
		() => options.find((o) => o.value === value) ?? null,
		[options, value],
	);

	// The "nothing selected" row is part of the list so it can be reached with
	// the keyboard like any other choice.
	const visible = useMemo(() => {
		const rows = options.filter((o) => matches(o, query));
		if (emptyLabel && matches({ value: "", label: emptyLabel }, query)) {
			return [{ value: "", label: emptyLabel } as SearchableOption, ...rows];
		}
		return rows;
	}, [options, query, emptyLabel]);

	useEffect(() => {
		if (activeIndex >= visible.length) setActiveIndex(0);
	}, [visible.length, activeIndex]);

	// Close when the click lands anywhere else on the page.
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: MouseEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onPointerDown);
		return () => document.removeEventListener("mousedown", onPointerDown);
	}, [open]);

	// Keep the highlighted row in view while arrowing through a long list.
	useEffect(() => {
		if (!open) return;
		listRef.current
			?.querySelector(`[data-index="${activeIndex}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, open]);

	const openList = useCallback(() => {
		if (disabled) return;
		setOpen(true);
		setQuery("");

		// The highlight has to be found in the list that actually renders. That
		// list prepends the "nothing selected" row, so searching `options` put
		// the initial highlight one row above the current selection — and the
		// first Enter then picked the wrong product.
		const rows = emptyLabel
			? [{ value: "", label: emptyLabel } as SearchableOption, ...options]
			: options;
		setActiveIndex(Math.max(0, rows.findIndex((o) => o.value === value)));

		requestAnimationFrame(() => inputRef.current?.focus());
	}, [disabled, emptyLabel, options, value]);

	const choose = useCallback(
		(option: SearchableOption) => {
			if (option.disabled) return;
			onChange(option.value);
			setOpen(false);
			setQuery("");
		},
		[onChange],
	);

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (!open) {
				openList();
				return;
			}
			const step = event.key === "ArrowDown" ? 1 : -1;
			setActiveIndex((i) => (visible.length === 0 ? 0 : (i + step + visible.length) % visible.length));
			return;
		}

		if (event.key === "Enter" && open) {
			event.preventDefault();
			const option = visible[activeIndex];
			if (option) choose(option);
			return;
		}

		if (event.key === "Escape" && open) {
			event.preventDefault();
			setOpen(false);
			setQuery("");
		}
	};

	return (
		<div ref={rootRef} className={`relative ${className}`}>
			{open ? (
				<input
					ref={inputRef}
					id={id}
					type="text"
					role="combobox"
					aria-expanded
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={visible[activeIndex] ? `${listId}-${activeIndex}` : undefined}
					aria-label={ariaLabel}
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setActiveIndex(0);
					}}
					onKeyDown={onKeyDown}
					placeholder={placeholder}
					className={FIELD}
				/>
			) : (
				<button
					type="button"
					id={id}
					role="combobox"
					aria-expanded={false}
					aria-controls={listId}
					aria-label={ariaLabel}
					disabled={disabled}
					onClick={openList}
					onKeyDown={onKeyDown}
					className={`${FIELD} flex items-center justify-between gap-2 disabled:opacity-60`}
				>
					<span className={`truncate ${selected ? "" : "text-zinc-400 dark:text-zinc-500"}`}>
						{selected?.label ?? emptyLabel ?? placeholder}
					</span>
					<span aria-hidden className="shrink-0 text-zinc-400">
						▾
					</span>
				</button>
			)}

			{open && (
				<ul
					ref={listRef}
					id={listId}
					role="listbox"
					className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
				>
					{visible.length === 0 && (
						<li className="px-3 py-3 text-xs font-semibold text-zinc-400">
							Nothing matches &ldquo;{query}&rdquo;
						</li>
					)}

					{visible.map((option, index) => {
						const isSelected = option.value === value;
						const isActive = index === activeIndex;

						return (
							<li
								key={`${option.value}-${index}`}
								id={`${listId}-${index}`}
								data-index={index}
								role="option"
								aria-selected={isSelected}
								aria-disabled={option.disabled}
								onMouseEnter={() => setActiveIndex(index)}
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => choose(option)}
								className={`cursor-pointer px-3 py-2 text-xs ${
									option.disabled
										? "cursor-not-allowed opacity-50"
										: isActive
											? "bg-blue-50 dark:bg-blue-950/40"
											: ""
								}`}
							>
								<div className="flex items-center justify-between gap-2">
									<span
										className={`truncate font-bold ${
											isSelected
												? "text-blue-600 dark:text-blue-400"
												: "text-zinc-900 dark:text-white"
										}`}
									>
										{option.label}
									</span>
									{isSelected && (
										<span aria-hidden className="shrink-0 text-blue-600">
											✓
										</span>
									)}
								</div>
								{option.hint && (
									<p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-500">
										{option.hint}
									</p>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
