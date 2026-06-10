import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..", "src", "app");

const routes = [
  ["page.tsx", "@/views/landing-page", "LandingPage"],
  ["super-admin/login/page.tsx", "@/views/super-admin-login", "SuperAdminLogin"],
  ["super-admin/dashboard/page.tsx", "@/views/admin-dashboard", "AdminDashboard", "admin"],
  ["super-admin/profile/page.tsx", "@/views/profile-page", "ProfilePage", "admin"],
  ["super-admin/settings/page.tsx", "@/views/settings-page", "SettingsPage", "admin"],
  ["admin/vendors/page.tsx", "@/views/admin-vendors", "AdminVendors", "admin"],
  ["admin/vendors/onboard/page.tsx", "@/views/vendor-onboard", "VendorOnboard", "admin"],
  ["admin/vendors/[id]/page.tsx", "@/views/vendor-detail", "VendorDetail", "admin"],
  ["admin/vendors/[id]/onboard/page.tsx", "@/views/vendor-onboard", "VendorOnboard", "admin"],
  ["admin/restaurants/page.tsx", "@/views/admin-restaurants", "AdminRestaurants", "admin"],
  ["admin/restaurants/onboard/page.tsx", "@/views/restaurant-onboard", "RestaurantOnboard", "admin"],
  ["admin/restaurants/[id]/page.tsx", "@/views/restaurant-detail", "RestaurantDetail", "admin"],
  ["admin/restaurants/[id]/onboard/page.tsx", "@/views/restaurant-onboard", "RestaurantOnboard", "admin"],
  ["admin/restaurants/[id]/catalog/[vendorId]/page.tsx", "@/views/restaurant-catalog", "RestaurantCatalog", "admin"],
  ["admin/relationships/page.tsx", "@/views/admin-relationships", "AdminRelationships", "admin"],
  ["admin/relationships/[id]/page.tsx", "@/views/relationship-detail", "RelationshipDetail", "admin"],
  ["admin/orders/[orderId]/page.tsx", "@/views/admin-order-detail", "AdminOrderDetail", "admin"],
  ["admin/activity-log/page.tsx", "@/views/admin-activity-log", "AdminActivityLog", "admin"],
  ["restaurant/login/page.tsx", "@/views/restaurant-login", "RestaurantLogin"],
  ["restaurant/register/page.tsx", "@/views/restaurant-register", "RestaurantRegister"],
  ["restaurant/portal/page.tsx", "@/views/restaurant-portal", "RestaurantPortal", "restaurant"],
  ["restaurant/relationships/page.tsx", "@/views/restaurant-relationships", "RestaurantRelationships", "restaurant"],
  ["restaurant/place-order/page.tsx", "@/views/restaurant-place-order", "RestaurantPlaceOrder", "restaurant"],
  ["restaurant/orders/page.tsx", "@/views/restaurant-orders", "RestaurantOrders", "restaurant"],
  ["restaurant/employees/page.tsx", "@/views/restaurant-employees", "RestaurantEmployees", "restaurant"],
  ["restaurant/vendor/[vendorId]/page.tsx", "@/views/restaurant-vendor-detail", "RestaurantVendorDetail", "restaurant"],
  ["restaurant/vendor/[vendorId]/order/page.tsx", "@/views/restaurant-order-composer", "RestaurantOrderComposer", "restaurant"],
  ["restaurant/vendor/[vendorId]/review/[orderId]/page.tsx", "@/views/restaurant-order-review", "RestaurantOrderReview", "restaurant"],
  ["restaurant/vendor/[vendorId]/dispute/[orderId]/page.tsx", "@/views/restaurant-dispute-resolution", "RestaurantDisputeResolution", "restaurant"],
  ["restaurant/profile/page.tsx", "@/views/profile-page", "ProfilePage", "restaurant"],
  ["restaurant/settings/page.tsx", "@/views/settings-page", "SettingsPage", "restaurant"],
  ["vendor/login/page.tsx", "@/views/vendor-login", "VendorLogin"],
  ["vendor/register/page.tsx", "@/views/vendor-register", "VendorRegister"],
  ["vendor/portal/page.tsx", "@/views/vendor-portal", "VendorPortal", "vendor"],
  ["vendor/relationships/page.tsx", "@/views/vendor-relationships", "VendorRelationships", "vendor"],
  ["vendor/relationships/[relationshipId]/page.tsx", "@/views/vendor-relationship-detail", "VendorRelationshipDetail", "vendor"],
  ["vendor/orders/page.tsx", "@/views/vendor-orders", "VendorOrders", "vendor"],
  ["vendor/orders/[orderId]/page.tsx", "@/views/vendor-order-detail", "VendorOrderDetail", "vendor"],
  ["vendor/orders/[orderId]/approve/page.tsx", "@/views/vendor-order-approval", "VendorOrderApproval", "vendor"],
  ["vendor/shipping/page.tsx", "@/views/shipping-orders", "ShippingOrders", "vendor-admin"],
  ["vendor/products/page.tsx", "@/views/vendor-product-catalog", "VendorProductCatalog", "vendor"],
  ["vendor/settings/page.tsx", "@/views/vendor-settings", "VendorSettings", "vendor-settings"],
  ["vendor/employees/page.tsx", "@/views/vendor-employees", "VendorEmployees", "vendor-settings"],
  ["vendor/profile/page.tsx", "@/views/profile-page", "ProfilePage", "vendor"],
  ["shipping-company/dashboard/page.tsx", "@/views/shipping-dashboard", "ShippingDashboard", "shipping"],
  ["shipping-company/orders/page.tsx", "@/views/shipping-orders", "ShippingOrders", "shipping"],
  ["shipping-company/catalog/page.tsx", "@/views/vendor-product-catalog", "VendorProductCatalog", "shipping-catalog"],
  ["shipping-company/profile/page.tsx", "@/views/profile-page", "ProfilePage", "shipping"],
  ["shipping-company/settings/page.tsx", "@/views/settings-page", "SettingsPage", "shipping-settings"],
];

function makePage(importPath, componentName, layout) {
  const lines = ['"use client";', "", `import ${componentName} from "${importPath}";`];

  if (layout === "admin") {
    lines.push(
      'import AdminAuthGuard from "@/components/admin-auth-guard";',
      'import AdminLayout from "@/components/admin-layout";',
      "",
      "export default function Page() {",
      "  return (",
      '    <AdminAuthGuard>',
      "      <AdminLayout>",
      `        <${componentName} />`,
      "      </AdminLayout>",
      "    </AdminAuthGuard>",
      "  );",
      "}",
    );
  } else if (layout === "restaurant") {
    lines.push(
      'import PortalAuthGuard from "@/components/portal-auth-guard";',
      'import RestaurantLayout from "@/components/restaurant-layout";',
      'import { RestaurantPortalNavProvider } from "@/contexts/restaurant-portal-nav-context";',
      "",
      "const ROLES = [\"restaurant\", \"restaurant_manager\", \"restaurant_employee\"];",
      "",
      "export default function Page() {",
      "  return (",
      '    <PortalAuthGuard expectedRoles={ROLES} loginPath="/restaurant/login">',
      "      <RestaurantPortalNavProvider>",
      "        <RestaurantLayout>",
      `          <${componentName} />`,
      "        </RestaurantLayout>",
      "      </RestaurantPortalNavProvider>",
      "    </PortalAuthGuard>",
      "  );",
      "}",
    );
  } else if (layout === "vendor") {
    lines.push(
      'import PortalAuthGuard from "@/components/portal-auth-guard";',
      'import VendorLayout from "@/components/vendor-layout";',
      'import { VendorPortalNavProvider } from "@/contexts/vendor-portal-nav-context";',
      "",
      "const ROLES = [\"vendor_admin\", \"manager\", \"sales_representative\", \"warehouse_worker\"];",
      "",
      "export default function Page() {",
      "  return (",
      '    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">',
      "      <VendorPortalNavProvider>",
      "        <VendorLayout>",
      `          <${componentName} />`,
      "        </VendorLayout>",
      "      </VendorPortalNavProvider>",
      "    </PortalAuthGuard>",
      "  );",
      "}",
    );
  } else if (layout === "vendor-admin") {
    lines.push(
      'import PortalAuthGuard from "@/components/portal-auth-guard";',
      'import VendorLayout from "@/components/vendor-layout";',
      'import { VendorPortalNavProvider } from "@/contexts/vendor-portal-nav-context";',
      "",
      "const ROLES = [\"vendor_admin\"];",
      "",
      "export default function Page() {",
      "  return (",
      '    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">',
      "      <VendorPortalNavProvider>",
      "        <VendorLayout>",
      `          <${componentName} />`,
      "        </VendorLayout>",
      "      </VendorPortalNavProvider>",
      "    </PortalAuthGuard>",
      "  );",
      "}",
    );
  } else if (layout === "vendor-settings") {
    lines.push(
      'import PortalAuthGuard from "@/components/portal-auth-guard";',
      'import VendorLayout from "@/components/vendor-layout";',
      'import { VendorPortalNavProvider } from "@/contexts/vendor-portal-nav-context";',
      "",
      "const ROLES = [\"vendor_admin\", \"manager\"];",
      "",
      "export default function Page() {",
      "  return (",
      '    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">',
      "      <VendorPortalNavProvider>",
      "        <VendorLayout>",
      `          <${componentName} />`,
      "        </VendorLayout>",
      "      </VendorPortalNavProvider>",
      "    </PortalAuthGuard>",
      "  );",
      "}",
    );
  } else if (layout === "shipping") {
    lines.push(
      'import PortalAuthGuard from "@/components/portal-auth-guard";',
      'import ShippingLayout from "@/components/shipping-layout";',
      "",
      "const ROLES = [\"vendor_admin\", \"manager\", \"driver\"];",
      "",
      "export default function Page() {",
      "  return (",
      '    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">',
      "      <ShippingLayout>",
      `        <${componentName} />`,
      "      </ShippingLayout>",
      "    </PortalAuthGuard>",
      "  );",
      "}",
    );
  } else if (layout === "shipping-catalog" || layout === "shipping-settings") {
    lines.push(
      'import PortalAuthGuard from "@/components/portal-auth-guard";',
      'import ShippingLayout from "@/components/shipping-layout";',
      "",
      "const ROLES = [\"vendor_admin\", \"manager\"];",
      "",
      "export default function Page() {",
      "  return (",
      '    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">',
      "      <ShippingLayout>",
      `        <${componentName} />`,
      "      </ShippingLayout>",
      "    </PortalAuthGuard>",
      "  );",
      "}",
    );
  } else {
    lines.push("", "export default function Page() {", `  return <${componentName} />;`, "}");
  }

  return lines.join("\n") + "\n";
}

for (const [routePath, importPath, componentName, layout] of routes) {
  const fullPath = path.join(appDir, routePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, makePage(importPath, componentName, layout));
}

// Redirect pages
const redirects = [
  ["admin/dashboard/page.tsx", "/super-admin/dashboard"],
  ["restaurant/page.tsx", "/restaurant/login"],
  ["vendor/page.tsx", "/vendor/login"],
  ["vendor/dashboard/page.tsx", "/vendor/portal"],
  ["restaurant/dashboard/page.tsx", "/restaurant/portal"],
  ["shipping-company/page.tsx", "/shipping-company/dashboard"],
  ["shipping-company/login/page.tsx", "/vendor/login"],
];

for (const [routePath, target] of redirects) {
  const fullPath = path.join(appDir, routePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const content = `"use client";\n\nimport { Redirect } from "@/lib/wouter-compat";\n\nexport default function Page() {\n  return <Redirect to="${target}" />;\n}\n`;
  fs.writeFileSync(fullPath, content);
}

console.log(`Generated ${routes.length + redirects.length} pages.`);
