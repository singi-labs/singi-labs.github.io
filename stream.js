// "Latest from the network" — a single merged stream of the three Singi Labs
// accounts' Bluesky posts. Read-only, no auth: the public AT Protocol AppView
// (public.api.bsky.app) serves getAuthorFeed without a token. All post text is
// rendered via textContent and every card is a single <a> to the post on
// bsky.app, so nothing from the network is ever injected as markup.
(function () {
    var root = document.getElementById('stream');
    if (!root) return;

    var ACCOUNTS = [
        { handle: 'singi.dev',    accent: '#DA702C' },
        { handle: 'barazo.forum', accent: '#3AA99F' },
        { handle: 'sifa.id',      accent: '#4385BE' }
    ];
    var API = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed';
    var MAX_CARDS = 12;
    // Cap each account so a high-volume account (Sifa posts daily) can't crowd
    // out the quieter ones (Barazo, Singi). Guarantees all three appear.
    var MAX_PER_ACCOUNT = 5;
    // Prefer posts with a bit of traction (likes + reposts + replies + quotes)
    // to filter out throwaway/dead posts. An account whose posts all fall short
    // still shows its most recent one, so none of the three ever vanishes.
    var MIN_REACTIONS = 5;

    var accentByHandle = {};
    ACCOUNTS.forEach(function (a) { accentByHandle[a.handle] = a.accent; });

    // Phosphor icons (static markup — safe to set via innerHTML).
    var ICONS = {
        reply: '<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216l12.47-37.4a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg>',
        repost: '<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M24,128A72.08,72.08,0,0,1,96,56H204.69L194.34,45.66a8,8,0,0,1,11.32-11.32l24,24a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L204.69,72H96a56.06,56.06,0,0,0-56,56,8,8,0,0,1-16,0Zm200-8a8,8,0,0,0-8,8,56.06,56.06,0,0,1-56,56H51.31l10.35-10.34a8,8,0,0,0-11.32-11.32l-24,24a8,8,0,0,0,0,11.32l24,24a8,8,0,0,0,11.32-11.32L51.31,200H160a72.08,72.08,0,0,0,72-72A8,8,0,0,0,224,120Z"/></svg>',
        like: '<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32Z"/></svg>'
    };

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    function fetchFeed(account) {
        var url = API + '?actor=' + encodeURIComponent(account.handle) +
            '&limit=20&filter=posts_no_replies';
        return fetch(url, { headers: { Accept: 'application/json' } })
            .then(function (r) {
                if (!r.ok) throw new Error(account.handle + ' HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                return (data.feed || [])
                    .filter(function (item) { return !item.reason; })          // drop reposts
                    .map(function (item) { return item.post; })
                    .filter(function (p) {                                      // originals only
                        return p && p.author && p.author.handle === account.handle && p.record;
                    });
            });
    }

    function relTime(iso) {
        var t = new Date(iso).getTime();
        if (isNaN(t)) return '';
        var s = Math.max(0, (Date.now() - t) / 1000);
        if (s < 60) return 'now';
        var m = s / 60; if (m < 60) return Math.floor(m) + 'm';
        var h = m / 60; if (h < 24) return Math.floor(h) + 'h';
        var d = h / 24; if (d < 30) return Math.floor(d) + 'd';
        var mo = d / 30; if (mo < 12) return Math.floor(mo) + 'mo';
        return Math.floor(mo / 12) + 'y';
    }

    function formatCount(n) {
        n = n || 0;
        if (n >= 1000) {
            var v = n / 1000;
            return (n >= 10000 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')) + 'K';
        }
        return String(n);
    }

    function rkeyOf(uri) {
        var m = /\/app\.bsky\.feed\.post\/([A-Za-z0-9._~-]+)$/.exec(uri || '');
        return m ? m[1] : null;
    }

    function stat(iconName, count) {
        var s = el('span', 'post-stat');
        var ico = el('span', 'post-stat-ico');
        ico.innerHTML = ICONS[iconName];
        s.appendChild(ico);
        s.appendChild(el('span', 'post-stat-n', formatCount(count)));
        return s;
    }

    function appendEmbed(container, embed) {
        if (!embed || !embed.$type) return;
        var t = embed.$type;
        if (t === 'app.bsky.embed.images#view' && embed.images && embed.images.length) {
            var media = el('div', 'post-media');
            var img = el('img');
            img.src = embed.images[0].thumb;
            img.alt = embed.images[0].alt || '';
            img.loading = 'lazy';
            img.decoding = 'async';
            media.appendChild(img);
            container.appendChild(media);
        } else if (t === 'app.bsky.embed.external#view' && embed.external) {
            var ext = el('div', 'post-ext');
            if (embed.external.thumb) {
                var thumb = el('img', 'post-ext-thumb');
                thumb.src = embed.external.thumb;
                thumb.alt = '';
                thumb.loading = 'lazy';
                ext.appendChild(thumb);
            }
            var body = el('div', 'post-ext-body');
            body.appendChild(el('span', 'post-ext-title', embed.external.title || embed.external.uri));
            var host = '';
            try { host = new URL(embed.external.uri).hostname.replace(/^www\./, ''); } catch (e) {}
            if (host) body.appendChild(el('span', 'post-ext-host', host));
            ext.appendChild(body);
            container.appendChild(ext);
        } else if (t === 'app.bsky.embed.recordWithMedia#view') {
            appendEmbed(container, embed.media);
        } else if (t === 'app.bsky.embed.record#view' && embed.record) {
            var rec = embed.record;
            var author = rec.author || (rec.record && rec.record.author);
            var value = rec.value || (rec.record && rec.record.value);
            var quoted = value && value.text;
            if (quoted) {
                var q = el('div', 'post-quote');
                if (author) {
                    q.appendChild(el('span', 'post-quote-author',
                        author.displayName || ('@' + author.handle)));
                }
                q.appendChild(el('span', 'post-quote-text', quoted));
                container.appendChild(q);
            }
        }
    }

    function card(post) {
        var handle = post.author.handle;
        var accent = accentByHandle[handle] || 'var(--muted)';
        var rkey = rkeyOf(post.uri);

        var a = el('a', 'post-card');
        a.href = 'https://bsky.app/profile/' + encodeURIComponent(handle) +
            (rkey ? '/post/' + rkey : '');
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.setProperty('--card-accent', accent);

        var head = el('div', 'post-head');
        if (post.author.avatar) {
            var av = el('img', 'post-avatar');
            av.src = post.author.avatar;
            av.alt = '';
            av.loading = 'lazy';
            head.appendChild(av);
        } else {
            head.appendChild(el('span', 'post-avatar post-avatar--fallback'));
        }
        var meta = el('div', 'post-meta');
        meta.appendChild(el('span', 'post-name', post.author.displayName || handle));
        var when = relTime(post.indexedAt || post.record.createdAt);
        meta.appendChild(el('span', 'post-handle', '@' + handle + (when ? ' · ' + when : '')));
        head.appendChild(meta);
        a.appendChild(head);

        if (post.record.text) a.appendChild(el('p', 'post-text', post.record.text));

        appendEmbed(a, post.embed);

        var stats = el('div', 'post-stats');
        stats.appendChild(stat('reply', post.replyCount));
        stats.appendChild(stat('repost', (post.repostCount || 0) + (post.quoteCount || 0)));
        stats.appendChild(stat('like', post.likeCount));
        a.appendChild(stats);

        return a;
    }

    function renderFallback() {
        root.setAttribute('aria-busy', 'false');
        root.innerHTML = '';
        var f = el('p', 'stream-fallback');
        f.appendChild(el('span', null, 'Follow us on Bluesky: '));
        ACCOUNTS.forEach(function (account, i) {
            var link = el('a', null, '@' + account.handle);
            link.href = 'https://bsky.app/profile/' + account.handle;
            link.target = '_blank';
            link.rel = 'noopener';
            f.appendChild(link);
            if (i < ACCOUNTS.length - 1) f.appendChild(el('span', 'stream-sep', ' · '));
        });
        root.appendChild(f);
    }

    Promise.allSettled(ACCOUNTS.map(fetchFeed)).then(function (results) {
        function reactions(p) {
            return (p.likeCount || 0) + (p.repostCount || 0) +
                (p.replyCount || 0) + (p.quoteCount || 0);
        }
        var posts = [];
        results.forEach(function (r) {
            if (r.status !== 'fulfilled' || !r.value.length) return;
            var originals = r.value;                                    // newest first
            var qualifying = originals.filter(function (p) {
                return reactions(p) >= MIN_REACTIONS;
            });
            // Prefer traction, but fall back to the account's newest post so a
            // quiet account (e.g. Barazo) is still represented.
            var picked = qualifying.length ? qualifying : [originals[0]];
            posts = posts.concat(picked.slice(0, MAX_PER_ACCOUNT));
        });

        var seen = {};
        posts = posts.filter(function (p) {
            if (seen[p.uri]) return false;
            seen[p.uri] = true;
            return true;
        });
        posts.sort(function (a, b) {
            return new Date(b.indexedAt || b.record.createdAt) -
                new Date(a.indexedAt || a.record.createdAt);
        });
        posts = posts.slice(0, MAX_CARDS);

        if (!posts.length) { renderFallback(); return; }

        var frag = document.createDocumentFragment();
        posts.forEach(function (p) { frag.appendChild(card(p)); });
        root.setAttribute('aria-busy', 'false');
        root.innerHTML = '';
        root.appendChild(frag);
        root.setAttribute('data-loaded', 'true');
    }).catch(renderFallback);
})();
