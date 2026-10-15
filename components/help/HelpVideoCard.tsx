"use client";

import * as React from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import type { HelpVideo } from "@/lib/help-manual";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/youtube-embed";

/**
 * Poster first, player on click: no request to YouTube, and so no cookies, until the visitor
 * asks for the video.
 */
export function HelpVideoCard({ title, video }: { title: string; video: HelpVideo }) {
  const [playing, setPlaying] = React.useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-pro-line/70 bg-pro-card shadow-xl shadow-black/20">
      <div className="relative aspect-video w-full bg-pro-page">
        {playing ? (
          <iframe
            src={youtubeEmbedUrl(video.youtubeId, { autoplay: true })}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            data-testid="help-video-player"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${title}`}
            data-testid="help-video-play"
            className="group absolute inset-0 block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinical-400/70"
          >
            <Image
              src={video.poster}
              alt=""
              fill
              sizes="(min-width: 1024px) 720px, 100vw"
              className="object-cover"
            />
            <span className="absolute inset-0 bg-pro-page/20 transition group-hover:bg-pro-page/10" aria-hidden />
            <span className="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-clinical-500 text-ink-900 shadow-lg transition group-hover:scale-105">
              <Play className="ml-1 h-7 w-7 fill-current" aria-hidden />
            </span>
            <span className="absolute bottom-3 right-3 rounded-md bg-pro-page/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
              {video.durationLabel}
            </span>
          </button>
        )}
      </div>
      <div className="flex justify-end px-4 py-2.5">
        <a
          href={youtubeWatchUrl(video.youtubeId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-clinical-300 hover:text-clinical-200"
        >
          Watch on YouTube
        </a>
      </div>
    </div>
  );
}
