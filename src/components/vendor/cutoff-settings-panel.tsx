import { useEffect } from "react";
import { vendorEmployeeApi } from "@/api/vendor/employees";
import { vendorEmployeeKeys } from "@/api/vendor/employees";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { VendorCutoffSettings } from "@shared/schema";
import { insertVendorCutoffSettingsSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type FormValues = z.infer<typeof insertVendorCutoffSettingsSchema>;

function timeToLabel(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function CutoffSettingsPanel({ vendorId, title = "Cutoff Settings", description = "Set the daily order cutoff used for lock and reminder timing." }: { vendorId: string; title?: string; description?: string }) {
  const { toast } = useToast();
  const { data } = useQuery<VendorCutoffSettings | null>({
    queryKey: vendorEmployeeKeys.cutoffSettings(vendorId),
    enabled: !!vendorId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(insertVendorCutoffSettingsSchema),
    defaultValues: {
      vendorId,
      cutoffHour: 17,
      cutoffMinute: 0,
      isEnabled: true,
      reminderMessage: "",
    },
  });

  useEffect(() => {
    if (!data) return;
    form.reset({
      vendorId,
      cutoffHour: data.cutoffHour,
      cutoffMinute: data.cutoffMinute,
      isEnabled: Boolean(data.isEnabled),
      reminderMessage: data.reminderMessage ?? "",
    });
  }, [data, form, vendorId]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await vendorEmployeeApi.updateCutoffSettings(vendorId, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorEmployeeKeys.cutoffSettings(vendorId) });
      toast({ title: "Cutoff settings saved" });
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Card className="border-border/60">
      <CardContent className="p-5 space-y-5">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="cutoffHour" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hour</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cutoffMinute" render={({ field }) => (
                <FormItem>
                  <FormLabel>Minute</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="isEnabled" render={({ field }) => (
                <FormItem className="flex items-end justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel>Enabled</FormLabel>
                    <p className="text-xs text-muted-foreground">Turn cutoff enforcement on or off.</p>
                  </div>
                  <FormControl>
                    <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="reminderMessage" render={({ field }) => (
              <FormItem>
                <FormLabel>Reminder Message</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Orders lock at 5:00 PM today." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Current cutoff preview</span>
              <span className="font-medium">
                {timeToLabel(Number(form.watch("cutoffHour") ?? 17), Number(form.watch("cutoffMinute") ?? 0))}
              </span>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save Cutoff"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
