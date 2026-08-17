"use client";

import { useEffect, useState } from "react";
import { useTheme } from "../../contexts/theme-context";

interface ThemeSwitcherProps {
	className?: string;
	size?: "sm" | "md" | "lg";
	showLabel?: boolean;
}

export function ThemeSwitcher({
	className = "",
	size = "md",
	showLabel = false,
}: ThemeSwitcherProps) {
	const { theme, toggleTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const sizeClasses = {
		sm: "w-4 h-4",
		md: "w-5 h-5",
		lg: "w-6 h-6",
	};

	const buttonSizeClasses = {
		sm: "p-1.5",
		md: "p-2",
		lg: "p-3",
	};

	// Return skeleton during hydration
	if (!mounted) {
		return (
			<div
				className={`${buttonSizeClasses[size]} text-zinc-600 dark:text-zinc-400 transition-colors rounded-lg flex items-center gap-2 ${className}`}>
				<div
					className={`${sizeClasses[size]} bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse`}
				/>
				{showLabel && (
					<div className="text-sm w-8 h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
				)}
			</div>
		);
	}

	return (
		<button
			onClick={toggleTheme}
			className={`${buttonSizeClasses[size]} text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 ${className}`}
			title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
			aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
			{theme === "light" ? (
				<svg
					className={sizeClasses[size]}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
					/>
				</svg>
			) : (
				<svg
					className={sizeClasses[size]}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
					/>
				</svg>
			)}
			{showLabel && (
				<span className="text-sm">{theme === "light" ? "Dark" : "Light"}</span>
			)}
		</button>
	);
}

// Alternative compact toggle switch design
export function ThemeToggle({ className = "" }: { className?: string }) {
	const { theme, toggleTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Return skeleton during hydration
	if (!mounted) {
		return (
			<div className={`flex items-center ${className}`}>
				<div className="relative inline-flex h-6 w-11 items-center rounded-full bg-zinc-300 dark:bg-zinc-600">
					<div className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
				</div>
			</div>
		);
	}

	return (
		<div className={`flex items-center ${className}`}>
			<button
				onClick={toggleTheme}
				className="relative inline-flex h-6 w-11 items-center rounded-full bg-zinc-300 dark:bg-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
				role="switch"
				aria-checked={theme === "dark"}
				aria-label="Toggle theme">
				<span
					className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
						theme === "dark" ? "translate-x-6" : "translate-x-1"
					}`}
				/>
				{/* Sun icon */}
				<svg
					className={`absolute left-1 h-3 w-3 text-yellow-500 transition-opacity ${
						theme === "light" ? "opacity-100" : "opacity-0"
					}`}
					fill="currentColor"
					viewBox="0 0 20 20">
					<path
						fillRule="evenodd"
						d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
						clipRule="evenodd"
					/>
				</svg>
				{/* Moon icon */}
				<svg
					className={`absolute right-1 h-3 w-3 text-zinc-400 transition-opacity ${
						theme === "dark" ? "opacity-100" : "opacity-0"
					}`}
					fill="currentColor"
					viewBox="0 0 20 20">
					<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
				</svg>
			</button>
		</div>
	);
}
