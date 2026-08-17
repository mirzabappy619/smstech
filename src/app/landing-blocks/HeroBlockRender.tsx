"use client";

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

	const getBackgroundStyle = () => {
		if (backgroundType === "image" && backgroundImage) {
			return {
				backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${backgroundImage})`,
				backgroundSize: "cover",
				backgroundPosition: "center",
			};
		}
		if (backgroundType === "color" && backgroundColor) {
			return { backgroundColor };
		}
		return {
			background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
		};
	};

	const textColorClass = textColor === "light" ? "text-white" : "text-gray-900";

	return (
		<section
			className="relative min-h-[600px] flex items-center justify-center py-20 px-4"
			style={getBackgroundStyle()}
		>
			<div className="max-w-4xl mx-auto text-center z-10">
				<h1
					className={`text-5xl md:text-6xl lg:text-7xl font-bold mb-6 ${textColorClass}`}
				>
					{title}
				</h1>
				<p
					className={`text-xl md:text-2xl mb-10 ${textColorClass} opacity-90`}
				>
					{subtitle}
				</p>
				<a
					href={ctaLink}
					className="inline-block bg-white text-gray-900 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg"
				>
					{ctaText}
				</a>
			</div>
		</section>
	);
}
