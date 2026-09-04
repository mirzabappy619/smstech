"use client";

import { useState } from "react";
import { CheckCircle2, Mail, Phone } from "lucide-react";
import { ContactBlockData } from "../landing-page-types";

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

	const field =
		"h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15";
	const labelCls = "mb-1.5 block text-[13px] font-medium text-ink";

	return (
		<section className="bg-bg px-6 py-20">
			<div className="mx-auto max-w-4xl">
				<div className="mx-auto mb-12 max-w-2xl text-center">
					<h2 className="font-display text-[28px] font-semibold tracking-tight text-ink md:text-[36px]">
						{title}
					</h2>
					{description && (
						<p className="mt-3 text-[15px] leading-relaxed text-ink-2">{description}</p>
					)}
				</div>

				<div className={showForm ? "grid gap-4 md:grid-cols-2" : "mx-auto max-w-md"}>
					<ul className="grid h-fit gap-px overflow-hidden rounded-xl border border-line bg-line">
						{phoneNumber && (
							<li className="bg-surface">
								<a
									href={`tel:${phoneNumber}`}
									className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-2"
								>
									<Phone className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
									<span className="min-w-0">
										<span className="block text-xs text-ink-3">Call us</span>
										<span className="tnum block truncate text-[15px] font-medium text-ink">
											{phoneNumber}
										</span>
									</span>
								</a>
							</li>
						)}
						{email && (
							<li className="bg-surface">
								<a
									href={`mailto:${email}`}
									className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-2"
								>
									<Mail className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
									<span className="min-w-0">
										<span className="block text-xs text-ink-3">Email us</span>
										<span className="block truncate text-[15px] font-medium text-ink">
											{email}
										</span>
									</span>
								</a>
							</li>
						)}
					</ul>

					{showForm && (
						<form
							onSubmit={handleSubmit}
							className="space-y-4 rounded-xl border border-line bg-surface p-6"
						>
							<div>
								<label htmlFor="lp-contact-name" className={labelCls}>
									Name
								</label>
								<input
									type="text"
									id="lp-contact-name"
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									required
									className={field}
								/>
							</div>
							<div>
								<label htmlFor="lp-contact-email" className={labelCls}>
									Email
								</label>
								<input
									type="email"
									id="lp-contact-email"
									value={formData.email}
									onChange={(e) => setFormData({ ...formData, email: e.target.value })}
									required
									className={field}
								/>
							</div>
							<div>
								<label htmlFor="lp-contact-message" className={labelCls}>
									Message
								</label>
								<textarea
									id="lp-contact-message"
									rows={4}
									value={formData.message}
									onChange={(e) => setFormData({ ...formData, message: e.target.value })}
									required
									className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
								/>
							</div>
							<button
								type="submit"
								disabled={isSubmitting}
								className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
							>
								{isSubmitting ? "Sending…" : "Send message"}
							</button>
							{submitStatus === "success" && (
								<p className="flex items-center justify-center gap-1.5 text-[13px] text-verified">
									<CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
									Message sent.
								</p>
							)}
							{submitStatus === "error" && (
								<p className="text-center text-[13px] text-danger">
									That didn&rsquo;t send. Please try again.
								</p>
							)}
						</form>
					)}
				</div>
			</div>
		</section>
	);
}
