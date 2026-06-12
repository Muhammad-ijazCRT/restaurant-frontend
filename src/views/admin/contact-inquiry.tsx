import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, User } from "lucide-react";
import { Link, useParams } from "@/lib/wouter-compat";
import { contactKeys, type ContactSubmission } from "@/api/public/contact";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPortalTimestamp } from "@/lib/format-relative-time";

export default function AdminContactInquiry() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";

  const { data, isLoading, isError } = useQuery<ContactSubmission>({
    queryKey: contactKeys.detail(id),
    enabled: Boolean(id),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/activity-log">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to activity
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contact inquiry</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Message submitted from the public contact form.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : isError || !data ? (
        <p className="text-sm text-destructive">Could not load this contact inquiry.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="capitalize">{data.status}</Badge>
            <time className="text-xs text-muted-foreground" dateTime={String(data.createdAt)}>
              {formatPortalTimestamp(data.createdAt)}
            </time>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{data.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <a href={`mailto:${data.email}`} className="text-sm font-medium text-primary hover:underline">
                  {data.email}
                </a>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Message</p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
