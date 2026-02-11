"use client";

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const controls = useAnimationControls();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  useEffect(() => {
    void controls.start({
      opacity: [0.995, 1],
      transition: { duration: 0.12, ease: "linear" }
    });
  }, [controls, pathname]);

  return (
    <motion.div animate={controls} initial={false}>
      {children}
    </motion.div>
  );
}
