"use client";

import * as React from "react";

const DURATION_MS = 280;

/**
 * Height open/close (grid rows 0fr → 1fr). Content stays mounted while it closes and
 * is unmounted after; once open, overflow is released so dropdowns inside can spill out.
 */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(open);
  const [expanded, setExpanded] = React.useState(open);
  const [settled, setSettled] = React.useState(open);
  const lastChildren = React.useRef(children);
  if (open && children) lastChildren.current = children;

  React.useEffect(() => {
    let frame = 0;
    let timer = 0;
    if (open) {
      setMounted(true);
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => setExpanded(true));
      });
      timer = window.setTimeout(() => setSettled(true), DURATION_MS);
    } else {
      setSettled(false);
      setExpanded(false);
      timer = window.setTimeout(() => setMounted(false), DURATION_MS);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open]);

  if (!mounted) return null;
  return (
    <div className="settings-collapse" data-open={expanded ? "true" : "false"}>
      <div className={settled ? "min-h-0" : "min-h-0 overflow-hidden"}>
        {open ? children : lastChildren.current}
      </div>
    </div>
  );
}
