import React, { useEffect, useRef } from 'react';

export const AppBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Generate subtle animated dots
    const numDots = 140;
    const dots = Array.from({ length: numDots }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.6 + 0.3,
      alpha: Math.random() * 0.7 + 0.2,
      speed: Math.random() * 0.05 + 0.02,
      color: Math.random() > 0.4 ? '#cebdff' : '#00d4ff'
    }));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render subtle glowing dots with soft pulse
      dots.forEach(dot => {
        dot.y -= dot.speed;
        if (dot.y < 0) {
          dot.y = height;
          dot.x = Math.random() * width;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = dot.color;
        ctx.globalAlpha = dot.alpha * (0.8 + Math.sin(Date.now() * 0.002 + dot.x) * 0.2);
        ctx.shadowBlur = 8;
        ctx.shadowColor = dot.color;
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} id="cosmic-canvas" />;
};
