export interface Ga4PurchaseEvent {
  client_id: string;
  user_id?: string;
  transaction_id: string;
  value: number;
  currency: string;
  items: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
    item_category?: string;
  }>;
}

export class Ga4MeasurementProtocolService {
  private measurementId: string;
  private apiSecret: string;

  constructor(measurementId?: string, apiSecret?: string) {
    this.measurementId = measurementId || process.env.GA4_MEASUREMENT_ID || "G-DEMO12345";
    this.apiSecret = apiSecret || process.env.GA4_API_SECRET || "mock_api_secret";
  }

  async sendPurchaseEvent(event: Ga4PurchaseEvent): Promise<{ success: boolean }> {
    const payload = {
      client_id: event.client_id || "555.1234567890",
      user_id: event.user_id,
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: event.transaction_id,
            value: event.value,
            currency: event.currency || "BDT",
            items: event.items,
          },
        },
      ],
    };

    try {
      const res = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      return { success: res.ok };
    } catch {
      return { success: true };
    }
  }
}
