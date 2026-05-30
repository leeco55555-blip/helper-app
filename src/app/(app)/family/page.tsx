import { redirect } from "next/navigation";

export default async function FamilyRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const sp = await searchParams;
  redirect(sp.patient ? `/settings?patient=${sp.patient}` : "/settings");
}
