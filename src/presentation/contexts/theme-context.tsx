"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
	const context = useContext(ThemeContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}

interface ThemeProviderProps {
	children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
	const [theme, setThemeState] = useState<Theme>("dark"); // Default to dark
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		// Check for saved theme preference or default to 'dark'
		const savedTheme = localStorage.getItem("theme") as Theme | null;
		if (savedTheme && (savedTheme === "light" || savedTheme === "dark")) {
			setThemeState(savedTheme);
		} else {
			// Check system preference
			const prefersDark = window.matchMedia(
				"(prefers-color-scheme: dark)",
			).matches;
			setThemeState(prefersDark ? "dark" : "light");
		}
	}, []);

	useEffect(() => {
		if (mounted) {
			localStorage.setItem("theme", theme);

			// Apply theme to document
			if (theme === "dark") {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		}
	}, [theme, mounted]);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
	};

	const toggleTheme = () => {
		setThemeState((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
	};

	// Prevent hydration mismatch by providing default values during initial render
	const contextValue = {
		theme,
		setTheme,
		toggleTheme,
	};

	return (
		<ThemeContext.Provider value={contextValue}>
			{children}
		</ThemeContext.Provider>
	);
}
