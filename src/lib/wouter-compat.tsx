"use client";

import NextLink from "next/link";
import { useParams as useNextParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

export function useLocation(): [string, (to: string, options?: { replace?: boolean }) => void] {
  const pathname = usePathname();
  const router = useRouter();

  const navigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      if (options?.replace) {
        router.replace(to);
      } else {
        router.push(to);
      }
    },
    [router],
  );

  return [pathname, navigate];
}

export function useSearch(): string {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string>>(): T {
  const params = useNextParams();
  const normalized: Record<string, string | undefined> = {};

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      normalized[key] = Array.isArray(value) ? value[0] : value;
    }
  }

  return normalized as T;
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

export function Link({ href, children, className, ...props }: LinkProps) {
  return (
    <NextLink href={href} className={className} {...props}>
      {children}
    </NextLink>
  );
}

export function Redirect({ to }: { to: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(to);
  }, [router, to]);

  return null;
}
