"use client";

import { WhyUsBlockData } from "../landing-page-types";

interface WhyUsBlockRenderProps {
	data: WhyUsBlockData;
}

export default function WhyUsBlockRender({ data }: WhyUsBlockRenderProps) {
	const { title, subtitle, reasons } = data;

	return (
		<section className="border-y border-line bg-surface px-6 py-20">
			<div className="mx-auto max-w-[1280px]">
				<div className="mx-auto mb-12 max-w-2xl text-center">
					<h2 className="font-display text-[28px] font-semibold tracking-tight text-ink md:text-[36px]">
						{title}
					</h2>
					{subtitle && (
						<p className="mt-3 text-[15px] leading-relaxed text-ink-2">{subtitle}</p>
					)}
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{reasons.map((reason, index) => (
						<div
							key={index}
							className="rounded-xl border border-line bg-bg p-7 transition-colors hover:border-line-2"
						>
							{reason.icon && (
								<span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-lg">
									{reason.icon}
								</span>
							)}
							<h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">
								{reason.title}
							</h3>
							<p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
								{reason.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
