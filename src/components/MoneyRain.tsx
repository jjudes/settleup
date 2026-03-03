'use client';

import React, { useEffect, useRef } from 'react';

export default function MoneyRain() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: Particle[] = [];
        const particleCount = 100;
        const mouse = { x: -1000, y: -1000 };

        class Particle {
            x: number;
            y: number;
            size: number;
            speedY: number;
            speedX: number;
            char: string;
            rotation: number;
            rotationSpeed: number;
            opacity: number;

            constructor() {
                this.x = Math.random() * (canvas?.width || 0);
                this.y = Math.random() * (canvas?.height || 0);
                this.size = Math.random() * 20 + 20;
                this.speedY = Math.random() * 0.8 + 0.5;
                this.speedX = Math.random() * 0.6 - 0.3;
                this.char = Math.random() > 0.3 ? '$' : '🤑';
                this.rotation = Math.random() * Math.PI * 2;
                this.rotationSpeed = (Math.random() - 0.5) * 0.05;
                this.opacity = Math.random() * 0.4 + 0.1;
            }

            update() {
                this.y += this.speedY;
                this.x += this.speedX;
                this.rotation += this.rotationSpeed;

                // Mouse interaction
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 150) {
                    const force = (150 - distance) / 150;
                    this.x -= dx * force * 0.05;
                    this.y -= dy * force * 0.05;
                }

                if (this.y > (canvas?.height || 0) + 50) {
                    this.y = -50;
                    this.x = Math.random() * (canvas?.width || 0);
                    this.opacity = Math.random() * 0.4 + 0.1;
                }

                if (this.x < -50) this.x = (canvas?.width || 0) + 50;
                if (this.x > (canvas?.width || 0) + 50) this.x = -50;
            }

            draw() {
                if (!ctx) return;
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);
                ctx.font = this.char === '$' ? `bold ${this.size}px sans-serif` : `${this.size}px serif`;
                ctx.fillStyle = this.char === '$' ? `rgba(70, 146, 60, ${this.opacity})` : `rgba(255, 255, 255, ${this.opacity + 0.2})`; // Emoji a bit more opaque
                ctx.fillText(this.char, -this.size / 2, this.size / 2);
                ctx.restore();
            }
        }

        const init = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            init();
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            animationFrameId = requestAnimationFrame(animate);
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);

        handleResize();
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-0"
        />
    );
}
