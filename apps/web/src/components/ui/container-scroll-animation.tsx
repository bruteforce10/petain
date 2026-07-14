"use client";
import React, { useRef } from "react";
import {
  useScroll,
  useTransform,
  useReducedMotion,
  motion,
  MotionValue,
} from "motion/react";

/**
 * Aceternity ContainerScroll, diadaptasi ke sistem Petain:
 * - Chrome kartu memakai Bingkai Browser (tint mint, tiga titik jendela,
 *   bayangan Artifact float) alih-alih chrome gelap bawaan.
 * - Tinggi mengikuti aspect ratio konten (mobile-first, tanpa crop),
 *   bukan tinggi tetap 60/80rem bawaan.
 * - prefers-reduced-motion: kartu tampil statis tanpa tilt/parallax.
 */
export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.96, 1] : [1.04, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <div
      className="relative flex items-center justify-center px-4 pb-4 pt-14 sm:px-6 md:px-16 md:pb-8 md:pt-20"
      ref={containerRef}
    >
      <div
        className="relative w-full"
        style={{
          perspective: "1000px",
        }}
      >
        <Header
          translate={prefersReducedMotion ? 0 : translate}
          titleComponent={titleComponent}
        />
        <Card
          rotate={prefersReducedMotion ? 0 : rotate}
          scale={prefersReducedMotion ? 1 : scale}
        >
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({
  translate,
  titleComponent,
}: {
  translate: MotionValue<number> | number;
  titleComponent: string | React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="mx-auto max-w-5xl text-center"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number> | number;
  scale: MotionValue<number> | number;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
      }}
      className="mx-auto mt-8 w-full max-w-5xl rounded-[26px] bg-white p-3 shadow-[0_24px_50px_-28px_rgba(0,55,46,0.35)] sm:p-[22px] md:mt-12"
    >
      <div aria-hidden className="mb-2.5 flex gap-1.5 sm:mb-3 sm:gap-2">
        <span className="h-2 w-2 rounded-full bg-[rgba(0,55,46,0.18)] sm:h-2.5 sm:w-2.5" />
        <span className="h-2 w-2 rounded-full bg-[rgba(0,55,46,0.18)] sm:h-2.5 sm:w-2.5" />
        <span className="h-2 w-2 rounded-full bg-[rgba(0,55,46,0.18)] sm:h-2.5 sm:w-2.5" />
      </div>
      <div className="overflow-hidden rounded-[14px] bg-white">{children}</div>
    </motion.div>
  );
};
