# Notes for future contributors (human or LLM)

## Primary directive

Keep this plugin as small and simple as possible. ~45 lines of vanilla JS in `webapp/main.js` is the whole thing. The HTML5 `<video controls>` element does all the real work. Resist the urge to add features the browser already provides for free (custom controls, thumbnail generation, codec detection, picture-in-picture buttons, etc.).

If a change would noticeably grow the codebase, stop and check whether it's truly required.

## Why DOM injection rather than the plugin API

Mattermost's documented `registerFilePreviewComponent` hook only fires inside the file preview modal (verified at `webapp/channels/src/components/file_preview_modal/file_preview_modal.tsx` lines 412-424 in `mattermost/mattermost` master, mid-2026). The inline file-attachment chip in the channel stream has **no plugin hook at all** in current Mattermost. To render a `<video>` element under a post the way the mobile app does, the only available approach is to walk the DOM and replace chips after React renders them.

A `MutationObserver` on `document.body` is the right primitive for this. Polling is wrong.

If a future Mattermost release adds a real inline-file extension point (e.g. `registerInlineFileComponent`), throw all of this away and switch to the API.

## DOM selectors we depend on

Verified against `mattermost/mattermost` master, mid-2026. If a future Mattermost UI refactor breaks them, the plugin will silently no-op (chips will render as before, no crashes).

| Selector                                          | Source                                                                              | Purpose                                     |
|---------------------------------------------------|-------------------------------------------------------------------------------------|---------------------------------------------|
| `.post-image__column`                             | `webapp/channels/src/components/file_attachment/file_attachment.tsx` ~line 400      | Outer file chip                             |
| `.post-image__type`                               | same file, ~line 342                                                                | Extension badge text (uppercased)           |
| `.post-image__download a[href*="/api/v4/files/"]` | `webapp/channels/src/components/file_attachment/filename_overlay.tsx` ~line 92      | Download link; href contains the file id    |

We deliberately do NOT rely on `button[id^="file_action_button_"]` (the dropdown action button), even though it also carries the file id. That button is conditionally rendered and absent in some views or permission states (confirmed via real DOM inspection on Mattermost server 11.x), so it is a less reliable source than the download link.

File URLs (cookie-authenticated by the user's Mattermost session):
- Streaming: `/api/v4/files/{id}` (the `?download=1` flag in the link href is dropped, since it triggers `Content-Disposition: attachment` and would prevent inline playback)

Both `/api/v4/files/{id}/thumbnail` and `/api/v4/files/{id}/preview` return HTTP 400 for video files (Mattermost server only generates these for images). We do NOT set a `poster` attribute on the `<video>` element; the browser shows the video's first frame after metadata loads. Do not re-add a poster pointing at those endpoints - the 400 response causes Chrome to skip rendering anything until the user plays the video.

## Intentionally absent

- No server-side Go code. This is a webapp-only plugin.
- No TypeScript, no bundler, no `node_modules`. `webapp/main.js` in the repo IS the bundle.
- No custom video player. The browser's native one already has fullscreen, seek, volume, playback speed, PiP.
- No thumbnail generation. Mattermost server already does it.
- No React. DOM-level integration only.

If you find yourself reaching for any of these, stop and ask whether it's truly necessary.

## Testing changes

```
make bundle
```

Upload `dist/mattermost-video-player.tar.gz` via **System Console > Plugin Management > Upload Plugin**, enable the plugin, then post a video file in a channel.

Check:
1. The file-chip is replaced by a `<video>` element.
2. Native controls appear (play, scrub, fullscreen, volume).
3. The video's first frame shows before the user clicks play (no separate poster image, since Mattermost server does not generate them for videos).
4. No flicker, flash, or visual artifact when hovering the post (especially in Firefox).
5. Video renders correctly in the RHS thread pane.

## Coexisting with React

We do NOT remove or replace any DOM node React owns. Instead:

1. A CSS rule injected at init hides any chip that contains `.file-icon.video` **and is inside a `.post`**. The `.post` ancestor scoping is critical: Mattermost reuses the same `.post-image__column` markup in the upload-preview area (where the user picks files to send), so without it our rule would hide the file the user is trying to upload. The rule survives React re-renders automatically: any new chip React produces with the same shape is hidden.
2. Our `<video>` element is inserted as the chip's preceding sibling. The idempotency check is simply: does the chip's `previousElementSibling` already exist and is it a `<video>`? If yes, skip.
3. The `swap()` function also short-circuits if the chip has no `.post` ancestor, so we don't inject videos into the upload-preview area either.

The chip stays in the DOM untouched (just invisible), and our video is a separate element React knows nothing about. We deliberately do NOT try to add classes or attributes to React-managed elements: React's reconciliation strips them on the next render, and re-adding them via a `MutationObserver` causes browser-locking loops.

## The `.post { overflow: hidden !important }` rule (do not remove)

This rule looks unrelated to a video player and a future contributor will be tempted to delete it. **Don't.**

Mattermost's `.post:hover` rule toggles `overflow: hidden` to `overflow: visible`. In Firefox, this overflow change triggers a compositor-layer rebuild on the post subtree, which detaches and re-attaches the `<video>` element's render surface. The visible result is a ~200ms flash where the video's content (thumbnail + controls) disappears and the page background shows through, every time the mouse enters or leaves the post.

The fix is to keep `.post`'s overflow stable: `.post { overflow: hidden !important }` blocks the toggle from ever happening. The fix is blanket across all posts (not scoped to ones containing our video) because scoping via JS class fails - React strips the class on re-render - and scoping via `:has()` is unreliable in Firefox for dynamically inserted descendants.

Side effect: any popover, dropdown, or tooltip rooted inside a `.post` that would extend beyond the post's box is now clipped. The current Mattermost UI does not seem to use this pattern visibly, so the trade-off is invisible in practice. If a future Mattermost release adds such a thing, target the override more narrowly then.

## Known fragilities

- Mattermost DOM class names can change between major versions. We have no automated detection; only manual testing on a new server version will catch it.
- The chip-hide CSS rule uses `:has()`, which requires Chrome 105+, Firefox 121+, Safari 15.4+. Mattermost-supported browsers are well above these floors in 2026.
- Codec support is the browser's responsibility, not ours. MP4 (H.264/AAC) plays everywhere; MOV, M4V, WEBM, and OGV depend on the browser. We accept this trade-off rather than detecting and warning.
- The `<video>` uses `preload="auto"`, which tells the browser to eagerly download the video on page load (not just metadata). This makes click-to-play instant in the common case (no waiting for buffer) and makes the first frame render reliably across browsers. Trade-off: every video in view starts downloading on page load even if the user never plays it. For typical chat-app usage this is fine, but if it ever becomes a bandwidth problem the alternative is `preload="metadata"` plus a custom buffering overlay wired to the `waiting`/`playing` events.

## Releasing

1. Bump the `version` field in `plugin.json` (semver).
2. Commit: `git commit -am "0.2.0"`
3. Tag and push: `git tag 0.2.0 && git push --follow-tags`

The workflow at `.github/workflows/release.yml` fires on any tag push. It runs `make bundle`, attests the build's provenance (cryptographic proof the artefact came from this exact source via this workflow), then creates a **draft** GitHub release with the renamed tar.gz attached. Open the draft on GitHub, review, click Publish.

First-time GitHub setup: in the repo's **Settings > Actions > General > Workflow permissions**, set "Read and write permissions" (required for `gh release create`).

## File map

- `plugin.json` - manifest (id, version, webapp.bundle_path).
- `webapp/main.js` - the entire plugin. Single IIFE, no imports.
- `Makefile` - `bundle` target produces the tar.gz. `clean` removes build artefacts.
- `.github/workflows/release.yml` - on tag push, builds + attests + creates a draft GitHub release.
- `README.md` - user-facing install/usage docs.
- `CONTRIBUTORS.md` - this file.
