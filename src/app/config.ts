// Application Configuration
// Centralizes all configuration with environment variable support

// ==============================================
// ENVIRONMENT DETECTION
// ==============================================
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

// ==============================================
// SUPABASE CONFIG
// ==============================================
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  jwtSecret: process.env.JWT_SECRET || '',
};

// Validate required config in production
if (isProduction) {
  if (!supabaseConfig.url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  if (!supabaseConfig.anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  if (!supabaseConfig.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// ==============================================
// APPLICATION CONFIG
// ==============================================
export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Gizmo Gadgets',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  description: 'Enterprise-grade e-commerce platform',
  version: '1.0.0',
  
  // Contact
  supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
  
  // Locale
  defaultLocale: 'en',
  supportedLocales: ['en', 'es', 'fr', 'de'],
  
  // Timezone
  timezone: process.env.TZ || 'America/New_York',
};

// ==============================================
// CURRENCY & PRICING CONFIG
// ==============================================
export const currencyConfig = {
  default: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'BDT',
  supported: ['BDT', 'USD', 'EUR'],
  symbol: '৳',
  symbols: {
    BDT: '৳',
    USD: '$',
    EUR: '€',
  } as Record<string, string>,
  
  // Formatting
  locale: 'en-BD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

export function formatCurrency(amount: number, _currency = currencyConfig.default): string {
  // Intl renders BDT as "BDT 1,000" — we prefer the ৳ symbol instead
  return `৳${Math.round(amount).toLocaleString('en-BD')}`;
}

// ==============================================
// TAX CONFIG
// ==============================================
export const taxConfig = {
  rate: parseFloat(process.env.TAX_RATE || '0.08'), // 8% default
  inclusive: process.env.TAX_INCLUSIVE === 'true',
  displayWithTax: true,
  taxIdRequired: false,
};

// ==============================================
// SHIPPING CONFIG
// ==============================================
export const shippingConfig = {
  freeShippingThreshold: parseFloat(process.env.FREE_SHIPPING_THRESHOLD || '50'),
  defaultShippingRate: parseFloat(process.env.DEFAULT_SHIPPING_RATE || '9.99'),
  expeditedShippingRate: parseFloat(process.env.EXPEDITED_SHIPPING_RATE || '19.99'),
  internationalEnabled: process.env.INTERNATIONAL_SHIPPING === 'true',
  
  // Estimated delivery days
  standardDaysMin: 3,
  standardDaysMax: 7,
  expeditedDaysMin: 1,
  expeditedDaysMax: 3,
};

// ==============================================
// CART CONFIG
// ==============================================
export const cartConfig = {
  maxItems: 50,
  maxQuantityPerItem: 99,
  cartExpiryDays: 7,
  abandonedCartTimeoutMinutes: parseInt(process.env.ABANDONED_CART_TIMEOUT || '60'),
  enableRecoveryEmails: true,
};

// ==============================================
// INVENTORY CONFIG
// ==============================================
export const inventoryConfig = {
  lowStockThreshold: parseInt(process.env.LOW_STOCK_THRESHOLD || '10'),
  outOfStockAction: 'hide' as 'hide' | 'show' | 'backorder',
  reserveInventoryOnCheckout: true,
  reservationExpiryMinutes: 30,
};

// ==============================================
// IMAGE & STORAGE CONFIG
// ==============================================
export const storageConfig = {
  buckets: {
    products: 'product-images',
    avatars: 'user-avatars',
    invoices: 'invoices',
    attachments: 'attachments',
  },
  
  // Image optimization
  maxImageSize: 10 * 1024 * 1024, // 10MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  thumbnailSizes: {
    small: { width: 150, height: 150 },
    medium: { width: 400, height: 400 },
    large: { width: 800, height: 800 },
  },
  
  // Signed URL expiry
  uploadUrlExpirySeconds: 3600, // 1 hour
  downloadUrlExpirySeconds: 86400, // 24 hours
};

// ==============================================
// RATE LIMITING CONFIG
// ==============================================
export const rateLimitConfig = {
  // General API limits
  api: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
  },
  
  // Auth endpoints (stricter)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts
  },
  
  // Order creation
  orders: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 orders per minute
  },
  
  // Webhook endpoints
  webhooks: {
    windowMs: 60 * 1000,
    max: 200,
  },
};

// ==============================================
// SECURITY CONFIG
// ==============================================
export const securityConfig = {
  // Session
  sessionMaxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  
  // Password
  minPasswordLength: 8,
  requireStrongPassword: true,
  passwordResetExpiryHours: 24,
  
  // 2FA
  enable2FA: process.env.ENABLE_2FA === 'true',
  
  // IP & Device tracking
  trackIPAddress: true,
  trackUserAgent: true,
  
  // Fraud detection
  enableFraudDetection: true,
  fraudScoreThreshold: 70,
  
  // Max login attempts before lockout
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 30,
};

// ==============================================
// EMAIL CONFIG
// ==============================================
export const emailConfig = {
  enabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
  
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
  
  from: {
    name: process.env.EMAIL_FROM_NAME || appConfig.name,
    email: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
  },
  
  // Templates
  templates: {
    welcome: 'welcome',
    orderConfirmation: 'order-confirmation',
    orderShipped: 'order-shipped',
    orderDelivered: 'order-delivered',
    passwordReset: 'password-reset',
    abandonedCart: 'abandoned-cart',
  },
};

// ==============================================
// SMS CONFIG
// ==============================================
export const smsConfig = {
  enabled: !!process.env.SMS_API_KEY,
  provider: process.env.SMS_PROVIDER || 'twilio',
  apiKey: process.env.SMS_API_KEY || '',
  apiSecret: process.env.SMS_API_SECRET || '',
  fromNumber: process.env.SMS_FROM_NUMBER || '',
};

// ==============================================
// PUSH NOTIFICATIONS CONFIG
// ==============================================
export const pushConfig = {
  enabled: !!process.env.PUSH_VAPID_PUBLIC_KEY,
  vapidPublicKey: process.env.PUSH_VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.PUSH_VAPID_PRIVATE_KEY || '',
};

// ==============================================
// PAYMENT CONFIG
// ==============================================
export const paymentConfig = {
  providers: {
    stripe: {
      enabled: !!process.env.STRIPE_SECRET_KEY,
      publicKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || '',
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    paypal: {
      enabled: !!process.env.PAYPAL_CLIENT_ID,
      clientId: process.env.PAYPAL_CLIENT_ID || '',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
      sandbox: !isProduction,
    },
  },
  
  // Supported payment methods
  supportedMethods: ['card', 'paypal', 'apple_pay', 'google_pay'],
  
  // Order of display
  displayOrder: ['card', 'paypal', 'apple_pay', 'google_pay'],
};

// ==============================================
// ANALYTICS CONFIG
// ==============================================
export const analyticsConfig = {
  googleAnalytics: {
    enabled: !!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '',
  },
  
  // Internal analytics
  trackPageViews: true,
  trackUserActions: true,
  trackConversions: true,
};

// ==============================================
// CACHE CONFIG
// ==============================================
export const cacheConfig = {
  redis: {
    enabled: !!process.env.REDIS_URL,
    url: process.env.REDIS_URL || '',
  },
  
  // TTL in seconds
  ttl: {
    products: 300, // 5 minutes
    categories: 3600, // 1 hour
    settings: 1800, // 30 minutes
    user: 60, // 1 minute
  },
};

// ==============================================
// PAGINATION CONFIG
// ==============================================
export const paginationConfig = {
  defaultPage: 1,
  defaultPerPage: 20,
  maxPerPage: 100,
  
  // Cursor-based pagination
  cursorEnabled: false,
};

// ==============================================
// SEARCH CONFIG
// ==============================================
export const searchConfig = {
  minSearchLength: 2,
  maxResults: 50,
  enableFuzzySearch: true,
  searchableFields: ['name', 'description', 'sku', 'tags'],
};

// ==============================================
// FEATURE FLAGS
// ==============================================
export const featureFlags = {
  enableWishlist: true,
  enableReviews: true,
  enableCoupons: true,
  enableGiftCards: false,
  enableSubscriptions: false,
  enableLiveChat: false,
  enableSocialLogin: false,
  enableMultiCurrency: false,
  enableMultiLanguage: false,
  enableBulkOperations: true,
  enableAdvancedSearch: true,
  enableProductRecommendations: true,
};

// ==============================================
// EXPORT ALL CONFIG
// ==============================================
const config = {
  app: appConfig,
  supabase: supabaseConfig,
  currency: currencyConfig,
  tax: taxConfig,
  shipping: shippingConfig,
  cart: cartConfig,
  inventory: inventoryConfig,
  storage: storageConfig,
  rateLimit: rateLimitConfig,
  security: securityConfig,
  email: emailConfig,
  sms: smsConfig,
  push: pushConfig,
  payment: paymentConfig,
  analytics: analyticsConfig,
  cache: cacheConfig,
  pagination: paginationConfig,
  search: searchConfig,
  features: featureFlags,
  courier: {
    pathao: {
      clientId: process.env.PATHAO_CLIENT_ID || '',
      clientSecret: process.env.PATHAO_CLIENT_SECRET || '',
      username: process.env.PATHAO_USERNAME || '',
      password: process.env.PATHAO_PASSWORD || '',
      environment: (process.env.PATHAO_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    },
    steadfast: {
      apiKey: process.env.STEADFAST_API_KEY || '',
      secretKey: process.env.STEADFAST_SECRET_KEY || '',
    },
    defaultProvider: (process.env.DEFAULT_COURIER_PROVIDER || 'none') as 'pathao' | 'steadfast' | 'none',
  },
  
  // Environment
  isDevelopment,
  isProduction,
  isTest,
};

export default config;
