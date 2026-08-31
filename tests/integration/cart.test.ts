/**
 * Cart API Integration Tests
 */
import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Cart API', () => {
  describe('GET /api/v1/cart', () => {
    it('should return cart for anonymous user (using session)', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cart`);
      await response.json();

      // Should return empty cart or cart with items
      expect([200, 401].includes(response.status)).toBe(true);
    });
  });

  describe('POST /api/v1/cart/items', () => {
    it('should reject adding item without product_id', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: 1,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject adding item with invalid quantity', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: '00000000-0000-0000-0000-000000000001',
          quantity: 0,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject adding item with negative quantity', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: '00000000-0000-0000-0000-000000000001',
          quantity: -1,
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/cart', () => {
    it('should handle cart clear request', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cart`, {
        method: 'DELETE',
      });

      // Should succeed or return 401 if auth required
      expect([200, 204, 401].includes(response.status)).toBe(true);
    });
  });
});

describe('Coupons API', () => {
  describe('POST /api/v1/cart/coupon', () => {
    it('should reject invalid coupon code', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cart/coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'INVALID_COUPON_CODE',
          cart_total: 100,
        }),
      });

      // Should return 400 or 404
      expect([400, 404].includes(response.status)).toBe(true);
    });

    it('should reject validation without code', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cart/coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_total: 100,
        }),
      });

      expect(response.status).toBe(400);
    });
  });
});
