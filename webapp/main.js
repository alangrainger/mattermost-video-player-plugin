(() => {
    'use strict';

    const FILE_ID = /\/api\/v4\/files\/([^/?]+)/;
    const INJECTED_CSS = `.post .post-image__column:has(.file-icon.video){display:none!important}
        .mm-video{width:100%;max-width:640px;max-height:480px;display:block;transform:translateZ(0)}
        .MediaGallery__tile>.mm-video{height:auto;object-fit:contain;cursor:auto}
        .MediaGallery__tile:has(>.mm-video)>:not(.mm-video,.image-preview-utility-buttons-container){display:none!important}
        .MediaGallery__row:has(.mm-video){height:auto!important;flex-wrap:wrap}
        .MediaGallery__tile:has(>.mm-video){width:auto!important;height:auto!important;max-width:100%;flex:0 1 auto!important;min-width:0}`;

    /**
     * Inject the plugin's CSS once at startup. The first rule hides Mattermost's
     * default file-attachment chip for videos so our <video> element shows in
     * its place. The second sizes the inline video and promotes it to its own
     * compositor layer (transform:translateZ(0)). The remaining rules handle
     * v12+ MediaGallery tiles: they hide the tile's thumbnail and overlays,
     * release the gallery's fixed row/tile dimensions, and let the tile shrink
     * and wrap so the player fits narrow panes and multi-item rows.
     */
    function injectStyle() {
        const s = document.createElement('style');
        s.textContent = INJECTED_CSS;
        document.head.appendChild(s);
    }

    /**
     * Build a configured <video> from a download link, or return null if the
     * link carries no Mattermost file id. Shared by the chip and gallery paths
     * so controls, preload, src and className stay identical between them.
     */
    function makeVideo(link) {
        const match = link?.getAttribute('href').match(FILE_ID);
        if (!match) return null;
        const video = document.createElement('video');
        video.controls = true;
        video.preload = 'auto';
        video.src = `/api/v4/files/${match[1]}`;
        video.className = 'mm-video';
        return video;
    }

    /**
     * If the given file-attachment chip is inside a post AND refers to a video
     * upload, insert an HTML5 <video> element as its sibling. The chip itself
     * stays in the DOM (hidden by our injected CSS) so React's reconciliation
     * never fights us over the injected element. Skipping chips outside a
     * `.post` ancestor leaves the upload-preview area unaffected.
     */
    function swap(chip) {
        if (!chip.closest('.post') || chip.previousElementSibling?.tagName === 'VIDEO') return;
        if (!chip.querySelector('.file-icon.video')) return;
        const video = makeVideo(chip.querySelector('.post-image__download a[href*="/api/v4/files/"]'));
        if (video) chip.parentElement.insertBefore(video, chip);
    }

    /**
     * Mattermost v12+ renders single-video and all-media posts as MediaGallery
     * tiles (posts mixing video with other files still get chips) whose click
     * handler opens a fullscreen modal. Replace the tile's thumbnail with an
     * inline <video>, keeping the download link intact. Event propagation is
     * stopped on the player so using its controls does not also trigger the
     * tile's modal.
     */
    function swapTile(tile) {
        if (!tile.closest('.post') || tile.querySelector(':scope > .mm-video')) return;
        if (!tile.querySelector('.MediaGallery__tile__play_indicator')) return;
        const video = makeVideo(tile.querySelector('a.size-aware-image__download[href*="/api/v4/files/"]'));
        if (!video) return;

        video.addEventListener('click', e => e.stopPropagation());
        video.addEventListener('keydown', e => {
            if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
        });

        tile.prepend(video);
    }

    /**
     * Process every file-attachment chip and MediaGallery video tile inside
     * `root`. Used both for the initial pass over the page and for any new
     * nodes the MutationObserver picks up later (channel switches, scroll-back
     * loads, new posts, etc.).
     */
    function scan(root) {
        if (root.nodeType !== 1) return;
        if (root.matches('.post-image__column')) swap(root);
        root.querySelectorAll('.post-image__column').forEach(swap);
        if (root.matches('.MediaGallery__tile')) swapTile(root);
        root.querySelectorAll('.MediaGallery__tile').forEach(swapTile);
    }

    window.registerPlugin('mattermost-video-player', {
        /**
         * Mattermost plugin entrypoint. Injects our CSS, processes any chips
         * and tiles already in the DOM, then watches for new ones via
         * MutationObserver.
         */
        initialize() {
            injectStyle();
            scan(document.body);
            new MutationObserver(mutations => {
                for (const m of mutations) for (const n of m.addedNodes) scan(n);
            }).observe(document.body, {childList: true, subtree: true});
        },
    });
})();
