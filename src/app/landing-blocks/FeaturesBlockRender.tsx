"use client";

import { FeaturesBlockData } from "../landing-page-types";

interface FeaturesBlockRenderProps {
	data: FeaturesBlockData;
}

export default function FeaturesBlockRender({ data }: FeaturesBlockRenderProps) {
	const { title, subtitle, features, columns = 3 } = data;

	const gridColsClass = {
		1: "md:grid-cols-1",
		2: "md:grid-cols-2",
		3: "md:grid-cols-3",
		4: "md:grid-cols-4",
	}[columns] || "md:grid-cols-3";

	return (
		<section className="py-16 px-4 bg-white">
			<div className="max-w-7xl mx-auto">
				<div className="text-center mb-12">
					<h2 className="text-4xl font-bold mb-4 text-gray-900">{title}</h2>
					{subtitle && (
						<p className="text-xl text-gray-600 max-w-3xl mx-auto">
							{subtitle}
						</p>
					)}
				</div>

				<div className={`grid grid-cols-1 ${gridColsClass} gap-8`}>
					{features.map((feature, index) => (
						<div
							key={index}
							className="p-6 rounded-lg hover:shadow-lg transition-shadow bg-gray-50"
						>
							<div className="text-5xl mb-4">{feature.icon}</div>
							<h3 className="text-xl font-semibold mb-3 text-gray-900">
								{feature.title}
							</h3>
							<p className="text-gray-600">{feature.description}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
