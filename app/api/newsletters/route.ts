import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const where: any = q ? {
    OR: [
      { subject: { contains: q, mode: 'insensitive' } },
      { previewText: { contains: q, mode: 'insensitive' } }
    ]
  } : {}
  const items = await prisma.newsletter.findMany({ where, orderBy: { sentAt: 'desc' }, take: 200 })
  return NextResponse.json({ items })
}
