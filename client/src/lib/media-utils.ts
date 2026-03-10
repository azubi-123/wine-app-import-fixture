/**
 * Universal media URL handling utilities
 * Provides consistent media access across the application
 */

export interface MediaDescriptor {
  publicId?: string;
  legacyUrl?: string;
  directUrl?: string;
}

/**
 * Get a usable URL for any piece of media
 * Handles both the new publicId system and legacy direct URLs
 */
export function getMediaUrl(media: MediaDescriptor): string {
  // Always prefer the new, secure proxy stream endpoint
  if (media.publicId) {
    return `/api/media/${media.publicId}/stream`;
  }
  
  // Support old, direct URLs for backward compatibility
  if (media.legacyUrl) {
    // Convert legacy /file URLs to /stream URLs since /file doesn't work in dev
    if (media.legacyUrl.includes('/api/media/') && media.legacyUrl.includes('/file')) {
      return media.legacyUrl.replace('/file', '/stream');
    }
    return media.legacyUrl;
  }
  
  // Support direct URLs (typically for local development or base64)
  if (media.directUrl) {
    return media.directUrl;
  }
  
  // Return empty string if no media is available
  return '';
}

/**
 * Get media URL specifically for images (packages, wines, etc.)
 */
export function getImageUrl(image: {
  imagePublicId?: string;
  imageUrl?: string;
  wineImageUrl?: string;
  coverImagePublicId?: string;
  coverImageUrl?: string;
}): string {
  return getMediaUrl({
    publicId: image.imagePublicId || image.coverImagePublicId,
    legacyUrl: image.imageUrl || image.wineImageUrl || image.coverImageUrl
  });
}

/**
 * Get media URL specifically for video messages
 */
export function getVideoUrl(video: {
  video_publicId?: string;
  videoPublicId?: string;
  video_url?: string;
  videoUrl?: string;
}): string {
  return getMediaUrl({
    publicId: video.video_publicId || video.videoPublicId,
    legacyUrl: video.video_url || video.videoUrl
  });
}

/**
 * Get media URL specifically for audio messages
 */
export function getAudioUrl(audio: {
  audio_publicId?: string;
  audioPublicId?: string;
  audio_url?: string;
  audioUrl?: string;
}): string {
  return getMediaUrl({
    publicId: audio.audio_publicId || audio.audioPublicId,
    legacyUrl: audio.audio_url || audio.audioUrl
  });
}

/**
 * Extract media information from a slide payload
 */
export function getSlideMediaInfo(slide: any): {
  type: 'video' | 'audio' | 'image' | null;
  url: string;
} {
  if (!slide?.payloadJson) {
    return { type: null, url: '' };
  }

  const payload = slide.payloadJson;

  // Check for video message slides
  if (slide.type === 'video_message') {
    return {
      type: 'video',
      url: getVideoUrl(payload)
    };
  }

  // Check for audio message slides
  if (slide.type === 'audio_message') {
    return {
      type: 'audio',
      url: getAudioUrl(payload)
    };
  }

  // Check for image slides or questions with images
  if (payload.imageUrl || payload.image_url || payload.imagePublicId) {
    return {
      type: 'image',
      url: getMediaUrl({
        publicId: payload.imagePublicId,
        legacyUrl: payload.imageUrl || payload.image_url
      })
    };
  }

  return { type: null, url: '' };
}

/**
 * Check if a media URL is valid and accessible
 */
export async function validateMediaUrl(url: string): Promise<boolean> {
  if (!url) return false;
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get a placeholder image URL for when media is not available
 */
export function getPlaceholderImageUrl(type: 'wine' | 'package' | 'general' = 'general'): string {
  switch (type) {
    case 'wine':
      return '/images/wine-bottle-placeholder.png';
    case 'package':
      return '/images/package-placeholder.png';
    default:
      return '/images/media-placeholder.png';
  }
}

/**
 * Generate media access URL with fallback to placeholder
 */
export function getMediaUrlWithFallback(
  media: MediaDescriptor,
  placeholderType: 'wine' | 'package' | 'general' = 'general'
): string {
  const url = getMediaUrl(media);
  return url || getPlaceholderImageUrl(placeholderType);
}