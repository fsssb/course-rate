
# 课程评分系统 · 接口设计文档（API Specification）
版本：v1.0  
状态：草案（可用于开发对接）  
编码：UTF-8  
上次更新：2025-11-03

> 适配的需求文档版本：**《课程评分系统需求说明书 v1.2》**（含“仅校内访问、学生对教师评分、查询可见综合分”等要求）。  
> 本文档默认部署形态：Next.js (App Router) + Prisma + PostgreSQL，Server Actions / Route Handlers 提供 API。

---

## 0. 术语
- **学生（Student）**：通过校园统一认证登录的用户，可提交与修改/删除在可编辑窗口内的评分。
- **管理员（Admin）**：教务角色，负责导入教师与课程数据、处理申诉、导出报表。
- **评分（Rating）**：学生针对某一课程-教师-学期的评分与评语。
- **综合分（Aggregate Score）**：同一教师或同一课程的评分加权平均值（默认算术平均）。

---

## 1. 认证与访问控制

### 1.1 仅校内访问（网络层）
- 入口层（Nginx/Cloudflare Tunnel/学校网关）做**源 IP 白名单**：`10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16` 等学校网段。
- 反向代理转发时，加请求头 `X-Forwarded-For` 与 `X-Real-IP`，后端在中间件校验。  
- 非白名单返回 HTTP `403`：`{"code":"IP_RESTRICTED","message":"Campus network required"}`。

### 1.2 统一认证（SSO）
- 推荐接入 **OIDC/SAML**（如：学校统一身份认证平台）。
- 首次成功登录自动在本地创建学生用户记录（Just-in-time Provisioning）。
- 会话策略：前端使用 HttpOnly Secure SameSite=Lax Cookie（Session 或 JWT）。

### 1.3 角色与权限
- 角色：`student` / `admin`。
- 基于路由的 RBAC 中间件：对 `admin` 前缀 API 进行强制校验。
- 评分写操作需要已登录学生身份；查询类接口匿名可访问（可选）或需登录访问（建议登录访问）。

---

## 2. 版本与基础约定
- 基础路径：`/api/v1`
- 数据格式：`application/json; charset=utf-8`
- 分页参数：`page`（默认 1），`pageSize`（默认 20，最大 100）
- 时间：ISO 8601，UTC 存储，前端本地化显示
- 错误统一结构：
```json
{
  "code": "RATING_WINDOW_CLOSED",
  "message": "评分窗口已关闭",
  "traceId": "a1b2c3d4e5"
}
```
- 成功统一结构：
```json
{
  "success": true,
  "data": { ... },
  "traceId": "a1b2c3d4e5"
}
```

---

## 3. 资源模型（简化）
```ts
type User = {
  id: string;              // snowflake/uuid
  sno: string;             // 学号（从 SSO claim 获取）
  name: string;
  role: 'student'|'admin';
  createdAt: string;
};

type Teacher = {
  id: string;
  name: string;
  dept: string;            // 学院/系
  title?: string;          // 职称
  hidden?: boolean;        // 是否在前台隐藏
};

type Course = {
  id: string;
  code: string;            // 课程代码
  name: string;
  dept: string;
  credits?: number;
};

type Section = {
  id: string;
  courseId: string;
  teacherId: string;
  term: string;            // 学期（例：2025-2026-1）
};

type Rating = {
  id: string;
  userId: string;
  sectionId: string;
  score: number;           // 1..5, 可半星 0.5 步长
  tags?: string[];         // 可选快捷标签（如“讲解清晰”）
  comment?: string;        // 评语（可匿名展示）
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  status: 'active'|'deleted'|'flagged';
};

type Aggregate = {
  target: 'teacher'|'course'|'section';
  targetId: string;
  term?: string;           // 当 target=teacher/course 时可为空；当 target=section 时等于该节 term
  count: number;           // 评分数量
  avg: number;             // 平均分（保留 1 位小数）
  updatedAt: string;
};
```

---

## 4. 认证与会话

### 4.1 发起登录
`GET /api/v1/auth/login`
- 描述：重定向到学校 SSO 登录页。
- 响应：`302` 到 IdP。

### 4.2 登录回调
`GET /api/v1/auth/callback`
- 描述：IdP 回调，后端完成 Token 交换 / 验签，创建或更新本地用户。
- 响应：设置会话 Cookie，`302` 回到前端主页或原路径。

### 4.3 当前用户信息
`GET /api/v1/auth/me`
- 权限：已登录
- 响应：
```json
{
  "success": true,
  "data": { "id": "u_1", "sno": "2025123456", "name": "张三", "role": "student" }
}
```

### 4.4 退出登录
`POST /api/v1/auth/logout`
- 清除会话并可选重定向到 IdP 统一登出。

---

## 5. 教师 / 课程 / 排课查询

### 5.1 搜索教师
`GET /api/v1/teachers`
- 查询参数：
  - `q`：关键词（支持姓名、拼音、模糊）
  - `dept`：学院/系
  - `page`, `pageSize`
- 响应（含综合分）：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id":"t_1","name":"李四","dept":"计算机学院","title":"副教授",
        "aggregate":{"count":1000,"avg":4.9,"updatedAt":"2025-10-10T00:00:00Z"}
      }
    ],
    "page":1,"pageSize":20,"total":200
  }
}
```

### 5.2 查询教师详情
`GET /api/v1/teachers/{teacherId}`
- 响应：教师信息 + 历史综合分（全学期 与 最近学期对比）+ 热门标签。
```json
{
  "success": true,
  "data": {
    "id":"t_1","name":"李四","dept":"计算机学院","title":"副教授",
    "aggregates": {
      "overall": {"count": 1234, "avg": 4.8},
      "byTerm": [
        {"term":"2025-2026-1","count":300,"avg":4.9},
        {"term":"2024-2025-2","count":250,"avg":4.7}
      ]
    },
    "topTags": ["讲解清晰","作业适中","备考友好"]
  }
}
```

### 5.3 搜索课程
`GET /api/v1/courses`
- 查询参数：`q`, `dept`, `code`, `page`, `pageSize`
- 响应：课程列表 + 综合分（基于全部授课教师的聚合或最近学期）。

### 5.4 查询课程详情
`GET /api/v1/courses/{courseId}`
- 响应：课程信息 + 综合分 + 按教师分布的评分统计（便于对比）。

### 5.5 查询某学期的排课（Section）
`GET /api/v1/sections`
- 查询参数：`courseId?`, `teacherId?`, `term?`（默认当前学期）, `page`, `pageSize`
- 响应：Section 列表（可供学生定位自己要评价的节次）。

---

## 6. 评分（学生端）

### 6.1 创建或更新评分（幂等）
`POST /api/v1/ratings`
- 权限：`student`
- 描述：对当前用户的 `sectionId` 进行**幂等写入**（同一用户同一 section 限 1 条，重复提交即更新）。
- 请求：
```json
{
  "sectionId": "sec_123",
  "score": 4.5,
  "tags": ["讲解清晰","作业适中"],
  "comment": "内容扎实，期末范围明确",
  "isAnonymous": true
}
```
- 规则：
  - 分数范围 `1..5`，步长 `0.5`
  - 评语长度 `0..1000`
  - 处于评分窗口（由后台配置 `openAt` ~ `closeAt`）
  - 需要**在校网内**（后端中间件已限制）
- 响应：`201` + 新记录或更新后的记录。

### 6.2 查看我对某节次的评分（用于回显）
`GET /api/v1/ratings/my?sectionId=sec_123`
- 权限：`student`
- 响应：当前用户对该 section 的评分（若无则 `data=null`）。

### 6.3 删除我的评分
`DELETE /api/v1/ratings/{ratingId}`
- 权限：`student`
- 行为：软删除 `status=deleted`，并触发聚合回算。

### 6.4 查看某个教师的评分样本（公开展示用）
`GET /api/v1/ratings/by-teacher/{teacherId}`
- 查询：`page`, `pageSize`, `term?`, `sort?=newest|helpful`
- 响应：分页评语（隐去非匿名用户的身份信息，仅显示学期与标签）。

---

## 7. 综合分与统计

### 7.1 获取教师综合分
`GET /api/v1/aggregates/teacher/{teacherId}`
- 查询：`term?=latest|{YYYY-YYYY-N}`（默认 overall+latest 两套）
- 响应：
```json
{
  "success": true,
  "data": {
    "overall": {"count":1200,"avg":4.8},
    "latest": {"term":"2025-2026-1","count":300,"avg":4.9}
  }
}
```

### 7.2 获取课程综合分
`GET /api/v1/aggregates/course/{courseId}`

### 7.3 获取节次综合分
`GET /api/v1/aggregates/section/{sectionId}`

> **聚合策略**：默认算术平均；可扩展加权（例如按学期权重/按去极值处理），由配置项决定。

---

## 8. 标签与敏感词

### 8.1 获取系统标签集
`GET /api/v1/tags`
- 返回建议标签列表（用于前端快捷选择与统计）。

### 8.2 敏感词检测（后台）
- 写入评分时服务端进行文本检测（自研或接入内容安全服务），违规则 `400`：`{"code":"CONTENT_VIOLATION"}`。

---

## 9. 管理端（Admin）

### 9.1 批量导入教师/课程/排课
`POST /api/v1/admin/import`
- 权限：`admin`
- 请求：`multipart/form-data`，字段：`type=teacher|course|section` + `file`（CSV/Excel）
- 响应：任务 ID；后台异步处理，提供进度查询。

### 9.2 导入任务状态
`GET /api/v1/admin/import/{jobId}`

### 9.3 手动重算聚合
`POST /api/v1/admin/recompute`
- 权限：`admin`
- 说明：触发全量或指定范围聚合重算（例如导入后）。

### 9.4 评分申诉处理
`POST /api/v1/admin/ratings/{ratingId}/moderate`
- 请求：`{ "action":"hide|flag|restore", "reason":"..." }`

### 9.5 导出报表
`GET /api/v1/admin/export?scope=teacher|course|section&term=2025-2026-1&format=csv`
- 权限：`admin`

### 9.6 系统配置（评分窗口、阈值等）
`GET /api/v1/admin/config` / `PUT /api/v1/admin/config`
- 字段示例：
```json
{
  "ratingWindow": {"openAt":"2025-10-01T00:00:00Z","closeAt":"2025-12-31T23:59:59Z"},
  "minCommentLength": 0,
  "maxCommentLength": 1000,
  "ipWhitelistCIDR": ["10.0.0.0/8","172.16.0.0/12","192.168.0.0/16"],
  "aggregation": {"method":"mean","trimOutliers":true}
}
```

---

## 10. 错误码清单（节选）
| code | http | 说明 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 未登录或会话失效 |
| `FORBIDDEN` | 403 | 权限不足 |
| `IP_RESTRICTED` | 403 | 仅限校内访问 |
| `VALIDATION_ERROR` | 400 | 参数校验失败 |
| `RATING_WINDOW_CLOSED` | 400 | 当前不在评分开放期 |
| `SECTION_NOT_FOUND` | 404 | 节次不存在 |
| `ALREADY_DELETED` | 409 | 评分已删除 |
| `CONTENT_VIOLATION` | 400 | 触发敏感词或违规内容 |
| `IMPORT_IN_PROGRESS` | 409 | 导入任务重复或进行中 |
| `TOO_MANY_REQUESTS` | 429 | 触发频率限制 |

---

## 11. 安全与合规
- **CSRF**：同源 + `SameSite=Lax` + 非幂等接口要求 `CSRF-Token`/双提交 Cookie。
- **速率限制**：按 IP 与用户双纬度（如：`/ratings` 5 req/min）。
- **隐私**：展示层默认匿名化学生身份；管理员可在合规前提下审计原始数据。
- **日志**：审计日志记录敏感操作（导入、删除、屏蔽等）。
- **CORS**：前端与后端同域，或在反向代理层解决。

---

## 12. OpenAPI（精简 YAML）
> 可用于生成客户端 SDK；具体响应字段以上文为准。

```yaml
openapi: 3.0.3
info:
  title: 课程评分系统 API
  version: "1.0.0"
servers:
  - url: /api/v1
paths:
  /auth/me:
    get:
      summary: 当前用户信息
      responses:
        "200":
          description: OK
  /teachers:
    get:
      summary: 搜索教师
      parameters:
        - in: query
          name: q
          schema: { type: string }
        - in: query
          name: dept
          schema: { type: string }
        - in: query
          name: page
          schema: { type: integer, minimum: 1, default: 1 }
        - in: query
          name: pageSize
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
      responses:
        "200": { description: OK }
  /ratings:
    post:
      summary: 创建或更新评分
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                sectionId: { type: string }
                score: { type: number, minimum: 1, maximum: 5, multipleOf: 0.5 }
                tags: { type: array, items: { type: string } }
                comment: { type: string, maxLength: 1000 }
                isAnonymous: { type: boolean }
      responses:
        "201": { description: Created }
```

---

## 13. 前后端接口约定（要点）
- **前端**：所有写操作通过 `fetch('/api/v1/...', { credentials:'include' })`，自动附带 Cookie。
- **后端**：Next.js Route Handler 校验：IP 白名单 → 会话 → 角色 → 业务校验。
- **聚合缓存**：写入评分后用队列异步刷新 `Aggregate` 表，查询走缓存命中。

---

## 14. 开发任务映射（便于落地）
1. 中间件：`IPWhitelistMiddleware`（Edge/Node）  
2. 认证集成：OIDC Provider、回调、会话持久化  
3. Prisma 模型与迁移（User/Teacher/Course/Section/Rating/Aggregate）  
4. 教师/课程/节次查询 API（含综合分）  
5. 评分写/读/删 API（含窗口校验、敏感词检测）  
6. 聚合计算器与队列（BullMQ/Cloud Tasks）  
7. 管理端导入、重算、导出 API  
8. 报错与审计日志、速率限制、CSRF、防刷  
9. OpenAPI 生成与 SDK

---

## 15. 示例：IP 白名单（伪代码）
```ts
export function ipWhitelist(req, res, next) {
  const ip = req.headers['x-real-ip'] || extractFromXFF(req.headers['x-forwarded-for']) || req.socket.remoteAddress;
  if (!inCIDRs(ip, config.ipWhitelistCIDR)) {
    return res.status(403).json({ code: 'IP_RESTRICTED', message: 'Campus network required' });
  }
  next();
}
```

---

**文档落地建议**  
- 文件路径：`docs/api-spec.md`（即本文档）。  
- 推荐配套生成 `/openapi.yaml` 用于前端/测试联调与 SDK 生成。

