import crypto from "crypto";

export interface MetaCapiEvent {
  event_name: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase" | "Lead";
  event_time: number;
  event_id: string; // for deduplication with browser pixel
  user_data: {
    email?: string;
    phone?: string;
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;
    fbp?: string;
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_name?: string;
    content_category?: string;
    content_ids?: string[];
    contents?: Array<{ id: string; quantity: number; item_price: number }>;
    num_items?: number;
    order_id?: string;
  };
}

function hashSha256(val: string | undefined): string | undefined {
  if (!val) return undefined;
  return crypto.createHash("sha256").update(val.trim().toLowerCase()).digest("hex");
}

export class MetaCapiService {
  private pixelId: string;
  private accessToken: string;
  private testEventCode?: string;

  constructor(pixelId?: string, accessToken?: string, testEventCode?: string) {
    this.pixelId = pixelId || process.env.META_PIXEL_ID || "12903829102";
    this.accessToken = accessToken || process.env.META_CAPI_ACCESS_TOKEN || "meta_mock_access_token";
    this.testEventCode = testEventCode;
  }

  async sendEvent(event: MetaCapiEvent): Promise<{ success: boolean; response?: any }> {
    const payload = {
      data: [
        {
          event_name: event.event_name,
          event_time: event.event_time || Math.floor(Date.now() / 1000),
          event_id: event.event_id,
          action_source: "website",
          user_data: {
            em: hashSha256(event.user_data.email),
            ph: hashSha256(event.user_data.phone),
            client_ip_address: event.user_data.client_ip_address,
            client_user_agent: event.user_data.client_user_agent,
            fbc: event.user_data.fbc,
            fbp: event.user_data.fbp,
          },
          custom_data: event.custom_data,
        },
      ],
      ...(this.testEventCode ? { test_event_code: this.testEventCode } : {}),
    };

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${this.pixelId}/events?access_token=${this.accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return { success: res.ok, response: data };
    } catch (err: any) {
      console.warn("CAPI dispatch failed", err);
      return { success: false, response: err.message };
    }
  }
}
