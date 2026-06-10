import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, files);
    else if (e.name === "page.tsx") files.push(f);
  }
  return files;
}

for (const file of walk(path.join(root, "src", "app", "restaurant"))) {
  let c = fs.readFileSync(file, "utf8");
  c = c.replace(
    /import RestaurantLayout from "@\/components\/restaurant\/layout";\nconst ROLES/,
    'import RestaurantLayout from "@/components/restaurant/layout";\n\nconst ROLES',
  );
  c = c.replace(
    /<PortalAuthGuard expectedRoles=\{ROLES\} loginPath="\/restaurant\/login">\n\s+<RestaurantLayout>/,
    '<PortalAuthGuard expectedRoles={ROLES} loginPath="/restaurant/login">\n      <RestaurantLayout>',
  );
  c = c.replace(/<\/RestaurantLayout>\s*<\/PortalAuthGuard>/, "</RestaurantLayout>\n    </PortalAuthGuard>");
  fs.writeFileSync(file, c);
}
