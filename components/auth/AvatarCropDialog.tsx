"use client";

import * as React from "react";
import Cropper from "react-easy-crop";
import { avatarDimensionsProblem, avatarFileProblem } from "@/lib/register-avatar";
import { registerPrimaryButtonClass } from "@/lib/register-ui";

/**
 * Profile photo checks and the square crop dialog, shared by /register and the
 * founders' review (replace photo), so both behave exactly the same: format and
 * size checked, 400×400 minimum, round crop with zoom, exported as a compact
 * 900×900 JPEG.
 */

type CropArea = { x: number; y: number; width: number; height: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = src;
  });
}

async function cropToBlob(imageSrc: string, area: CropArea): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  // Keep enough resolution for retina profile circles while avoiding oversized uploads.
  canvas.width = 900;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare crop canvas.");

  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);

  const toBlob = (quality: number) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/jpeg", quality);
    });

  // Compress progressively until we get a compact file while preserving quality.
  // Target chosen to keep uploads snappy without visible pixelation in avatar usage.
  const targetBytes = 280 * 1024;
  let quality = 0.9;
  let blob = await toBlob(quality);
  if (!blob) throw new Error("Could not generate cropped image.");

  while (blob.size > targetBytes && quality > 0.72) {
    quality -= 0.06;
    const nextBlob = await toBlob(quality);
    if (!nextBlob) break;
    blob = nextBlob;
  }

  return blob;
}

/**
 * Checks a picked photo (format, size, dimensions). On success returns an object URL
 * for the crop dialog; the caller revokes it.
 */
export async function prepareAvatarSource(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const problem = avatarFileProblem(file);
  if (problem) return { ok: false, message: problem };
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const sizeProblem = avatarDimensionsProblem(image.naturalWidth, image.naturalHeight);
    if (sizeProblem) {
      URL.revokeObjectURL(url);
      return { ok: false, message: sizeProblem };
    }
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, message: "We couldn't open that image. Please try a JPG or PNG." };
  }
  return { ok: true, url };
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AvatarCropDialog({
  sourceUrl,
  title,
  hint = "Drag to position the face in the circle.",
  onCancel,
  onConfirm,
}: {
  sourceUrl: string;
  title: string;
  hint?: string;
  onCancel: () => void;
  /** The cropped JPEG. Throwing (or rejecting) keeps the dialog open. */
  onConfirm: (file: File) => Promise<void> | void;
}) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const confirmRef = React.useRef<HTMLButtonElement | null>(null);
  const titleId = React.useId();
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<CropArea | null>(null);
  const [isCropping, setIsCropping] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    // Keep keyboard focus inside the dialog while it is open.
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  async function confirm() {
    if (!croppedAreaPixels) {
      setError("Please adjust and confirm the crop.");
      return;
    }
    setIsCropping(true);
    setError(null);
    try {
      const blob = await cropToBlob(sourceUrl, croppedAreaPixels);
      await onConfirm(new File([blob], "profile-photo.jpg", { type: "image/jpeg" }));
    } catch (err) {
      console.error(err);
      setError("Failed to process the image. Please try another photo.");
    } finally {
      setIsCropping(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/70 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
      >
        <p id={titleId} className="text-lg font-extrabold text-ink-900">
          {title}
        </p>
        <p className="mt-0.5 text-sm text-ink-600">{hint}</p>
        <div className="relative mt-4 h-72 overflow-hidden rounded-2xl bg-ink-100">
          <Cropper
            image={sourceUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, croppedPixels) => {
              setCroppedAreaPixels(croppedPixels as CropArea);
            }}
          />
        </div>
        <label className="mt-4 block text-[13px] font-semibold text-ink-800">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-2 w-full accent-clinical-500"
          />
        </label>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[48px] items-center rounded-xl border-[1.5px] border-ink-200 px-5 text-sm font-semibold text-ink-800 transition hover:border-clinical-300"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => void confirm()}
            disabled={isCropping}
            className={`${registerPrimaryButtonClass} flex-1 disabled:opacity-60`}
          >
            {isCropping ? "Processing…" : "Confirm crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
