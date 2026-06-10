import { useMemo } from "react";
import { Link, useLocation } from "@/lib/wouter-compat";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AuthUser } from "@/lib/portal-auth";
import { apiUrl } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

function resolveProfileImageUrl(image?: string | null): string | null {
  if (!image) return null;
  if (image.startsWith("data:") || image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  return apiUrl(image.startsWith("/") ? image : `/${image}`);
}

type ProfileMenuProps = {
  user?: AuthUser | null;
  roleLabel?: string;
  onLogout: () => void;
  settingsHref?: string;
  profileHref?: string;
  className?: string;
};

function getDisplayName(name?: string | null) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "Portal User";
  return trimmed.split(/\s+/).slice(0, 2).join(" ");
}

function getInitials(name?: string | null) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "U";
  return parts.map((part) => part[0]).join("").toUpperCase();
}

export function ProfileMenu({
  user,
  roleLabel,
  onLogout,
  settingsHref,
  profileHref = "/",
  className,
}: ProfileMenuProps) {
  const [, navigate] = useLocation();

  const { data: profile } = useQuery<{ name?: string; image?: string; email?: string } | null>({
    queryKey: ["/api/profile"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const currentUser = profile || user;

  const displayName = useMemo(() => getDisplayName(currentUser?.name), [currentUser?.name]);
  const initials = useMemo(() => getInitials(currentUser?.name), [currentUser?.name]);
  const avatarUrl = resolveProfileImageUrl(currentUser?.image as string | null | undefined);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`flex h-11 items-center gap-3 rounded-full border border-border/60 bg-background px-3 hover:bg-muted ${className ?? ""}`}
          data-testid="button-profile-menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 text-left sm:block">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{roleLabel ?? "Profile"}</p>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => navigate(profileHref)}>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        {settingsHref ? (
          <DropdownMenuItem onSelect={() => navigate(settingsHref)}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
