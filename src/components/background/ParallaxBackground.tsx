'use client';

import { useEffect, useState } from 'react';

/**
 * Firewatch 风格视差背景
 * — 固定定位的多层几何山形，滚动速度为前景的 30%~50%
 */
export default function ParallaxBackground() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // 各层视差速度递减（最远层最慢）
  const layer0Y = scrollY * 0.12; // 天空/远山 — 几乎不动
  const layer1Y = scrollY * 0.22; // 中山
  const layer2Y = scrollY * 0.35; // 近山
  const layer3Y = scrollY * 0.48; // 前景剪影 — 50% 速度

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 900"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 日落渐变 */}
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B4A" stopOpacity="0.25" />
            <stop offset="35%" stopColor="#FF8C69" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#FFB347" stopOpacity="0.10" />
            <stop offset="85%" stopColor="#FFD89B" stopOpacity="0.04" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="farHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8836B" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#D4735B" stopOpacity="0.15" />
          </linearGradient>

          <linearGradient id="midHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C0624A" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#A84933" stopOpacity="0.10" />
          </linearGradient>

          <linearGradient id="nearHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B3A2A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#6B2210" stopOpacity="0.06" />
          </linearGradient>

          <linearGradient id="foreHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D1A0E" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2A0E04" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* 天空渐变底 */}
        <rect x="0" y="0" width="1440" height="900" fill="url(#skyGrad)" />

        {/* Layer 0 — 最远山（最慢） */}
        <g transform={`translate(0, ${layer0Y})`}>
          <polygon points="0,550 180,420 340,500 520,390 680,470 820,400 1000,510 1150,430 1300,490 1440,440 1440,900 0,900" fill="url(#farHill)" />
        </g>

        {/* Layer 1 — 远中山 */}
        <g transform={`translate(0, ${layer1Y})`}>
          <polygon points="0,580 220,510 410,600 590,480 750,570 920,490 1090,560 1260,500 1440,540 1440,900 0,900" fill="url(#midHill)" />
        </g>

        {/* Layer 2 — 近山 */}
        <g transform={`translate(0, ${layer2Y})`}>
          <polygon points="0,640 260,570 450,670 650,550 840,650 1030,560 1200,630 1440,580 1440,900 0,900" fill="url(#nearHill)" />
          {/* 松树剪影点缀 */}
          <circle cx="320" cy="590" r="22" fill="#3A2318" opacity="0.25" />
          <circle cx="340" cy="580" r="28" fill="#3A2318" opacity="0.25" />
          <circle cx="880" cy="610" r="18" fill="#3A2318" opacity="0.2" />
          <circle cx="910" cy="600" r="24" fill="#3A2318" opacity="0.2" />
          <circle cx="1150" cy="605" r="20" fill="#3A2318" opacity="0.22" />
        </g>

        {/* Layer 3 — 前景剪影 (50% 速度) */}
        <g transform={`translate(0, ${layer3Y})`}>
          <polygon points="0,720 300,680 500,770 700,690 920,760 1150,700 1350,750 1440,710 1440,900 0,900" fill="url(#foreHill)" />
          {/* 前景树冠 */}
          <circle cx="380" cy="695" r="35" fill="#2A0E04" opacity="0.2" />
          <circle cx="420" cy="690" r="40" fill="#2A0E04" opacity="0.2" />
          <circle cx="395" cy="680" r="30" fill="#2A0E04" opacity="0.18" />
          <circle cx="980" cy="710" r="32" fill="#2A0E04" opacity="0.2" />
          <circle cx="1020" cy="705" r="38" fill="#2A0E04" opacity="0.2" />
        </g>
      </svg>
    </div>
  );
}
