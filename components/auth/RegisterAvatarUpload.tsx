"use client";

import * as React from "react";
import Cropper from "react-easy-crop";

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

export function RegisterAvatarUpload({
  fieldName = "avatarFile",
}: RegisterAvatarUploadProps) {
  const sourceInputRef = React.useRef<HTMLInputElement | null>(null);
  const formFileInputRef = React.useRef<HTMLInputElement | null>(null);
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

  React.useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, sourceUrl]);

  function clearFormFile() {
    if (formFileInputRef.current) {
      formFileInputRef.current.value = "";
    }
    setIsReady(false);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      e.target.value = "";
      clearFormFile();
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image is too large. Please use a file under 10 MB.");
      e.target.value = "";
      clearFormFile();
      return;
    }

    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsReady(false);

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setIsModalOpen(true);
  }

  function onCancelCrop() {
    setIsModalOpen(false);
    setError("Profile photo is required. Please upload and confirm your crop.");
    if (sourceInputRef.current) sourceInputRef.current.value = "";
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
      setSourceUrl(null);
    }
    clearFormFile();
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
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
        Professional profile photo <span className="text-red-300">*</span>
      </p>
      <p className="mt-2 text-xs text-slate-300">
        Professional photo required (Close-up, neutral background).
      </p>

      <div className="mt-3 flex items-center gap-4">
        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20">
          Upload photo
          <input
            ref={sourceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={onPickFile}
          />
        </label>
        <div className="text-xs text-slate-400">
          {isReady ? "Crop confirmed." : "Upload and confirm crop to continue."}
        </div>
      </div>

      <input
        ref={formFileInputRef}
        type="file"
        name={fieldName}
        className="sr-only"
        accept="image/jpeg"
        tabIndex={-1}
      />
      <input
        type="text"
        required
        readOnly
        value={isReady ? "ready" : ""}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

      {previewUrl ? (
        <div className="mt-4 flex items-center gap-3">
          <img
            src={previewUrl}
            alt="Profile preview"
            className="h-20 w-20 rounded-full border border-slate-600 object-cover"
          />
          <span className="text-xs text-slate-300">Ready for submission</span>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          {error}
        </p>
      ) : null}

      {isModalOpen && sourceUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <p className="mb-2 text-sm font-semibold text-slate-100">
              Crop profile photo (1:1)
            </p>
            <div className="relative h-72 overflow-hidden rounded-xl bg-slate-950">
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
            <div className="mt-3">
              <label className="text-xs text-slate-300">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancelCrop}
                className="rounded-xl border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmCrop}
                disabled={isCropping}
                className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60"
              >
                {isCropping ? "Processing..." : "Confirm crop"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

