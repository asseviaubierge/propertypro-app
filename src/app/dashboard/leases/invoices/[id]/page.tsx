import { redirect } from "next/navigation";

export default async function LegacyLeaseInvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/accounting/invoices/${id}`);
}
