import { useState } from "react";
import { notesPaths } from "@/api/shared/notes";
import { notesKeys } from "@/api/shared/notes";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { StickyNote, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { InternalNote } from "@shared/schema";

function formatTimestamp(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InternalNotesSection({
  entityType,
  entityId,
}: {
  entityType: "vendor" | "restaurant_org" | "relationship";
  entityId: string;
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const notesKey = notesKeys.list(entityType, entityId);

  const { data: notes = [], isLoading } = useQuery<InternalNote[]>({
    queryKey: notesKey,
    staleTime: 0,
  });

  const addMutation = useMutation({
    mutationFn: async (body: string) => {
      await apiRequest("POST", notesPaths.create(entityType, entityId), { body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKey });
      setDraft("");
      toast({ title: "Note added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add note", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", notesPaths.delete(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKey });
      setDeletingId(null);
      toast({ title: "Note deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete note", description: err.message, variant: "destructive" });
    },
  });

  const trimmed = draft.trim();
  const charsLeft = 5000 - trimmed.length;
  const overLimit = charsLeft < 0;

  const deletingNote = notes.find(n => n.id === deletingId);

  return (
    <div className="border rounded-lg bg-card overflow-hidden mt-8" data-testid="section-internal-notes">
      <div
        className="px-5 py-4 border-b flex items-center gap-2 cursor-pointer select-none hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-toggle-notes-section"
      >
        {isOpen
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <StickyNote className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Internal Notes</h2>
        {!isLoading && notes.length > 0 && (
          <span className="text-xs text-muted-foreground ml-1" data-testid="text-notes-count">
            {notes.length} note{notes.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isOpen && (<>
        <div className="p-5 border-b">
          <Textarea
            placeholder="Add an internal note…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="resize-none text-sm min-h-[80px]"
            maxLength={5100}
            data-testid="textarea-new-note"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {overLimit ? `${Math.abs(charsLeft)} characters over limit` : `${charsLeft.toLocaleString()} characters remaining`}
            </span>
            <Button
              size="sm"
              onClick={() => trimmed && !overLimit && addMutation.mutate(trimmed)}
              disabled={!trimmed || overLimit || addMutation.isPending}
              data-testid="button-add-note"
            >
              {addMutation.isPending ? "Adding…" : "Add Note"}
            </Button>
          </div>
        </div>

        {isLoading ? (
        <div className="p-4 space-y-3" data-testid="notes-skeleton">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      ) : notes.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-10 px-4"
          data-testid="empty-state-notes"
        >
          <div className="rounded-full bg-muted p-3 mb-3">
            <StickyNote className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No notes yet</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Use notes to capture internal context, follow-ups, or observations about this record.
          </p>
        </div>
      ) : (
        <ul data-testid="list-notes">
          {notes.map((note) => (
            <li
              key={note.id}
              className="px-5 py-4 border-b border-border last:border-0 hover:bg-muted/20 transition-colors group"
              data-testid={`note-row-${note.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className="text-sm text-foreground whitespace-pre-wrap flex-1 leading-relaxed"
                  data-testid={`note-body-${note.id}`}
                >
                  {note.body}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                  onClick={() => setDeletingId(note.id)}
                  data-testid={`button-delete-note-${note.id}`}
                  title="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p
                className="text-xs text-muted-foreground mt-2"
                data-testid={`note-timestamp-${note.id}`}
              >
                {formatTimestamp(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      </>)}

      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-delete-note">
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this note? This cannot be undone.
          </p>
          {deletingNote && (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-sm text-muted-foreground italic line-clamp-3">
              {deletingNote.body}
            </blockquote>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingId(null)}
              data-testid="button-cancel-delete-note"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              data-testid="button-confirm-delete-note"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
