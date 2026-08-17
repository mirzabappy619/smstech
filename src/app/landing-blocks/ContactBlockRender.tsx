"use client";

import { ContactBlockData } from "../landing-page-types";
import { useState } from "react";

interface ContactBlockRenderProps {
	data: ContactBlockData;
}

export default function ContactBlockRender({ data }: ContactBlockRenderProps) {
	const { title, phoneNumber, description, email, showForm = false } = data;
	const [formData, setFormData] = useState({ name: "", email: "", message: "" });
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setSubmitStatus(null);

		// Simulate form submission
		await new Promise((resolve) => setTimeout(resolve, 1000));
		
		setIsSubmitting(false);
		setSubmitStatus("success");
		setFormData({ name: "", email: "", message: "" });
		
		setTimeout(() => setSubmitStatus(null), 5000);
	};

	return (
		<section className="py-16 px-4 bg-gray-50">
			<div className="max-w-4xl mx-auto">
				<div className="text-center mb-12">
					<h2 className="text-4xl font-bold mb-4 text-gray-900">{title}</h2>
					{description && (
						<p className="text-xl text-gray-600 max-w-3xl mx-auto">
							{description}
						</p>
					)}
				</div>

				<div className={showForm ? "grid md:grid-cols-2 gap-8" : ""}>
					<div className={showForm ? "" : "text-center"}>
						<div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
							<div className="flex items-center justify-center md:justify-start">
								<svg
									className="w-6 h-6 text-blue-600 mr-3"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
									/>
								</svg>
								<a
									href={`tel:${phoneNumber}`}
									className="text-2xl font-semibold text-gray-900 hover:text-blue-600"
								>
									{phoneNumber}
								</a>
							</div>

							{email && (
								<div className="flex items-center justify-center md:justify-start">
									<svg
										className="w-6 h-6 text-blue-600 mr-3"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
										/>
									</svg>
									<a
										href={`mailto:${email}`}
										className="text-xl text-gray-900 hover:text-blue-600"
									>
										{email}
									</a>
								</div>
							)}
						</div>
					</div>

					{showForm && (
						<div className="bg-white rounded-lg shadow-lg p-8">
							<form onSubmit={handleSubmit} className="space-y-4">
								<div>
									<label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
										Name
									</label>
									<input
										type="text"
										id="name"
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										required
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									/>
								</div>
								<div>
									<label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
										Email
									</label>
									<input
										type="email"
										id="email"
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										required
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									/>
								</div>
								<div>
									<label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
										Message
									</label>
									<textarea
										id="message"
										rows={4}
										value={formData.message}
										onChange={(e) => setFormData({ ...formData, message: e.target.value })}
										required
										className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									/>
								</div>
								<button
									type="submit"
									disabled={isSubmitting}
									className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
								>
									{isSubmitting ? "Sending..." : "Send Message"}
								</button>
								{submitStatus === "success" && (
									<p className="text-green-600 text-center">Message sent successfully!</p>
								)}
								{submitStatus === "error" && (
									<p className="text-red-600 text-center">Failed to send message. Please try again.</p>
								)}
							</form>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
