# Mattermost Video Player Plugin

Replaces the file-attachment chip for video uploads with an inline HTML5 `<video>` element on Mattermost web and desktop. This matches the inline behaviour of the Mattermost mobile app, which already plays videos inline.

The HTML5 player provides standard controls including fullscreen, seek, volume, and playback speed. The video's first frame is shown before play (Mattermost's server does not generate thumbnails for video files, so there is no separate poster image).

## How it works

A small CSS rule hides any file-attachment chip whose icon class identifies it as a video. A MutationObserver then watches for those chips appearing in the DOM and, for each, inserts a sibling `<video controls>` element pointing at the Mattermost file URL.

This is approximately 50 lines of vanilla JavaScript with no build step. The plugin ships as a single JS file plus `plugin.json`.

## Build

```
make bundle
```

Produces `dist/mattermost-video-player.tar.gz`, ready to upload via **System Console > Plugin Management > Upload Plugin**.

## Compatibility

Targets Mattermost server 9.0.0 and later. Relies on the current `.post-image__column` / `.post-image__type` / `.post-image__download` / `.file-icon.video` DOM shape in the webapp. If Mattermost refactors that markup, this plugin will silently no-op (chips will continue to render as before). Also requires a browser supporting CSS `:has()` (Chrome 105+, Firefox 121+, Safari 15.4+).

## Supported formats

The browser's native `<video>` element decides what plays. MP4 (H.264/AAC) is the safest bet for cross-browser playback. WEBM works in Chromium and Firefox. MOV and M4V depend on the browser's codec support.
