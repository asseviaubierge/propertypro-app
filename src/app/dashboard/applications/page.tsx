"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Search,
  MoreHorizontal,
  Eye,
  Check,
  X,
  Clock,
  Calendar,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { GlobalSearch } from "@/components/ui/global-search";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Application {
  _id: string;
  status: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  propertyId: {
    _id: string;
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
    };
    rentAmount: number;
  };
  applicationFee: {
    amount: number;
    status: string;
  };
  submittedAt?: string;
  createdAt: string;
}

const statusColors = {
  draft: "secondary",
  submitted: "default",
  under_review: "default",
  screening_in_progress: "default",
  approved: "default",
  rejected: "destructive",
  withdrawn: "secondary",
} as const;

const statusIcons = {
  draft: Clock,
  submitted: FileText,
  under_review: Eye,
  screening_in_progress: Search,
  approved: Check,
  rejected: X,
  withdrawn: X,
};

export default function ApplicationsPage() {
  const { data: session } = useSession();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Handler for debounced search from GlobalSearch component
  const handleSearch = useCallback((value: string) => {
    setIsSearching(true);
    setSearchTerm(value);
    // Trigger fetch after search term is set
    setCurrentPage(1); // Reset to first page on search
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [currentPage, statusFilter, searchTerm]);

  const fetchApplications = async () => {
    try {
      // Only show main loading on initial load
      if (!searchTerm) {
        setLoading(true);
      }
      setIsSearching(true);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      if (searchTerm) {
        params.append("search", searchTerm);
      }

      const response = await fetch(`/api/applications?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch applications");
      }

      const data = await response.json();
      setApplications(data.applications);
      setTotalPages(data.pagination.pages);
    } catch (err) {
      setError("Failed to load applications");
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const handleStatusChange = async (
    applicationId: string,
    action: "approve" | "reject",
  ) => {
    try {
      const response = await fetch(
        `/api/applications/${applicationId}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notes: `Application ${action}d by ${session?.user?.firstName} ${session?.user?.lastName}`,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to ${action} application`);
      }

      // Refresh the applications list
      fetchApplications();
    } catch (err) {
      alert(`Failed to ${action} application`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const StatusIcon =
      statusIcons[status as keyof typeof statusIcons] || FileText;
    return (
      <Badge
        variant={statusColors[status as keyof typeof statusColors] || "default"}
      >
        <StatusIcon className="mr-1 h-3 w-3" />
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">Applications</h1>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">Applications</h1>
          <p className="text-muted-foreground">
            Review and manage tenant applications
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Applications
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{applications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                applications.filter((app) =>
                  ["submitted", "under_review"].includes(app.status),
                ).length
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {applications.filter((app) => app.status === "approved").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                applications.filter((app) => {
                  const appDate = new Date(app.createdAt);
                  const now = new Date();
                  return (
                    appDate.getMonth() === now.getMonth() &&
                    appDate.getFullYear() === now.getFullYear()
                  );
                }).length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Global Search Component with 300ms debounce */}
            <GlobalSearch
              placeholder="Search by applicant name or email..."
              initialValue={searchTerm}
              debounceDelay={300}
              onSearch={handleSearch}
              isLoading={isSearching}
              className="flex-1"
              ariaLabel="Search applications"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="screening_in_progress">Screening</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Applications ({applications.length})</CardTitle>
          <CardDescription>
            A list of all rental applications and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Fee Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => (
                <TableRow key={application._id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {application.personalInfo.firstName}{" "}
                        {application.personalInfo.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {application.personalInfo.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {application.propertyId.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {application.propertyId.address.city},{" "}
                        {application.propertyId.address.state}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(application.status)}</TableCell>
                  <TableCell>
                    ${application.propertyId.rentAmount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        application.applicationFee.status === "paid"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {application.applicationFee.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {application.submittedAt
                      ? formatDate(application.submittedAt)
                      : "Not submitted"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/applications/${application._id}`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {[
                          "submitted",
                          "under_review",
                          "screening_in_progress",
                        ].includes(application.status) && (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(application._id, "approve")
                              }
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(application._id, "reject")
                              }
                            >
                              <X className="mr-2 h-4 w-4" />
                              Reject
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
