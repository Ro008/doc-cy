"use client";

import * as React from "react";
import { Camera, Check } from "lucide-react";
import { AvatarCropDialog, prepareAvatarSource } from "@/components/auth/AvatarCropDialog";
import { REGISTER_AVATAR_ACCEPT } from "@/lib/register-avatar";
import { registerLabelClass } from "@/lib/register-ui";

type RegisterAvatarUploadProps = {
  fieldName?: string;
};

/**
 * Required profile photo: drop or browse, checked (format, size, 400×400 min)
 * before the square crop dialog opens, then posted as `fieldName` (JPEG).
 * The checks and the dialog are shared with the founders' review (AvatarCropDialog).
 */
export function RegisterAvatarUpload({ fieldName = "avatarFile" }: RegisterAvatarUploadProps) {
  const sourceInputRef = React.useRef<HTMLInputElement | null>(null);
  const formFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, sourceUrl]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const prepared = await prepareAvatarSource(file);
    if (prepared.ok === false) {
      setError(prepared.message);
      return;
    }
    setError(null);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(prepared.url);
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
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
      setSourceUrl(null);
    }
    // Keep a photo they already confirmed; only nudge when there is none yet.
    if (!isReady) setError("No photo yet — upload one to continue.");
  }

  function onCropped(croppedFile: File) {
    const dt = new DataTransfer();
    dt.items.add(croppedFile);
    if (formFileInputRef.current) {
      formFileInputRef.current.files = dt.files;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(croppedFile));
    setIsReady(true);
    setError(null);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(null);
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

      {sourceUrl ? (
        <AvatarCropDialog
          sourceUrl={sourceUrl}
          title="Crop your photo"
          hint="Drag to position your face in the circle."
          onCancel={onCancelCrop}
          onConfirm={onCropped}
        />
      ) : null}
    </div>
  );
}
