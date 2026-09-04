"use client";

import { Check } from "lucide-react";
import { PricingBlockData } from "../landing-page-types";
import { formatCurrency } from "@/lib/currency";

interface PricingBlockRenderProps {
	data: PricingBlockData;
}

export default function PricingBlockRender({ data }: PricingBlockRenderProps) {
	const { title, subtitle, plans, currency = "BDT" } = data;

	const formatPrice = (price: number) => formatCurrency(price, currency);

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

				<div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{plans.map((plan, index) => {
						const featured = Boolean(plan.highlighted);
						return (
							<div
								key={index}
								className={`relative flex flex-col overflow-hidden rounded-xl border p-7 ${
									featured
										? "border-ink bg-inverse text-inverse-ink"
										: "border-line bg-bg"
								}`}
							>
								{featured && (
									<span className="absolute right-5 top-5 rounded-md bg-white/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
										Popular
									</span>
								)}

								<h3
									className={`font-display text-lg font-semibold tracking-tight ${
										featured ? "" : "text-ink"
									}`}
								>
									{plan.name}
								</h3>
								{plan.description && (
									<p
										className={`mt-1.5 text-[13.5px] leading-relaxed ${
											featured ? "opacity-70" : "text-ink-2"
										}`}
									>
										{plan.description}
									</p>
								)}

								<p className="mt-6 flex items-baseline gap-1.5">
									<span
										className={`tnum font-display text-[34px] font-semibold leading-none tracking-tight ${
											featured ? "" : "text-ink"
										}`}
									>
										{formatPrice(plan.price)}
									</span>
									{plan.period && (
										<span
											className={`text-[13px] ${featured ? "opacity-60" : "text-ink-3"}`}
										>
											/{plan.period}
										</span>
									)}
								</p>

								<ul className="mt-7 flex-1 space-y-2.5">
									{plan.features.map((feature, featureIndex) => (
										<li
											key={featureIndex}
											className={`flex items-start gap-2.5 text-[13.5px] leading-relaxed ${
												featured ? "opacity-85" : "text-ink-2"
											}`}
										>
											<Check
												className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
													featured ? "" : "text-verified"
												}`}
												strokeWidth={2.5}
											/>
											{feature}
										</li>
									))}
								</ul>

								<a
									href={plan.ctaLink}
									className={`mt-8 inline-flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
										featured
											? "bg-inverse-ink text-inverse hover:opacity-90"
											: "bg-accent text-on-accent hover:bg-accent-hover"
									}`}
								>
									{plan.ctaText}
								</a>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
