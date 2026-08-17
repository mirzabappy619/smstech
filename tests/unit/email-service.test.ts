/**
 * Email Service Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emailTemplates, EmailService } from '@/infrastructure/email';

// Mock the config
vi.mock('@/config', () => ({
  config: {
    app: {
      name: 'TestStore',
      baseUrl: 'http://localhost:3000',
    },
    email: {
      host: null, // Disabled for testing
    },
  },
}));

describe('Email Service', () => {
  let service: EmailService;

  beforeEach(() => {
    service = new EmailService();
  });

  describe('send', () => {
    it('should return success when email config is not set', async () => {
      const result = await service.send({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle array of recipients', async () => {
      const result = await service.send({
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('Email Templates', () => {
  describe('orderConfirmation', () => {
    it('should generate order confirmation template', () => {
      const template = emailTemplates.orderConfirmation({
        customerName: 'John Doe',
        orderNumber: 'ORD-2024-001',
        orderDate: 'January 14, 2024',
        items: [
          { name: 'Product 1', quantity: 2, price: '$50.00' },
          { name: 'Product 2', quantity: 1, price: '$30.00' },
        ],
        subtotal: '$130.00',
        shipping: '$9.99',
        tax: '$10.40',
        total: '$150.39',
        shippingAddress: '123 Main St\nNew York, NY 10001',
      });

      expect(template.name).toBe('order-confirmation');
      expect(template.subject).toContain('ORD-2024-001');
      expect(template.html).toContain('John Doe');
      expect(template.html).toContain('$150.39');
      expect(template.html).toContain('Product 1');
      expect(template.text).toContain('Order Confirmed');
    });
  });

  describe('orderShipped', () => {
    it('should generate shipping notification template', () => {
      const template = emailTemplates.orderShipped({
        customerName: 'John Doe',
        orderNumber: 'ORD-2024-001',
        trackingNumber: 'TRK123456',
        trackingUrl: 'https://tracking.example.com/TRK123456',
        carrier: 'FedEx',
        estimatedDelivery: 'January 20, 2024',
      });

      expect(template.name).toBe('order-shipped');
      expect(template.subject).toContain('Shipped');
      expect(template.html).toContain('TRK123456');
      expect(template.html).toContain('FedEx');
      expect(template.html).toContain('January 20, 2024');
    });
  });

  describe('passwordReset', () => {
    it('should generate password reset template', () => {
      const template = emailTemplates.passwordReset({
        userName: 'John',
        resetLink: 'https://example.com/reset?token=abc123',
        expiresIn: '1 hour',
      });

      expect(template.name).toBe('password-reset');
      expect(template.subject).toBe('Reset Your Password');
      expect(template.html).toContain('John');
      expect(template.html).toContain('reset?token=abc123');
      expect(template.html).toContain('1 hour');
    });
  });

  describe('abandonedCart', () => {
    it('should generate abandoned cart template without coupon', () => {
      const template = emailTemplates.abandonedCart({
        customerName: 'John',
        items: [
          { name: 'Product 1', price: '$50.00' },
        ],
        cartUrl: 'https://example.com/cart',
      });

      expect(template.name).toBe('abandoned-cart');
      expect(template.subject).toContain('left something behind');
      expect(template.html).toContain('Product 1');
      expect(template.html).not.toContain('SAVE10');
    });

    it('should generate abandoned cart template with coupon', () => {
      const template = emailTemplates.abandonedCart({
        customerName: 'John',
        items: [
          { name: 'Product 1', price: '$50.00' },
        ],
        cartUrl: 'https://example.com/cart',
        couponCode: 'SAVE10',
        discount: '10%',
      });

      expect(template.html).toContain('SAVE10');
      expect(template.html).toContain('10%');
    });
  });

  describe('welcomeEmail', () => {
    it('should generate welcome email template', () => {
      const template = emailTemplates.welcomeEmail({
        userName: 'John',
        loginUrl: 'https://example.com/login',
      });

      expect(template.name).toBe('welcome');
      expect(template.subject).toContain('Welcome');
      expect(template.html).toContain('John');
      expect(template.html).toContain('Start Shopping');
    });
  });
});

describe('Email Service Convenience Methods', () => {
  let service: EmailService;

  beforeEach(() => {
    service = new EmailService();
  });

  it('should send order confirmation email', async () => {
    const result = await service.sendOrderConfirmation('test@example.com', {
      customerName: 'John',
      orderNumber: 'ORD-001',
      orderDate: 'Jan 1, 2024',
      items: [],
      subtotal: '$0',
      shipping: '$0',
      tax: '$0',
      total: '$0',
      shippingAddress: '123 Main St',
    });

    expect(result.success).toBe(true);
  });

  it('should send order shipped email', async () => {
    const result = await service.sendOrderShipped('test@example.com', {
      customerName: 'John',
      orderNumber: 'ORD-001',
      trackingNumber: 'TRK123',
      trackingUrl: 'http://tracking.example.com',
      carrier: 'UPS',
      estimatedDelivery: 'Jan 5, 2024',
    });

    expect(result.success).toBe(true);
  });

  it('should send password reset email', async () => {
    const result = await service.sendPasswordReset('test@example.com', {
      userName: 'John',
      resetLink: 'http://example.com/reset',
      expiresIn: '1 hour',
    });

    expect(result.success).toBe(true);
  });

  it('should send abandoned cart reminder', async () => {
    const result = await service.sendAbandonedCartReminder('test@example.com', {
      customerName: 'John',
      items: [{ name: 'Product', price: '$10' }],
      cartUrl: 'http://example.com/cart',
    });

    expect(result.success).toBe(true);
  });

  it('should send welcome email', async () => {
    const result = await service.sendWelcomeEmail('test@example.com', {
      userName: 'John',
      loginUrl: 'http://example.com/login',
    });

    expect(result.success).toBe(true);
  });
});
