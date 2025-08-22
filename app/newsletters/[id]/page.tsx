import { prisma } from '@/lib/prisma'

function fmt(d: Date) {
  return new Date(d).toLocaleString()
}

export default async function Reader({ params }: { params: { id: string } }) {
  const n = await prisma.newsletter.findUnique({ where: { id: params.id } })
  if (!n) return <main className="mx-auto max-w-3xl px-6 py-10">Not found</main>
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <a href="/archive" className="text-sm text-blue-600 underline">← Back</a>
      <h1 className="text-2xl font-semibold mt-2">{n.subject}</h1>
      <div className="text-sm opacity-70 mb-6">{fmt(n.sentAt)}</div>
      <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: n.html }} />
    </main>
  )
}
