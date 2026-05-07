# 🚀 AIGC_Demo

一个基于 Next.js 与 Supabase 的交互式 AIGC 工作流项目，支持真实的大模型分析、联网趋势检索、文生图与图生视频流程。

本仓库当前提供一条完整的生成链路：

- 👤 匿名用户会话初始化
- ✍️ 提示词提交
- 🧠 DeepSeek 提示词分析与增强
- 🔎 DashScope 联网趋势检索
- 🗂️ Supabase 知识库检索与结果持久化
- 🖼️ DashScope 文生图
- 🎬 DashScope 图生视频
- 📜 分步骤历史记录追踪

## ✨ 效果展示

### 图片效果

![国际都市](./showcase/global-city.png)

![大厦俯瞰](./showcase/tower-overview.png)

![君临天下](./showcase/rule-the-world.png)

![君临天下2](./showcase/rule-the-world-2.png)

![奇幻通话](./showcase/fantasy-call.png)

![赛博朋克](./showcase/cyberpunk.png)

### 视频效果

GitHub README 对本地视频内嵌的支持有限，仓库中保留了完整视频文件，下面提供可直接点击的预览入口：

### UI 展示视频

由于 UI 展示视频文件较大，GitHub README 中不适合直接内嵌播放。

可通过以下链接查看或下载完整展示视频：

- [下载 UI 展示视频](./results/ui-demo/aigc-ui-demo.mp4)

[![君临天下视频预览](./showcase/rule-the-world.png)](./showcase/rule-the-world.mp4)

[![奇幻通话视频预览](./showcase/fantasy-call.png)](./showcase/fantasy-call.mp4)

[![赛博朋克视频预览](./showcase/cyberpunk.png)](./showcase/cyberpunk.mp4)

- [打开赛博城市视频结果](./showcase/cyber-city.mp4)

## 📌 当前能力

### ✅ 已实现

- Next.js 前端页面与 API 路由
- 基于 Supabase 的生成记录、历史记录、配置项、知识库数据结构
- Supabase 匿名登录流程
- 通过 `/api/generate/[id]` 轮询生成状态
- 使用 DeepSeek 进行结构化提示词分析
- 使用 DashScope 联网搜索能力获取趋势信息
- 使用 DeepSeek 结合趋势结果和知识库内容增强提示词
- 使用 DashScope 文生图生成真实图片结果
- 使用 DashScope 图生视频生成真实视频结果

### ⚠️ 使用前提

- 你需要准备可用的 `DASHSCOPE_API_KEY`
- 你需要准备可用的 `DEEPSEEK_API_KEY`
- 你需要在 Supabase 中执行仓库提供的数据库结构脚本
- 图片和视频生成会消耗真实的模型调用额度

## 🧰 技术栈

- Next.js 14
- React 18
- Supabase
- PostgreSQL
- DeepSeek API
- DashScope API

## 📁 项目结构

```text
AIGC_Demo/
├── pages/
│   ├── index.js
│   └── api/
│       ├── configs.js
│       ├── generate.js
│       ├── health.js
│       ├── history.js
│       └── generate/[id].js
├── lib/
│   ├── env.js
│   ├── providers.js
│   └── supabase.js
├── results/
│   ├── *.png
│   └── *.mp4
├── scripts/
│   └── setup-database.js
├── supabase/
│   └── schema.sql
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
└── package.json
```

## ✅ 运行要求

- Node.js 18 或更高版本
- npm
- 一个可用的 Supabase 项目
- 一个可用的 DashScope API Key
- 一个可用的 DeepSeek API Key

## ⚡ 快速开始

### 1. 📥 克隆仓库

```bash
git clone https://github.com/<your-username>/AIGC_Demo.git
cd AIGC_Demo
```

### 2. 📦 安装依赖

```bash
npm install
```

### 3. 🔐 配置环境变量

将 `.env.example` 复制为 `.env.local`，然后填写你自己的配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DASHSCOPE_API_KEY=your_dashscope_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DASHSCOPE_TEXT_MODEL=qwen-plus
DASHSCOPE_IMAGE_MODEL=wanx2.1-t2i-turbo
DASHSCOPE_VIDEO_MODEL=wanx2.1-i2v-turbo
DASHSCOPE_TEXT_VIDEO_MODEL=wanx2.1-t2v-turbo
APP_BASE_URL=http://localhost:3000
```

其中：

- `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 为 Supabase 相关配置
- `DASHSCOPE_API_KEY` 为阿里云百炼 / DashScope 密钥
- `DEEPSEEK_API_KEY` 为 DeepSeek 密钥
- `DASHSCOPE_TEXT_VIDEO_MODEL` 用于仅视频模式的文生视频模型，不填写时会使用默认值

### 4. 🗄️ 初始化数据库结构

打开 Supabase 的 SQL Editor，执行 [supabase/schema.sql](./supabase/schema.sql) 中的内容。

执行完成后，可运行以下命令检查数据库是否准备就绪：

```bash
npm run db:setup
```

这个脚本只负责检查数据库是否可用，不会自动创建数据表。

### 5. ▶️ 启动项目

```bash
npm run dev
```

启动后访问 [http://localhost:3000](http://localhost:3000)。

## 🔄 工作流说明

1. 👤 前端初始化 Supabase 匿名会话。
2. ✍️ 用户提交提示词到 `POST /api/generate`。
3. 🧠 后端调用 DeepSeek 对提示词做结构化分析，判断风格、关键词、搜索意图与负面提示词。
4. 🔎 后端调用 DashScope 联网搜索获取趋势信息。
5. 🗂️ 后端从 Supabase 知识库中检索相关风格模板。
6. ✨ 后端再次调用 DeepSeek，把原始提示词、趋势结果和知识库内容整合为增强提示词。
7. 🖼️ 后端调用 DashScope 文生图接口生成图片。
8. 🎬 如果用户勾选视频，后端继续调用 DashScope 图生视频接口生成视频。
9. 📡 前端通过 `GET /api/generate/[id]` 轮询状态并展示结果。

## 🌐 API 一览

- `POST /api/generate`
  发起一次生成任务。
- `GET /api/generate/[id]`
  获取生成状态与历史步骤。
- `GET /api/history`
  获取某个用户的生成历史。
- `GET /api/configs`
  获取某个用户保存的配置。
- `POST /api/configs`
  保存用户配置。
- `GET /api/health`
  检查数据库状态与模型服务环境变量状态。

## 🧪 关键实现说明

- `pages/api/generate.js`
  负责串联 DeepSeek 分析、DashScope 搜索、Supabase 知识库检索、DeepSeek 提示词增强、DashScope 图片生成、DashScope 视频生成。
- `lib/providers.js`
  封装了 DeepSeek 与 DashScope 的具体调用逻辑，以及 DashScope 异步任务轮询逻辑。
- `scripts/setup-database.js`
  是 Supabase 就绪检查脚本，不是迁移脚本。

## ⚠️ 注意事项

- DashScope 图片与视频模型名称可能会随官方升级变化，如果你账号当前默认模型不同，可以通过 `.env.local` 覆盖默认模型名称。
- 图生视频通常比文生图耗时更长，前端会持续轮询直到任务完成或失败。
- 如果 API Key 无效、额度不足或模型无权限，生成任务会在历史步骤中标记失败并返回错误信息。

## 🖼️ 截图说明

`results/` 目录中已包含可直接用于 GitHub 仓库展示的图片与视频成品素材。

## 📬 联系方式

如需交流项目、反馈问题或合作沟通，可联系：

- `15193540213@163.com`

## 📄 许可证

本项目采用 MIT License，详见 [LICENSE](./LICENSE)。
