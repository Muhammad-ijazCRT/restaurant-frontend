export { apiUrl, apiRequest, getQueryFn, queryClient } from "./client";

export { authPaths } from "./shared/auth";
export { profileKeys, profilePaths } from "./shared/profile";
export { notesKeys, notesPaths } from "./shared/notes";
export { attachmentKeys, attachmentPaths } from "./shared/attachments";
export {
  relationshipKeys,
  relationshipPaths,
  relationshipApi,
} from "./shared/relationships";

export { adminDashboardKeys, adminDashboardPaths } from "./admin/dashboard";
export { adminVendorKeys, adminVendorPaths, adminVendorApi } from "./admin/vendors";
export {
  adminRestaurantKeys,
  adminRestaurantPaths,
  adminRestaurantApi,
} from "./admin/restaurants";

export { vendorKeys, vendorPaths } from "./vendor/vendors";
export { vendorProductKeys, vendorProductPaths, vendorProductApi } from "./vendor/products";
export { vendorOrderKeys, vendorOrderPaths, vendorOrderApi } from "./vendor/orders";
export {
  vendorEmployeeKeys,
  vendorEmployeePaths,
  vendorEmployeeApi,
} from "./vendor/employees";

export { restaurantOrgKeys, restaurantOrgPaths } from "./restaurant/orgs";
export {
  restaurantOrderKeys,
  restaurantOrderPaths,
  restaurantOrderApi,
} from "./restaurant/orders";
export {
  restaurantEmployeeKeys,
  restaurantEmployeePaths,
  restaurantEmployeeApi,
} from "./restaurant/employees";
export {
  restaurantReviewKeys,
  restaurantReviewPaths,
  restaurantReviewApi,
} from "./restaurant/review";
