import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isYouTubeVideoId, youtubeEmbedUrl, youtubeWatchUrl } from "../../lib/youtube-embed";

describe("isYouTubeVideoId", () => {
  it("accepts an 11-character YouTube id", () => {
    assert.equal(isYouTubeVideoId("dQw4w9WgXcQ"), true);
    assert.equal(isYouTubeVideoId("a-b_C1d2E3f"), true);
  });

  it("rejects anything else, so a pasted URL or a typo cannot reach an iframe src", () => {
    assert.equal(isYouTubeVideoId(""), false);
    assert.equal(isYouTubeVideoId("short"), false);
    assert.equal(isYouTubeVideoId("dQw4w9WgXcQ extra"), false);
    assert.equal(isYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), false);
    assert.equal(isYouTubeVideoId('dQw4w9WgXc"'), false);
    assert.equal(isYouTubeVideoId(null), false);
    assert.equal(isYouTubeVideoId(undefined), false);
  });
});

describe("youtubeEmbedUrl", () => {
  it("uses the privacy-enhanced domain, which sets no cookies until the video is played", () => {
    const url = new URL(youtubeEmbedUrl("dQw4w9WgXcQ"));
    assert.equal(url.origin, "https://www.youtube-nocookie.com");
    assert.equal(url.pathname, "/embed/dQw4w9WgXcQ");
  });

  it("asks for related videos from the same channel only and no autoplay by default", () => {
    const url = new URL(youtubeEmbedUrl("dQw4w9WgXcQ"));
    assert.equal(url.searchParams.get("rel"), "0");
    assert.equal(url.searchParams.get("autoplay"), null);
  });

  it("autoplays when the visitor has just clicked play", () => {
    const url = new URL(youtubeEmbedUrl("dQw4w9WgXcQ", { autoplay: true }));
    assert.equal(url.searchParams.get("autoplay"), "1");
  });

  it("refuses an invalid id", () => {
    assert.throws(() => youtubeEmbedUrl("not an id"), /YouTube video id/);
  });
});

describe("youtubeWatchUrl", () => {
  it("links to the video on youtube.com", () => {
    assert.equal(youtubeWatchUrl("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});
