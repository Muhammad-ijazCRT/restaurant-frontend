export const RESTAURANT_SECTION_IDS = {
  dashboard: "restaurant-dashboard",
  vendors: "restaurant-vendors",
} as const;

export type RestaurantSectionId =
  (typeof RESTAURANT_SECTION_IDS)[keyof typeof RESTAURANT_SECTION_IDS];
