/* prisma/seed.ts */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/** 生成 1 位小数的字符串（3.5 ~ 5.0） */
function randScore(min = 3.5, max = 5.0) {
  const v = Math.random() * (max - min) + min;
  return (Math.round(v * 10) / 10).toFixed(1); // "4.3"
}

/** 简单延时，便于日志阅读 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("🌱 Seeding start…");

  // 1) 学期（Term）—— 受 @@unique([year, season]) 限制，用 upsert
  const termsData = [
    { name: "2025春", year: 2025, season: "spring", startDate: new Date("2025-02-20"), endDate: new Date("2025-07-05") },
    { name: "2025秋", year: 2025, season: "fall",   startDate: new Date("2025-09-05"), endDate: new Date("2026-01-15") },
  ];

  const terms = [];
  for (const t of termsData) {
    const i = await prisma.term.upsert({
      where: { year_season: { year: t.year, season: t.season } },
      update: { ...t },
      create: { ...t },
    });
    terms.push(i);
  }
  console.log(`✅ Terms upserted: ${terms.map(t => t.name).join(", ")}`);

  // 2) 老师（Teacher）—— 用 teacherNo 作为唯一键
  const teachersData = [
    { teacherNo: "T001", name: "张三", dept: "计算机学院" },
    { teacherNo: "T002", name: "李四", dept: "计算机学院" },
    { teacherNo: "T003", name: "王五", dept: "数学学院" },
  ];
  const teachers = [];
  for (const t of teachersData) {
    const i = await prisma.teacher.upsert({
      where: { teacherNo: t.teacherNo },
      update: { name: t.name, dept: t.dept ?? null },
      create: t,
    });
    teachers.push(i);
  }
  console.log(`✅ Teachers upserted: ${teachers.map(t => `${t.name}(${t.teacherNo})`).join(", ")}`);

  // 3) 课程（Course）—— 用 code 唯一，且绑定 teacherId
  const teacherByNo = Object.fromEntries(teachers.map(t => [t.teacherNo!, t]));
  const coursesData = [
    { code: "CS101", name: "程序设计基础", dept: "计算机学院", teacherNo: "T001" },
    { code: "CS201", name: "数据结构",     dept: "计算机学院", teacherNo: "T001" },
    { code: "CS301", name: "操作系统",     dept: "计算机学院", teacherNo: "T002" },
    { code: "MA101", name: "高等数学",     dept: "数学学院",   teacherNo: "T003" },
  ];

  const courses = [];
  for (const c of coursesData) {
    const teacher = teacherByNo[c.teacherNo];
    const i = await prisma.course.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        dept: c.dept ?? null,
        teacherId: teacher.id,
      },
      create: {
        code: c.code,
        name: c.name,
        dept: c.dept ?? null,
        teacherId: teacher.id,
      },
    });
    courses.push(i);
  }
  console.log(`✅ Courses upserted: ${courses.map(c => `${c.name}(${c.code})`).join(", ")}`);

  // 4) 学生（Student）—— 用 studentNo 唯一
  const studentsData = Array.from({ length: 20 }).map((_, idx) => ({
    studentNo: `S${String(1000 + idx)}`,
    name: `学生${idx + 1}`,
  }));

  // 批量创建（重复执行也不重复，依赖 unique: studentNo）
  await prisma.student.createMany({
    data: studentsData,
    skipDuplicates: true,
  });
  const students = await prisma.student.findMany({
    where: { studentNo: { in: studentsData.map(s => s.studentNo) } },
  });
  console.log(`✅ Students ready: ${students.length}`);

  // 5) 开课（CourseOffering）—— @@unique([courseId, termId])
  const termBySeason: Record<string, string> = Object.fromEntries(
    terms.map(t => [t.season, t.id])
  );

  // 每门课 2025春/秋都开一次
  const offerings = [];
  for (const c of courses) {
    for (const season of ["spring", "fall"]) {
      const termId = termBySeason[season];
      const off = await prisma.courseOffering.upsert({
        where: { courseId_termId: { courseId: c.id, termId } },
        update: {},
        create: { courseId: c.id, termId },
      });
      offerings.push(off);
    }
  }
  console.log(`✅ Offerings upserted: ${offerings.length}`);

  // 6) 评价（Review）
  // 规则：每个学生 对每位任课老师 在某个学期 评价 0~2 次（多数 1 次）
  //       满足唯一约束 @@unique([studentId, teacherId, termId])
  const reviewsToCreate: Prisma.ReviewCreateManyInput[] = [];

  for (const stu of students) {
    // 随机选 1~3 位老师进行评价
    const shuffledTeachers = [...teachers].sort(() => Math.random() - 0.5);
    const pickTeachers = shuffledTeachers.slice(0, 1 + Math.floor(Math.random() * 3));

    for (const tch of pickTeachers) {
      // 随机选 1 个学期
      const term = terms[Math.floor(Math.random() * terms.length)];

      // 绑定该老师任课的一门课（如果有）
      const teacherCourses = courses.filter(c => c.teacherId === tch.id);
      const course = teacherCourses.length ? teacherCourses[Math.floor(Math.random() * teacherCourses.length)] : null;

      // 找到对应开课（如果该课该学期开了）
      let offering: { id: string } | null = null;
      if (course) {
        offering = offerings.find(o => o.courseId === course.id && o.termId === term.id) ?? null;
      }

      // 构造一条评价（注意：Decimal 字段传字符串最稳妥）
      const payload: Prisma.ReviewCreateManyInput = {
        id: undefined as any, // createMany 会忽略 id
        studentId: stu.id,
        teacherId: tch.id,
        termId: term.id,
        courseId: course?.id ?? null,
        offeringId: offering?.id ?? null,
        overall: randScore(),
        clarity: randScore(),
        engagement: randScore(3.6, 5.0),
        fairness: randScore(3.4, 5.0),
        workload: randScore(2.5, 4.5),
        comment: Math.random() > 0.5 ? "老师讲解清楚，课堂互动多。" : "课程节奏适中，作业适量。",
        isAnonymous: true,
        createdAt: new Date(),
      };

      reviewsToCreate.push(payload);
    }
  }

  // 去重：按 (studentId, teacherId, termId)
  const seen = new Set<string>();
  const deduped = reviewsToCreate.filter(r => {
    const key = `${r.studentId}|${r.teacherId}|${r.termId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 批量插入，违反唯一约束则跳过
  await prisma.review.createMany({
    data: deduped,
    skipDuplicates: true,
  });

  const totalReviews = await prisma.review.count();
  console.log(`✅ Reviews inserted (total in DB): ${totalReviews}`);

  console.log("🎉 Seeding finished.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await wait(100);
    await prisma.$disconnect();
  });

