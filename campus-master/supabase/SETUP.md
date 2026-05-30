# Supabase 设置（本项目）

1. 在 Supabase 创建项目
2. 打开 **SQL Editor**，执行 [schema.sql](schema.sql)
3. 在 Supabase 控制台获取：
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 复制 `.env.example` 为 `.env.local` 并填写
5. （可选）把某个用户设为管理员：

```sql
update public.profiles set role='admin' where id = '<user_uuid>';
```

6. 前端本地启动：

```bash
npm run dev
```

## 已有项目升级

如果数据库已经执行过旧版 `schema.sql`，请在 Supabase SQL Editor 额外执行：

- [patches/20260530_security_and_audit_visibility.sql](patches/20260530_security_and_audit_visibility.sql)

该补丁会阻止普通用户将自己提升为管理员，并允许任务双方查看 AI 审核结果。

## 凭证图片上传（Storage）

- 本项目使用 Storage bucket：`task-evidence`（在 [schema.sql](schema.sql) 中已包含创建与 RLS 策略）
- 上传路径约定：`{taskId}/{userId}/{timestamp}-{filename}`
- 读取策略：仅任务参与者（需求方/接单方）与管理员可读；写入策略：仅接单方在 `in_progress` 状态可上传

## 私聊（Realtime + 通知）

- 数据表：`public.conversations`（按任务 1:1）、`public.messages`（消息明细）
- 权限：RLS 限定仅任务双方可读写消息
- 实时：前端使用 Realtime 订阅 `public.messages` 的 INSERT（用于聊天窗口自动刷新）
   - 若你在 Supabase 控制台里关闭了 Postgres Changes，需要在 Database → Replication（或 Realtime）里把 `messages` 表加入发布列表
- 通知：`messages` 插入后会触发写入 `public.notifications`（对方会在顶部“最新通知”实时看到）

## 违约 / 超时（自动判定 + 扣分）

- 取消任务：RPC `public.cancel_task(task_id, reason)`
   - 会退款（解冻到需求方余额）并将任务标记为 `canceled`
   - 若“接单后取消”，系统会记录违约并扣信用分（接单方 -2；需求方 -1）
- 超时自动判定：RPC `public.auto_finalize_tasks()`（仅 `service_role` 可调用）
   - `in_progress` 超时（默认 24h）：接单方未推进 → 任务重新开放（回到 `open`，清空 helper），接单方记违约 -2
   - `awaiting_acceptance` 超时（默认 24h）：需求方超时未验收 → 系统自动确认完成并支付，需求方记违约 -1

### 定时触发（推荐：Vercel Cron）

项目提供了一个受 `CRON_SECRET` 保护的入口：

- `GET /api/cron/auto-finalize?key=YOUR_CRON_SECRET`

配置步骤：

1. 在部署环境配置环境变量：`SUPABASE_SERVICE_ROLE_KEY` 与 `CRON_SECRET`
2. 在 Vercel Cron 里配置每 10~30 分钟请求一次上述 URL

本地手动触发（示例）：

```bash
curl "http://localhost:3000/api/cron/auto-finalize?key=YOUR_CRON_SECRET"
```
