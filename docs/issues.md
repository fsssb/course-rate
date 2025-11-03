# 🧾 项目 Issue 总览（v1.1）

> 本文档整合了截至《课程评分系统需求文档 v1.1》发布后的全部项目 Issue。
> 适用于仓库：`fsssb/course-rate`  
> 更新时间：2025-11-03

---

## ✅ Issue #1：初始化 Next.js 项目

**标题：** `feat: init Next.js app (A1)`

### 🎯 目标
完成 Next.js 16 初始化，确保项目可在 WSL2 环境下启动并访问。

### 📘 任务内容
- 初始化项目结构（App Router + TS + Tailwind）  
- 添加 ESLint / Prettier 配置  
- 确认 `npm run dev` 可启动（返回 200）  
- 推送远端分支 `feature/1-init-next`，创建 PR（含 `Closes #1`）

### ✅ 验收标准
- 项目运行正常（本地 200 OK）  
- GitHub PR 合并完成  

---

## ⚙️ Issue #3：Prisma 初始化与迁移

**标题：** `feat: setup Prisma schema and migrate (A1)`

### 🎯 目标
初始化 Prisma，并建立数据库模型与迁移。

### 📘 任务内容
- 执行 `npx prisma init`  
- 更新 `.env` 中 `DATABASE_URL` 与 `JWT_SECRET`  
- 定义 `schema.prisma`（采用 v1.1 精简模型）  
- 运行迁移并验证：
  ```bash
  npx prisma migrate dev --name simplify-models
  npx prisma generate
  ```

### ✅ 验收标准
- Prisma CLI 运行正常；  
- `prisma studio` 可查看数据模型；  
- 与 v1.1 文档一致（仅 `Student`、`Teacher`、`Course`、`Session`、`Evaluation` 五表）。

---

## ⚙️ Issue #4：公共库

**标题：** `feat: common libraries (prisma.ts, auth.ts)`

### 🎯 目标
建立通用工具模块以支撑后端逻辑。

### 📘 任务内容
- 创建 `src/lib/prisma.ts`：Prisma Client 单例；  
- 创建 `src/lib/auth.ts`：JWT 签发与验证函数。

### ✅ 验收标准
- 所有 API 均使用单例 Prisma Client；  
- JWT 校验逻辑通过单元测试验证。

---

## ⚙️ Issue #5：环境变量模板

**标题：** `chore: add .env.example template`

### 🎯 目标
规范环境变量模板，避免敏感信息提交。

### 📘 任务内容
- 添加 `.env.example`：
  ```env
  DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>?schema=public"
  JWT_SECRET="temp_placeholder"
  ALLOWED_IP_PREFIXES="10.,172.16.,192.168.,202.120."
  ```
- 更新 README 引导。

### ✅ 验收标准
- `.env.example` 存在且完整；  
- `.env` 未被提交至仓库。

---

## ⚙️ Issue #6：README 快速开始

**标题：** `docs: update README with setup guide`

### 🎯 目标
为新开发者提供快速启动指南。

### 📘 任务内容
- 说明安装 Node、nvm、依赖与启动步骤；  
- 添加数据库迁移命令；  
- 补充校内访问限制说明。

### ✅ 验收标准
- 新成员可在 10 分钟内完成本地运行；  
- 包含示例命令与截图。

---

## 🧩 Issue #7：教师综合评分接口

**标题：** `feat: 教师综合评分接口 (/api/teacher/[id]/rating)`

### 🎯 目标
实现教师综合评分接口，返回教师平均分与评价数。

### 📘 功能说明
| 项目 | 内容 |
|------|------|
| 接口路径 | `/api/teacher/[id]/rating` |
| 请求方式 | `GET` |
| 响应示例 | ```json { "teacherId": "t123", "avgRating": 4.9, "totalReviews": 1000 } ``` |
| 权限限制 | 登录后学生可访问 |

### 🧩 实现要点
- 使用 Prisma `.aggregate()` 计算平均分与数量；  
- 对无评分返回 0；  
- 前端课程页展示结果。

### ✅ 验收标准
- 返回正确平均分与数量；  
- 无报错；  
- 性能稳定（延迟 < 200ms）。

---

## 🧱 Issue #8：校园网访问限制中间件

**标题：** `feat: 校园网访问限制 (middleware.ts)`

### 🎯 目标
在应用层限制访问，仅允许校内 IP 段访问系统。

### 📘 实现方案
- 创建 `middleware.ts`，匹配除 `_next` 外所有路由；  
- 读取 `.env` 中的 `ALLOWED_IP_PREFIXES`；  
- 非匹配 IP 返回 403：
  ```text
  校园网访问限制：请连接校内网络。
  ```

### ✅ 验收标准
- 校内访问正常；  
- 外网返回 403；  
- 环境变量可动态配置；  
- 本地开发可通过 `ALLOW_LOCAL_DEV=true` 绕过。

---

## 📘 Issue 总结表

| ID | 标题 | 类型 | 状态 |
|----|------|------|------|
| #1 | 初始化 Next.js 项目 | 架构初始化 | ✅ 完成 |
| #3 | 初始化 Prisma 与迁移 | 数据模型 | ⏳ 进行中 |
| #4 | 公共库 | 通用模块 | 待开发 |
| #5 | 环境变量模板 | 配置规范 | 待开发 |
| #6 | README 快速开始 | 文档 | 待开发 |
| #7 | 教师综合评分接口 | 新功能 | 未开始 |
| #8 | 校园网访问限制 | 安全模块 | 未开始 |

---

**文档版本：** v1.1  
**作者：** 项目协作助手  
**日期：** 2025-11-03  
**适用仓库：** `fsssb/course-rate`
