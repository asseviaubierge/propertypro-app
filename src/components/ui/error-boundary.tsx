"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { errorLogger, ErrorCategory, ErrorSeverity } from "@/lib/error-logger";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Log error to error logger
    errorLogger.logError({
      error,
      category: ErrorCategory.UI,
      severity: ErrorSeverity.HIGH,
      context: {
        componentStack: errorInfo.componentStack,
      },
      metadata: {
        errorInfo: errorInfo.componentStack,
      },
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            retry={this.handleRetry}
          />
        );
      }

      // Default error UI
      return (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center text-red-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-700">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>

            {process.env.NODE_ENV === "development" && this.state.errorInfo && (
              <details className="text-sm text-red-600">
                <summary className="cursor-pointer font-medium">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}

            <Button
              onClick={this.handleRetry}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    console.error("Error caught by useErrorHandler:", error);
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError };
}

// Specific error boundary for image-related errors
export function ImageErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-orange-500 mb-4" />
            <h3 className="text-lg font-semibold text-orange-800 mb-2">
              Image Loading Error
            </h3>
            <p className="text-orange-700 text-center mb-4">
              There was a problem loading the images. This might be due to a
              network issue or invalid image data.
            </p>
            <Button
              onClick={retry}
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Loading Images
            </Button>
          </CardContent>
        </Card>
      )}
      onError={(error, errorInfo) => {
        // Log image-specific errors
        console.error("Image Error:", error);
        console.error("Error Info:", errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
