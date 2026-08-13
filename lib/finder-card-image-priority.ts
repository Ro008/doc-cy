export type FinderCardImagePriority = {
  loading: "eager" | "lazy";
  fetchPriority?: "high";
};

/** First viewport row on a typical phone; 2-col clinic grids still cover above-the-fold. */
export const FINDER_EAGER_CARD_IMAGE_COUNT = 4;
export const FINDER_HIGH_PRIORITY_CARD_IMAGE_COUNT = 2;

/** Single-card landings (manual professional profile). */
export const FINDER_LCP_CARD_IMAGE_PRIORITY: FinderCardImagePriority = {
  loading: "eager",
  fetchPriority: "high",
};

export function finderCardImagePriority(index: number): FinderCardImagePriority {
  if (index < FINDER_HIGH_PRIORITY_CARD_IMAGE_COUNT) {
    return { loading: "eager", fetchPriority: "high" };
  }
  if (index < FINDER_EAGER_CARD_IMAGE_COUNT) {
    return { loading: "eager" };
  }
  return { loading: "lazy" };
}
