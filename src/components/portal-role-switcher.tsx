import { useMemo } from "react";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  getAlternatePortalRoles,
  getUserRole,
  switchPortalRole,
} from "@/lib/portal-auth";

export function PortalRoleSwitcher() {
  const { toast } = useToast();
  const currentRole = getUserRole();
  const alternateRoles = useMemo(
    () => getAlternatePortalRoles(currentRole),
    [currentRole],
  );

  const switchMutation = useMutation({
    mutationFn: async (role: string) => switchPortalRole(role),
    onSuccess: (homePath) => {
      window.location.assign(homePath);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not switch portal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (alternateRoles.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-full px-3"
          data-testid="button-portal-role-switcher"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Switch Portal</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Go to another portal</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alternateRoles.map((entry) => (
          <DropdownMenuItem
            key={entry.role}
            disabled={switchMutation.isPending}
            onSelect={() => switchMutation.mutate(entry.role)}
            data-testid={`menu-switch-role-${entry.role}`}
          >
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
