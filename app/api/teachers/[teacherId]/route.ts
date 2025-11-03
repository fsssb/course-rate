import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { teacherId: string } }
) {
  const { teacherId } = params;

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true, name: true, dept: true, teacherNo: true },
  });
  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const agg = await prisma.review.aggregate({
    where: { teacherId },
    _avg: {
      overall: true, clarity: true, engagement: true, fairness: true, workload: true,
    },
    _count: { _all: true },
  });

  const toNum = (v: any) => (v == null ? null : Number(v));
  return NextResponse.json({
    teacher,
    stats: {
      count: agg._count._all,
      avg: {
        overall: toNum(agg._avg.overall),
        clarity: toNum(agg._avg.clarity),
        engagement: toNum(agg._avg.engagement),
        fairness: toNum(agg._avg.fairness),
        workload: toNum(agg._avg.workload),
      },
    },
  });
}
