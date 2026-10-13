import { Star } from "lucide-react";

type Props = {
  rating: number;
  /** Text alternative, e.g. "4.3 out of 5 stars". */
  label: string;
  size?: string;
  /** Colour of the stars not reached; the hero sits on teal, the Reviews section on a card. */
  emptyClassName?: string;
};

/** Five stars, filled up to the rounded rating: the Reviews section and the hero. */
export function ProfileStars({ rating, label, size = "h-4 w-4", emptyClassName = "text-profile-border" }: Props) {
  return (
    <span role="img" aria-label={label} className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={`${size} ${n <= Math.round(rating) ? "fill-amber-500 text-amber-500" : emptyClassName}`}
        />
      ))}
    </span>
  );
}
