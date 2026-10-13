import type { Locator, Page, TestInfo } from "@playwright/test";

/** Reel (phone) cut vs tutorial (desktop) cut. */
export const isReel = (info: TestInfo) => info.project.name === "reel";

/**
 * Injects, into every page of the recording: a visible cursor (desktop), a click ripple, a
 * spotlight that dims everything except the element being explained, a big emoji caption and a
 * progress bar. Everything is drawn in the page so the video needs no post-production.
 */
export async function installOverlay(page: Page, reel: boolean) {
  await page.addInitScript(
    ({ reel }) => {
      const mount = () => {
        if (document.getElementById("tv-overlay")) return;
        const root = document.createElement("div");
        root.id = "tv-overlay";
        root.innerHTML = `
          <style>
            #tv-cursor{position:fixed;z-index:2147483646;width:30px;height:30px;margin:-4px 0 0 -4px;pointer-events:none;
              display:${reel ? "none" : "block"};left:0;top:0;filter:drop-shadow(0 3px 5px rgba(0,0,0,.45))}
            #tv-ripple{position:fixed;z-index:2147483645;pointer-events:none;width:64px;height:64px;margin:-32px 0 0 -32px;
              border-radius:50%;background:rgba(45,212,191,.45);border:3px solid rgba(45,212,191,.95);opacity:0;transform:scale(.4)}
            #tv-ripple.go{animation:tv-r .6s ease-out}
            @keyframes tv-r{0%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:scale(1.8)}}
            #tv-spot{position:fixed;z-index:2147483640;pointer-events:none;border-radius:20px;border:4px solid #2dd4bf;
              box-shadow:0 0 0 9999px rgba(3,10,25,.62),0 0 34px 6px rgba(45,212,191,.65);opacity:0;
              transition:opacity .3s ease,left .4s ease,top .4s ease,width .4s ease,height .4s ease}
            #tv-spot.show{opacity:1;animation:tv-pulse 1.4s ease-in-out infinite}
            @keyframes tv-pulse{50%{border-color:#99f6e4}}
            #tv-caption{position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%) scale(.85);width:max-content;
              max-width:${reel ? "92vw" : "78vw"};${reel ? "bottom:15%" : "bottom:6%"};padding:${reel ? "18px 24px" : "16px 32px"};
              border-radius:24px;background:linear-gradient(135deg,#0d9488,#0e7490);color:#fff;
              font:800 ${reel ? "40px" : "40px"}/1.2 "Segoe UI Emoji","Segoe UI",system-ui,sans-serif;letter-spacing:-.01em;
              text-align:center;pointer-events:none;opacity:0;box-shadow:0 14px 44px rgba(0,0,0,.5);
              border:3px solid rgba(255,255,255,.85);text-shadow:0 2px 6px rgba(0,0,0,.35)}
            #tv-caption.show{animation:tv-pop .45s cubic-bezier(.2,1.4,.4,1) forwards}
            @keyframes tv-pop{0%{opacity:0;transform:translateX(-50%) scale(.7) translateY(24px)}
              100%{opacity:1;transform:translateX(-50%) scale(1) translateY(0)}}
            #tv-progress{position:fixed;z-index:2147483647;left:0;top:0;height:7px;width:0;background:linear-gradient(90deg,#2dd4bf,#a7f3d0);
              box-shadow:0 0 14px rgba(45,212,191,.9);pointer-events:none}
          </style>
          <div id="tv-spot"></div>
          <svg id="tv-cursor" viewBox="0 0 24 24"><path d="M3 2l7 18 2.6-7.4L20 10z" fill="#fff" stroke="#0b1220" stroke-width="1.6" stroke-linejoin="round"/></svg>
          <div id="tv-ripple"></div><div id="tv-caption"></div><div id="tv-progress"></div>`;
        document.documentElement.appendChild(root);
        // A page change wipes the DOM: pick the progress bar up where it was.
        try {
          const saved = JSON.parse(sessionStorage.getItem("tv-progress") ?? "null");
          if (saved) {
            const bar = document.getElementById("tv-progress")!;
            const elapsed = (Date.now() - saved.start) / 1000;
            const left = Math.max(saved.total - elapsed, 0);
            bar.style.width = `${Math.min((elapsed / saved.total) * 100, 100)}%`;
            void bar.offsetWidth;
            bar.style.transition = `width ${left}s linear`;
            bar.style.width = "100%";
          }
        } catch {}
        const cur = document.getElementById("tv-cursor") as unknown as SVGElement;
        const rip = document.getElementById("tv-ripple")!;
        addEventListener(
          "mousemove",
          (e) => ((cur as any).style.transform = `translate(${e.clientX}px,${e.clientY}px)`),
          true,
        );
        const pop = (x: number, y: number) => {
          rip.style.left = `${x}px`;
          rip.style.top = `${y}px`;
          rip.classList.remove("go");
          void rip.offsetWidth;
          rip.classList.add("go");
        };
        addEventListener("mousedown", (e) => pop(e.clientX, e.clientY), true);
        addEventListener("touchstart", (e) => pop(e.touches[0].clientX, e.touches[0].clientY), true);
      };
      if (document.readyState === "loading") addEventListener("DOMContentLoaded", mount);
      else mount();
    },
    { reel },
  );
}

/** Shows (or hides, with null) the big caption. Use \n for a line break. */
export async function caption(page: Page, text: string | null, holdMs = 0, reel = false) {
  await page.evaluate(({ t, reel }) => {
    const el = document.getElementById("tv-caption");
    if (!el) return;
    el.classList.remove("show");
    // Sit on the opposite half of the screen from the spotlight so it never covers the subject.
    const spot = document.getElementById("tv-spot");
    const r = spot?.classList.contains("show") ? spot.getBoundingClientRect() : null;
    const spotInLowerHalf = r ? r.top + r.height / 2 > innerHeight / 2 : false;
    if (spotInLowerHalf) {
      el.style.bottom = "auto";
      el.style.top = reel ? "5%" : "9%";
    } else {
      el.style.top = "auto";
      el.style.bottom = reel ? "15%" : "6%";
    }
    if (t) {
      el.innerHTML = t.split("\n").map((l) => l.replace(/</g, "&lt;")).join("<br>");
      void el.offsetWidth;
      el.classList.add("show");
    } else el.style.opacity = "0";
  }, { t: text, reel });
  if (holdMs) await page.waitForTimeout(holdMs);
}

/** Dims the page and rings the element being explained; pass null to clear. */
export async function spotlight(page: Page, target: Locator | null, pad = 10) {
  if (!target) {
    await page.evaluate(() => document.getElementById("tv-spot")?.classList.remove("show"));
    return;
  }
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const box = await target.boundingBox();
  if (!box) throw new Error("spotlight: target has no bounding box");
  await page.evaluate(
    ({ box, pad }) => {
      const el = document.getElementById("tv-spot")!;
      el.style.left = `${box.x - pad}px`;
      el.style.top = `${box.y - pad}px`;
      el.style.width = `${box.width + pad * 2}px`;
      el.style.height = `${box.height + pad * 2}px`;
      el.classList.add("show");
    },
    { box, pad },
  );
  // Let the ring finish moving so caption() can read its final position.
  await page.waitForTimeout(450);
}

/** Thin progress bar along the top edge that fills over `seconds`. */
export async function startProgress(page: Page, seconds: number) {
  await page.evaluate((s) => {
    sessionStorage.setItem("tv-progress", JSON.stringify({ start: Date.now(), total: s }));
    const el = document.getElementById("tv-progress")!;
    el.style.transition = "none";
    el.style.width = "0";
    void el.offsetWidth;
    el.style.transition = `width ${s}s linear`;
    el.style.width = "100%";
  }, seconds);
}

/** Glides the cursor to the element, then clicks (taps on the reel cut). */
export async function glideClick(page: Page, target: Locator, reel: boolean) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("glideClick: target has no bounding box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (reel) {
    await page.waitForTimeout(300);
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.move(x, y, { steps: 28 });
    await page.waitForTimeout(250);
    await page.mouse.click(x, y);
  }
}
