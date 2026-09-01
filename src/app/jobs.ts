// Background Jobs System
// Simple queue-based job processing for Next.js

import { createAdminClient } from "@/lib/supabase/server";
import { emailConfig, cartConfig, inventoryConfig } from "./config";

// ==============================================
// JOB TYPES
// ==============================================
export type JobType =
	| "send_email"
	| "send_sms"
	| "send_push"
	| "process_abandoned_cart"
	| "check_low_stock"
	| "generate_report"
	| "cleanup_expired_carts"
	| "sync_inventory"
	| "process_webhook"
	| "generate_invoice";

interface JobPayload {
	send_email: {
		to: string;
		template: string;
		data: Record<string, unknown>;
	};
	send_sms: {
		to: string;
		message: string;
	};
	send_push: {
		userId: string;
		title: string;
		body: string;
		data?: Record<string, unknown>;
	};
	process_abandoned_cart: {
		cartId: string;
		userId: string;
		email: string;
	};
	check_low_stock: Record<string, never>;
	generate_report: {
		type: "sales" | "inventory" | "customers";
		startDate: string;
		endDate: string;
		format: "csv" | "pdf";
	};
	cleanup_expired_carts: Record<string, never>;
	sync_inventory: {
		locationId?: string;
	};
	process_webhook: {
		source: string;
		event: string;
		data: Record<string, unknown>;
	};
	generate_invoice: {
		orderId: string;
	};
}

interface Job<T extends JobType = JobType> {
	id: string;
	type: T;
	payload: JobPayload[T];
	priority: number;
	attempts: number;
	maxAttempts: number;
	scheduledFor: Date;
	createdAt: Date;
	processedAt?: Date;
	completedAt?: Date;
	failedAt?: Date;
	error?: string;
}

// ==============================================
// IN-MEMORY QUEUE (for development/Vercel)
// ==============================================
class JobQueue {
	private jobs: Job[] = [];
	private processing = false;
	private handlers: Map<JobType, (payload: unknown) => Promise<void>> =
		new Map();

	/**
	 * Add a job to the queue
	 */
	async add<T extends JobType>(
		type: T,
		payload: JobPayload[T],
		options: {
			priority?: number;
			delay?: number;
			maxAttempts?: number;
		} = {},
	): Promise<string> {
		const job: Job<T> = {
			id: crypto.randomUUID(),
			type,
			payload,
			priority: options.priority || 0,
			attempts: 0,
			maxAttempts: options.maxAttempts || 3,
			scheduledFor: new Date(Date.now() + (options.delay || 0)),
			createdAt: new Date(),
		};

		this.jobs.push(job as Job);
		this.jobs.sort((a, b) => b.priority - a.priority);

		// Process immediately if not already processing
		if (!this.processing) {
			this.process();
		}

		console.log(`[Jobs] Added job ${job.id} of type ${type}`);
		return job.id;
	}

	/**
	 * Register a job handler
	 */
	register<T extends JobType>(
		type: T,
		handler: (payload: JobPayload[T]) => Promise<void>,
	): void {
		this.handlers.set(type, handler as (payload: unknown) => Promise<void>);
	}

	/**
	 * Process jobs in the queue
	 */
	private async process(): Promise<void> {
		if (this.processing) return;
		this.processing = true;

		while (this.jobs.length > 0) {
			const now = new Date();
			const job = this.jobs.find(
				(j) => j.scheduledFor <= now && !j.processedAt,
			);

			if (!job) {
				// No ready jobs, wait a bit
				await new Promise((resolve) => setTimeout(resolve, 1000));
				continue;
			}

			const handler = this.handlers.get(job.type);
			if (!handler) {
				console.error(`[Jobs] No handler registered for job type: ${job.type}`);
				this.removeJob(job.id);
				continue;
			}

			job.processedAt = new Date();
			job.attempts++;

			try {
				await handler(job.payload);
				job.completedAt = new Date();
				this.removeJob(job.id);
				console.log(`[Jobs] Completed job ${job.id} of type ${job.type}`);
			} catch (error) {
				job.error = error instanceof Error ? error.message : "Unknown error";
				console.error(`[Jobs] Failed job ${job.id}:`, job.error);

				if (job.attempts >= job.maxAttempts) {
					job.failedAt = new Date();
					this.removeJob(job.id);
					console.error(`[Jobs] Job ${job.id} exceeded max attempts, removed`);
				} else {
					// Exponential backoff
					job.processedAt = undefined;
					job.scheduledFor = new Date(
						Date.now() + Math.pow(2, job.attempts) * 1000,
					);
				}
			}
		}

		this.processing = false;
	}

	private removeJob(id: string): void {
		this.jobs = this.jobs.filter((j) => j.id !== id);
	}

	/**
	 * Get queue stats
	 */
	stats(): { pending: number; processing: number; failed: number } {
		const now = new Date();
		return {
			pending: this.jobs.filter((j) => !j.processedAt && j.scheduledFor > now)
				.length,
			processing: this.jobs.filter(
				(j) => j.processedAt && !j.completedAt && !j.failedAt,
			).length,
			failed: this.jobs.filter((j) => j.failedAt).length,
		};
	}
}

// Singleton instance
export const jobQueue = new JobQueue();

// ==============================================
// JOB HANDLERS
// ==============================================

/**
 * Send email handler
 */
async function handleSendEmail(
	payload: JobPayload["send_email"],
): Promise<void> {
	if (!emailConfig.enabled) {
		console.log("[Jobs] Email disabled, skipping:", payload.template);
		return;
	}

	// TODO: Implement actual email sending with nodemailer
	console.log("[Jobs] Sending email:", payload);

	// Example implementation:
	// const transporter = nodemailer.createTransport(emailConfig.smtp);
	// await transporter.sendMail({
	//   from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
	//   to: payload.to,
	//   subject: getSubjectForTemplate(payload.template),
	//   html: renderTemplate(payload.template, payload.data),
	// });
}

/**
 * Send SMS handler
 */
async function handleSendSMS(payload: JobPayload["send_sms"]): Promise<void> {
	console.log("[Jobs] Sending SMS:", payload);
	// TODO: Implement with Twilio or other provider
}

/**
 * Send push notification handler
 */
async function handleSendPush(payload: JobPayload["send_push"]): Promise<void> {
	console.log("[Jobs] Sending push:", payload);
	// TODO: Implement with web push or FCM
}

/**
 * Process abandoned cart handler
 */
async function handleAbandonedCart(
	payload: JobPayload["process_abandoned_cart"],
): Promise<void> {
	const supabase = await createAdminClient();

	// Get cart details
	const { data: cart } = (await supabase
		.from("carts")
		.select(
			`
      *,
      items:cart_items(*, product:products(name, images, base_price))
    `,
		)
		.eq("id", payload.cartId)
		.single()) as any;

	if (!cart || cart.items.length === 0) {
		return;
	}

	// Generate recovery coupon if enabled
	let couponCode: string | undefined;
	const generateCoupon = cartConfig.abandonedCartTimeoutMinutes > 0;

	if (generateCoupon) {
		const code = `RECOVER-${Date.now().toString(36).toUpperCase()}`;
		await supabase.from("coupons").insert({
			code,
			type: "percentage",
			value: 10,
			min_order_amount: 30,
			max_uses: 1,
			expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			is_active: true,
		} as any);
		couponCode = code;
	}

	// Send recovery email
	await jobQueue.add("send_email", {
		to: payload.email,
		template: "abandoned-cart",
		data: {
			cartId: payload.cartId,
			items: cart.items,
			subtotal: cart.subtotal,
			couponCode,
			recoveryUrl: `${process.env.NEXT_PUBLIC_APP_URL}/cart?recover=${payload.cartId}`,
		},
	});

	// Mark cart as abandoned and email sent
	await (supabase.from("carts") as any)
		.update({
			is_abandoned: true,
			abandoned_at: new Date().toISOString(),
			recovery_email_sent_at: new Date().toISOString(),
		})
		.eq("id", payload.cartId);
}

/**
 * Check low stock handler
 */
async function handleCheckLowStock(): Promise<void> {
	const supabase = await createAdminClient();

	const { data: lowStockItems } = (await supabase
		.from("inventory")
		.select(
			`
      *,
      product:products(id, name, sku),
      location:locations(name)
    `,
		)
		.lte("available_quantity", inventoryConfig.lowStockThreshold)) as any;

	if (!lowStockItems || lowStockItems.length === 0) {
		return;
	}

	// Get admin users to notify
	const { data: admins } = (await supabase
		.from("users")
		.select("email")
		.in("role", ["admin", "owner"])) as any;

	if (!admins) return;

	// Send notification to each admin
	for (const admin of admins) {
		await jobQueue.add("send_email", {
			to: admin.email,
			template: "low-stock-alert",
			data: {
				items: lowStockItems.map((item: any) => ({
					productName: item.product?.name,
					sku: item.product?.sku,
					location: item.location?.name,
					quantity: item.available_quantity,
					reorderPoint: item.reorder_point,
				})),
				count: lowStockItems.length,
			},
		});
	}
}

/**
 * Cleanup expired carts handler
 */
async function handleCleanupExpiredCarts(): Promise<void> {
	const supabase = await createAdminClient();

	const expiryDate = new Date(
		Date.now() - cartConfig.cartExpiryDays * 24 * 60 * 60 * 1000,
	);

	const { count } = await supabase
		.from("carts")
		.delete()
		.lt("updated_at", expiryDate.toISOString())
		.is("user_id", null); // Only delete guest carts

	console.log(`[Jobs] Cleaned up ${count} expired guest carts`);
}

/**
 * Generate invoice handler
 */
async function handleGenerateInvoice(
	payload: JobPayload["generate_invoice"],
): Promise<void> {
	const supabase = await createAdminClient();

	const { data: order } = (await supabase
		.from("orders")
		.select(
			`
      *,
      items:order_items(*),
      user:users(first_name, last_name, email)
    `,
		)
		.eq("id", payload.orderId)
		.single()) as any;

	if (!order) {
		throw new Error(`Order not found: ${payload.orderId}`);
	}

	// TODO: Generate PDF invoice using pdfkit
	console.log("[Jobs] Generating invoice for order:", order.order_number);

	// Example structure:
	// const pdf = new PDFDocument();
	// pdf.text(`Invoice for Order ${order.order_number}`);
	// ... add order details
	// const buffer = await pdf.end();

	// Upload to Supabase Storage
	// await supabase.storage
	//   .from('invoices')
	//   .upload(`${order.id}.pdf`, buffer);

	// Send invoice email
	await jobQueue.add("send_email", {
		to: order.user?.email || order.shipping_address.email,
		template: "invoice",
		data: {
			orderNumber: order.order_number,
			invoiceUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/orders/${order.id}/invoice`,
		},
	});
}

/**
 * Generate report handler
 */
async function handleGenerateReport(
	payload: JobPayload["generate_report"],
): Promise<void> {
	// No database client until there is something to query — the handler is
	// still a stub.
	console.log("[Jobs] Generating report:", payload);

	// TODO: Implement report generation based on type
	// This would query data, format it, and generate CSV/PDF
}

/**
 * Sync inventory handler
 */
async function handleSyncInventory(
	payload: JobPayload["sync_inventory"],
): Promise<void> {
	console.log("[Jobs] Syncing inventory:", payload);
	// TODO: Sync with external inventory management system
}

/**
 * Process webhook handler
 */
async function handleProcessWebhook(
	payload: JobPayload["process_webhook"],
): Promise<void> {
	console.log("[Jobs] Processing webhook:", payload.source, payload.event);
	// Webhook processing is usually done synchronously in the webhook endpoint
	// This is for async processing of heavy operations
}

// ==============================================
// REGISTER ALL HANDLERS
// ==============================================
jobQueue.register("send_email", handleSendEmail);
jobQueue.register("send_sms", handleSendSMS);
jobQueue.register("send_push", handleSendPush);
jobQueue.register("process_abandoned_cart", handleAbandonedCart);
jobQueue.register("check_low_stock", handleCheckLowStock);
jobQueue.register("cleanup_expired_carts", handleCleanupExpiredCarts);
jobQueue.register("generate_invoice", handleGenerateInvoice);
jobQueue.register("generate_report", handleGenerateReport);
jobQueue.register("sync_inventory", handleSyncInventory);
jobQueue.register("process_webhook", handleProcessWebhook);

// ==============================================
// SCHEDULED JOBS (Cron-like)
// ==============================================
export interface ScheduledJob {
	name: string;
	cron: string; // cron expression
	handler: () => Promise<void>;
	enabled: boolean;
}

export const scheduledJobs: ScheduledJob[] = [
	{
		name: "Check abandoned carts",
		cron: "*/15 * * * *", // Every 15 minutes
		handler: async () => {
			const supabase = await createAdminClient();
			const abandonedThreshold = new Date(
				Date.now() - cartConfig.abandonedCartTimeoutMinutes * 60 * 1000,
			);

			const { data: carts } = await supabase
				.from("carts")
				.select("id, user_id, users(email)")
				.eq("is_abandoned", false)
				.is("recovery_email_sent_at", null)
				.lt("updated_at", abandonedThreshold.toISOString())
				.not("user_id", "is", null);

			for (const cart of carts || []) {
				await jobQueue.add("process_abandoned_cart", {
					cartId: cart.id,
					userId: cart.user_id,
					email: (cart as unknown as { users: { email: string } }).users?.email,
				});
			}
		},
		enabled: true,
	},
	{
		name: "Check low stock",
		cron: "0 9 * * *", // Daily at 9 AM
		handler: async () => {
			await jobQueue.add("check_low_stock", {});
		},
		enabled: true,
	},
	{
		name: "Cleanup expired carts",
		cron: "0 2 * * *", // Daily at 2 AM
		handler: async () => {
			await jobQueue.add("cleanup_expired_carts", {});
		},
		enabled: true,
	},
];

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Enqueue order confirmation emails
 */
export async function enqueueOrderConfirmation(
	orderId: string,
	email: string,
): Promise<void> {
	await jobQueue.add("send_email", {
		to: email,
		template: "order-confirmation",
		data: { orderId },
	});

	await jobQueue.add("generate_invoice", { orderId });
}

/**
 * Enqueue shipping notification
 */
export async function enqueueShippingNotification(
	orderId: string,
	email: string,
	trackingNumber: string,
	trackingUrl: string,
): Promise<void> {
	await jobQueue.add("send_email", {
		to: email,
		template: "order-shipped",
		data: { orderId, trackingNumber, trackingUrl },
	});

	// Also send SMS if phone is available
	// await jobQueue.add('send_sms', { ... });
}

/**
 * Enqueue password reset email
 */
export async function enqueuePasswordReset(
	email: string,
	resetToken: string,
): Promise<void> {
	await jobQueue.add(
		"send_email",
		{
			to: email,
			template: "password-reset",
			data: {
				resetUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`,
			},
		},
		{ priority: 10 },
	); // High priority
}

/**
 * Enqueue welcome email
 */
export async function enqueueWelcomeEmail(
	email: string,
	firstName: string,
): Promise<void> {
	await jobQueue.add("send_email", {
		to: email,
		template: "welcome",
		data: { firstName },
	});
}

export default jobQueue;
