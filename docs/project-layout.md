# 🗂️ 项目结构说明（Project Layout）

> 本文档描述了 `fsssb/course-rate` 仓库的目录结构、模块职责与开发规范。
> 版本：v1.1  
> 更新时间：2025-11-03

---

## 📁 1. 顶层目录结构

```bash
course-rate/
├── app/                 # Next.js App Router 页面目录
│   ├── api/             # 后端接口路由
│   │   ├── auth/        # 注册 / 登录接口
│   │   ├── evaluation/  # 课程评分接口
│   │   └── teacher/     # 教师信息与评分统计接口
│   ├── (student)/       # 学生端页面（登录后可见）
│   ├── layout.tsx       # 全局布局组件
│   └── page.tsx         # 入口页面（登录页）
│
├── prisma/              # 数据库模型与迁移
│   ├── schema.prisma    # Prisma 主模型定义
│   └── migrations/      # 数据库迁移历史记录
│
├── src/                 # 源码目录（辅助模块与工具）
│   ├── lib/             # 通用工具库
│   │   ├── prisma.ts    # Prisma Client 单例
│   │   ├── auth.ts      # JWT 签发与验证逻辑
│   │   └── utils.ts     # 通用函数（可选）
│   └── types/           # TypeScript 类型定义
│
├── docs/                # 文档目录（设计 / 需求 / Issue / 报告）
│   ├── requirements.md  # 系统需求文档（v1.1）
│   ├── change-impact.md # 进度影响分析报告
│   └── issues.md        # 项目 Issue 总览
│
├── public/              # 静态资源（图标 / 图片 / 字体）
│   └── icon.svg         # 应用图标
│
├── middleware.ts        # 校园网访问限制中间件
├── package.json         # 项目依赖与脚本配置
├── tsconfig.json        # TypeScript 编译配置
├── .env.example         # 环境变量模板（安全示例）
└── README.md            # 启动与开发说明
```

---

## ⚙️ 2. 模块说明

| 模块 | 位置 | 职责 |
|------|------|------|
| **App Router 页面** | `app/` | 前端页面与 API 路由并存的核心目录。 |
| **API 接口** | `app/api/` | 提供认证、评分、统计等服务端逻辑。 |
| **Prisma 模型** | `prisma/schema.prisma` | 定义学生、教师、课程、评分等数据结构。 |
| **中间件** | `middleware.ts` | 校园网访问限制，实现 IP 白名单控制。 |
| **通用库** | `src/lib/` | 提供数据库连接、JWT 校验、通用工具函数。 |
| **文档区** | `docs/` | 存放系统设计、需求、Issue、变更记录。 |

---

## 🧱 3. 数据模型概览

| 模型 | 说明 |
|------|------|
| `Student` | 登录账户（唯一登录角色） |
| `Teacher` | 教师信息（被评分对象） |
| `Course` | 课程数据，关联教师 |
| `Session` | 课程节次（学期 / 周次） |
| `Evaluation` | 学生评分记录（1–5 分 + 文字反馈） |

---

## 🔐 4. 安全设计要点

- JWT Token 校验放在接口层（`auth.ts`）  
- IP 白名单限制放在中间件层（`middleware.ts`）  
- `.env` 文件只存放本地，不提交仓库  
- 所有密码使用 bcrypt 加密  

---

## 🧩 5. 开发与协作规范

| 类型 | 约定 |
|------|------|
| **分支命名** | `feature/<issue-id>-<desc>`、`chore/<desc>` |
| **提交格式** | `feat:` / `fix:` / `chore:` / `docs:` |
| **Pull Request** | 必须包含 `Closes #<issue-id>` |
| **代码风格** | ESLint + Prettier 自动格式化 |
| **环境变量** | 仅 `.env.example` 可提交，真实 `.env` 本地保存 |

---

## 🚀 6. 本地开发命令

```bash
# 安装依赖
npm install

# 数据库迁移
npx prisma migrate dev --name init

# 启动开发服务器
npm run dev

# 查看数据库结构
npx prisma studio
```

---

## 🧭 7. 文档索引

| 文档 | 说明 |
|------|------|
| `docs/requirements.md` | 系统需求文档（功能与角色） |
| `docs/change-impact.md` | 进度影响分析报告 |
| `docs/issues.md` | Issue 总览（任务追踪） |
| `docs/project-layout.md` | 本文档（结构与模块说明） |

---

**文档版本：** v1.1  
**作者：** 项目协作助手  
**日期：** 2025-11-03  
**适用仓库：** `fsssb/course-rate`
