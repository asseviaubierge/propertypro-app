export default function DisplaySettingsLoading() {
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
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-6 w-44 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="h-4 w-80 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2"></div>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {/* Display options skeleton */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                  ))}
                </div>
              </div>
            ))}
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
