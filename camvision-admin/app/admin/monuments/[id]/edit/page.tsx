import { redirect } from "next/navigation"

export default async function MonumentsEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/lieux/${id}/edit`)
}
