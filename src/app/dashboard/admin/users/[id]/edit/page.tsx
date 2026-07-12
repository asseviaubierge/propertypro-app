"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Save,
  User,
  Shield,
  Mail,
  Phone,
  AlertCircle,
  Upload,
  X,
} from "lucide-react";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { UserRole, IUser } from "@/types";
import { isValidPhoneNumber } from "@/lib/utils";
import { useAvailableRoles } from "@/hooks/useRolePermissions";
import { useAuthorization } from "@/hooks/useAuthorization";

// Validation schema factory for user editing (password is optional)
const createEditUserSchema = (t: (key: string) => string) =>
  z.object({
    firstName: z
      .string()
      .min(1, t("admin.editUser.validation.firstNameRequired"))
      .max(50, t("admin.editUser.validation.firstNameTooLong"))
      .regex(
        /^[a-zA-Z\s]+$/,
        t("admin.editUser.validation.firstNameLettersOnly"),
      ),
    lastName: z
      .string()
      .min(1, t("admin.editUser.validation.lastNameRequired"))
      .max(50, t("admin.editUser.validation.lastNameTooLong"))
      .regex(
        /^[a-zA-Z\s]+$/,
        t("admin.editUser.validation.lastNameLettersOnly"),
      ),
    email: z
      .string()
      .email(t("admin.editUser.validation.invalidEmail"))
      .toLowerCase(),
    phone: z
      .string()
      .optional()
      .refine((phone) => !phone || isValidPhoneNumber(phone), {
        message: t("admin.editUser.validation.invalidPhone"),
      }),
    role: z.string().min(1, t("admin.editUser.validation.selectValidRole")),
    isActive: z.boolean(),
    avatar: z.string().optional(),
  });

type EditUserFormData = z.infer<ReturnType<typeof createEditUserSchema>>;

interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

export default function EditUserPage({ params }: EditUserPageProps) {
  const router = useRouter();
  const { canManageUsers } = useAuthorization();
  const { t } = useLocalizationContext();
  const [user, setUser] = useState<IUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [roleOptions, setRoleOptions] = useState<
    Array<{
      value: string;
      label: string;
      description?: string;
      isSystem?: boolean;
    }>
  >([]);
  const { roles: availableRoles, isLoading: rolesLoading } =
    useAvailableRoles();

  // Check permissions
  const canEditUsers = canManageUsers;

  const form = useForm<EditUserFormData>({
    resolver: zodResolver(createEditUserSchema(t)),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: UserRole.MANAGER,
      isActive: true,
      avatar: "",
    },
  });

  // Fetch user details
  const fetchUser = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/users/${id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch user details");
      }

      const data = await response.json();
      const userData = data?.data ?? null;

      if (!userData) {
        throw new Error("User data missing");
      }

      setUser(userData);
      setAvatarUrl(userData.avatar ?? "");

      // Populate form with user data
      form.reset({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone ?? "",
        role: userData.role,
        isActive: userData.isActive,
        avatar: userData.avatar ?? "",
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error(t("admin.editUser.toast.loadFailed"));
      router.push("/dashboard/admin/users");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const onSubmit = async (data: EditUserFormData) => {
    try {
      setIsSaving(true);

      // Include avatar URL if uploaded
      const userData = {
        ...data,
        avatar: avatarUrl || undefined,
      };

      // Validate role against available options
      const allowed = roleOptions.map((r) => r.value);
      if (!allowed.includes(userData.role)) {
        toast.error(t("admin.editUser.validation.selectValidRole"));
        setIsSaving(false);
        return;
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message || t("admin.editUser.toast.updateFailed"),
        );
      }

      toast.success(t("admin.editUser.toast.updateSuccess"));
      router.push(`/dashboard/admin/users/${userId}`);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.editUser.toast.updateFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Map available roles to select options
  useEffect(() => {
    if (rolesLoading) return;
    const mapped =
      availableRoles?.map((r) => {
        const isSystem = !!r.isSystem;
        const name: string = r.name;
        const label = (Object.values(UserRole) as string[]).includes(name)
          ? t(`admin.roles.defaultRoles.${name}.label`, {
              defaultValue:
                name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "),
            })
          : r.label || name;
        const description = (Object.values(UserRole) as string[]).includes(name)
          ? t(`admin.editUser.roles.${name}.description`)
          : r.description || "";
        return {
          value: name,
          label,
          description,
          isSystem,
        };
      }) ?? [];
    // Sort system first, then custom alphabetically
    mapped.sort((a, b) => {
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;
      return a.label.localeCompare(b.label);
    });
    setRoleOptions(mapped);
  }, [availableRoles, rolesLoading, t]);

  // Initialize component
  useEffect(() => {
    const initializeComponent = async () => {
      const resolvedParams = await params;
      setUserId(resolvedParams.id);
      if (canEditUsers) {
        fetchUser(resolvedParams.id);
      }
    };

    initializeComponent();
  }, [params, canEditUsers]);

  if (!canEditUsers) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">
            {t("admin.editUser.accessDenied.title")}
          </h3>
          <p className="text-muted-foreground">
            {t("admin.editUser.accessDenied.description")}
          </p>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("admin.editUser.accessDenied.goBack")}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="h-9 w-16 bg-muted rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted rounded animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>

        {/* Form Skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-96 bg-muted rounded-lg animate-pulse" />
          <div className="h-96 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">
            {t("admin.editUser.notFound.title")}
          </h3>
          <p className="text-muted-foreground">
            {t("admin.editUser.notFound.description")}
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/admin/users")}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("admin.editUser.notFound.backToUsers")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("admin.editUser.header.title", {
              values: { firstName: user.firstName, lastName: user.lastName },
            })}
          </h1>
          <p className="text-muted-foreground">
            {t("admin.editUser.header.subtitle")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("admin.editUser.header.back")}
        </Button>
      </div>

      {/* Warning for editing admin users */}
      {([UserRole.ADMIN, UserRole.MANAGER] as UserRole[]).includes(
        user.role as UserRole,
      ) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{t("admin.editUser.warning.title")}</strong>{" "}
            {t("admin.editUser.warning.description")}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t("admin.editUser.personalInfo.title")}
                </CardTitle>
                <CardDescription>
                  {t("admin.editUser.personalInfo.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Avatar Section */}
                <div className="flex items-center space-x-6 pb-4 border-b">
                  <AvatarUpload
                    currentAvatar={avatarUrl}
                    onAvatarUploaded={setAvatarUrl}
                    onAvatarRemoved={() => setAvatarUrl("")}
                    size="lg"
                    userInitials={`${user.firstName[0]}${user.lastName[0]}`}
                  />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">
                      {t("admin.editUser.personalInfo.profilePicture")}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      {t("admin.editUser.personalInfo.profilePictureDesc")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("admin.editUser.personalInfo.firstName")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t(
                              "admin.editUser.personalInfo.firstNamePlaceholder",
                            )}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("admin.editUser.personalInfo.lastName")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t(
                              "admin.editUser.personalInfo.lastNamePlaceholder",
                            )}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("admin.editUser.personalInfo.email")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder={t(
                              "admin.editUser.personalInfo.emailPlaceholder",
                            )}
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        {t("admin.editUser.personalInfo.emailDesc")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("admin.editUser.personalInfo.phone")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="tel"
                            placeholder={t(
                              "admin.editUser.personalInfo.phonePlaceholder",
                            )}
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        {t("admin.editUser.personalInfo.phoneDesc")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Account & Security */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t("admin.editUser.accountSecurity.title")}
                </CardTitle>
                <CardDescription>
                  {t("admin.editUser.accountSecurity.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("admin.editUser.accountSecurity.userRole")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                "admin.editUser.accountSecurity.selectRole",
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {role.label}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {role.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {t("admin.editUser.accountSecurity.roleDesc")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3 pt-4 border-t">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            {t("admin.editUser.accountSecurity.activeAccount")}
                          </FormLabel>
                          <FormDescription>
                            {t(
                              "admin.editUser.accountSecurity.activeAccountDesc",
                            )}
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Account Information */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-sm font-medium">
                    {t("admin.editUser.accountSecurity.accountInfo")}
                  </h4>
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("admin.editUser.accountSecurity.userId")}
                      </span>
                      <span className="font-mono">{user._id.toString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("admin.editUser.accountSecurity.created")}
                      </span>
                      <span>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("admin.editUser.accountSecurity.lastUpdated")}
                      </span>
                      <span>
                        {new Date(user.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {user.lastLogin && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("admin.editUser.accountSecurity.lastLogin")}
                        </span>
                        <span>
                          {new Date(user.lastLogin).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSaving}
            >
              {t("admin.editUser.actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {t("admin.editUser.actions.saving")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t("admin.editUser.actions.save")}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
