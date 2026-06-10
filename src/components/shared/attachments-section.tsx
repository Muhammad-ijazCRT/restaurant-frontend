import { useRef, useState } from "react";
import { attachmentPaths } from "@/api/shared/attachments";
import { attachmentKeys } from "@/api/shared/attachments";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Paperclip, Upload, Trash2, Download, Eye, Loader2,
  FileText, FileImage, FileSpreadsheet, FileArchive, File,
} from "lucide-react";
import type { AttachmentMeta } from "@shared/schema";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const PREVIEWABLE_MIME_PREFIXES = ["image/"];
const PREVIEWABLE_MIME_EXACT = new Set(["application/pdf", "text/plain", "text/csv"]);

function isPreviewable(fileType: string): boolean {
  return (
    PREVIEWABLE_MIME_PREFIXES.some((p) => fileType.startsWith(p)) ||
    PREVIEWABLE_MIME_EXACT.has(fileType)
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("csv")) return FileSpreadsheet;
  if (fileType.includes("zip") || fileType.includes("archive") || fileType.includes("compressed")) return FileArchive;
  if (fileType.includes("pdf") || fileType.includes("word") || fileType.includes("text")) return FileText;
  return File;
}

export function AttachmentsSection({
  entityType,
  entityId,
}: {
  entityType: "vendor" | "restaurant_org";
  entityId: string;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const attachmentsKey = attachmentKeys.list(entityType, entityId);

  const { data: attachments = [], isLoading } = useQuery<AttachmentMeta[]>({
    queryKey: attachmentsKey,
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", attachmentPaths.delete(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attachmentsKey });
      setDeletingId(null);
      toast({ title: "Attachment deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target) return;
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      toast({
        title: "File too large",
        description: "Files must be 10 MB or smaller.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        await apiRequest("POST", attachmentPaths.create(entityType, entityId), {
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          fileData: base64,
        });
        queryClient.invalidateQueries({ queryKey: attachmentsKey });
        toast({ title: "File uploaded", description: file.name });
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      toast({ title: "Failed to read file", variant: "destructive" });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleView(attachment: AttachmentMeta) {
    setViewingId(attachment.id);
    try {
      const response = await fetch(apiUrl(attachmentPaths.view(attachment.id)));
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: attachment.fileType }));

      const newTab = window.open(blobUrl, "_blank");

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

      if (!newTab) {
        toast({
          title: "Popup blocked",
          description: "Allow pop-ups for this site, then try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Preview failed",
        description: "Could not load the file for preview.",
        variant: "destructive",
      });
    } finally {
      setViewingId(null);
    }
  }

  function handleDownload(attachment: AttachmentMeta) {
    const a = document.createElement("a");
    a.href = attachmentPaths.download(attachment.id);
    a.download = attachment.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const deletingAttachment = attachments.find(a => a.id === deletingId);

  return (
    <div className="border rounded-lg bg-card overflow-hidden mt-8" data-testid="section-attachments">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Attachments</h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground ml-1" data-testid="text-attachment-count">
              {attachments.length > 0 ? `${attachments.length} file${attachments.length !== 1 ? "s" : ""}` : ""}
            </span>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            data-testid="input-attachment-file"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="button-upload-attachment"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {uploading ? "Uploading..." : "Upload File"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3" data-testid="attachment-skeleton">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ) : attachments.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-12 px-4"
          data-testid="empty-state-attachments"
        >
          <div className="rounded-full bg-muted p-3 mb-3">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No attachments yet</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Upload documents like W-9s, pricing sheets, agreements, or onboarding files.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="button-upload-attachment-empty"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />Upload First File
          </Button>
        </div>
      ) : (
        <ul data-testid="list-attachments">
          {attachments.map((attachment) => {
            const Icon = fileIcon(attachment.fileType);
            const canPreview = isPreviewable(attachment.fileType);
            const isLoadingView = viewingId === attachment.id;
            return (
              <li
                key={attachment.id}
                className="flex items-center gap-3 px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                data-testid={`attachment-row-${attachment.id}`}
              >
                <div className="rounded-md bg-muted p-2 shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium text-foreground truncate"
                    data-testid={`attachment-name-${attachment.id}`}
                  >
                    {attachment.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(attachment.fileSize)} · Uploaded {formatDate(attachment.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canPreview && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handleView(attachment)}
                      disabled={isLoadingView}
                      data-testid={`button-view-${attachment.id}`}
                      title="Open preview in new tab"
                    >
                      {isLoadingView
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Eye className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => handleDownload(attachment)}
                    data-testid={`button-download-${attachment.id}`}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletingId(attachment.id)}
                    data-testid={`button-delete-attachment-${attachment.id}`}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-delete-attachment">
          <DialogHeader>
            <DialogTitle>Delete Attachment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">{deletingAttachment?.fileName}</span>?
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)} data-testid="button-cancel-delete-attachment">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              data-testid="button-confirm-delete-attachment"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
