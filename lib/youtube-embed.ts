const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function isYouTubeVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && YOUTUBE_ID.test(value);
}

/**
 * Privacy-enhanced embed: youtube-nocookie.com sets no cookies until the visitor plays the video.
 * The id is validated because it ends up in an iframe `src`.
 */
export function youtubeEmbedUrl(id: string, options: { autoplay?: boolean } = {}): string {
  if (!isYouTubeVideoId(id)) throw new Error(`Not a YouTube video id: ${JSON.stringify(id)}`);
  const params = new URLSearchParams({ rel: "0" });
  if (options.autoplay) params.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function youtubeWatchUrl(id: string): string {
  if (!isYouTubeVideoId(id)) throw new Error(`Not a YouTube video id: ${JSON.stringify(id)}`);
  return `https://www.youtube.com/watch?v=${id}`;
}
