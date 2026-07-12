export default function ProfileSettingsLoading() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>

      {/* Settings Card Skeleton */}
      <div className="border rounded-lg bg-white dark:bg-gray-900">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="h-4 w-80 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2"></div>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {/* Form fields skeleton */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            ))}
            <div className="flex gap-4 pt-4">
              <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
