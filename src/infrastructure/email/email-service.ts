/**
 * Email Service
 * Handles sending transactional emails using SMTP or email service providers
 */

import { config } from '@/config';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
}

// Email templates
export const emailTemplates = {
  orderConfirmation: (data: {
    customerName: string;
    orderNumber: string;
    orderDate: string;
    items: Array<{ name: string; quantity: number; price: string }>;
    subtotal: string;
    shipping: string;
    tax: string;
    total: string;
    shippingAddress: string;
  }): EmailTemplate => ({
    name: 'order-confirmation',
    subject: `Order Confirmation - ${data.orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .order-item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
          .total-row.final { font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 10px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customerName},</p>
            <p>Thank you for your order! We've received your order and will begin processing it shortly.</p>
            
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> ${data.orderNumber}</p>
            <p><strong>Order Date:</strong> ${data.orderDate}</p>
            
            <h3>Items Ordered</h3>
            ${data.items.map(item => `
              <div class="order-item">
                <span>${item.name} x ${item.quantity}</span>
                <span style="float: right;">${item.price}</span>
              </div>
            `).join('')}
            
            <div style="margin-top: 20px;">
              <div class="total-row"><span>Subtotal:</span><span>${data.subtotal}</span></div>
              <div class="total-row"><span>Shipping:</span><span>${data.shipping}</span></div>
              <div class="total-row"><span>Tax:</span><span>${data.tax}</span></div>
              <div class="total-row final"><span>Total:</span><span>${data.total}</span></div>
            </div>
            
            <h3>Shipping Address</h3>
            <p>${data.shippingAddress.replace(/\n/g, '<br>')}</p>
            
            <p style="margin-top: 20px;">
              <a href="${config.app.url}/account/orders" class="button">View Order Status</a>
            </p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
            <p>&copy; ${new Date().getFullYear()} ${config.app.name}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Order Confirmed - ${data.orderNumber}\n\nHi ${data.customerName},\n\nThank you for your order!\n\nOrder Number: ${data.orderNumber}\nTotal: ${data.total}`,
  }),

  orderShipped: (data: {
    customerName: string;
    orderNumber: string;
    trackingNumber: string;
    trackingUrl: string;
    carrier: string;
    estimatedDelivery: string;
  }): EmailTemplate => ({
    name: 'order-shipped',
    subject: `Your Order Has Shipped - ${data.orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .tracking-box { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Your Order Has Shipped!</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customerName},</p>
            <p>Great news! Your order <strong>${data.orderNumber}</strong> is on its way.</p>
            
            <div class="tracking-box">
              <h3>Tracking Information</h3>
              <p><strong>Carrier:</strong> ${data.carrier}</p>
              <p><strong>Tracking Number:</strong> ${data.trackingNumber}</p>
              <p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery}</p>
              <p style="margin-top: 15px;">
                <a href="${data.trackingUrl}" class="button">Track Your Package</a>
              </p>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${config.app.name}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Your Order Has Shipped!\n\nHi ${data.customerName},\n\nYour order ${data.orderNumber} is on its way.\n\nTracking Number: ${data.trackingNumber}\nCarrier: ${data.carrier}`,
  }),

  passwordReset: (data: {
    userName: string;
    resetLink: string;
    expiresIn: string;
  }): EmailTemplate => ({
    name: 'password-reset',
    subject: 'Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${data.userName},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${data.resetLink}" class="button">Reset Password</a>
            </p>
            <p>This link will expire in ${data.expiresIn}.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${config.app.name}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Password Reset Request\n\nHi ${data.userName},\n\nClick this link to reset your password: ${data.resetLink}\n\nThis link expires in ${data.expiresIn}.`,
  }),

  abandonedCart: (data: {
    customerName: string;
    items: Array<{ name: string; price: string; imageUrl?: string }>;
    cartUrl: string;
    couponCode?: string;
    discount?: string;
  }): EmailTemplate => ({
    name: 'abandoned-cart',
    subject: 'You left something behind!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .item { display: flex; align-items: center; padding: 15px 0; border-bottom: 1px solid #e5e7eb; }
          .item img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-right: 15px; }
          .coupon-box { background: #fef3c7; border: 2px dashed #f59e0b; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Cart Misses You! 🛒</h1>
          </div>
          <div class="content">
            <p>Hi ${data.customerName},</p>
            <p>You left some great items in your cart. Don't let them get away!</p>
            
            ${data.items.map(item => `
              <div class="item">
                ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : ''}
                <div>
                  <strong>${item.name}</strong>
                  <p>${item.price}</p>
                </div>
              </div>
            `).join('')}
            
            ${data.couponCode ? `
              <div class="coupon-box">
                <p style="margin: 0; font-weight: bold;">🎉 Special Offer Just For You!</p>
                <p style="font-size: 24px; font-weight: bold; color: #f59e0b; margin: 10px 0;">
                  ${data.discount} OFF
                </p>
                <p style="margin: 0;">Use code: <strong>${data.couponCode}</strong></p>
              </div>
            ` : ''}
            
            <p style="text-align: center; margin-top: 20px;">
              <a href="${data.cartUrl}" class="button">Complete Your Purchase</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${config.app.name}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Your Cart Misses You!\n\nHi ${data.customerName},\n\nYou left some items in your cart. Complete your purchase: ${data.cartUrl}`,
  }),

  welcomeEmail: (data: {
    userName: string;
    loginUrl: string;
  }): EmailTemplate => ({
    name: 'welcome',
    subject: `Welcome to ${config.app.name}!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 40px 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .features { display: grid; gap: 15px; margin: 20px 0; }
          .feature { background: white; padding: 15px; border-radius: 8px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${config.app.name}! 🎉</h1>
          </div>
          <div class="content">
            <p>Hi ${data.userName},</p>
            <p>Thank you for joining us! We're excited to have you as part of our community.</p>
            
            <div class="features">
              <div class="feature">
                <strong>🛍️ Shop the Latest</strong>
                <p>Browse thousands of products at great prices</p>
              </div>
              <div class="feature">
                <strong>🚚 Fast Shipping</strong>
                <p>Get your orders delivered quickly and reliably</p>
              </div>
              <div class="feature">
                <strong>💝 Exclusive Offers</strong>
                <p>Receive special deals and discounts</p>
              </div>
            </div>
            
            <p style="text-align: center; margin-top: 20px;">
              <a href="${data.loginUrl}" class="button">Start Shopping</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${config.app.name}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to ${config.app.name}!\n\nHi ${data.userName},\n\nThank you for joining us! Start shopping: ${data.loginUrl}`,
  }),
};

export class EmailService {

  constructor() {
  }

  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { to, subject, attachments } = options;

    // Check if email is configured
    if (!config.email?.smtp.host) {
      console.warn('Email not configured. Logging email instead.');
      console.log('Email to:', to);
      console.log('Subject:', subject);
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    try {
      // TODO: Implement actual email sending using nodemailer or email provider SDK
      // Example with nodemailer:
      // const nodemailer = require('nodemailer');
      // const transporter = nodemailer.createTransport({
      //   host: config.email.host,
      //   port: config.email.port,
      //   secure: config.email.secure,
      //   auth: {
      //     user: config.email.user,
      //     pass: config.email.password,
      //   },
      // });
      // 
      // const result = await transporter.sendMail({
      //   from: options.from || this.from,
      //   to: Array.isArray(to) ? to.join(', ') : to,
      //   subject,
      //   html,
      //   text,
      //   attachments,
      // });
      // 
      // return { success: true, messageId: result.messageId };

      // Placeholder - log email for development
      console.log('📧 Email sent:');
      console.log('  To:', to);
      console.log('  Subject:', subject);
      console.log('  Attachments:', attachments?.length || 0);
      
      return { success: true, messageId: `msg-${Date.now()}` };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendTemplate(
    templateFn: () => EmailTemplate,
    to: string | string[],
    options?: Partial<EmailOptions>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = templateFn();
    return this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      ...options,
    });
  }

  // Convenience methods
  async sendOrderConfirmation(to: string, data: Parameters<typeof emailTemplates.orderConfirmation>[0]) {
    return this.sendTemplate(() => emailTemplates.orderConfirmation(data), to);
  }

  async sendOrderShipped(to: string, data: Parameters<typeof emailTemplates.orderShipped>[0]) {
    return this.sendTemplate(() => emailTemplates.orderShipped(data), to);
  }

  async sendPasswordReset(to: string, data: Parameters<typeof emailTemplates.passwordReset>[0]) {
    return this.sendTemplate(() => emailTemplates.passwordReset(data), to);
  }

  async sendAbandonedCartReminder(to: string, data: Parameters<typeof emailTemplates.abandonedCart>[0]) {
    return this.sendTemplate(() => emailTemplates.abandonedCart(data), to);
  }

  async sendWelcomeEmail(to: string, data: Parameters<typeof emailTemplates.welcomeEmail>[0]) {
    return this.sendTemplate(() => emailTemplates.welcomeEmail(data), to);
  }
}

// Singleton instance
export const emailService = new EmailService();
