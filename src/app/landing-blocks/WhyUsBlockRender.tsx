"use client";

import { WhyUsBlockData } from "../landing-page-types";

interface WhyUsBlockRenderProps {
	data: WhyUsBlockData;
}

export default function WhyUsBlockRender({ data }: WhyUsBlockRenderProps) {
	const { title, subtitle, reasons } = data;

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

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					{reasons.map((reason, index) => (
						<div
							key={index}
							className="flex flex-col items-center text-center p-6 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 hover:shadow-lg transition-all"
						>
							<div className="text-6xl mb-4">{reason.icon}</div>
							<h3 className="text-xl font-semibold mb-3 text-gray-900">
								{reason.title}
							</h3>
							<p className="text-gray-600">{reason.description}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
