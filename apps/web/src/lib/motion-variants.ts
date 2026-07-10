import type { Variants } from 'framer-motion';

const entranceEase = [0.16, 1, 0.3, 1] as const;
const revealEase = [0.2, 0.8, 0.2, 1] as const;
const settleEase = [0.19, 1, 0.22, 1] as const;

export const entrance: Variants = {
  initial: { opacity: 0, y: 18, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.34, ease: entranceEase } },
  exit: { opacity: 0, y: 8, filter: 'blur(4px)', transition: { duration: 0.16 } },
};

export const reveal: Variants = {
  initial: { opacity: 0, clipPath: 'inset(0 0 12% 0)' },
  animate: { opacity: 1, clipPath: 'inset(0 0 0% 0)', transition: { duration: 0.28, ease: revealEase } },
  exit: { opacity: 0, clipPath: 'inset(0 0 8% 0)', transition: { duration: 0.16 } },
};

export const defer: Variants = {
  animate: { transition: { staggerChildren: 0.052, delayChildren: 0.04 } },
};

export const settle: Variants = {
  initial: { opacity: 0, scale: 0.985, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.26, ease: settleEase } },
  exit: { opacity: 0, scale: 0.992, y: 4, transition: { duration: 0.14 } },
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: entranceEase } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const slideUp: Variants = entrance;
export const scaleIn: Variants = settle;
export const stagger: Variants = defer;

export const listItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: entranceEase } },
};
