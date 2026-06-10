import { apiRequest } from "@/api/client";

export const restaurantReviewKeys = {
  review: (restaurantId: string, orderId: string) =>
    ["/api/restaurant-orgs", restaurantId, "orders", orderId, "review"] as const,
  substitutions: (restaurantId: string, orderId: string) =>
    ["/api/restaurant-orgs", restaurantId, "orders", orderId, "substitutions"] as const,
} as const;

export const restaurantReviewPaths = {
  review: (restaurantId: string, orderId: string) =>
    `/api/restaurant-orgs/${restaurantId}/orders/${orderId}/review`,
  substitutions: (restaurantId: string, orderId: string) =>
    `/api/restaurant-orgs/${restaurantId}/orders/${orderId}/substitutions`,
  substitution: (restaurantId: string, orderId: string, substitutionId: string) =>
    `/api/restaurant-orgs/${restaurantId}/orders/${orderId}/substitutions/${substitutionId}`,
  resubmitReview: (restaurantId: string, orderId: string) =>
    `/api/restaurant-orgs/${restaurantId}/orders/${orderId}/resubmit-review`,
} as const;

export const restaurantReviewApi = {
  submit: (restaurantId: string, orderId: string, data: unknown) =>
    apiRequest("POST", restaurantReviewPaths.review(restaurantId, orderId), data),
  updateSubstitution: (
    restaurantId: string,
    orderId: string,
    substitutionId: string,
    data: unknown,
  ) =>
    apiRequest(
      "PATCH",
      restaurantReviewPaths.substitution(restaurantId, orderId, substitutionId),
      data,
    ),
  resubmit: (restaurantId: string, orderId: string, data: unknown) =>
    apiRequest("PATCH", restaurantReviewPaths.resubmitReview(restaurantId, orderId), data),
};
