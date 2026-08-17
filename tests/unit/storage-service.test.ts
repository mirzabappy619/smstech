/**
 * Storage Service Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService, BUCKETS, ALLOWED_TYPES, MAX_SIZES } from '@/infrastructure/storage';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test/file.jpg' }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test/file.jpg' } }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example.com/file.jpg' }, error: null }),
        createSignedUploadUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://upload.example.com', token: 'token123' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        list: vi.fn().mockResolvedValue({ data: [{ name: 'file1.jpg', id: '1', updated_at: '2024-01-01' }], error: null }),
      })),
    },
  })),
}));

// Mock config
vi.mock('@/config', () => ({
  config: {
    supabase: {
      url: 'https://test.supabase.co',
      serviceRoleKey: 'test-service-key',
    },
  },
}));

describe('Storage Constants', () => {
  describe('BUCKETS', () => {
    it('should have correct bucket names', () => {
      expect(BUCKETS.PRODUCTS).toBe('products');
      expect(BUCKETS.AVATARS).toBe('avatars');
      expect(BUCKETS.INVOICES).toBe('invoices');
      expect(BUCKETS.ATTACHMENTS).toBe('attachments');
    });
  });

  describe('ALLOWED_TYPES', () => {
    it('should allow images for products bucket', () => {
      expect(ALLOWED_TYPES.products).toContain('image/jpeg');
      expect(ALLOWED_TYPES.products).toContain('image/png');
      expect(ALLOWED_TYPES.products).toContain('image/webp');
    });

    it('should allow images for avatars bucket', () => {
      expect(ALLOWED_TYPES.avatars).toContain('image/jpeg');
      expect(ALLOWED_TYPES.avatars).toContain('image/png');
    });

    it('should allow PDF for invoices bucket', () => {
      expect(ALLOWED_TYPES.invoices).toContain('application/pdf');
    });
  });

  describe('MAX_SIZES', () => {
    it('should have correct file size limits', () => {
      expect(MAX_SIZES.products).toBe(10 * 1024 * 1024); // 10MB
      expect(MAX_SIZES.avatars).toBe(5 * 1024 * 1024); // 5MB
      expect(MAX_SIZES.invoices).toBe(20 * 1024 * 1024); // 20MB
    });
  });
});

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
  });

  describe('upload', () => {
    it('should reject invalid bucket', async () => {
      const result = await service.upload({
        bucket: 'invalid-bucket',
        path: 'test/file.jpg',
        file: Buffer.from('test'),
        contentType: 'image/jpeg',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid bucket');
    });

    it('should reject invalid file type', async () => {
      const result = await service.upload({
        bucket: 'products',
        path: 'test/file.exe',
        file: Buffer.from('test'),
        contentType: 'application/x-executable',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File type not allowed');
    });

    it('should reject oversized files', async () => {
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB
      const result = await service.upload({
        bucket: 'products',
        path: 'test/file.jpg',
        file: largeBuffer,
        contentType: 'image/jpeg',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should upload valid file successfully', async () => {
      const result = await service.upload({
        bucket: 'products',
        path: 'test/file.jpg',
        file: Buffer.from('test'),
        contentType: 'image/jpeg',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('test/file.jpg');
      expect(result.publicUrl).toBeDefined();
    });
  });

  describe('getSignedUrl', () => {
    it('should generate signed download URL', async () => {
      const result = await service.getSignedUrl({
        bucket: 'products',
        path: 'test/file.jpg',
        expiresIn: 3600,
      });

      expect(result.success).toBe(true);
      expect(result.signedUrl).toBeDefined();
    });
  });

  describe('getSignedUploadUrl', () => {
    it('should generate signed upload URL', async () => {
      const result = await service.getSignedUploadUrl({
        bucket: 'products',
        path: 'test/file.jpg',
      });

      expect(result.success).toBe(true);
      expect(result.signedUrl).toBeDefined();
      expect(result.token).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete files', async () => {
      const result = await service.delete({
        bucket: 'products',
        paths: ['test/file1.jpg', 'test/file2.jpg'],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('list', () => {
    it('should list files in bucket', async () => {
      const result = await service.list('products', 'test');

      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
    });
  });

  describe('getPublicUrl', () => {
    it('should return public URL', () => {
      const url = service.getPublicUrl('products', 'test/file.jpg');
      expect(url).toBe('https://example.com/test/file.jpg');
    });
  });

  describe('generatePath', () => {
    it('should generate unique path', () => {
      const path1 = service.generatePath('products', 'My Image.jpg');
      const path2 = service.generatePath('products', 'My Image.jpg');

      expect(path1).toMatch(/^products\/\d+-[a-z0-9]+-my-image\.jpg$/);
      expect(path1).not.toBe(path2); // Different timestamps
    });

    it('should sanitize filename', () => {
      const path = service.generatePath('products', 'My@Special#Image!.png');
      expect(path).toContain('my-special-image');
    });

    it('should preserve file extension', () => {
      const path = service.generatePath('products', 'image.webp');
      expect(path).toMatch(/\.webp$/);
    });
  });
});
