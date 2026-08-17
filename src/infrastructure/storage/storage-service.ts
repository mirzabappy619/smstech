/**
 * Storage Service
 * Handles file uploads and downloads using Supabase Storage
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '@/config';

export interface UploadOptions {
  bucket: string;
  path: string;
  file: File | Buffer;
  contentType?: string;
  upsert?: boolean;
  cacheControl?: string;
}

export interface SignedUrlOptions {
  bucket: string;
  path: string;
  expiresIn?: number; // seconds
  download?: boolean;
}

export interface DeleteOptions {
  bucket: string;
  paths: string[];
}

// Bucket names
export const BUCKETS = {
  PRODUCTS: 'products',
  AVATARS: 'avatars',
  INVOICES: 'invoices',
  ATTACHMENTS: 'attachments',
} as const;

export type BucketName = typeof BUCKETS[keyof typeof BUCKETS];

// Allowed file types per bucket
export const ALLOWED_TYPES: Record<BucketName, string[]> = {
  [BUCKETS.PRODUCTS]: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  [BUCKETS.AVATARS]: ['image/jpeg', 'image/png', 'image/webp'],
  [BUCKETS.INVOICES]: ['application/pdf'],
  [BUCKETS.ATTACHMENTS]: ['application/pdf', 'image/jpeg', 'image/png', 'text/csv'],
};

// Max file sizes per bucket (in bytes)
export const MAX_SIZES: Record<BucketName, number> = {
  [BUCKETS.PRODUCTS]: 10 * 1024 * 1024, // 10MB
  [BUCKETS.AVATARS]: 5 * 1024 * 1024, // 5MB
  [BUCKETS.INVOICES]: 20 * 1024 * 1024, // 20MB
  [BUCKETS.ATTACHMENTS]: 15 * 1024 * 1024, // 15MB
};

export class StorageService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );
  }

  /**
   * Upload a file to Supabase Storage
   */
  async upload(options: UploadOptions): Promise<{
    success: boolean;
    path?: string;
    publicUrl?: string;
    error?: string;
  }> {
    const { bucket, path, file, contentType, upsert = false, cacheControl = 'public, max-age=31536000, s-maxage=31536000, immutable' } = options;

    try {
      // Validate bucket
      if (!Object.values(BUCKETS).includes(bucket as BucketName)) {
        return { success: false, error: 'Invalid bucket' };
      }

      // Validate file type
      const allowedTypes = ALLOWED_TYPES[bucket as BucketName];
      if (contentType && !allowedTypes.includes(contentType)) {
        return { success: false, error: `File type not allowed. Allowed: ${allowedTypes.join(', ')}` };
      }

      // Validate file size
      const maxSize = MAX_SIZES[bucket as BucketName];
      const fileSize = file instanceof Buffer ? file.length : (file as any).size;
      if (fileSize > maxSize) {
        return { success: false, error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` };
      }

      // Convert File to ArrayBuffer if needed
      const fileData = file instanceof Buffer ? file : await (file as any).arrayBuffer();

      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(path, fileData, {
          contentType,
          upsert,
          cacheControl,
        });

      if (error) {
        return { success: false, error: error.message };
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return {
        success: true,
        path: data.path,
        publicUrl: urlData.publicUrl,
      };
    } catch (error) {
      console.error('Storage upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a signed URL for private file access
   */
  async getSignedUrl(options: SignedUrlOptions): Promise<{
    success: boolean;
    signedUrl?: string;
    error?: string;
  }> {
    const { bucket, path, expiresIn = 3600, download = false } = options;

    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn, {
          download,
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, signedUrl: data.signedUrl };
    } catch (error) {
      console.error('Get signed URL error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a signed upload URL for direct browser uploads
   */
  async getSignedUploadUrl(options: { bucket: string; path: string }): Promise<{
    success: boolean;
    signedUrl?: string;
    token?: string;
    error?: string;
  }> {
    const { bucket, path } = options;

    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        signedUrl: data.signedUrl,
        token: data.token,
      };
    } catch (error) {
      console.error('Get signed upload URL error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete files from storage
   */
  async delete(options: DeleteOptions): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { bucket, paths } = options;

    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove(paths);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Storage delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List files in a bucket path
   */
  async list(bucket: string, path?: string): Promise<{
    success: boolean;
    files?: Array<{ name: string; id: string; updatedAt: string; size: number }>;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list(path || '', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const files = data
        .filter(item => item.name !== '.emptyFolderPlaceholder')
        .map(item => ({
          name: item.name,
          id: item.id,
          updatedAt: item.updated_at,
          size: item.metadata?.size || 0,
        }));

      return { success: true, files };
    } catch (error) {
      console.error('Storage list error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Generate a unique file path
   */
  generatePath(prefix: string, filename: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = filename.split('.').pop();
    const safeName = filename
      .split('.')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 50);
    return `${prefix}/${timestamp}-${random}-${safeName}.${ext}`;
  }
}

// Singleton instance
export const storageService = new StorageService();
