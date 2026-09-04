"use client";

import { ArrowRight } from "lucide-react";
import { HeroBlockData } from "../landing-page-types";

interface HeroBlockRenderProps {
	data: HeroBlockData;
}

export default function HeroBlockRender({ data }: HeroBlockRenderProps) {
	const {
		title,
		subtitle,
		ctaText,
		ctaLink,
		backgroundImage,
		backgroundType = "gradient",
		backgroundColor,
		textColor = "light",
	} = data;

	const hasCustomBackground =
		(backgroundType === "image" && backgroundImage) ||
		(backgroundType === "color" && backgroundColor) ||
		backgroundType === "gradient";

	const getBackgroundStyle = () => {
		if (backgroundType === "image" && backgroundImage) {
			return {
				backgroundImage: `linear-gradient(rgba(12, 13, 15, 0.62), rgba(12, 13, 15, 0.62)), url(${backgroundImage})`,
				backgroundSize: "cover",
				backgroundPosition: "center",
			};
		}
		if (backgroundType === "color" && backgroundColor) {
			return { backgroundColor };
		}
		return {
			background:
				"linear-gradient(135deg, var(--inverse) 0%, color-mix(in oklab, var(--accent) 32%, var(--inverse)) 100%)",
		};
	};

	// Custom backgrounds carry their own contrast; otherwise fall back to tokens.
	const headingClass = hasCustomBackground
		? textColor === "light"
			? "text-white"
			: "text-[#16171A]"
		: "text-ink";
	const bodyClass = hasCustomBackground
		? textColor === "light"
			? "text-white/80"
			: "text-[#55565C]"
		: "text-ink-2";

	return (
		<section
			className="relative flex min-h-[520px] items-center justify-center px-6 py-24"
			style={getBackgroundStyle()}
		>
			<div className="mx-auto max-w-3xl text-center">
				<h1
					className={`font-display text-[36px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl lg:text-[58px] ${headingClass}`}
				>
					{title}
				</h1>
				{subtitle && (
					<p className={`mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg ${bodyClass}`}>
						{subtitle}
					</p>
				)}
				{ctaText && (
					<a
						href={ctaLink}
						className="group mt-10 inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-7 text-[15px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
					>
						{ctaText}
						<ArrowRight
							className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
							strokeWidth={2}
						/>
					</a>
				)}
			</div>
		</section>
	);
}
