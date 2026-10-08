---
rule: react/video-media
title: React Video Media Components
category: react
scope: [react]
priority: recommended
applies-to: [react, typescript, javascript]
tags: [video, media, lazy-loading, intersection-observer, autoplay, fallback, performance]
---

# React Video Media Components

Best practices for implementing video components with autoplay, lazy loading, and fallback handling.

---

## Description

Video components require special handling for performance, accessibility, and browser compatibility. This rule defines patterns for lazy loading videos, viewport-triggered autoplay, and progressive fallback chains to ensure a good user experience even when videos fail to load.

---

## Specific Guidelines

### DO:
- Use MP4 format with H.264 codec for maximum browser compatibility
- Add `movflags +faststart` during encoding for streaming playback
- Always provide a poster image via the `poster` attribute
- Use `preload="metadata"` (never `preload="auto"`)
- Require `muted` + `playsInline` for autoplay (browser requirement)
- Use IntersectionObserver for viewport-triggered playback
- Pause video when leaving viewport to save resources
- Implement fallback chain: video -> image -> icon
- Set `loop` for decorative background videos
- Lazy load video src only when entering viewport

### DON'T:
- Use `preload="auto"` (wastes bandwidth)
- Attempt autoplay without `muted` (will fail on mobile)
- Skip poster image (causes layout shift during load)
- Load video src eagerly (blocks initial render)
- Forget to handle video load errors (shows broken media)
- Keep video playing when off-screen (wastes CPU/battery)

---

## Implementation Details

### Video Encoding (FFmpeg):

```bash
# Web-optimized MP4 (H.264, faststart for streaming)
ffmpeg -i input.mp4 \
  -c:v libx264 -crf 23 -preset medium \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  -vf "scale=1280:-2" \
  output.mp4
```

Key flags:
- `-crf 23`: Quality level (18-28, lower = better quality, larger file)
- `-movflags +faststart`: Enables streaming (moov atom at start)
- `-preset medium`: Encoding speed/compression tradeoff
- `scale=1280:-2`: Max width 1280px, maintain aspect ratio (even height)

### Component Pattern:

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

type MediaState = "loading" | "video" | "image" | "icon";

interface VideoMediaProps {
  videoUrl: string;
  posterUrl: string;
  alt: string;
  fallbackIcon?: LucideIcon;
  className?: string;
}

export function VideoMedia({
  videoUrl,
  posterUrl,
  alt,
  fallbackIcon: FallbackIcon,
  className,
}: VideoMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaState, setMediaState] = useState<MediaState>("loading");
  const [isVisible, setIsVisible] = useState(false);

  // Viewport detection with lazy loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        threshold: 0.3,
        rootMargin: "100px", // Preload slightly before visible
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Play/pause based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mediaState !== "video") return;

    if (isVisible) {
      video.muted = true; // Required for autoplay
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay failed, stay on poster frame
        });
      }
    } else {
      video.pause();
    }
  }, [isVisible, mediaState]);

  const handleVideoCanPlay = useCallback(() => {
    setMediaState("video");
  }, []);

  const handleVideoError = useCallback(() => {
    setMediaState("image"); // Fall back to poster image
  }, []);

  const handleImageError = useCallback(() => {
    setMediaState("icon"); // Fall back to icon
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {/* Video layer */}
      {(mediaState === "loading" || mediaState === "video") && (
        <video
          ref={videoRef}
          src={isVisible ? videoUrl : undefined} // Lazy load
          poster={posterUrl}
          loop
          muted
          playsInline
          preload="metadata"
          onCanPlay={handleVideoCanPlay}
          onError={handleVideoError}
        />
      )}

      {/* Image fallback */}
      {mediaState === "image" && (
        <img
          src={posterUrl}
          alt={alt}
          onError={handleImageError}
        />
      )}

      {/* Icon fallback */}
      {mediaState === "icon" && FallbackIcon && (
        <div className="fallback-container">
          <FallbackIcon className="h-12 w-12" />
        </div>
      )}
    </div>
  );
}
```

### Asset Configuration Pattern:

```typescript
// mediaAssets.ts - Asset URL configuration
import { getAssetUrl } from "@app/lib/assets";

export type MediaSlug = "intro" | "overview" | "tutorial";

const MEDIA_PREFIX: Record<MediaSlug, string> = {
  intro: "content-intro",
  overview: "content-overview",
  tutorial: "content-tutorial",
};

export function getMediaAssets(slug: MediaSlug) {
  const prefix = MEDIA_PREFIX[slug];
  return {
    video: getAssetUrl(`videos/${prefix}-video.mp4`),
    poster: getAssetUrl(`videos/${prefix}-poster.jpg`),
  };
}
```

---

## Benefits

1. **Performance**: Lazy loading prevents unnecessary bandwidth usage
2. **Battery life**: Pausing off-screen videos saves CPU/battery
3. **Reliability**: Fallback chain ensures content always displays
4. **Mobile support**: `muted` + `playsInline` required for iOS autoplay
5. **UX**: Poster shows immediately while video loads (no layout shift)
6. **Streaming**: `faststart` flag enables playback before full download

---

## Examples

### Correct: Video with full fallback chain

```tsx
import { VideoMedia } from "@app/components/media/VideoMedia";
import { getMediaAssets } from "@app/constants/mediaAssets";
import { Heart } from "lucide-react";

export function IntroCard() {
  return (
    <VideoMedia
      videoUrl={getMediaAssets("intro").video}
      posterUrl={getMediaAssets("intro").poster}
      alt="Introduction preview"
      fallbackIcon={Heart}
      className="rounded-xl"
    />
  );
}
```

### Correct: Video with proper encoding

```bash
# Encode with web-optimized settings
ffmpeg -i original.mov \
  -c:v libx264 -crf 23 -preset medium \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  -vf "scale=1280:-2" \
  output-video.mp4
```

### Incorrect: Missing critical attributes

```tsx
// BAD: Will fail autoplay on mobile, no fallback
<video
  src={videoUrl}
  autoPlay  // Won't work without muted
  // Missing: poster, playsInline, muted, preload
/>
```

### Incorrect: Eager loading

```tsx
// BAD: Loads video immediately, wastes bandwidth
<video
  src={videoUrl}  // Always loaded
  preload="auto"  // Downloads entire video
/>

// GOOD: Lazy load with IntersectionObserver
<video
  src={isVisible ? videoUrl : undefined}
  preload="metadata"
/>
```

### Incorrect: No error handling

```tsx
// BAD: Shows broken video if load fails
<video src={videoUrl} />

// GOOD: Fallback to image on error
<video
  src={videoUrl}
  poster={posterUrl}
  onError={() => setMediaState("image")}
/>
{mediaState === "image" && (
  <img src={posterUrl} alt={alt} onError={() => setMediaState("icon")} />
)}
```

---

## Testing Considerations

When testing video components:

1. **Mock IntersectionObserver** - JSDOM doesn't implement it
2. **Test `video.muted` as property** - Not an HTML attribute in JSDOM
3. **Handle `video.play()` Promise** - May return undefined in tests
4. **Test fallback chain** - Fire error events to trigger fallbacks

```typescript
// Example test setup
class MockIntersectionObserver implements IntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  observe = vi.fn();
  disconnect = vi.fn();
  // ... other methods
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
```
