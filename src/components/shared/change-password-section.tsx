"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { profilePaths } from "@/api/shared/profile";
import { getSessionPassword, storeSessionPassword } from "@/lib/portal-auth";

type ChangePasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  defaultVisible = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  defaultVisible?: boolean;
}) {
  const [visible, setVisible] = useState(defaultVisible);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className="pr-11"
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordSection() {
  const { toast } = useToast();
  const [form, setForm] = useState<ChangePasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const storedPassword = getSessionPassword();
    if (storedPassword) {
      setForm((prev) => ({ ...prev, currentPassword: storedPassword }));
    }
  }, []);

  const mutation = useMutation({
    mutationFn: async (data: ChangePasswordForm) => {
      const res = await apiRequest("PUT", profilePaths.changePassword, data);
      return res.json() as Promise<{ message?: string }>;
    },
    onSuccess: (data, variables) => {
      storeSessionPassword(variables.newPassword);
      setForm({
        currentPassword: variables.newPassword,
        newPassword: "",
        confirmPassword: "",
      });
      toast({
        title: "Password Updated",
        description: data.message || "Your password has been changed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Could not update your password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (form.newPassword.length < 8) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New password and confirm password do not match.",
        variant: "destructive",
      });
      return;
    }

    mutation.mutate(form);
  };

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/10">
            <KeyRound className="h-4 w-4 text-green-600" />
          </div>
          Change Password
        </CardTitle>
        <CardDescription className="text-xs">
          Your current password is shown below. Enter a new password to update your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            id="current-password"
            label="Current Password"
            value={form.currentPassword}
            onChange={(currentPassword) => setForm((prev) => ({ ...prev, currentPassword }))}
            placeholder="Your current password"
            autoComplete="current-password"
            defaultVisible
          />
          <PasswordField
            id="new-password"
            label="New Password"
            value={form.newPassword}
            onChange={(newPassword) => setForm((prev) => ({ ...prev, newPassword }))}
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
          />
          <PasswordField
            id="confirm-password"
            label="Confirm Password"
            value={form.confirmPassword}
            onChange={(confirmPassword) => setForm((prev) => ({ ...prev, confirmPassword }))}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
          />
          <Button type="submit" className="w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
