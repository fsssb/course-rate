import { NextRequest, NextResponse } from 'next/server'
import prisma from '../../../lib/prisma' // 从 app/api/teachers/ratings 到 app/lib 的相对路径是 ../../../lib/prisma

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const take = Number(searchParams.get('take') || 50)

  // 1) 先筛老师，避免 N+1
  const teachers = await prisma.teacher.findMany({
    where: q ? { name: { contains: q } } : {},
    select: { id: true, name: true, dept: true },
    orderBy: { name: 'asc' },
    take,
  })
  const ids = teachers.map((t) => t.id)

  // 2) 对这些老师一次性聚合出平均分与评价数
  const grouped = await prisma.review.groupBy({
    by: ['teacherId'],
    where: { teacherId: { in: ids } },
    _avg: { overall: true },
    _count: { id: true },
    orderBy: { _avg: { overall: 'desc' } },
  })

  const tmap = new Map(teachers.map((t) => [t.id, t]))
  const data = grouped.map((g) => ({
    teacherId: g.teacherId,
    teacherName: tmap.get(g.teacherId)?.name ?? '未知老师',
    dept: tmap.get(g.teacherId)?.dept ?? null,
    avgOverall: g._avg.overall ? Number(g._avg.overall) : null,
    reviewCount: g._count.id,
  }))

  return NextResponse.json(data)
}

