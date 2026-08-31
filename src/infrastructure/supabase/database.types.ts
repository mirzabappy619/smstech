// Supabase Database Types
// This file should be generated using: npx supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          role: 'customer' | 'admin' | 'owner' | 'delivery';
          is_active: boolean;
          is_email_verified: boolean;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          first_name: string;
          last_name: string;
          phone?: string | null;
          role?: 'customer' | 'admin' | 'owner' | 'delivery';
          is_active?: boolean;
          is_email_verified?: boolean;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          role?: 'customer' | 'admin' | 'owner' | 'delivery';
          is_active?: boolean;
          is_email_verified?: boolean;
          avatar_url?: string | null;
          updated_at?: string;
          last_login_at?: string | null;
        };
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          street: string;
          apartment: string | null;
          city: string;
          state: string;
          postal_code: string;
          country: string;
          is_default: boolean;
          label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          street: string;
          apartment?: string | null;
          city: string;
          state: string;
          postal_code: string;
          country: string;
          is_default?: boolean;
          label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          street?: string;
          apartment?: string | null;
          city?: string;
          state?: string;
          postal_code?: string;
          country?: string;
          is_default?: boolean;
          label?: string | null;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          parent_id: string | null;
          image_url: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          parent_id?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          parent_id?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string;
          short_description: string | null;
          sku: string;
          barcode: string | null;
          category_id: string;
          brand_id: string | null;
          base_price: number;
          compare_at_price: number | null;
          currency: string;
          images: string[];
          tags: string[];
          seo_title: string | null;
          seo_description: string | null;
          is_active: boolean;
          is_featured: boolean;
          weight: number | null;
          dimensions: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description: string;
          short_description?: string | null;
          sku: string;
          barcode?: string | null;
          category_id: string;
          brand_id?: string | null;
          base_price: number;
          compare_at_price?: number | null;
          currency?: string;
          images?: string[];
          tags?: string[];
          seo_title?: string | null;
          seo_description?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          weight?: number | null;
          dimensions?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string;
          short_description?: string | null;
          sku?: string;
          barcode?: string | null;
          category_id?: string;
          brand_id?: string | null;
          base_price?: number;
          compare_at_price?: number | null;
          currency?: string;
          images?: string[];
          tags?: string[];
          seo_title?: string | null;
          seo_description?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          weight?: number | null;
          dimensions?: Json | null;
          updated_at?: string;
        };
      };
      product_variations: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          sku: string;
          price: number;
          compare_at_price: number | null;
          currency: string;
          stock: number;
          attributes: Json;
          images: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          sku: string;
          price: number;
          compare_at_price?: number | null;
          currency?: string;
          stock?: number;
          attributes?: Json;
          images?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          sku?: string;
          price?: number;
          compare_at_price?: number | null;
          currency?: string;
          stock?: number;
          attributes?: Json;
          images?: string[];
          is_active?: boolean;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          order_number: string;
          subtotal: number;
          tax: number;
          shipping: number;
          discount: number;
          total: number;
          currency: string;
          status: string;
          payment_status: string;
          payment_method: string | null;
          shipping_address: Json;
          billing_address: Json | null;
          coupon_code: string | null;
          tracking_number: string | null;
          estimated_delivery: string | null;
          delivered_at: string | null;
          cancelled_at: string | null;
          cancel_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_number: string;
          subtotal: number;
          tax?: number;
          shipping?: number;
          discount?: number;
          total: number;
          currency?: string;
          status?: string;
          payment_status?: string;
          payment_method?: string | null;
          shipping_address: Json;
          billing_address?: Json | null;
          coupon_code?: string | null;
          tracking_number?: string | null;
          estimated_delivery?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subtotal?: number;
          tax?: number;
          shipping?: number;
          discount?: number;
          total?: number;
          status?: string;
          payment_status?: string;
          payment_method?: string | null;
          shipping_address?: Json;
          billing_address?: Json | null;
          coupon_code?: string | null;
          tracking_number?: string | null;
          estimated_delivery?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          variation_id: string | null;
          name: string;
          sku: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          currency: string;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          variation_id?: string | null;
          name: string;
          sku: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          currency?: string;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          quantity?: number;
          unit_price?: number;
          total_price?: number;
        };
      };
      order_notes: {
        Row: {
          id: string;
          order_id: string;
          content: string;
          is_internal: boolean;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          content: string;
          is_internal?: boolean;
          created_by: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
      };
      carts: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string;
          coupon_code: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id: string;
          coupon_code?: string | null;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          coupon_code?: string | null;
          expires_at?: string;
          updated_at?: string;
        };
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          variation_id: string | null;
          quantity: number;
          added_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          product_id: string;
          variation_id?: string | null;
          quantity?: number;
          added_at?: string;
        };
        Update: {
          quantity?: number;
        };
      };
      inventory: {
        Row: {
          id: string;
          product_id: string;
          variation_id: string | null;
          warehouse_id: string;
          quantity: number;
          reserved_quantity: number;
          available_quantity: number;
          reorder_point: number | null;
          reorder_quantity: number | null;
          bin_location: string | null;
          last_counted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          variation_id?: string | null;
          warehouse_id: string;
          quantity?: number;
          reserved_quantity?: number;
          reorder_point?: number | null;
          reorder_quantity?: number | null;
          bin_location?: string | null;
          last_counted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          quantity?: number;
          reserved_quantity?: number;
          reorder_point?: number | null;
          reorder_quantity?: number | null;
          bin_location?: string | null;
          last_counted_at?: string | null;
          updated_at?: string;
        };
      };
      inventory_logs: {
        Row: {
          id: string;
          inventory_id: string;
          type: string;
          quantity: number;
          previous_stock: number;
          new_stock: number;
          reason: string | null;
          order_id: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          inventory_id: string;
          type: string;
          quantity: number;
          previous_stock: number;
          new_stock: number;
          reason?: string | null;
          order_id?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: never;
      };
      locations: {
        Row: {
          id: string;
          name: string;
          code: string;
          address: Json;
          is_active: boolean;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          address: Json;
          is_active?: boolean;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          code?: string;
          address?: Json;
          is_active?: boolean;
          is_default?: boolean;
          updated_at?: string;
        };
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: never;
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          type: 'percentage' | 'fixed' | 'free_shipping';
          value: number;
          min_order_amount: number | null;
          max_uses: number | null;
          used_count: number;
          starts_at: string | null;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          type: 'percentage' | 'fixed' | 'free_shipping';
          value: number;
          min_order_amount?: number | null;
          max_uses?: number | null;
          used_count?: number;
          starts_at?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          type?: 'percentage' | 'fixed' | 'free_shipping';
          value?: number;
          min_order_amount?: number | null;
          max_uses?: number | null;
          used_count?: number;
          starts_at?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      delivery_zones: {
        Row: {
          id: string;
          name: string;
          postal_codes: string[];
          shipping_rate: number;
          min_order_for_free: number | null;
          estimated_days: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          postal_codes?: string[];
          shipping_rate: number;
          min_order_for_free?: number | null;
          estimated_days?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          postal_codes?: string[];
          shipping_rate?: number;
          min_order_for_free?: number | null;
          estimated_days?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: never;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data: Json | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data?: Json | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          is_read?: boolean;
        };
      };
      fraud_flags: {
        Row: {
          id: string;
          user_id: string | null;
          order_id: string | null;
          type: string;
          severity: 'low' | 'medium' | 'high';
          details: Json;
          is_resolved: boolean;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          order_id?: string | null;
          type: string;
          severity: 'low' | 'medium' | 'high';
          details: Json;
          is_resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          is_resolved?: boolean;
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
      };
      device_units: {
        Row: {
          id: string;
          product_id: string;
          variation_id: string | null;
          warehouse_id: string;
          serial_number: string;
          imei_1: string | null;
          imei_2: string | null;
          mac_address: string | null;
          battery_health_pct: number | null;
          battery_cycles: number;
          cosmetic_grade: 'Brand New' | 'Like New A+' | 'Grade A' | 'Grade B';
          regional_variant: string;
          specs_summary: Json;
          cost_price: number;
          selling_price: number;
          status: 'in_stock' | 'reserved' | 'sold' | 'in_transit' | 'defective' | 'returned';
          sold_order_id: string | null;
          sold_at: string | null;
          warranty_months: number;
          warranty_expires_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          variation_id?: string | null;
          warehouse_id: string;
          serial_number: string;
          imei_1?: string | null;
          imei_2?: string | null;
          mac_address?: string | null;
          battery_health_pct?: number | null;
          battery_cycles?: number;
          cosmetic_grade?: 'Brand New' | 'Like New A+' | 'Grade A' | 'Grade B';
          regional_variant?: string;
          specs_summary?: Json;
          cost_price?: number;
          selling_price: number;
          status?: 'in_stock' | 'reserved' | 'sold' | 'in_transit' | 'defective' | 'returned';
          sold_order_id?: string | null;
          sold_at?: string | null;
          warranty_months?: number;
          warranty_expires_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          variation_id?: string | null;
          warehouse_id?: string;
          serial_number?: string;
          imei_1?: string | null;
          imei_2?: string | null;
          mac_address?: string | null;
          battery_health_pct?: number | null;
          battery_cycles?: number;
          cosmetic_grade?: 'Brand New' | 'Like New A+' | 'Grade A' | 'Grade B';
          regional_variant?: string;
          specs_summary?: Json;
          cost_price?: number;
          selling_price?: number;
          status?: 'in_stock' | 'reserved' | 'sold' | 'in_transit' | 'defective' | 'returned';
          sold_order_id?: string | null;
          sold_at?: string | null;
          warranty_months?: number;
          warranty_expires_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      branch_transfers: {
        Row: {
          id: string;
          transfer_number: string;
          source_warehouse_id: string;
          target_warehouse_id: string;
          status: 'pending' | 'in_transit' | 'received' | 'rejected';
          total_items: number;
          notes: string | null;
          created_by: string | null;
          received_by: string | null;
          shipped_at: string | null;
          received_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transfer_number: string;
          source_warehouse_id: string;
          target_warehouse_id: string;
          status?: 'pending' | 'in_transit' | 'received' | 'rejected';
          total_items?: number;
          notes?: string | null;
          created_by?: string | null;
          received_by?: string | null;
          shipped_at?: string | null;
          received_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'in_transit' | 'received' | 'rejected';
          total_items?: number;
          notes?: string | null;
          received_by?: string | null;
          shipped_at?: string | null;
          received_at?: string | null;
          updated_at?: string;
        };
      };
      pos_shifts: {
        Row: {
          id: string;
          shift_number: string;
          warehouse_id: string;
          cashier_user_id: string | null;
          opening_float: number;
          closing_cash_actual: number | null;
          closing_cash_expected: number | null;
          cash_sales_total: number;
          card_sales_total: number;
          mobile_sales_total: number;
          wallet_sales_total: number;
          dues_created_total: number;
          dues_collected_total: number;
          difference: number;
          status: 'open' | 'closed';
          opened_at: string;
          closed_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shift_number: string;
          warehouse_id: string;
          cashier_user_id?: string | null;
          opening_float?: number;
          closing_cash_actual?: number | null;
          closing_cash_expected?: number | null;
          cash_sales_total?: number;
          card_sales_total?: number;
          mobile_sales_total?: number;
          wallet_sales_total?: number;
          dues_created_total?: number;
          dues_collected_total?: number;
          difference?: number;
          status?: 'open' | 'closed';
          opened_at?: string;
          closed_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          closing_cash_actual?: number | null;
          closing_cash_expected?: number | null;
          cash_sales_total?: number;
          card_sales_total?: number;
          mobile_sales_total?: number;
          wallet_sales_total?: number;
          dues_created_total?: number;
          dues_collected_total?: number;
          difference?: number;
          status?: 'open' | 'closed';
          closed_at?: string | null;
          notes?: string | null;
        };
      };
      party_ledgers: {
        Row: {
          id: string;
          party_type: 'customer' | 'supplier';
          party_id: string;
          party_name: string;
          entry_type: 'debit' | 'credit';
          amount: number;
          balance_after: number;
          reference_type: string;
          reference_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          party_type: 'customer' | 'supplier';
          party_id: string;
          party_name: string;
          entry_type: 'debit' | 'credit';
          amount: number;
          balance_after: number;
          reference_type: string;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          notes?: string | null;
        };
      };
      pre_bookings: {
        Row: {
          id: string;
          booking_number: string;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          product_id: string;
          variation_id: string | null;
          target_warehouse_id: string | null;
          queue_priority: number;
          total_price: number;
          advance_paid: number;
          remaining_due: number;
          payment_method: string;
          payment_status: 'pending' | 'paid' | 'partially_paid' | 'refunded';
          status: 'queued' | 'allocated' | 'ready_for_pickup' | 'fulfilled' | 'cancelled';
          allocated_unit_id: string | null;
          allocated_at: string | null;
          fulfilled_order_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_number: string;
          customer_id?: string | null;
          customer_name: string;
          customer_phone: string;
          customer_email?: string | null;
          product_id: string;
          variation_id?: string | null;
          target_warehouse_id?: string | null;
          queue_priority: number;
          total_price: number;
          advance_paid: number;
          remaining_due: number;
          payment_method?: string;
          payment_status?: 'pending' | 'paid' | 'partially_paid' | 'refunded';
          status?: 'queued' | 'allocated' | 'ready_for_pickup' | 'fulfilled' | 'cancelled';
          allocated_unit_id?: string | null;
          allocated_at?: string | null;
          fulfilled_order_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          remaining_due?: number;
          payment_status?: 'pending' | 'paid' | 'partially_paid' | 'refunded';
          status?: 'queued' | 'allocated' | 'ready_for_pickup' | 'fulfilled' | 'cancelled';
          allocated_unit_id?: string | null;
          allocated_at?: string | null;
          fulfilled_order_id?: string | null;
          updated_at?: string;
        };
      };
      payment_transactions: {
        Row: {
          id: string;
          order_id: string | null;
          pre_booking_id: string | null;
          shift_id: string | null;
          gateway: 'cash' | 'card' | 'bkash' | 'nagad' | 'sslcommerz' | 'customer_advance' | 'customer_due';
          transaction_reference: string | null;
          amount: number;
          status: 'initiated' | 'completed' | 'failed' | 'refunded';
          raw_payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          pre_booking_id?: string | null;
          shift_id?: string | null;
          gateway: 'cash' | 'card' | 'bkash' | 'nagad' | 'sslcommerz' | 'customer_advance' | 'customer_due';
          transaction_reference?: string | null;
          amount: number;
          status?: 'initiated' | 'completed' | 'failed' | 'refunded';
          raw_payload?: Json;
          created_at?: string;
        };
        Update: {
          status?: 'initiated' | 'completed' | 'failed' | 'refunded';
          raw_payload?: Json;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: 'customer' | 'admin' | 'owner' | 'delivery';
      order_status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded' | 'partially_refunded';
      payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
      coupon_type: 'percentage' | 'fixed' | 'free_shipping';
      fraud_severity: 'low' | 'medium' | 'high';
    };
  };
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
