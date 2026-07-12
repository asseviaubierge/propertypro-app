"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Shield,
  Key,
  UserX,
  Mail,
  RefreshCw,
  Home,
  ArrowLeft,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");

  // Map error codes to user-friendly messages
  const getErrorDetails = (errorCode: string | null) => {
    switch (errorCode) {
      case "Configuration":
        return {
          icon: AlertCircle,
          title: "Configuration Error",
          description: "There is a problem with the server configuration.",
          suggestion: "Please contact the administrator.",
          color: "red",
        };
      case "AccessDenied":
        return {
          icon: UserX,
          title: "Access Denied",
          description: "You do not have permission to sign in.",
          suggestion: "Please contact your administrator if you believe this is an error.",
          color: "orange",
        };
      case "Verification":
        return {
          icon: Mail,
          title: "Verification Required",
          description: "The verification token has expired or has already been used.",
          suggestion: "Please request a new verification email.",
          color: "blue",
        };
      case "OAuthSignin":
        return {
          icon: Shield,
          title: "OAuth Sign In Error",
          description: "Error occurred while trying to sign in with the OAuth provider.",
          suggestion: "Please try again or use a different sign-in method.",
          color: "purple",
        };
      case "OAuthCallback":
        return {
          icon: Shield,
          title: "OAuth Callback Error",
          description: "Error occurred during the OAuth callback process.",
          suggestion: "Please try signing in again.",
          color: "purple",
        };
      case "OAuthCreateAccount":
        return {
          icon: Shield,
          title: "Account Creation Error",
          description: "Could not create an account with the OAuth provider.",
          suggestion: "The email might already be in use. Try signing in instead.",
          color: "purple",
        };
      case "EmailCreateAccount":
        return {
          icon: Mail,
          title: "Email Account Error",
          description: "Could not create an account with the provided email.",
          suggestion: "The email might already be in use. Try signing in instead.",
          color: "blue",
        };
      case "Callback":
        return {
          icon: AlertCircle,
          title: "Callback Error",
          description: "Error occurred during the authentication callback.",
          suggestion: "Please try signing in again.",
          color: "red",
        };
      case "OAuthAccountNotLinked":
        return {
          icon: Shield,
          title: "Account Not Linked",
          description: "This email is already associated with another account.",
          suggestion: "Please sign in using your original sign-in method.",
          color: "orange",
        };
      case "EmailSignin":
        return {
          icon: Mail,
          title: "Email Sign In Error",
          description: "The email sign-in link is invalid or has expired.",
          suggestion: "Please request a new sign-in link.",
          color: "blue",
        };
      case "CredentialsSignin":
        return {
          icon: Key,
          title: "Invalid Credentials",
          description: "The email or password you entered is incorrect.",
          suggestion: "Please check your credentials and try again.",
          color: "red",
        };
      case "SessionRequired":
        return {
          icon: Shield,
          title: "Session Required",
          description: "You must be signed in to access this page.",
          suggestion: "Please sign in to continue.",
          color: "orange",
        };
      default:
        return {
          icon: AlertCircle,
          title: "Authentication Error",
          description: "An unexpected error occurred during authentication.",
          suggestion: "Please try again or contact support if the problem persists.",
          color: "red",
        };
    }
  };

  const errorDetails = getErrorDetails(error);
  const ErrorIcon = errorDetails.icon;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="max-w-lg w-full border-border/60 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 relative">
            <div className={`absolute inset-0 bg-${errorDetails.color}-500/20 blur-2xl rounded-full`} />
            <div className={`relative bg-${errorDetails.color}-500/10 p-4 rounded-full inline-block`}>
              <ErrorIcon className={`size-12 text-${errorDetails.color}-600`} />
            </div>
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold">
            {errorDetails.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>What happened?</AlertTitle>
            <AlertDescription className="mt-2">
              {errorDetails.description}
            </AlertDescription>
          </Alert>

          {/* Suggestion */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <p className="text-sm font-medium mb-2">What should I do?</p>
            <p className="text-sm text-muted-foreground">
              {errorDetails.suggestion}
            </p>
          </div>

          {/* Error Code (for debugging) */}
          {error && (
            <div className="text-center text-xs text-muted-foreground">
              <p>Error Code: <code className="font-mono bg-muted px-2 py-1 rounded">{error}</code></p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => router.push("/auth/signin")}
              className="w-full gap-2"
              size="lg"
            >
              <RefreshCw className="size-4" />
              Try Signing In Again
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => router.back()}
                variant="outline"
                className="gap-2"
              >
                <ArrowLeft className="size-4" />
                Go Back
              </Button>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="gap-2"
              >
                <Home className="size-4" />
                Home
              </Button>
            </div>
          </div>

          {/* Additional Help */}
          <div className="pt-4 border-t border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-3">
              Need more help?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                <a href="/auth/forgot-password">Reset Password</a>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                <a href="/auth/signup">Create Account</a>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                <a href="mailto:support@propertypro.com">Contact Support</a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}

