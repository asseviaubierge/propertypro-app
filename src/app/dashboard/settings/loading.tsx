import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Tabs Skeleton */}
      <div className="space-y-6">
        {/* Tab List Skeleton */}
        <div className="flex space-x-1 rounded-lg bg-muted p-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-md" />
          ))}
        </div>

        {/* Tab Content Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Form Sections Skeleton */}
            {Array.from({ length: 3 }).map((_, sectionIndex) => (
              <div key={sectionIndex} className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-64" />
                </div>

                {/* Form Fields Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, fieldIndex) => (
                    <div key={fieldIndex} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full rounded-md" />
                    </div>
                  ))}
                </div>

                {/* Toggle Switches Skeleton */}
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, toggleIndex) => (
                    <div
                      key={toggleIndex}
                      className="flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                  ))}
                </div>

                {sectionIndex < 2 && (
                  <div className="my-6">
                    <Skeleton className="h-px w-full" />
                  </div>
                )}
              </div>
            ))}

            {/* Action Buttons Skeleton */}
            <div className="flex justify-end space-x-3 pt-6">
              <Skeleton className="h-10 w-20 rounded-md" />
              <Skeleton className="h-10 w-24 rounded-md" />
            </div>
          </CardContent>
        </Card>

        {/* Additional Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, cardIndex) => (
            <Card key={cardIndex}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-28" />
                </div>
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 3 }).map((_, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
