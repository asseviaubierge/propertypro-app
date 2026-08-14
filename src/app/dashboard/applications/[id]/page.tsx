"use client";

import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  FileText,
  Mail,
  MapPin,
  Phone,
  User,
  X,
  Building2,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface ApplicationDetails {
  _id: string;
  status: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  personalInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
  };
  employmentInfo?: {
    employer?: string;
    position?: string;
    income?: number;
    startDate?: string;
    employerContact?: string;
  };
  emergencyContacts?: Array<{
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  }>;
  previousAddresses?: Array<{
    address?: string;
    landlordName?: string;
    landlordContact?: string;
    moveInDate?: string;
    moveOutDate?: string;
    reasonForLeaving?: string;
  }>;
  documents?: Array<{
    type?: string;
    fileName?: string;
    fileUrl?: string;
    uploadedAt?: string;
    verified?: boolean;
  }>;
  additionalInfo?: {
    pets?: string;
    vehicles?: string;
    reasonForMoving?: string;
    additionalNotes?: string;
  };
  applicationFee?: {
    amount?: number;
    status?: string;
    paymentMethod?: string;
    paidAt?: string;
  };
  propertyId?: {
    _id?: string;
    name?: string;
    type?: string;
    rentAmount?: number;
    securityDeposit?: number;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  applicantId?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  reviewedBy?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  createdAt?: string;
}

function getStatusBadgeClass(status?: string) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "approved") {
    return "bg-green-100 text-green-800 border-green-200";
  }
  if (normalized === "rejected" || normalized === "withdrawn") {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (normalized === "under_review") {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (normalized === "draft") {
    return "bg-gray-100 text-gray-800 border-gray-200";
  }
  return "bg-yellow-100 text-yellow-800 border-yellow-200";
}

function formatStatusLabel(status?: string) {
  if (!status) return "Inconnu";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type PropertyAddress = NonNullable<
  NonNullable<ApplicationDetails["propertyId"]>["address"]
>;

function formatAddress(address?: PropertyAddress) {
  if (!address) return "Not available";
  const parts = [
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Not available";
}

export default function ApplicationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { formatCurrency, formatDate } = useLocalizationContext();
  const applicationId = params.id as string;

  const [application, setApplication] = useState<ApplicationDetails | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<
    "approve" | "reject" | null
  >(null);

  const isStaff = useMemo(() => {
    const role = String(session?.user?.role || "").toLowerCase();
    return role !== "tenant";
  }, [session?.user?.role]);

  const canProcess = useMemo(() => {
    const status = (application?.status || "").toLowerCase();
    return (
      isStaff &&
      (status === "submitted" || status === "under_review") &&
      !!application
    );
  }, [application, isStaff]);

  const fetchApplication = useCallback(async () => {
    if (!applicationId) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/applications/${applicationId}`);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load application");
      }

      setApplication(payload.data?.application || null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load application";
      toast.error(message);
      router.push("/dashboard/tenants/applications");
    } finally {
      setLoading(false);
    }
  }, [applicationId, router]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const handleStatusChange = useCallback(
    async (action: "approve" | "reject") => {
      if (!application) return;
      try {
        setActionLoading(action);
        const response = await fetch(
          `/api/applications/${application._id}/${action}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              notes: `Application ${action}d by ${session?.user?.name || "Staff"}`,
            }),
          },
        );
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || `Failed to ${action} application`);
        }

        toast.success(`Application ${action}d successfully`);
        fetchApplication();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to ${action} application`;
        toast.error(message);
      } finally {
        setActionLoading(null);
      }
    },
    [application, fetchApplication, session?.user?.name],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">Candidature introuvable</h3>
        <p className="mb-4 text-muted-foreground">
          The requested application is unavailable.
        </p>
        <Button onClick={() => router.push("/dashboard/tenants/applications")}>
          Back to Applications
        </Button>
      </div>
    );
  }

  const applicantName =
    [
      application.personalInfo?.firstName || application.applicantId?.firstName,
      application.personalInfo?.lastName || application.applicantId?.lastName,
    ]
      .filter(Boolean)
      .join(" ") || "Unknown Applicant";

  const applicantEmail =
    application.personalInfo?.email ||
    application.applicantId?.email ||
    "Not available";

  const applicantPhone =
    application.personalInfo?.phone ||
    application.applicantId?.phone ||
    "Not available";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Application Details
            </h1>
            <Badge className={getStatusBadgeClass(application.status)}>
              {formatStatusLabel(application.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">ID: {application._id}</p>
        </div>
        <div className="flex items-center gap-2">
          {canProcess && (
            <>
              <Button
                size="sm"
                onClick={() => handleStatusChange("approve")}
                disabled={actionLoading !== null}
              >
                <Check className="mr-2 h-4 w-4" />
                {actionLoading === "approve" ? "Approving..." : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleStatusChange("reject")}
                disabled={actionLoading !== null}
              >
                <X className="mr-2 h-4 w-4" />
                {actionLoading === "reject" ? "Rejecting..." : "Reject"}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/tenants/applications")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Soumise</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {application.submittedAt
                  ? formatDate(application.submittedAt)
                  : "Not submitted"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Application Fee
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-lg font-semibold">
              {formatCurrency(application.applicationFee?.amount || 0)}
            </p>
            <Badge variant="outline" className="capitalize">
              {application.applicationFee?.status || "pending"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Examinée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {application.reviewedAt
                  ? formatDate(application.reviewedAt)
                  : "Not reviewed"}
              </span>
            </div>
            <p className="text-muted-foreground">
              {application.reviewedBy
                ? `${application.reviewedBy.firstName || ""} ${application.reviewedBy.lastName || ""}`.trim()
                : "Aucun vérificateur"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Candidat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Nom</p>
              <p className="font-medium">{applicantName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">E-mail</p>
              <p className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {applicantEmail}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Téléphone</p>
              <p className="font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {applicantPhone}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Bien
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Nom</p>
              <p className="font-medium">
                {application.propertyId?.name || "Not available"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Adresse</p>
              <p className="font-medium flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>{formatAddress(application.propertyId?.address)}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground">Loyer</p>
                <p className="font-medium">
                  {formatCurrency(application.propertyId?.rentAmount || 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Garantie</p>
                <p className="font-medium">
                  {formatCurrency(application.propertyId?.securityDeposit || 0)}
                </p>
              </div>
            </div>
            {application.propertyId?._id && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/dashboard/properties/${application.propertyId._id}`}
                >
                  View Property
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Employment
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Employeur</p>
            <p className="font-medium">
              {application.employmentInfo?.employer || "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Poste</p>
            <p className="font-medium">
              {application.employmentInfo?.position || "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Revenu</p>
            <p className="font-medium">
              {application.employmentInfo?.income
                ? formatCurrency(application.employmentInfo.income)
                : "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Date de début</p>
            <p className="font-medium">
              {application.employmentInfo?.startDate
                ? formatDate(application.employmentInfo.startDate)
                : "Not provided"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts d’urgence</CardTitle>
        </CardHeader>
        <CardContent>
          {!application.emergencyContacts?.length ? (
            <p className="text-sm text-muted-foreground">
              No emergency contacts.
            </p>
          ) : (
            <div className="space-y-3">
              {application.emergencyContacts.map((contact, index) => (
                <div key={`${contact.name || "contact"}-${index}`}>
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Nom : </span>
                      <span className="font-medium">
                        {contact.name || "Not provided"}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        Relationship:{" "}
                      </span>
                      <span className="font-medium">
                        {contact.relationship || "Not provided"}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Téléphone : </span>
                      <span className="font-medium">
                        {contact.phone || "Not provided"}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">E-mail : </span>
                      <span className="font-medium">
                        {contact.email || "Not provided"}
                      </span>
                    </p>
                  </div>
                  {index < (application.emergencyContacts?.length || 0) - 1 && (
                    <Separator className="mt-3" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {!application.documents?.length ? (
            <p className="text-sm text-muted-foreground">
              No documents uploaded.
            </p>
          ) : (
            <div className="space-y-2">
              {application.documents.map((doc, index) => (
                <div
                  key={`${doc.fileName || "document"}-${index}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border p-3"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {doc.fileName || "Unnamed file"}
                    </p>
                    <p className="text-muted-foreground capitalize">
                      {(doc.type || "other").replace("_", " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={doc.verified ? "default" : "outline"}>
                      {doc.verified ? "Verified" : "En attente"}
                    </Badge>
                    {doc.fileUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(application.additionalInfo?.pets ||
        application.additionalInfo?.vehicles ||
        application.additionalInfo?.reasonForMoving ||
        application.additionalInfo?.additionalNotes ||
        application.reviewNotes) && (
        <Card>
          <CardHeader>
            <CardTitle>Notes complémentaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {application.additionalInfo?.pets && (
              <p>
                <span className="text-muted-foreground">Animaux : </span>
                <span className="font-medium">
                  {application.additionalInfo.pets}
                </span>
              </p>
            )}
            {application.additionalInfo?.vehicles && (
              <p>
                <span className="text-muted-foreground">Véhicules : </span>
                <span className="font-medium">
                  {application.additionalInfo.vehicles}
                </span>
              </p>
            )}
            {application.additionalInfo?.reasonForMoving && (
              <p>
                <span className="text-muted-foreground">
                  Reason for moving:{" "}
                </span>
                <span className="font-medium">
                  {application.additionalInfo.reasonForMoving}
                </span>
              </p>
            )}
            {application.additionalInfo?.additionalNotes && (
              <p>
                <span className="text-muted-foreground">Notes du candidat : </span>
                <span className="font-medium">
                  {application.additionalInfo.additionalNotes}
                </span>
              </p>
            )}
            {application.reviewNotes && (
              <p>
                <span className="text-muted-foreground">Notes d’examen : </span>
                <span className="font-medium">{application.reviewNotes}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
