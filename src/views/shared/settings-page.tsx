import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Bell, Shield, Palette, Globe } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-start min-h-full w-full">
      {/* Page Header - Centered */}
      <div className="w-full max-w-2xl text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
          <Settings className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Manage your account settings and preferences.
        </p>
      </div>

      {/* Settings Sections - All Centered */}
      <div className="w-full max-w-2xl space-y-4">

        {/* General Preferences */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                <Globe className="h-4 w-4 text-blue-500" />
              </div>
              General Preferences
            </CardTitle>
            <CardDescription className="text-xs">
              Language, timezone, and regional settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/30">
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
                <Bell className="h-4 w-4 text-amber-500" />
              </div>
              Notifications
            </CardTitle>
            <CardDescription className="text-xs">
              Control how and when you receive alerts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/30">
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10">
                <Palette className="h-4 w-4 text-purple-500" />
              </div>
              Appearance
            </CardTitle>
            <CardDescription className="text-xs">
              Theme, color, and display preferences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/30">
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/10">
                <Shield className="h-4 w-4 text-green-500" />
              </div>
              Security
            </CardTitle>
            <CardDescription className="text-xs">
              Password, two-factor authentication, and session management.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/30">
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
