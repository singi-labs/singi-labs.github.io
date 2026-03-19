(function () {
    var canvas = document.getElementById('network-bg');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W, H, nodes, edges, particles;

    var COLORS = [
        '#DA702C',
        '#8B7EC8',
        '#3AA99F',
        '#4385BE'
    ];

    var TIERS = [
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
    function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

    function createNodes() {
        var area = W * H;
        var count = Math.max(18, Math.min(50, Math.floor(area / 25000)));
        nodes = [];
        for (var i = 0; i < count; i++) {
            var tier = Math.random() < 0.15 ? 2 : (Math.random() < 0.4 ? 1 : 0);
            var t = TIERS[tier];
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
        var maxDist = Math.min(W, H) * 0.3;
        for (var i = 0; i < nodes.length; i++) {
            var distances = [];
            for (var j = i + 1; j < nodes.length; j++) {
                var d = dist(nodes[i], nodes[j]);
                if (d < maxDist) distances.push({ j: j, d: d });
            }
            distances.sort(function (a, b) { return a.d - b.d; });
            var connectCount = Math.min(distances.length, Math.floor(rand(1, 3.5)));
            for (var k = 0; k < connectCount; k++) {
                var combinedTier = Math.max(nodes[i].tier, nodes[distances[k].j].tier);
                var wt = TIERS[combinedTier].weight;
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
        var count = Math.max(4, Math.floor(edges.length / 3));
        for (var i = 0; i < count; i++) {
            spawnParticle();
        }
    }

    function spawnParticle() {
        var edge = edges[Math.floor(Math.random() * edges.length)];
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
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            n.x += n.vx;
            n.y += n.vy;
            if (n.x < 20 || n.x > W - 20) n.vx *= -1;
            if (n.y < 20 || n.y > H - 20) n.vy *= -1;
            n.x = Math.max(10, Math.min(W - 10, n.x));
            n.y = Math.max(10, Math.min(H - 10, n.y));
        }
    }

    function updateParticles() {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.t += p.speed;
            if (p.t >= 1) {
                particles.splice(i, 1);
                spawnParticle();
            }
        }
    }

    var edgeTimer = 0;
    var EDGE_REBUILD_INTERVAL = 600;

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

        for (var i = 0; i < edges.length; i++) {
            var e = edges[i];
            var a = nodes[e.a];
            var b = nodes[e.b];
            var d = dist(a, b);
            var maxDist = Math.min(W, H) * 0.3;
            var fade = 1 - Math.pow(d / maxDist, 2);
            if (fade <= 0) continue;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = e.color;
            ctx.globalAlpha = 0.08 * e.weight * fade;
            ctx.lineWidth = 0.5 + e.weight * 1.5;
            ctx.stroke();
        }

        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            var a = nodes[p.edge.a];
            var b = nodes[p.edge.b];
            var t = p.forward ? p.t : 1 - p.t;
            var px = a.x + (b.x - a.x) * t;
            var py = a.y + (b.y - a.y) * t;
            var alpha = Math.min(p.t, 1 - p.t) * 4;
            alpha = Math.min(alpha, 1);
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.25 * alpha;
            ctx.fill();
        }

        var t = time * 0.001;
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var pulseScale = 1 + Math.sin(t * 1.5 + n.phase) * 0.15 * n.pulse;
            var r = n.r * pulseScale;
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
        requestAnimationFrame(draw);
    }

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!prefersReducedMotion.matches) {
        init();
        requestAnimationFrame(draw);

        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                resize();
                createNodes();
                createEdges();
                createParticles();
            }, 200);
        });
    }
})();
