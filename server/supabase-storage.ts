import { createClient } from '@supabase/supabase-js';

// Supabase client for storage operations only (database uses direct PostgreSQL)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`supabase service role set for ${supabaseUrl} - ${supabaseUrl && supabaseServiceRole ? 'yes' : 'no'}`);
// Lazy initialization of Supabase client
let supabaseStorage: ReturnType<typeof createClient> | null = null;

export function getSupabaseStorage() {
  if (!supabaseStorage) {
    if (!supabaseUrl || !supabaseServiceRole) {
      console.error('Supabase configuration missing:', {
        hasUrl: !!supabaseUrl,
        hasServiceRole: !!supabaseServiceRole,
        urlPrefix: supabaseUrl?.substring(0, 30) + '...'
      });
      throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for media uploads');
    }
    
    console.log('Initializing Supabase Storage client:', {
      url: supabaseUrl,
      bucket: STORAGE_BUCKET
    });
    
    // Create client with service role for server-side operations
    supabaseStorage = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  return supabaseStorage;
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceRole);
}

// Storage bucket configuration
export const STORAGE_BUCKET = 'media-files';

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,  // 10MB
  audio: 50 * 1024 * 1024,  // 50MB  
  video: 200 * 1024 * 1024, // 200MB
};

// Allowed file types - comprehensive image format support
export const ALLOWED_FILE_TYPES = {
  image: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 
    'image/bmp', 'image/tiff', 'image/svg+xml', 'image/avif', 'image/heic', 
    'image/heif'
  ],
  audio: [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
    'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac',
    'audio/ogg', 'audio/webm'
  ],
  video: [
    'video/mp4', 'video/webm', 'video/quicktime', 
    'video/avi', 'video/x-msvideo',
    'video/x-matroska', 'video/mkv',
    'video/x-flv', 'video/flv',
    'video/x-ms-wmv', 'video/wmv',
    'video/3gpp', 'video/3gpp2',
    'video/mov', 'video/ogg', 'video/ogv'
  ],
};

// Helper function to get media type from MIME type
export function getMediaType(mimeType: string): 'image' | 'audio' | 'video' | null {
  if (ALLOWED_FILE_TYPES.image.includes(mimeType)) return 'image';
  if (ALLOWED_FILE_TYPES.audio.includes(mimeType)) return 'audio';
  if (ALLOWED_FILE_TYPES.video.includes(mimeType)) return 'video';
  return null;
}

// Generate file path based on type and ID
export function generateFilePath(mediaType: 'image' | 'audio' | 'video', id: string, fileName: string): string {
  const timestamp = Date.now();
  const fileExtension = fileName.split('.').pop();
  
  switch (mediaType) {
    case 'image':
      return `images/${id}/${timestamp}.${fileExtension}`;
    case 'audio':
      return `audio/messages/${id}/${timestamp}.${fileExtension}`;
    case 'video':
      return `videos/messages/${id}/${timestamp}.${fileExtension}`;
    default:
      throw new Error(`Unsupported media type: ${mediaType}`);
  }
}

// Upload file to Supabase Storage
export async function uploadMediaFile(
  file: Buffer,
  fileName: string,
  mimeType: string,
  id: string
): Promise<string> {
  const storage = getSupabaseStorage();
  
  let mediaType = getMediaType(mimeType);
  
  // Fallback for M4A files with non-standard MIME types
  if (!mediaType && fileName.toLowerCase().endsWith('.m4a')) {
    console.log(`M4A file detected with MIME type: ${mimeType}, treating as audio`);
    mediaType = 'audio';
    // Override MIME type for Supabase storage
    mimeType = 'audio/mp4';
  }
  
  if (!mediaType) {
    throw new Error(`Unsupported file type: ${mimeType} (file: ${fileName})`);
  }

  // Check file size
  if (file.length > FILE_SIZE_LIMITS[mediaType]) {
    throw new Error(`File too large. Maximum size for ${mediaType}: ${FILE_SIZE_LIMITS[mediaType] / (1024 * 1024)}MB`);
  }

  const filePath = generateFilePath(mediaType, id, fileName);

  const { data, error } = await storage.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    const storageError = error as any; // Type assertion for StorageError properties
    console.error('Supabase Storage upload error:', {
      error: error,
      errorCode: storageError.code,
      errorMessage: error.message,
      errorDetails: storageError.details,
      errorHint: storageError.hint,
      filePath: filePath,
      fileName: fileName,
      mimeType: mimeType,
      fileSize: file.length,
      bucket: STORAGE_BUCKET
    });
    
    // Provide more specific error messages based on error code
    if (error.message?.includes('row-level security')) {
      throw new Error('Storage access denied. Please check Supabase RLS policies.');
    } else if (error.message?.includes('bucket')) {
      throw new Error(`Storage bucket '${STORAGE_BUCKET}' not found or not accessible.`);
    } else if (error.message?.includes('size')) {
      throw new Error(`File size exceeds storage limits.`);
    } else if (error.message?.includes('duplicate')) {
      throw new Error('A file with this name already exists.');
    }
    
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = storage.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// Verify Supabase Storage bucket exists and is accessible
export async function verifyStorageBucket(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { 
      success: false, 
      error: 'Supabase environment variables not configured' 
    };
  }

  try {
    const storage = getSupabaseStorage();
    
    // List buckets to check if our bucket exists
    const { data: buckets, error: listError } = await storage.storage.listBuckets();
    
    if (listError) {
      console.error('Failed to list Supabase buckets:', listError);
      return { 
        success: false, 
        error: `Failed to list buckets: ${listError.message}` 
      };
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === STORAGE_BUCKET);
    
    if (!bucketExists) {
      console.error(`Supabase bucket '${STORAGE_BUCKET}' does not exist`);
      return { 
        success: false, 
        error: `Storage bucket '${STORAGE_BUCKET}' does not exist. Please create it in Supabase dashboard.` 
      };
    }
    
    // Try to list files in the bucket to verify access
    const { error: accessError } = await storage.storage
      .from(STORAGE_BUCKET)
      .list('', { limit: 1 });
    
    if (accessError) {
      console.error(`Cannot access Supabase bucket '${STORAGE_BUCKET}':`, accessError);
      return { 
        success: false, 
        error: `Cannot access bucket '${STORAGE_BUCKET}': ${accessError.message}. Please check bucket permissions.` 
      };
    }
    
    console.log(`✅ Supabase Storage bucket '${STORAGE_BUCKET}' is accessible`);
    return { success: true };
    
  } catch (error) {
    console.error('Error verifying Supabase Storage:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Delete file from Supabase Storage
export async function deleteMediaFile(fileUrl: string): Promise<void> {
  try {
    const storage = getSupabaseStorage();
    
    // Extract file path from URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    const bucketIndex = pathParts.findIndex(part => part === STORAGE_BUCKET);
    if (bucketIndex === -1) {
      throw new Error('Invalid file URL format');
    }
    
    const filePath = pathParts.slice(bucketIndex + 1).join('/');

    const { error } = await storage.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      const storageError = error as any; // Type assertion for StorageError properties
      console.error('Supabase Storage delete error:', {
        error: error,
        errorCode: storageError.code,
        errorMessage: error.message,
        filePath: filePath,
        fileUrl: fileUrl,
        bucket: STORAGE_BUCKET
      });
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting media file:', error);
    // Don't throw - file might already be deleted
  }
}