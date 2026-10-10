export interface VideoInfo {
  type: 'youtube' | 'instagram' | 'direct' | 'unsupported';
  embedUrl?: string;
  originalUrl: string;
}

export function parseVideoUrl(url?: string): VideoInfo | null {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return null;
  }

  const trimmed = url.trim();

  // YouTube Shorts or standard video
  const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=0&rel=0`,
      originalUrl: trimmed,
    };
  }

  // Instagram Reel / Post
  const igMatch = trimmed.match(/instagram\.com\/(?:reel|p)\/([\w-]+)/);
  if (igMatch && igMatch[1]) {
    return {
      type: 'instagram',
      embedUrl: `https://www.instagram.com/reel/${igMatch[1]}/embed`,
      originalUrl: trimmed,
    };
  }

  // Direct MP4 / WebM video
  if (trimmed.match(/\.(mp4|webm|ogg)$/i) || trimmed.startsWith('data:video')) {
    return {
      type: 'direct',
      embedUrl: trimmed,
      originalUrl: trimmed,
    };
  }

  return {
    type: 'unsupported',
    originalUrl: trimmed,
  };
}
