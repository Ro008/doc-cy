"use client";

import * as React from "react";
import Cropper from "react-easy-crop";
import { Camera, Check } from "lucide-react";
import {
  REGISTER_AVATAR_ACCEPT,
  avatarDimensionsProblem,
  avatarFileProblem,
} from "@/lib/register-avatar";
import { registerLabelClass, registerPrimaryButtonClass } from "@/lib/register-ui";

type CropArea = { x: number; y: number; width: number; height: number };

type RegisterAvatarUploadProps = {
  fieldName?: string;
};

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

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

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

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Required profile photo: drop or browse, checked (format, size, 400×400 min)
 * before the square crop dialog opens, then posted as `fieldName` (JPEG).
 */
export function RegisterAvatarUpload({ fieldName = "avatarFile" }: RegisterAvatarUploadProps) {
  const sourceInputRef = React.useRef<HTMLInputElement | null>(null);
  const formFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const confirmRef = React.useRef<HTMLButtonElement | null>(null);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<CropArea | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isCropping, setIsCropping] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, sourceUrl]);

  React.useEffect(() => {
    if (isModalOpen) confirmRef.current?.focus();
  }, [isModalOpen]);

  function clearFormFile() {
    if (formFileInputRef.current) {
      formFileInputRef.current.value = "";
    }
    setIsReady(false);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const problem = avatarFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }

    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      const sizeProblem = avatarDimensionsProblem(image.naturalWidth, image.naturalHeight);
      if (sizeProblem) {
        URL.revokeObjectURL(url);
        setError(sizeProblem);
        return;
      }
    } catch {
      URL.revokeObjectURL(url);
      setError("We couldn't open that image. Please try a JPG or PNG.");
      return;
    }

    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(url);
    setIsModalOpen(true);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires `change`.
    e.target.value = "";
    void handleFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    void handleFile(e.dataTransfer.files?.[0]);
  }

  function onCancelCrop() {
    setIsModalOpen(false);
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
      setSourceUrl(null);
    }
    // Keep a photo they already confirmed; only nudge when there is none yet.
    if (!isReady) setError("No photo yet — upload one to continue.");
  }

  function onDialogKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancelCrop();
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

  async function onConfirmCrop() {
    if (!sourceUrl || !croppedAreaPixels) {
      setError("Please adjust and confirm your crop.");
      return;
    }

    setIsCropping(true);
    try {
      const blob = await cropToBlob(sourceUrl, croppedAreaPixels);
      const croppedFile = new File([blob], "profile-photo.jpg", {
        type: "image/jpeg",
      });

      const dt = new DataTransfer();
      dt.items.add(croppedFile);
      if (formFileInputRef.current) {
        formFileInputRef.current.files = dt.files;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(croppedFile));
      setIsReady(true);
      setError(null);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      setError("Failed to process image. Please try another photo.");
      clearFormFile();
    } finally {
      setIsCropping(false);
    }
  }

  return (
    <div
      className="group"
      data-validate-field="1"
      data-invalid="0"
      data-field-key="photo"
      data-field-label="Profile photo"
    >
      <p className={registerLabelClass}>
        Profile photo<span className="text-red-600">*</span>
      </p>
      <div
        data-testid="register-avatar-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={`mt-1 flex items-center gap-4 rounded-2xl border-[1.5px] border-dashed px-4 py-3 transition group-data-[invalid=1]:border-red-300 ${
          isDragOver ? "border-clinical-500 bg-clinical-100" : "border-ink-200 bg-ink-50"
        }`}
      >
        {previewUrl ? (
          // Local blob: preview of the crop; next/image cannot optimise object URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Your profile photo"
            className="h-16 w-16 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
          />
        ) : (
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-clinical-800 shadow-sm">
            <Camera className="h-6 w-6" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {isReady ? (
            <p
              data-testid="register-avatar-ready"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-wellness-700"
            >
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
              Photo ready
            </p>
          ) : (
            <p className="text-sm text-ink-700">
              <span className="hidden sm:inline">Drag a photo here or </span>
              <span className="sm:hidden">Add a clear, close-up photo.</span>
            </p>
          )}
          <label className="mt-1 inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border-[1.5px] border-clinical-500 bg-white px-3 text-sm font-bold text-clinical-800 transition hover:bg-clinical-50 focus-within:ring-4 focus-within:ring-clinical-500/25">
            {isReady ? "Change photo" : "Browse files"}
            <input
              ref={sourceInputRef}
              type="file"
              accept={REGISTER_AVATAR_ACCEPT}
              className="sr-only"
              data-testid="register-avatar-file-input"
              data-focus-target="true"
              onChange={onPickFile}
            />
          </label>
          <p className="mt-1 text-xs text-ink-500">
            JPG, PNG or WebP · at least 400×400 px · max 10 MB
          </p>
        </div>
      </div>

      <input
        ref={formFileInputRef}
        type="file"
        name={fieldName}
        className="sr-only"
        accept="image/jpeg"
        tabIndex={-1}
        aria-hidden
      />
      <input
        type="text"
        data-validity-proxy="true"
        required
        value={isReady ? "ready" : ""}
        // A readonly input is barred from constraint validation, which would make
        // this required field silently always valid. The no-op keeps React quiet.
        onChange={() => {}}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      {error ? (
        <p data-testid="register-avatar-error" role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : (
        <p className="field-hint mt-1.5 hidden text-xs text-red-600 group-data-[invalid=1]:block">
          Please upload and confirm your profile photo.
        </p>
      )}

      {isModalOpen && sourceUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/70 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-crop-title"
            onKeyDown={onDialogKeyDown}
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
          >
            <p id="register-crop-title" className="text-lg font-extrabold text-ink-900">
              Crop your photo
            </p>
            <p className="mt-0.5 text-sm text-ink-600">
              Drag to position your face in the circle.
            </p>
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
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={onCancelCrop}
                className="inline-flex min-h-[48px] items-center rounded-xl border-[1.5px] border-ink-200 px-5 text-sm font-semibold text-ink-800 transition hover:border-clinical-300"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={onConfirmCrop}
                disabled={isCropping}
                className={`${registerPrimaryButtonClass} flex-1 disabled:opacity-60`}
              >
                {isCropping ? "Processing…" : "Confirm crop"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
