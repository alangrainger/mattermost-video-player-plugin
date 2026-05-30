(() => {
    'use strict';

    const FILE_ID = /\/api\/v4\/files\/([^/?]+)/;
    const INJECTED_CSS = `.post .post-image__column:has(.file-icon.video){display:none!important} .post{overflow:hidden!important} 
        .mm-video{width:100%;max-width:640px;max-height:480px;display:block}`;

    /**
     * Inject the plugin's CSS once at startup. The first rule hides Mattermost's
     * default file-attachment chip for videos so our <video> element shows in
     * its place. The second prevents a Firefox-specific compositor flash on post
     * hover (Mattermost toggles .post overflow on :hover, which causes Firefox
     * to detach and re-attach the video's render layer; see CONTRIBUTORS.md).
     */
    function injectStyle() {
        const s = document.createElement('style');
        s.textContent = INJECTED_CSS;
        document.head.appendChild(s);
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

        const link = chip.querySelector('.post-image__download a[href*="/api/v4/files/"]');
        const match = link?.getAttribute('href').match(FILE_ID);
        if (!match) return;

        const video = document.createElement('video');
        video.controls = true;
        video.preload = 'auto';
        video.src = `/api/v4/files/${match[1]}`;
        video.className = 'mm-video';
        chip.parentElement.insertBefore(video, chip);
    }

    /**
     * Process every file-attachment chip inside `root`. Used both for the
     * initial pass over the page and for any new nodes the MutationObserver
     * picks up later (channel switches, scroll-back loads, new posts, etc.).
     */
    function scan(root) {
        if (root.nodeType !== 1) return;
        if (root.matches('.post-image__column')) swap(root);
        root.querySelectorAll('.post-image__column').forEach(swap);
    }

    window.registerPlugin('mattermost-video-player', {
        /**
         * Mattermost plugin entrypoint. Injects our CSS, processes any chips
         * already in the DOM, then watches for new ones via MutationObserver.
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
