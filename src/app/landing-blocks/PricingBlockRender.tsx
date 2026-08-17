"use client";

import { PricingBlockData } from "../landing-page-types";

interface PricingBlockRenderProps {
	data: PricingBlockData;
}

export default function PricingBlockRender({ data }: PricingBlockRenderProps) {
	const { title, subtitle, plans, currency = "USD" } = data;

	const formatPrice = (price: number) => {
		if (currency === "USD") return `$${price}`;
		if (currency === "EUR") return `€${price}`;
		if (currency === "GBP") return `£${price}`;
		return `${price} ${currency}`;
	};

	return (
		<section className="py-16 px-4 bg-gray-50">
			<div className="max-w-7xl mx-auto">
				<div className="text-center mb-12">
					<h2 className="text-4xl font-bold mb-4 text-gray-900">{title}</h2>
					{subtitle && (
						<p className="text-xl text-gray-600 max-w-3xl mx-auto">
							{subtitle}
						</p>
					)}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
					{plans.map((plan, index) => (
						<div
							key={index}
							className={`relative rounded-lg overflow-hidden transition-all ${
								plan.highlighted
									? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-2xl transform scale-105"
									: "bg-white text-gray-900 shadow-lg hover:shadow-xl"
							}`}
						>
							{plan.highlighted && (
								<div className="absolute top-0 right-0 bg-yellow-400 text-gray-900 px-4 py-1 text-sm font-bold rounded-bl-lg">
									POPULAR
								</div>
							)}
							<div className="p-8">
								<h3
									className={`text-2xl font-bold mb-2 ${
										plan.highlighted ? "text-white" : "text-gray-900"
									}`}
								>
									{plan.name}
								</h3>
								{plan.description && (
									<p
										className={`mb-6 ${
											plan.highlighted ? "text-blue-100" : "text-gray-600"
										}`}
									>
										{plan.description}
									</p>
								)}
								<div className="mb-6">
									<span
										className={`text-5xl font-bold ${
											plan.highlighted ? "text-white" : "text-gray-900"
										}`}
									>
										{formatPrice(plan.price)}
									</span>
									<span
										className={`text-lg ml-2 ${
											plan.highlighted ? "text-blue-100" : "text-gray-600"
										}`}
									>
										/{plan.period}
									</span>
								</div>
								<ul className="mb-8 space-y-3">
									{plan.features.map((feature, featureIndex) => (
										<li key={featureIndex} className="flex items-start">
											<svg
												className={`w-5 h-5 mt-0.5 mr-2 flex-shrink-0 ${
													plan.highlighted ? "text-green-300" : "text-green-500"
												}`}
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span
												className={
													plan.highlighted ? "text-blue-50" : "text-gray-700"
												}
											>
												{feature}
											</span>
										</li>
									))}
								</ul>
								<a
									href={plan.ctaLink}
									className={`block text-center py-3 px-6 rounded-lg font-semibold transition-all ${
										plan.highlighted
											? "bg-white text-blue-600 hover:bg-gray-100"
											: "bg-blue-600 text-white hover:bg-blue-700"
									}`}
								>
									{plan.ctaText}
								</a>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
