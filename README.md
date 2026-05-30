# Mattermost Video Player Plugin

Replaces the file-attachment chip for video uploads with an inline HTML5 `<video>` element on Mattermost web and desktop. This matches the inline behaviour of the Mattermost mobile app, which already plays videos inline.

The HTML5 player provides standard controls including fullscreen, seek, volume, and playback speed. The video's first frame is shown before play (Mattermost's server does not generate thumbnails for video files, so there is no separate poster image).

## Install

You will need Mattermost system-admin access.

1. Download the latest `mattermost-video-player-<version>.tar.gz` from the [GitHub Releases page](https://github.com/alangrainger/mattermost-video-player-plugin/releases).
2. In Mattermost, go to **System Console > Plugin Management**. Make sure **Enable Plugin Uploads** is set to *true*.
3. Under **Upload Plugin**, choose the downloaded tar.gz and click **Upload**.
4. In the **Installed Plugins** list, find "Video Player" and click **Enable**.
5. Refresh the Mattermost browser tab (Ctrl+Shift+R / Cmd+Shift+R) so the new webapp bundle is picked up.

After enabling, any post containing a video attachment will display an inline player in place of the file chip.

To uninstall: in the same System Console page, click **Disable** then **Remove** on the plugin row.

## How it works

A small CSS rule hides any file-attachment chip whose icon class identifies it as a video. A MutationObserver then watches for those chips appearing in the DOM and, for each, inserts a sibling `<video controls>` element pointing at the Mattermost file URL.

This is approximately 50 lines of vanilla JavaScript with no build step. The plugin ships as a single JS file plus `plugin.json`.

## Build

```
make bundle
```

Produces `dist/mattermost-video-player.tar.gz`, ready to upload via **System Console > Plugin Management > Upload Plugin**.

## Compatibility

Targets Mattermost server 10.0.0 and later, as that is what I'm running and have tested against. Relies on the current `.post-image__column` / `.post-image__download` / `.file-icon.video` DOM shape in the webapp. If Mattermost refactors that markup, this plugin will silently no-op (chips will continue to render as before). Also requires a browser supporting CSS `:has()` (Chrome 105+, Firefox 121+, Safari 15.4+).

## Supported formats

The browser's native `<video>` element decides what plays. MP4 (H.264/AAC) is the safest bet for cross-browser playback. WEBM works in Chromium and Firefox. MOV and M4V depend on the browser's codec support.
