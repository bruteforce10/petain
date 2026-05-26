"use client";

import { useRef, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useVelocity,
  useAnimationFrame,
} from "framer-motion";

interface ParallaxProps {
  children: React.ReactNode;
  baseVelocity: number;
}

function ParallaxText({ children, baseVelocity = 100 }: ParallaxProps) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], {
    clamp: false,
  });

  const directionFactor = useRef<number>(1);
  const wrapValue = (min: number, max: number, v: number) => {
    const rangeSize = max - min;
    return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
  };

  useAnimationFrame((t, delta) => {
    let moveBy = directionFactor.current * baseVelocity * (delta / 1000);

    // change direction if velocity is negative
    if (velocityFactor.get() < 0) {
      directionFactor.current = -1;
    } else if (velocityFactor.get() > 0) {
      directionFactor.current = 1;
    }

    // apply velocity factor
    moveBy += directionFactor.current * moveBy * velocityFactor.get();

    baseX.set(baseX.get() + moveBy);
  });

  // Calculate the wrapping using useTransform
  // This depends on the width of the content. A common pattern is to wrap between 0% and -50%
  // or -100%. We'll wrap at -50% so we have 2 copies filling the space seamlessly.
  const x = useTransform(baseX, (v) => `${wrapValue(0, -50, v)}%`);

  return (
    <div className="parallax overflow-hidden m-0 whitespace-nowrap flex flex-nowrap">
      <motion.div
        className="scroller flex whitespace-nowrap flex-nowrap gap-3 py-4 items-center"
        style={{ x }}
      >
        <div className="flex shrink-0 gap-3 items-center px-1.5">
          {children}
        </div>
        <div className="flex shrink-0 gap-3 items-center px-1.5">
          {children}
        </div>
        <div className="flex shrink-0 gap-3 items-center px-1.5">
          {children}
        </div>
        <div className="flex shrink-0 gap-3 items-center px-1.5">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export function ImageMarquee() {
  const images = [
    "/profesi/1.webp",
    "/profesi/2.webp",
    "/profesi/3.webp",
    "/profesi/4.webp",
    "/profesi/5.webp",
    "/profesi/6.webp",
    "/profesi/7.webp",
  ];

  const [velocity, setVelocity] = useState(-1);

  useEffect(() => {
    const updateSpeed = () => {
      // Increase speed on mobile screens (width < 768px)
      if (window.innerWidth < 768) {
        setVelocity(-4);
      } else {
        setVelocity(-1);
      }
    };

    updateSpeed();
    window.addEventListener("resize", updateSpeed);
    return () => window.removeEventListener("resize", updateSpeed);
  }, []);

  return (
    <div className="w-full overflow-hidden relative py-6">
      {/* Gradients for smooth fade on edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#f5e9d8] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#f5e9d8] to-transparent z-10" />

      <div className="flex flex-col md:gap-6">
        <ParallaxText baseVelocity={velocity}>
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Profesi ${i + 1}`}
              className="h-32 md:h-56 w-auto shrink-0 block"
            />
          ))}
        </ParallaxText>
        <ParallaxText baseVelocity={-velocity}>
          {[...images].reverse().map((src, i) => (
            <img
              key={`rev-${i}`}
              src={src}
              alt={`Profesi Reverse ${i + 1}`}
              className="h-32 md:h-56 w-auto shrink-0 block"
            />
          ))}
        </ParallaxText>
      </div>
    </div>
  );
}
