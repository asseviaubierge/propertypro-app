"use client";

import { z } from "zod";
import Link from "next/link";
import {
  showSimpleError,
  showSimpleSuccess,
} from "@/lib/toast-notifications";
import { useState } from "react";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormDatePicker } from "@/components/ui/date-picker";
import {
  Form,
  FormControl,
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
import {
  ArrowLeft,
  User,
  Briefcase,
  Phone,
  FileText,
  Key,
  Calendar as CalendarIcon,
  Upload,
  File,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

// Create tenant schema factory function to use translations
const createTenantSchema = (t: (key: string) => string) =>
  z
    .object({
      // User Information
      firstName: z
        .string()
        .min(1, t("tenants.form.validation.firstNameRequired")),
      lastName: z
        .string()
        .min(1, t("tenants.form.validation.lastNameRequired")),
      email: z.string().email(t("tenants.form.validation.emailInvalid")),
      phone: z.string().min(1, t("tenants.form.validation.phoneRequired")),
      avatar: z.string().optional(),

      // Password Information
      password: z
        .string()
        .min(8, t("tenants.form.validation.passwordMinLength"))
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
          t("tenants.form.validation.passwordComplexity")
        ),
      confirmPassword: z
        .string()
        .min(1, t("tenants.form.validation.confirmPasswordRequired")),

      // Tenant Status
      tenantStatus: z.enum(
        [
          "application_submitted",
          "under_review",
          "approved",
          "active",
          "inactive",
          "moved_out",
          "terminated",
        ],
        {
          errorMap: () => ({
            message: t("tenants.form.validation.tenantStatusInvalid"),
          }),
        }
      ),

      // Personal Information
      dateOfBirth: z.date({
        required_error: t("tenants.form.validation.dateOfBirthRequired"),
      }),
      ssn: z
  .string()
  .trim()
  .min(1, "Le numéro CIP est obligatoire")
  .regex(
    /^\d{5,15}$/,
    "Le numéro CIP doit contenir entre 5 et 15 chiffres"
  ),
      // Employment Information
      employer: z.string().optional(),
      position: z.string().optional(),
      income: z
        .number()
        .min(0, t("tenants.form.validation.incomePositive"))
        .optional(),
      employmentStartDate: z.string().optional(),

      // Emergency Contact (All Optional)
      emergencyContactName: z.string().optional(),
      emergencyContactRelationship: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
      emergencyContactEmail: z
        .string()
        .email(t("tenants.form.validation.emailInvalid"))
        .optional()
        .or(z.literal("")),

      // Additional Information
      creditScore: z.number().min(1).max(7).optional(),

      moveInDate: z
        .string()
        .optional()
        .transform((val) => {
          if (!val || val.trim() === "") return undefined;
          return val.trim();
        })
        .refine(
          (val) => {
            if (!val) return true; // Allow empty/undefined values

            const date = new Date(val);
            if (isNaN(date.getTime())) return false;

            // Allow move-in dates from 5 years ago to 5 years in the future
            const fiveYearsAgo = new Date();
            fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

            const fiveYearsFromNow = new Date();
            fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);

            return date >= fiveYearsAgo && date <= fiveYearsFromNow;
          },
          {
            message: t("tenants.form.validation.moveInDateRange"),
          }
        ),
      notes: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("tenants.form.validation.passwordsMismatch"),
      path: ["confirmPassword"],
    });

export default function NewTenantPage() {
  const { t } = useLocalizationContext();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});

  const tenantSchema = createTenantSchema(t);
  type TenantFormData = z.infer<typeof tenantSchema>;

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      // User Information
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      avatar: "",

      // Password Information
      password: "",
      confirmPassword: "",

      // Tenant Status
      tenantStatus: "application_submitted",

      // Personal Information
      dateOfBirth: undefined,
      ssn: "",

      // Employment Information
      employer: "",
      position: "",
      income: undefined,
      employmentStartDate: "",

      // Emergency Contact
      emergencyContactName: "",
      emergencyContactRelationship: "",
      emergencyContactPhone: "",
      emergencyContactEmail: "",

      // Additional Information
      creditScore: undefined,
      moveInDate: "",
      notes: "",
    },
  });

  const handleAvatarUploaded = (url: string) => {
    setAvatarUrl(url);
    form.setValue("avatar", url);
  };

  const handleAvatarRemoved = () => {
    setAvatarUrl("");
    form.setValue("avatar", "");
  };

  const cleanupUploadedDocuments = async (urls: string[]) => {
    if (urls.length === 0) return;
    await Promise.allSettled(
      urls.map((url) =>
        fetch(`/api/upload?url=${encodeURIComponent(url)}`, {
          method: "DELETE",
        })
      )
    );
  };

  const uploadDocuments = async (files: File[]) => {
    if (files.length === 0) return [];

    const uploadedUrls: string[] = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "document");
        formData.append("folder", "PropertyPro/tenant-documents/pending");

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(
            payload?.error ||
              payload?.message ||
              `Failed to upload ${file.name}`
          );
        }

        const url = payload?.data?.url as string | undefined;
        if (!url) {
          throw new Error(`Upload returned no URL for ${file.name}`);
        }

        uploadedUrls.push(url);
      } catch (error) {
        await cleanupUploadedDocuments(uploadedUrls);
        throw error;
      }
    }

    return uploadedUrls;
  };

  const generateFilePreview = (file: File) => {
    const fileKey = `${file.name}-${file.size}`;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreviews((prev) => ({
          ...prev,
          [fileKey]: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocumentChange = (files: FileList | null) => {
    if (!files) return;

    const incomingFiles = Array.from(files);
    const maxFiles = 20;
    const maxFileSizeBytes = 10 * 1024 * 1024;
    const allowedTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]);

    const validIncoming = incomingFiles.filter((file) => {
      if (file.size > maxFileSizeBytes) {
        showSimpleError(
          t("tenants.applicationForm.documents.toasts.fileTooLarge.title"),
          t("tenants.applicationForm.documents.toasts.fileTooLarge.description", {
            values: { name: file.name, maxSize: "10MB" },
          })
        );
        return false;
      }
      if (!allowedTypes.has(file.type)) {
        showSimpleError(
          t("tenants.applicationForm.documents.toasts.invalidFileType.title"),
          t(
            "tenants.applicationForm.documents.toasts.invalidFileType.description",
            {
              values: { name: file.name },
            }
          )
        );
        return false;
      }
      return true;
    });

    setDocumentFiles((prev) => {
      const merged = [...prev, ...validIncoming];
      if (merged.length > maxFiles) {
        showSimpleError(
          t("tenants.applicationForm.documents.toasts.fileLimit.title"),
          t("tenants.applicationForm.documents.toasts.fileLimit.description", {
            values: { maxFiles },
          })
        );
        return merged.slice(0, maxFiles);
      }

      // Generate previews for new files
      validIncoming.forEach((file) => generateFilePreview(file));

      return merged;
    });
  };

  const removeDocumentFile = (index: number) => {
    const file = documentFiles[index];
    const fileKey = `${file.name}-${file.size}`;

    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      const newPreviews = { ...prev };
      delete newPreviews[fileKey];
      return newPreviews;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleDocumentChange(e.dataTransfer.files);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return ImageIcon;
    }
    return File;
  };

  const onSubmit = async (data: TenantFormData) => {
    setIsLoading(true);
    try {
      const uploadedDocumentUrls = await uploadDocuments(documentFiles);

      // Create tenant user directly with all data
      const tenantData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phone: data.phone,
        role: "tenant",
        avatar: avatarUrl || undefined,
        tenantStatus: data.tenantStatus,
        dateOfBirth: data.dateOfBirth || undefined,
        ssn: data.ssn || undefined,
        employmentInfo: data.employer
          ? {
              employer: data.employer,
              position: data.position || "",
              income: data.income || 0,
              startDate: data.employmentStartDate || undefined,
            }
          : undefined,
        emergencyContacts:
          data.emergencyContactName?.trim()
            ? [
                {
                  name: data.emergencyContactName,
                  relationship: data.emergencyContactRelationship || "",
                  phone: data.emergencyContactPhone || "",
                  email: data.emergencyContactEmail || "",
                },
              ]
            : [],
        creditScore: data.creditScore,
        moveInDate: data.moveInDate || undefined,
        applicationNotes: data.notes || undefined,
        documents: uploadedDocumentUrls,
      };

      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tenantData),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage =
          result.error ||
          result.message ||
          t("tenants.form.toasts.createError");
        await cleanupUploadedDocuments(uploadedDocumentUrls);
        throw new Error(errorMessage);
      }

      showSimpleSuccess(
        t("tenants.form.toasts.createSuccess", {
          values: { name: `${data.firstName} ${data.lastName}` },
        })
      );
      router.push("/dashboard/tenants");
    } catch (error) {
      showSimpleError(
        "Create Failed",
        error instanceof Error
          ? error.message
          : t("tenants.form.toasts.createError")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t("tenants.form.header.title")}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t("tenants.form.header.subtitle")}
            </p>
          </div>
          <Link href="/dashboard/tenants">
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-accent/50 transition-colors border-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("tenants.form.actions.backToTenants")}
            </Button>
          </Link>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Modern Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Avatar Upload - Enhanced Card */}
              <div className="lg:col-span-4">
                <Card className="h-fit border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-card/95 backdrop-blur-sm">
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="flex items-center justify-center gap-2 text-xl">
                      <User className="h-6 w-6 text-primary" />
                      {t("tenants.form.sections.avatar.title")}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {t("tenants.form.sections.avatar.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center pb-8">
                    <AvatarUpload
                      currentAvatar={avatarUrl}
                      onAvatarUploaded={handleAvatarUploaded}
                      onAvatarRemoved={handleAvatarRemoved}
                      disabled={isLoading}
                      userInitials={
                        `${form.watch("firstName")?.[0] || ""}${
                          form.watch("lastName")?.[0] || ""
                        }`.toUpperCase() || "U"
                      }
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Personal Information - Enhanced Large Card */}
              <div className="lg:col-span-8">
                <Card className="h-fit border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-card/95 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <User className="h-6 w-6 text-primary" />
                      {t("tenants.form.sections.personalInfo.title")}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {t("tenants.form.sections.personalInfo.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel className="text-sm font-semibold text-foreground">
                              {t("tenants.form.fields.firstName.label")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  "tenants.form.fields.firstName.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
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
                          <FormItem className="space-y-3">
                            <FormLabel className="text-sm font-semibold text-foreground">
                              {t("tenants.form.fields.lastName.label")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  "tenants.form.fields.lastName.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel className="text-sm font-semibold text-foreground">
                              {t("tenants.form.fields.email.label")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder={t(
                                  "tenants.form.fields.email.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel className="text-sm font-semibold text-foreground">
                              {t("tenants.form.fields.phone.label")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  "tenants.form.fields.phone.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel className="text-sm font-semibold text-foreground">
                              {t("tenants.form.fields.dateOfBirth.label")}
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className="h-11 w-full justify-start text-left font-normal border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>
                                        {t(
                                          "tenants.form.fields.dateOfBirth.placeholder"
                                        )}
                                      </span>
                                    )}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date > new Date() ||
                                    date < new Date("1900-01-01")
                                  }
                                  initialFocus
                                  captionLayout="dropdown"
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ssn"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel className="text-sm font-semibold text-muted-foreground">
                              Numéro CIP
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex. : 021254585844"
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Account Setup - Enhanced Medium Card */}
              <div className="lg:col-span-6">
                <Card className="h-fit border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-card/95 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <Key className="h-6 w-6 text-primary" />
                      {t("tenants.form.sections.accountSetup.title")}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {t("tenants.form.sections.accountSetup.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-1 gap-6">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-foreground">
                              {t("tenants.form.fields.password.label")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={t(
                                  "tenants.form.fields.password.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-foreground">
                              {t("tenants.form.fields.confirmPassword.label")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={t(
                                  "tenants.form.fields.confirmPassword.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="tenantStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-foreground">
                              {t("tenants.form.fields.tenantStatus.label")}
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200">
                                  <SelectValue
                                    placeholder={t(
                                      "tenants.form.fields.tenantStatus.placeholder"
                                    )}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="application_submitted">
                                  {t("tenants.status.applicationSubmitted")}
                                </SelectItem>
                                <SelectItem value="under_review">
                                  {t("tenants.status.underReview")}
                                </SelectItem>
                                <SelectItem value="approved">
                                  {t("tenants.status.approved")}
                                </SelectItem>
                                <SelectItem value="active">
                                  {t("tenants.status.active")}
                                </SelectItem>
                                <SelectItem value="inactive">
                                  {t("tenants.status.inactive")}
                                </SelectItem>
                                <SelectItem value="moved_out">
                                  {t("tenants.status.movedOut")}
                                </SelectItem>
                                <SelectItem value="terminated">
                                  {t("tenants.status.terminated")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Employment Information - Enhanced Medium Card */}
              <div className="lg:col-span-6">
                <Card className="h-fit border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-card/95 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <Briefcase className="h-6 w-6 text-primary" />
                      {t("tenants.form.sections.employment.title")}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {t("tenants.form.sections.employment.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-6">
                      <FormField
                        control={form.control}
                        name="employer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-muted-foreground">
                              {t("tenants.form.fields.employer.label")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  "tenants.form.fields.employer.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-muted-foreground">
                              {t("tenants.form.fields.position.label")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  "tenants.form.fields.position.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="income"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-muted-foreground">
                                {t("tenants.form.fields.income.label")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder={t(
                                    "tenants.form.fields.income.placeholder"
                                  )}
                                  className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value
                                        ? Number(e.target.value)
                                        : undefined
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="employmentStartDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-muted-foreground">
                                {t(
                                  "tenants.form.fields.employmentStartDate.label"
                                )}
                              </FormLabel>
                              <FormControl>
                                <FormDatePicker
                                  value={
                                    field.value
                                      ? new Date(field.value)
                                      : undefined
                                  }
                                  onChange={(date) =>
                                    field.onChange(
                                      date?.toISOString().split("T")[0]
                                    )
                                  }
                                  placeholder={t(
                                    "tenants.form.fields.employmentStartDate.placeholder"
                                  )}
                                  disabled={(date) => date > new Date()}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Emergency Contact - Enhanced Medium Card */}
              <div className="lg:col-span-7">
                <Card className="h-fit border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-card/95 backdrop-blur-sm">
                  <CardHeader className="">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <Phone className="h-6 w-6 text-primary" />
                      {t("tenants.form.sections.emergencyContact.title")}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {t("tenants.form.sections.emergencyContact.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-muted-foreground">
                              {t(
                                "tenants.form.fields.emergencyContactName.label"
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  "tenants.form.fields.emergencyContactName.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergencyContactRelationship"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-muted-foreground">
                              {t(
                                "tenants.form.fields.emergencyContactRelationship.label"
                              )}
                            </FormLabel>
                            <FormControl>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <SelectTrigger className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200">
                                  <SelectValue
                                    placeholder={t(
                                      "tenants.form.fields.emergencyContactRelationship.placeholder"
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="spouse">
                                    {t(
                                      "tenants.form.fields.emergencyContactRelationship.spouse"
                                    )}
                                  </SelectItem>
                                  <SelectItem value="parent">
                                    {t(
                                      "tenants.form.fields.emergencyContactRelationship.parent"
                                    )}
                                  </SelectItem>
                                  <SelectItem value="sibling">
                                    {t(
                                      "tenants.form.fields.emergencyContactRelationship.sibling"
                                    )}
                                  </SelectItem>
                                  <SelectItem value="child">
                                    {t(
                                      "tenants.form.fields.emergencyContactRelationship.child"
                                    )}
                                  </SelectItem>
                                  <SelectItem value="friend">
                                    {t(
                                      "tenants.form.fields.emergencyContactRelationship.friend"
                                    )}
                                  </SelectItem>
                                  <SelectItem value="other">
                                    {t(
                                      "tenants.form.fields.emergencyContactRelationship.other"
                                    )}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergencyContactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-muted-foreground">
                              {t(
                                "tenants.form.fields.emergencyContactPhone.label"
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t(
                                  "tenants.form.fields.emergencyContactPhone.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="emergencyContactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-muted-foreground">
                              {t(
                                "tenants.form.fields.emergencyContactEmail.label"
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder={t(
                                  "tenants.form.fields.emergencyContactEmail.placeholder"
                                )}
                                className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Information - Enhanced Small Card */}
              <div className="lg:col-span-5">
                <Card className="h-fit border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-card/95 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <FileText className="h-6 w-6 text-primary" />
                      {t("tenants.form.sections.additionalInfo.title")}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {t("tenants.form.sections.additionalInfo.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="creditScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-muted-foreground">
                            Nombre d'occupants
                          </FormLabel>
                          <Select
                            value={field.value ? String(field.value) : ""}
                            onValueChange={(value) => field.onChange(Number(value))}
                          >
                            <FormControl>
                              <SelectTrigger className="h-11 border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200">
                                <SelectValue placeholder="Sélectionnez le nombre d'occupants" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">1 à 3 personnes</SelectItem>
                              <SelectItem value="2">4 à 5 personnes</SelectItem>
                              <SelectItem value="3">6 à 8 personnes</SelectItem>
                              <SelectItem value="4">9 à 10 personnes</SelectItem>
                              <SelectItem value="5">Plus de 10 personnes</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="moveInDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-muted-foreground">
                            {t("tenants.form.fields.moveInDate.label")}
                          </FormLabel>
                          <FormControl>
                            <FormDatePicker
                              value={
                                field.value ? new Date(field.value) : undefined
                              }
                              onChange={(date) =>
                                field.onChange(
                                  date?.toISOString().split("T")[0]
                                )
                              }
                              placeholder={t(
                                "tenants.form.fields.moveInDate.placeholder"
                              )}
                              disabled={(date) => {
                                const fiveYearsAgo = new Date();
                                fiveYearsAgo.setFullYear(
                                  fiveYearsAgo.getFullYear() - 5
                                );
                                const fiveYearsFromNow = new Date();
                                fiveYearsFromNow.setFullYear(
                                  fiveYearsFromNow.getFullYear() + 5
                                );
                                return (
                                  date < fiveYearsAgo || date > fiveYearsFromNow
                                );
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-12">
                <Card className="h-fit border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-card/95 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <FileText className="h-6 w-6 text-primary" />
                      {t("tenants.applicationForm.steps.documents")}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {t("tenants.applicationForm.documents.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Drag and Drop Zone */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative border-2 border-dashed rounded-lg transition-all duration-300 ${
                        isDragging
                          ? "border-primary bg-primary/5 scale-[1.02]"
                          : "border-border/60 hover:border-primary/50 bg-background/50"
                      }`}
                    >
                      <input
                        type="file"
                        id="document-upload"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => handleDocumentChange(e.target.files)}
                        disabled={isLoading}
                        className="hidden"
                      />
                      <label
                        htmlFor="document-upload"
                        className="flex flex-col items-center justify-center py-12 px-6 cursor-pointer"
                      >
                        <div
                          className={`rounded-full p-4 mb-4 transition-all duration-300 ${
                            isDragging
                              ? "bg-primary/20 scale-110"
                              : "bg-primary/10"
                          }`}
                        >
                          <Upload
                            className={`h-10 w-10 transition-colors duration-300 ${
                              isDragging ? "text-primary" : "text-primary/70"
                            }`}
                          />
                        </div>
                        <p className="text-lg font-semibold text-foreground mb-2">
                          {isDragging
                            ? t("tenants.applicationForm.documents.dropHere")
                            : t(
                                "tenants.applicationForm.documents.dragDropBrowse"
                              )}
                        </p>
                        <p className="text-sm text-muted-foreground text-center">
                          {t(
                            "tenants.applicationForm.documents.supportedFormats"
                          )}
                          <br />
                          {t("tenants.applicationForm.documents.limits", {
                            values: { maxSize: "10MB", maxFiles: 20 },
                          })}
                        </p>
                      </label>
                    </div>

                    {/* File Previews Grid */}
                    {documentFiles.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">
                            {t("tenants.applicationForm.documents.uploadedFiles", {
                              values: { count: documentFiles.length, maxFiles: 20 },
                            })}
                          </h3>
                          {documentFiles.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDocumentFiles([]);
                                setFilePreviews({});
                              }}
                              disabled={isLoading}
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              {t("tenants.applicationForm.documents.clearAll")}
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {documentFiles.map((file, index) => {
                            const fileKey = `${file.name}-${file.size}`;
                            const preview = filePreviews[fileKey];
                            const FileIcon = getFileIcon(file);
                            const isImage = file.type.startsWith("image/");

                            return (
                              <div
                                key={`${file.name}-${file.size}-${index}`}
                                className="group relative rounded-lg border-2 border-border/60 bg-background/50 overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-300"
                              >
                                {/* Preview Area */}
                                <div className="aspect-square bg-muted/30 flex items-center justify-center p-4">
                                  {isImage && preview ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={preview}
                                      alt={file.name}
                                      className="w-full h-full object-cover rounded"
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center">
                                      <FileIcon className="h-16 w-16 text-primary/70 mb-2" />
                                      <span className="text-xs text-muted-foreground font-medium uppercase">
                                        {file.type.includes("pdf")
                                          ? "PDF"
                                          : file.type.includes("word") ||
                                            file.type.includes("document")
                                          ? "DOC"
                                          : file.name.split(".").pop()}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* File Info */}
                                <div className="p-3 bg-background/80 backdrop-blur-sm">
                                  <div className="truncate text-sm font-medium text-foreground mb-1">
                                    {file.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </div>
                                </div>

                                {/* Delete Button */}
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => removeDocumentFile(index)}
                                  disabled={isLoading}
                                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Notes - Enhanced Full Width Card */}
              <div className="lg:col-span-12">
                <Card className="h-fit border-2 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-card/95 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <FileText className="h-6 w-6 text-primary" />
                      {t("tenants.form.sections.notes.title")}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {t("tenants.form.sections.notes.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-muted-foreground">
                            {t("tenants.form.fields.notes.label")}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t(
                                "tenants.form.fields.notes.placeholder"
                              )}
                              className="min-h-[120px] border-2 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 bg-background/50 transition-all duration-200 resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Enhanced Form Actions */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {t("tenants.form.actions.requiredFields")}
              </div>
              <div className="flex items-center gap-4">
                <Link href="/dashboard/tenants">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-2 hover:bg-accent/50 transition-all duration-200"
                  >
                    {t("tenants.form.actions.cancel")}
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-linear-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t("tenants.form.actions.creating")}
                    </>
                  ) : (
                    t("tenants.form.actions.createTenant")
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
