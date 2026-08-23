import { describe, it, expect } from 'vitest';
import { normalizeProduct } from '@/data/products';
import { normalizeBDPhone, isValidBDPhone } from '@/lib/bd-phone-validator';
import { getRiskLevelConfig } from '@/lib/fraud-check';

describe('Admin Product Workflow & Storefront Integration', () => {
  it('should correctly normalize a created product for storefront display', () => {
    const rawAdminProduct = {
      id: 'prod-uuid-1234',
      name: 'MacBook Pro 16 M3 Max',
      slug: 'macbook-pro-16-m3-max',
      description: 'Supercharged for pros',
      base_price: 380000,
      original_price: 400000,
      images: ['https://example.com/macbook.jpg'],
      is_active: true,
      is_featured: true,
      sku: 'APL-MBP16-M3',
      stock: 15,
      rating: 4.9,
      review_count: 32,
      category: {
        id: 'cat-laptops',
        name: 'Laptops',
        slug: 'laptops',
      },
      attributes: {
        brand: 'Apple',
        condition: 'brand_new',
        processor: 'Apple M3 Max (16-core)',
        ram: '36GB Unified Memory',
        storage: '1TB SSD',
        display: '16.2-inch Liquid Retina XDR',
      },
      product_variations: [
        {
          id: 'var-1',
          name: '36GB RAM / 1TB SSD - Space Black',
          sku: 'APL-MBP16-M3-SB',
          price: 380000,
          stock: 10,
          is_active: true,
          attributes: { color: 'Space Black', storage: '1TB', ram: '36GB' },
        },
        {
          id: 'var-2',
          name: '48GB RAM / 1TB SSD - Silver',
          sku: 'APL-MBP16-M3-SL',
          price: 420000,
          stock: 5,
          is_active: true,
          attributes: { color: 'Silver', storage: '1TB', ram: '48GB' },
        },
      ],
    };

    const storefrontProduct = normalizeProduct(rawAdminProduct);

    expect(storefrontProduct.id).toBe('prod-uuid-1234');
    expect(storefrontProduct.slug).toBe('macbook-pro-16-m3-max');
    expect(storefrontProduct.name).toBe('MacBook Pro 16 M3 Max');
    expect(storefrontProduct.price).toBe(380000);
    expect(storefrontProduct.originalPrice).toBe(400000);
    expect(storefrontProduct.brand).toBe('Apple');
    expect(storefrontProduct.category).toBe('laptop');
    expect(storefrontProduct.image).toBe('https://example.com/macbook.jpg');
    expect(storefrontProduct.variants).toBeDefined();
    expect(storefrontProduct.variants?.length).toBe(2);
    expect(storefrontProduct.variants?.[0].label).toBe('36GB RAM / 1TB SSD - Space Black');
    expect(storefrontProduct.variants?.[0].price).toBe(380000);
  });
});

describe('Admin Phone Validation & Fraud Risk Detection Workflow', () => {
  it('should validate and normalize valid Bangladeshi phone numbers', () => {
    expect(isValidBDPhone('01712345678')).toBe(true);
    expect(isValidBDPhone('+8801812345678')).toBe(true);
    expect(normalizeBDPhone('+8801712345678')).toBe('01712345678');
    expect(normalizeBDPhone('8801912345678')).toBe('01912345678');
    expect(normalizeBDPhone('01312345678')).toBe('01312345678');
  });

  it('should reject invalid phone numbers', () => {
    expect(isValidBDPhone('123456')).toBe(false);
    expect(isValidBDPhone('01212345678')).toBe(false); // Invalid operator prefix
    expect(isValidBDPhone('')).toBe(false);
  });

  it('should return appropriate badge and style configurations for risk levels', () => {
    const highRisk = getRiskLevelConfig('High Risk');
    expect(highRisk.isSafeForCOD).toBe(false);
    expect(highRisk.badge).toContain('red');

    const excellentRisk = getRiskLevelConfig('Excellent');
    expect(excellentRisk.isSafeForCOD).toBe(true);
    expect(excellentRisk.badge).toContain('emerald');

    const unknownRisk = getRiskLevelConfig('Unknown');
    expect(unknownRisk.isSafeForCOD).toBe(true);
    expect(unknownRisk.badge).toContain('slate');
  });
});
