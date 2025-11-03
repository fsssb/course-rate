// app/api/teachers/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || "10")));

    // 先查老师列表（分页）
    const whereTeacher = q ? { name: { contains: q } } : {};
    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where: whereTeacher,
        select: { id: true, name: true, dept: true },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.teacher.count({ where: whereTeacher }),
    ]);

    // 再按老师ID做一次性分组聚合（平均分/评价数）
    const teacherIds = teachers.map((t) => t.id);
    let aggregates:
      | Array<{ teacherId: string; avgOverall: number | null; reviewCount: number }>
      | [] = [];

    if (teacherIds.length > 0) {
      const rows = await prisma.review.groupBy({
        by: ["teacherId"],
        where: { teacherId: { in: teacherIds } },
        _avg: { overall: true },
        _count: { _all: true },
      });

      aggregates = rows.map((r) => ({
        teacherId: r.teacherId,
        avgOverall: r._avg.overall ?? null,
        reviewCount: r._count._all ?? 0,
      }));
    }

    // 合并：教师基础信息 + 聚合结果
    const aggMap = new Map(aggregates.map((a) => [a.teacherId, a]));
    const items = teachers.map((t) => {
      const a = aggMap.get(t.id);
      return {
        teacherId: t.id,
        teacherName: t.name,
        dept: t.dept ?? null,
        avgOverall: a?.avgOverall ?? null,   // 可能是 null，前端已做 typeof 判断
        reviewCount: a?.reviewCount ?? 0,
      };
    });

    return NextResponse.json({ items, total, page, pageSize });
  } catch (e) {
    console.error("[/api/teachers/search] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
