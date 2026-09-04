"use client";

import { FeaturesBlockData } from "../landing-page-types";

interface FeaturesBlockRenderProps {
	data: FeaturesBlockData;
}

export default function FeaturesBlockRender({ data }: FeaturesBlockRenderProps) {
	const { title, subtitle, features, columns = 3 } = data;

	const gridColsClass =
		{
			1: "md:grid-cols-1",
			2: "md:grid-cols-2",
			3: "md:grid-cols-3",
			4: "md:grid-cols-4",
		}[columns] || "md:grid-cols-3";

	return (
		<section className="bg-bg px-6 py-20">
			<div className="mx-auto max-w-[1280px]">
				<div className="mx-auto mb-12 max-w-2xl text-center">
					<h2 className="font-display text-[28px] font-semibold tracking-tight text-ink md:text-[36px]">
						{title}
					</h2>
					{subtitle && (
						<p className="mt-3 text-[15px] leading-relaxed text-ink-2">{subtitle}</p>
					)}
				</div>

				<div
					className={`grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line ${gridColsClass}`}
				>
					{features.map((feature, index) => (
						<div key={index} className="bg-surface p-7">
							{feature.icon && (
								<span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-lg">
									{feature.icon}
								</span>
							)}
							<h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">
								{feature.title}
							</h3>
							<p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
