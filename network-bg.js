(function () {
    const canvas = document.getElementById('network-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W, H, nodes, edges, particles;

    const COLORS = [
        '#DA702C',
        '#8B7EC8',
        '#3AA99F',
        '#4385BE'
    ];

    const TIERS = [
        { minR: 2, maxR: 3.5, weight: 0.3, pulse: 0.3 },
        { minR: 3, maxR: 5,   weight: 0.6, pulse: 0.5 },
        { minR: 4.5, maxR: 7, weight: 1.0, pulse: 0.8 }
    ];

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function rand(min, max) { return min + Math.random() * (max - min); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

    function createNodes() {
        const area = W * H;
        const count = Math.max(18, Math.min(50, Math.floor(area / 25000)));
        nodes = [];
        for (let i = 0; i < count; i++) {
            const tier = Math.random() < 0.15 ? 2 : (Math.random() < 0.4 ? 1 : 0);
            const t = TIERS[tier];
            nodes.push({
                x: rand(40, W - 40),
                y: rand(40, H - 40),
                vx: rand(-0.15, 0.15),
                vy: rand(-0.15, 0.15),
                r: rand(t.minR, t.maxR),
                tier: tier,
                color: pick(COLORS),
                pulse: t.pulse,
                phase: rand(0, Math.PI * 2)
            });
        }
    }

    function createEdges() {
        edges = [];
        const maxDist = Math.min(W, H) * 0.3;
        for (let i = 0; i < nodes.length; i++) {
            const distances = [];
            for (let j = i + 1; j < nodes.length; j++) {
                const d = dist(nodes[i], nodes[j]);
                if (d < maxDist) distances.push({ j: j, d: d });
            }
            distances.sort(function (a, b) { return a.d - b.d; });
            const connectCount = Math.min(distances.length, Math.floor(rand(1, 3.5)));
            for (let k = 0; k < connectCount; k++) {
                const combinedTier = Math.max(nodes[i].tier, nodes[distances[k].j].tier);
                const wt = TIERS[combinedTier].weight;
                edges.push({
                    a: i,
                    b: distances[k].j,
                    weight: wt,
                    color: Math.random() < 0.5 ? nodes[i].color : nodes[distances[k].j].color
                });
            }
        }
    }

    function createParticles() {
        particles = [];
        const count = Math.max(4, Math.floor(edges.length / 3));
        for (let i = 0; i < count; i++) {
            spawnParticle();
        }
    }

    function spawnParticle() {
        const edge = edges[Math.floor(Math.random() * edges.length)];
        particles.push({
            edge: edge,
            t: 0,
            speed: rand(0.002, 0.008),
            size: rand(1.2, 2.5),
            color: edge.color,
            forward: Math.random() < 0.5
        });
    }

    function init() {
        resize();
        createNodes();
        createEdges();
        createParticles();
    }

    function updateNodes() {
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            n.x += n.vx;
            n.y += n.vy;
            if (n.x < 20 || n.x > W - 20) n.vx *= -1;
            if (n.y < 20 || n.y > H - 20) n.vy *= -1;
            n.x = Math.max(10, Math.min(W - 10, n.x));
            n.y = Math.max(10, Math.min(H - 10, n.y));
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.t += p.speed;
            if (p.t >= 1) {
                particles.splice(i, 1);
                spawnParticle();
            }
        }
    }

    let edgeTimer = 0;
    const EDGE_REBUILD_INTERVAL = 600;
    let rafId = null;
    let inViewport = true;
    let tabVisible = !document.hidden;

    function draw(time) {
        ctx.clearRect(0, 0, W, H);

        edgeTimer++;
        if (edgeTimer >= EDGE_REBUILD_INTERVAL) {
            edgeTimer = 0;
            createEdges();
            while (particles.length < Math.max(4, Math.floor(edges.length / 3))) {
                spawnParticle();
            }
        }

        updateNodes();
        updateParticles();

        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            const a = nodes[e.a];
            const b = nodes[e.b];
            const d = dist(a, b);
            const maxDist = Math.min(W, H) * 0.3;
            const fade = 1 - Math.pow(d / maxDist, 2);
            if (fade <= 0) continue;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = e.color;
            ctx.globalAlpha = 0.08 * e.weight * fade;
            ctx.lineWidth = 0.5 + e.weight * 1.5;
            ctx.stroke();
        }

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const a = nodes[p.edge.a];
            const b = nodes[p.edge.b];
            const t = p.forward ? p.t : 1 - p.t;
            const px = a.x + (b.x - a.x) * t;
            const py = a.y + (b.y - a.y) * t;
            let alpha = Math.min(p.t, 1 - p.t) * 4;
            alpha = Math.min(alpha, 1);
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.25 * alpha;
            ctx.fill();
        }

        const t = time * 0.001;
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            const pulseScale = 1 + Math.sin(t * 1.5 + n.phase) * 0.15 * n.pulse;
            const r = n.r * pulseScale;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fillStyle = n.color;
            ctx.globalAlpha = 0.15 + n.tier * 0.08;
            ctx.fill();
            if (n.tier === 2) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
                ctx.strokeStyle = n.color;
                ctx.globalAlpha = 0.06 + Math.sin(t * 1.5 + n.phase) * 0.03;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1;
        rafId = requestAnimationFrame(draw);
    }

    function shouldAnimate() {
        return inViewport && tabVisible;
    }

    function start() {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(draw);
    }

    function stop() {
        if (rafId === null) return;
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    function syncRunState() {
        if (shouldAnimate()) start();
        else stop();
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!prefersReducedMotion.matches) {
        init();
        start();

        const observer = new IntersectionObserver(function (entries) {
            inViewport = entries[0].isIntersecting;
            syncRunState();
        });
        observer.observe(canvas);

        document.addEventListener('visibilitychange', function () {
            tabVisible = !document.hidden;
            syncRunState();
        });

        let resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                resize();
                createNodes();
                createEdges();
                createParticles();
            }, 200);
        }, { passive: true });
    }
})();
