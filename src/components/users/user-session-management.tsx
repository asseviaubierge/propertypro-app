/**
 * PropertyPro - User Session Management Component
 * Manage active user sessions and force logout capabilities
 */

"use client";

import React, { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  LogOut,
  Shield,
  Clock,
  MapPin,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { UserRole } from "@/types";

interface UserSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  browser: string;
  os: string;
  ipAddress: string;
  location?: {
    city?: string;
    country?: string;
    region?: string;
  };
  lastActivity: Date;
  createdAt: Date;
  isCurrentSession: boolean;
}

interface UserSessionManagementProps {
  userId?: string;
  className?: string;
}

export function UserSessionManagement({
  userId,
  className,
}: UserSessionManagementProps) {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [sessionToTerminate, setSessionToTerminate] =
    useState<UserSession | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [userId]);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);

      // Mock data for demonstration
      const mockSessions: UserSession[] = [
        {
          id: "session-1",
          userId: "user-1",
          userName: "John Doe",
          userEmail: "john.doe@example.com",
          userRole: UserRole.TENANT,
          deviceType: "desktop",
          browser: "Chrome 120.0",
          os: "Windows 11",
          ipAddress: "192.168.1.100",
          location: {
            city: "New York",
            country: "United States",
            region: "NY",
          },
          lastActivity: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
          isCurrentSession: true,
        },
        {
          id: "session-2",
          userId: "user-1",
          userName: "John Doe",
          userEmail: "john.doe@example.com",
          userRole: UserRole.TENANT,
          deviceType: "mobile",
          browser: "Safari 17.0",
          os: "iOS 17.1",
          ipAddress: "10.0.0.50",
          location: {
            city: "New York",
            country: "United States",
            region: "NY",
          },
          lastActivity: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
          isCurrentSession: false,
        },
        {
          id: "session-3",
          userId: "user-2",
          userName: "Jane Smith",
          userEmail: "jane.smith@example.com",
          userRole: UserRole.MANAGER,
          deviceType: "desktop",
          browser: "Firefox 121.0",
          os: "macOS 14.0",
          ipAddress: "203.0.113.45",
          location: {
            city: "San Francisco",
            country: "United States",
            region: "CA",
          },
          lastActivity: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
          createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
          isCurrentSession: false,
        },
      ];

      // Filter by user if specified
      const filteredSessions = userId
        ? mockSessions.filter((session) => session.userId === userId)
        : mockSessions;

      setSessions(filteredSessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Failed to load user sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateSession = async (session: UserSession) => {
    try {
      setIsTerminating(true);

      // In a real app, this would call an API to terminate the session
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to terminate session");
      }

      // Remove the session from the list
      setSessions((prev) => prev.filter((s) => s.id !== session.id));

      toast.success(
        session.isCurrentSession
          ? "Current session will be terminated"
          : "Session terminated successfully"
      );

      setShowTerminateDialog(false);
      setSessionToTerminate(null);
    } catch (error) {
      console.error("Error terminating session:", error);
      toast.error("Failed to terminate session");
    } finally {
      setIsTerminating(false);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      case "tablet":
        return <Tablet className="h-4 w-4" />;
      case "desktop":
        return <Monitor className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getActivityStatus = (lastActivity: Date) => {
    const minutesAgo = Math.floor(
      (Date.now() - lastActivity.getTime()) / (1000 * 60)
    );

    if (minutesAgo < 5) {
      return { label: "Active", variant: "default" as const };
    } else if (minutesAgo < 30) {
      return { label: "Recent", variant: "secondary" as const };
    } else {
      return { label: "Idle", variant: "outline" as const };
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              {userId ? "User session history" : "All active user sessions"}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSessions}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center space-x-4 p-3 border rounded-lg"
              >
                <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No active sessions found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device & Browser</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const activityStatus = getActivityStatus(
                    session.lastActivity
                  );
                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          {getDeviceIcon(session.deviceType)}
                          <div>
                            <p className="font-medium">{session.browser}</p>
                            <p className="text-sm text-muted-foreground">
                              {session.os}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{session.userName}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.userEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <div>
                            <p className="text-sm">
                              {session.location?.city},{" "}
                              {session.location?.region}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {session.ipAddress}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {formatDistanceToNow(session.lastActivity, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={activityStatus.variant}>
                            {activityStatus.label}
                          </Badge>
                          {session.isCurrentSession && (
                            <Badge variant="outline" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSessionToTerminate(session);
                            setShowTerminateDialog(true);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Terminate Session Dialog */}
      <Dialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Terminate Session
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to terminate this session?
            </DialogDescription>
          </DialogHeader>

          {sessionToTerminate && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3 mb-2">
                  {getDeviceIcon(sessionToTerminate.deviceType)}
                  <div>
                    <p className="font-medium">{sessionToTerminate.browser}</p>
                    <p className="text-sm text-muted-foreground">
                      {sessionToTerminate.os}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  User: {sessionToTerminate.userName} (
                  {sessionToTerminate.userEmail})
                </p>
                <p className="text-sm text-muted-foreground">
                  IP: {sessionToTerminate.ipAddress}
                </p>
              </div>

              {sessionToTerminate.isCurrentSession && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This is the current session. The user will be logged out
                    immediately.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTerminateDialog(false)}
              disabled={isTerminating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                sessionToTerminate && handleTerminateSession(sessionToTerminate)
              }
              disabled={isTerminating}
            >
              {isTerminating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Terminating...
                </>
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  Terminate Session
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
