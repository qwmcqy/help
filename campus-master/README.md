校园“万事达”——互助与众包任务平台（课程设计）

技术栈：Next.js（App Router） + Supabase（Auth/Postgres/RLS/Realtime） + Vercel（推荐部署）

## 功能范围（最小闭环）

- RBAC：需求方 / 接单方 / 管理员
- 任务状态机：待接单 → 进行中 → 待验收 → 已完成；任意阶段可进入争议中
- 资金托管：发布冻结、完成划拨、流水记录（通过 Postgres 函数保证原子性）
- 实时通知：基于 Supabase Realtime 订阅 `notifications`
- AI 辅助审核（可选）：配置 `OPENAI_API_KEY` 后调用大模型识别任务描述中的违规、暴力、违法交易等风险，并给出风险等级、命中类别和人工复核建议

## 本地运行

1) 安装依赖：

```bash
npm install
```

2) 配置 Supabase：

- 在 Supabase 创建项目
- 在 SQL Editor 执行 [supabase/schema.sql](supabase/schema.sql)
- 复制 `.env.example` 为 `.env.local`，填入：
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `OPENAI_API_KEY`（可选，启用 AI 辅助审核）
	- `OPENAI_MODEL`（可选，默认 `gpt-4o-mini`）
	- `OPENAI_BASE_URL`（可选，默认 OpenAI；使用 DeepSeek 时填 `https://api.deepseek.com`）

DeepSeek 配置示例：

```env
OPENAI_API_KEY=你的_DeepSeek_API_Key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-v4-flash
```

细节见 [supabase/SETUP.md](supabase/SETUP.md)

3) 启动：

```bash
npm run dev
```

打开 `http://localhost:3000`

## 部署到 Vercel（推荐）

- 将项目导入 Vercel
- 在 Vercel Project Settings → Environment Variables 配置与本地相同的环境变量
- 构建命令：`npm run build`；输出目录由 Next.js 自动识别

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
