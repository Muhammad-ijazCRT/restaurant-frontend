import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@/lib/wouter-compat";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import type { RestaurantEmployee, RestaurantOrg } from "@shared/schema";
import RestaurantEmployeePermissionsDialog from "@/components/restaurant/employee-permissions-dialog";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  normalizeEmployeeRoles,
  ROLE_OPTIONS,
  roleLabel,
  type RestaurantEmployeeRole,
} from "@/lib/restaurant-employee-permissions";
import { canManageRestaurantEmployees } from "@/lib/restaurant-portal-labels";
import { getUserRole } from "@/lib/portal-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const employeeFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  phone: z.string().optional(),
  password: z.string().optional(),
  roles: z
    .array(z.enum(["manager", "employee"]))
    .min(1, "Select at least one role"),
}).superRefine((data, ctx) => {
  if (data.password && data.password.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: "Password must be at least 8 characters",
    });
  }
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

function EmployeeDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  restaurantName?: string;
  employee: RestaurantEmployee | null;
}) {
  const { toast } = useToast();
  const isEditing = !!employee;
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: employee?.name ?? "",
      email: employee?.email ?? "",
      phone: employee?.phone ?? "",
      password: "",
      roles: normalizeEmployeeRoles(employee?.roles),
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: EmployeeFormValues) => {
      const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        roles: data.roles,
        ...(data.password ? { loginPassword: data.password } : {}),
      };
      if (isEditing) {
        await apiRequest(
          "PATCH",
          `/api/restaurant-orgs/${restaurantId}/employees/${employee.id}`,
          payload,
        );
        return;
      }
      await apiRequest("POST", `/api/restaurant-orgs/${restaurantId}/employees`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs", restaurantId, "employees"] });
      toast({ title: isEditing ? "Employee updated" : "Employee added" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Employee save failed", description: err.message, variant: "destructive" });
    },
  });

  function toggleRole(value: RestaurantEmployeeRole) {
    const current = form.getValues("roles");
    form.setValue(
      "roles",
      current.includes(value) ? current.filter((role) => role !== value) : [...current, value],
      { shouldValidate: true, shouldDirty: true },
    );
  }

  function handleSubmit(data: EmployeeFormValues) {
    if (!isEditing && !data.password) {
      form.setError("password", { message: "Password is required" });
      return;
    }
    mutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-restaurant-employee-form">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this team member."
              : `Add a team member to ${restaurantName ?? "this restaurant"}.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Jane Smith" data-testid="input-restaurant-employee-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="jane@example.com" data-testid="input-restaurant-employee-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="(555) 555-5555" data-testid="input-restaurant-employee-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isEditing ? "New Password" : "Password"}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        className="pr-11"
                        placeholder={
                          isEditing ? "Leave blank to keep current password" : "Minimum 8 characters"
                        }
                        data-testid="input-restaurant-employee-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Roles</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map((role) => {
                      const selected = field.value.includes(role.value);
                      return (
                        <Button
                          key={role.value}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleRole(role.value)}
                          data-testid={`button-restaurant-role-${role.value}`}
                        >
                          {role.label}
                        </Button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-restaurant-employee">
                {mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Employee"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function RestaurantEmployees() {
  const { restaurantId } = useRestaurantAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const canManageEmployees = canManageRestaurantEmployees(getUserRole());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<RestaurantEmployee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<RestaurantEmployee | null>(null);
  const [permissionsEmployee, setPermissionsEmployee] = useState<RestaurantEmployee | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!restaurantId) navigate("/restaurant/login");
  }, [restaurantId, navigate]);

  const { data: restaurant } = useQuery<RestaurantOrg>({
    queryKey: ["/api/restaurant-orgs", restaurantId],
    enabled: !!restaurantId,
  });
  const { data: employees = [], isLoading } = useQuery<RestaurantEmployee[]>({
    queryKey: ["/api/restaurant-orgs", restaurantId, "employees"],
    enabled: !!restaurantId,
  });

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;

    return employees.filter((employee) => {
      const roles = normalizeEmployeeRoles(employee.roles).map((role) => roleLabel(role).toLowerCase());
      return (
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        (employee.phone ?? "").toLowerCase().includes(query) ||
        roles.some((role) => role.includes(query))
      );
    });
  }, [employees, search]);

  const deleteMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      await apiRequest("DELETE", `/api/restaurant-orgs/${restaurantId}/employees/${employeeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs", restaurantId, "employees"] });
      setDeletingEmployee(null);
      toast({ title: "Employee deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  if (!restaurantId) return null;

  function openAddDialog() {
    setEditingEmployee(null);
    setDialogOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8" data-testid="page-restaurant-employees">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Team members for {restaurant?.name ?? "this restaurant"}
          </p>
        </div>
        {canManageEmployees ? (
          <Button onClick={openAddDialog} data-testid="button-add-restaurant-employee-header">
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : employees.length === 0 ? (
          <div
            className="flex min-h-[230px] flex-col items-center justify-center px-4 py-12 text-center"
            data-testid="empty-state-restaurant-employees"
          >
            <Users className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No employees added yet</p>
            {canManageEmployees ? (
              <Button variant="outline" className="mt-5" onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" /> Add Employee
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">Team Members</h2>
                <Badge variant="secondary">{employees.length}</Badge>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search employees..."
                  className="pl-9"
                  data-testid="input-search-restaurant-employees"
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Roles</TableHead>
                  {canManageEmployees ? <TableHead>Permissions</TableHead> : null}
                  {canManageEmployees ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManageEmployees ? 6 : 4}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      No employees match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee) => {
                    const employeeRoles = normalizeEmployeeRoles(employee.roles);

                    return (
                      <TableRow key={employee.id} data-testid={`row-restaurant-employee-${employee.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="rounded-md bg-blue-50 p-1.5 text-blue-600">
                              <UserCircle className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{employee.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                        <TableCell className="text-muted-foreground">{employee.phone || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {employeeRoles.map((role) => (
                              <Badge key={role} variant="outline">
                                {roleLabel(role)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        {canManageEmployees ? (
                          <TableCell>
                            <Button
                              variant="link"
                              className="h-auto p-0 text-violet-700"
                              onClick={() => setPermissionsEmployee(employee)}
                              data-testid={`button-restaurant-permissions-${employee.id}`}
                            >
                              <Shield className="mr-1.5 h-4 w-4" />
                              Permissions
                            </Button>
                          </TableCell>
                        ) : null}
                        {canManageEmployees ? (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingEmployee(employee);
                                  setDialogOpen(true);
                                }}
                                data-testid={`button-edit-restaurant-employee-${employee.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => setDeletingEmployee(employee)}
                                data-testid={`button-delete-restaurant-employee-${employee.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </>
        )}
      </div>

      {canManageEmployees ? (
        <>
          <EmployeeDialog
            key={editingEmployee?.id ?? "new"}
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditingEmployee(null);
            }}
            restaurantId={restaurantId}
            restaurantName={restaurant?.name}
            employee={editingEmployee}
          />

          <RestaurantEmployeePermissionsDialog
            open={!!permissionsEmployee}
            onOpenChange={(open) => {
              if (!open) setPermissionsEmployee(null);
            }}
            restaurantId={restaurantId}
            employee={permissionsEmployee}
          />

          <Dialog open={!!deletingEmployee} onOpenChange={(open) => !open && setDeletingEmployee(null)}>
            <DialogContent data-testid="dialog-delete-restaurant-employee">
              <DialogHeader>
                <DialogTitle>Delete Employee</DialogTitle>
                <DialogDescription>
                  Delete <strong>{deletingEmployee?.name}</strong> from this restaurant team?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeletingEmployee(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deletingEmployee && deleteMutation.mutate(deletingEmployee.id)}
                  data-testid="button-confirm-delete-restaurant-employee"
                >
                  <X className="mr-2 h-4 w-4" /> {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
