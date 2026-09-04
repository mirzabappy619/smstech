"use client";

import { OrderFormBlockData } from "../landing-page-types";
import { useState } from "react";
import { isValidBDPhone, BD_PHONE_ERROR_MESSAGE } from "@/lib/bd-phone-validator";
import { trackMetaPurchase, getMetaCookie } from "@/presentation/components/meta-pixel";

interface OrderFormBlockRenderProps {
	data: OrderFormBlockData;
}

interface OrderFormState {
	selectedProductId: string;
	quantity: number;
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	address: string;
}

export default function OrderFormBlockRender({
	data,
}: OrderFormBlockRenderProps) {
	console.log(
		"OrderFormBlockRender rendering with data:",
		JSON.stringify(data, null, 2),
	);

	const {
		title,
		subtitle,
		productOptions = [],
		showQuantity = true,
		requiredFields = ["firstName", "lastName", "phone", "address"],
		successMessage = "Thank you for your order! We'll contact you shortly.",
	} = data || {};

	console.log("Extracted productOptions count:", productOptions?.length);

	const [formState, setFormState] = useState<OrderFormState>({
		selectedProductId: "",
		quantity: 1,
		firstName: "",
		lastName: "",
		email: "",
		phone: "",
		address: "",
	});

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(
		null,
	);
	const [errorMessage, setErrorMessage] = useState("");

	const selectedProduct = productOptions.find(
		(p) => p.id === formState.selectedProductId,
	);

	const totalPrice = selectedProduct
		? selectedProduct.price * formState.quantity
		: 0;

	const isFieldRequired = (field: string) => requiredFields.includes(field);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setSubmitStatus(null);
		setErrorMessage("");

		if (!selectedProduct) {
			setErrorMessage("Please select a product");
			setIsSubmitting(false);
			return;
		}

		if (formState.phone && !isValidBDPhone(formState.phone)) {
			setErrorMessage(BD_PHONE_ERROR_MESSAGE);
			setIsSubmitting(false);
			return;
		}

		try {
			// Step 1: Add product to cart
			const cartResponse = await fetch("/api/v1/cart", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					product_id: selectedProduct.id,
					quantity: formState.quantity,
				}),
			});

			if (!cartResponse.ok) {
				throw new Error("Failed to add product to cart");
			}

			// Step 2: Build customer info
			const customerInfo: Record<string, string> = {};
			if (isFieldRequired("firstName"))
				customerInfo.firstName = formState.firstName;
			if (isFieldRequired("lastName"))
				customerInfo.lastName = formState.lastName;
			if (isFieldRequired("email")) customerInfo.email = formState.email;
			if (isFieldRequired("phone")) customerInfo.phone = formState.phone;
			if (isFieldRequired("address")) customerInfo.address = formState.address;

			// Step 3: Create order (will use cart items)
			const fbc = getMetaCookie("_fbc");
			const fbp = getMetaCookie("_fbp");

			const payload = {
				shipping_address: {
					first_name: formState.firstName,
					last_name: formState.lastName,
					address_line1: formState.address,
					city: "Dhaka",
					state: "Dhaka",
					postal_code: "1205",
					country: "BD",
					phone: formState.phone,
					...(formState.email && { email: formState.email }),
				},
				shipping_method: "standard",
				payment_method: "cash_on_delivery",
				source: "landing_page",
				fbc: fbc || null,
				fbp: fbp || null,
			};

			const response = await fetch("/api/v1/orders", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || "Failed to submit order");
			}

			const orderJson = await response.json().catch(() => null);
			const createdOrderId =
				orderJson?.data?.order?.id || orderJson?.order?.id || `ORD-${Date.now()}`;

			// Track Meta Pixel & CAPI Purchase
			try {
				trackMetaPurchase({
					eventId: createdOrderId,
					value: totalPrice,
					currency: "BDT",
					contentIds: [selectedProduct.id],
					contents: [
						{
							id: selectedProduct.id,
							quantity: formState.quantity,
							item_price: selectedProduct.price,
						},
					],
					numItems: formState.quantity,
				});
			} catch {}

			// Step 4: Clear the cart after successful order
			await fetch("/api/v1/cart", {
				method: "DELETE",
			});

			setSubmitStatus("success");
			setFormState({
				selectedProductId: "",
				quantity: 1,
				firstName: "",
				lastName: "",
				email: "",
				phone: "",
				address: "",
			});
		} catch (error) {
			setSubmitStatus("error");
			setErrorMessage(
				error instanceof Error ? error.message : "Failed to submit order",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (submitStatus === "success") {
		return (
			<section className="py-16 px-4 bg-surface">
				<div className="max-w-4xl mx-auto text-center">
					<div className="bg-verified-soft border-2 border-verified rounded-lg p-8">
						<svg
							className="w-16 h-16 text-verified mx-auto mb-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
						<h3 className="text-2xl font-bold text-ink mb-2">
							Order Submitted!
						</h3>
						<p className="text-ink mb-6">{successMessage}</p>
						<button
							onClick={() => setSubmitStatus(null)}
							className="bg-accent text-on-accent px-6 py-2 rounded-lg hover:bg-accent-hover">
							Place Another Order
						</button>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className="py-16 px-4 bg-surface">
			<div className="max-w-4xl mx-auto">
				<div className="text-center mb-12">
					<h2 className="text-4xl font-bold mb-4 text-ink">{title}</h2>
					{subtitle && (
						<p className="text-xl text-ink-2 max-w-3xl mx-auto">
							{subtitle}
						</p>
					)}
				</div>

				<form
					onSubmit={handleSubmit}
					className="space-y-8">
					{/* Product Selection */}
					<div>
						<h3 className="text-2xl font-semibold mb-4 text-ink">
							Select Product
						</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{productOptions.map((product) => (
								<div
									key={product.id}
									onClick={() =>
										setFormState({
											...formState,
											selectedProductId: product.id,
										})
									}
									className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
										formState.selectedProductId === product.id
											? "border-blue-600 bg-blue-50 shadow-lg"
											: "border-gray-300 hover:border-blue-300"
									}`}>
									{product.image && (
										<img
											src={product.image}
											alt={product.name}
											className="w-full h-40 object-cover rounded-lg mb-3"
										/>
									)}
									<h4 className="font-semibold text-lg text-ink mb-1">
										{product.name}
									</h4>
									{product.description && (
										<p className="text-sm text-ink-2 mb-2">
											{product.description}
										</p>
									)}
									<p className="text-xl font-bold text-accent">
										${product.price}
									</p>
								</div>
							))}
						</div>
					</div>

					{/* Quantity */}
					{showQuantity && (
						<div>
							<label
								htmlFor="quantity"
								className="block text-lg font-medium text-ink mb-2">
								Quantity
							</label>
							<input
								type="number"
								id="quantity"
								min="1"
								value={formState.quantity}
								onChange={(e) =>
									setFormState({
										...formState,
										quantity: parseInt(e.target.value) || 1,
									})
								}
								className="w-32 px-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-accent/15 focus:border-accent text-ink bg-surface"
							/>
						</div>
					)}

					{/* Customer Information */}
					<div>
						<h3 className="text-2xl font-semibold mb-4 text-ink">
							Customer Information
						</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{isFieldRequired("firstName") && (
								<div>
									<label
										htmlFor="firstName"
										className="block text-sm font-medium text-ink mb-1">
										First Name *
									</label>
									<input
										type="text"
										id="firstName"
										value={formState.firstName}
										onChange={(e) =>
											setFormState({ ...formState, firstName: e.target.value })
										}
										required
										className="w-full px-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-accent/15 focus:border-accent text-ink bg-surface"
									/>
								</div>
							)}

							{isFieldRequired("lastName") && (
								<div>
									<label
										htmlFor="lastName"
										className="block text-sm font-medium text-ink mb-1">
										Last Name *
									</label>
									<input
										type="text"
										id="lastName"
										value={formState.lastName}
										onChange={(e) =>
											setFormState({ ...formState, lastName: e.target.value })
										}
										required
										className="w-full px-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-accent/15 focus:border-accent text-ink bg-surface"
									/>
								</div>
							)}

							{isFieldRequired("email") && (
								<div>
									<label
										htmlFor="email"
										className="block text-sm font-medium text-ink mb-1">
										Email *
									</label>
									<input
										type="email"
										id="email"
										value={formState.email}
										onChange={(e) =>
											setFormState({ ...formState, email: e.target.value })
										}
										required
										className="w-full px-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-accent/15 focus:border-accent text-ink bg-surface"
									/>
								</div>
							)}

							{isFieldRequired("phone") && (
								<div>
									<label
										htmlFor="phone"
										className="block text-sm font-medium text-ink mb-1">
										Phone *
									</label>
									<input
										type="tel"
										id="phone"
										value={formState.phone}
										onChange={(e) =>
											setFormState({ ...formState, phone: e.target.value })
										}
										required
										className="w-full px-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-accent/15 focus:border-accent text-ink bg-surface"
									/>
								</div>
							)}

							{isFieldRequired("address") && (
								<div className="md:col-span-2">
									<label
										htmlFor="address"
										className="block text-sm font-medium text-ink mb-1">
										Shipping Address *
									</label>
									<textarea
										id="address"
										rows={3}
										value={formState.address}
										onChange={(e) =>
											setFormState({ ...formState, address: e.target.value })
										}
										required
										className="w-full px-4 py-2 border border-line rounded-lg focus:ring-2 focus:ring-accent/15 focus:border-accent text-ink bg-surface"
									/>
								</div>
							)}
						</div>
					</div>

					{/* Total Price */}
					{selectedProduct && (
						<div className="bg-bg p-6 rounded-lg">
							<div className="flex justify-between items-center text-2xl font-bold">
								<span className="text-ink">Total:</span>
								<span className="text-accent">৳{Math.round(totalPrice)}</span>
							</div>
							<p className="text-sm text-ink-2 mt-2">
								Payment Method: Cash on Delivery
							</p>
						</div>
					)}

					{/* Error Message */}
					{submitStatus === "error" && (
						<div className="bg-danger-soft border border-danger text-danger px-4 py-3 rounded-lg">
							{errorMessage || "Failed to submit order. Please try again."}
						</div>
					)}

					{/* Submit Button */}
					<button
						type="submit"
						disabled={isSubmitting || !selectedProduct}
						className="w-full bg-accent text-on-accent py-4 rounded-lg text-lg font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors">
						{isSubmitting ? "Submitting Order..." : "Place Order"}
					</button>
				</form>
			</div>
		</section>
	);
}
