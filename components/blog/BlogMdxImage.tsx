import Image from "next/image";

type BlogMdxImageProps = {
  src?: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
};

function toNumber(value: number | string | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}

function blurPlaceholder(width: number, height: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f172a" offset="0%"/><stop stop-color="#111827" offset="50%"/><stop stop-color="#0b1220" offset="100%"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export function BlogMdxImage({ src, alt, width, height }: BlogMdxImageProps) {
  const imageSrc = String(src ?? "").trim();
  if (!imageSrc) return null;
  const safeWidth = toNumber(width, 1600);
  const safeHeight = toNumber(height, 900);

  return (
    <span className="my-5 block max-w-xl overflow-hidden rounded-xl border border-slate-700/70 shadow-[0_0_14px_-12px_rgba(52,211,153,0.65)]">
      <Image
        src={imageSrc}
        alt={String(alt ?? "Blog image")}
        width={safeWidth}
        height={safeHeight}
        className="h-44 w-full rounded-xl object-cover sm:h-56"
        placeholder="blur"
        blurDataURL={blurPlaceholder(safeWidth, safeHeight)}
        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 70vw, 560px"
      />
    </span>
  );
}
