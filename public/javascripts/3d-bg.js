
(function() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const PARTICLE_COUNT = 80;
    const CONNECTION_DIST = 150;
    const MOUSE_INFLUENCE = 120;

    let mouse = { x: W / 2, y: H / 2 };

    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    window.addEventListener('resize', () => {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    });

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.r = Math.random() * 2 + 1;
            this.baseAlpha = Math.random() * 0.5 + 0.2;
            this.alpha = this.baseAlpha;
            const colors = ['124, 58, 237', '37, 99, 235', '6, 182, 212', '167, 139, 250'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // mouse repulsion
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MOUSE_INFLUENCE) {
                const force = (MOUSE_INFLUENCE - dist) / MOUSE_INFLUENCE;
                this.x += dx * force * 0.02;
                this.y += dy * force * 0.02;
                this.alpha = Math.min(1, this.baseAlpha + force * 0.4);
            } else {
                this.alpha += (this.baseAlpha - this.alpha) * 0.05;
            }

            if (this.x < 0) this.x = W;
            if (this.x > W) this.x = 0;
            if (this.y < 0) this.y = H;
            if (this.y > H) this.y = 0;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
            ctx.fill();

            // glow
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r * 3, 0, Math.PI * 2);
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 3);
            grad.addColorStop(0, `rgba(${this.color}, ${this.alpha * 0.3})`);
            grad.addColorStop(1, `rgba(${this.color}, 0)`);
            ctx.fillStyle = grad;
            ctx.fill();
        }
    }

    const particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle());

    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONNECTION_DIST) {
                    const alpha = (1 - dist / CONNECTION_DIST) * 0.2;
                    const grad = ctx.createLinearGradient(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                    grad.addColorStop(0, `rgba(${particles[i].color}, ${alpha})`);
                    grad.addColorStop(1, `rgba(${particles[j].color}, ${alpha})`);
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, W, H);

        // subtle grid
        ctx.strokeStyle = 'rgba(124,58,237,0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 60) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += 60) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        drawConnections();
        particles.forEach(p => { p.update(); p.draw(); });

        requestAnimationFrame(animate);
    }

    animate();

    function initTilt(scope) {
        const cards = (scope || document).querySelectorAll('.card-3d:not([data-tilt])');
        cards.forEach(card => {
            card.dataset.tilt = '1';
            card.addEventListener('mousemove', e => {
                const rect = card.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const rx = ((e.clientY - cy) / (rect.height / 2)) * -8;
                const ry = ((e.clientX - cx) / (rect.width / 2)) * 8;
                card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    }

    initTilt();
    window._init3DTilt = initTilt;
})();
