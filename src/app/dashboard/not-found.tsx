import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, SearchX, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardNotFoundPage() {
  return (
    <div className="min-h-full flex items-center justify-center py-10">
      <Card className="relative w-full max-w-2xl overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm shadow-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary/80 via-info/70 to-success/80" />
        <CardContent className="p-6 sm:p-8 md:p-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <SearchX className="h-8 w-8" />
          </div>

          <div className="space-y-3 text-center">
            <p className="text-md font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Error 404
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              This dashboard page is unavailable
            </h1>
            <p className="mx-auto max-w-md text-sm text-muted-foreground sm:text-base">
              The link may be outdated, the page may have been moved, or you may
              not have permission to view it.
            </p>
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <Button asChild size="sm">
              <Link href="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Back To Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/accounting/transactions">
                <Receipt className="mr-2 h-4 w-4" />
                View Transactions
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
