# 贡献指南

感谢你对 AIGC_Demo 项目的关注。

## 🌟 如何贡献

### 报告问题

如果你发现了 Bug，请先：

1. 查看 [Issues](https://github.com/your-username/AIGC_Demo/issues) 中是否已经有类似问题。
2. 如果没有，请新建 Issue，并尽量包含以下信息：
   - 清晰的标题
   - 问题描述
   - 复现步骤
   - 预期结果与实际结果
   - 运行环境信息
   - 截图或错误日志

### 提交功能改进

1. 先创建 Issue 说明你的想法。
2. 与维护者确认方向后再开始开发。
3. 保持改动聚焦，避免把多个不相关功能混在同一个 PR 中。

## 🔧 开发流程

### 1. Fork 仓库

```bash
git clone https://github.com/your-username/AIGC_Demo.git
cd AIGC_Demo
```

### 2. 创建分支

```bash
git checkout -b feature/your-feature-name
```

或：

```bash
git checkout -b fix/your-bug-fix
```

### 3. 安装依赖

```bash
npm install
```

### 4. 配置环境变量

复制 `.env.example` 为 `.env.local`，并填写以下关键变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHSCOPE_API_KEY`
- `DEEPSEEK_API_KEY`
- `DASHSCOPE_TEXT_VIDEO_MODEL`（可选）

### 5. 初始化数据库

在 Supabase SQL Editor 中执行 `supabase/schema.sql`。

然后运行：

```bash
npm run db:setup
```

### 6. 启动项目

```bash
npm run dev
```

## 🧱 代码约定

### JavaScript / React

- 优先使用函数式组件与 Hooks
- 保持模块职责单一
- 新增服务接入逻辑时，优先放到 `lib/` 中复用
- 对复杂流程增加简洁但有信息量的注释

### 文件命名

- 页面组件：按 Next.js 目录结构组织
- 工具与服务模块：使用清晰的小写语义命名
- API 路由：按资源职责拆分

### 提交信息建议

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `refactor:` 重构
- `chore:` 构建、脚本、配置调整

示例：

```bash
git commit -m "feat: add real DashScope image and video generation flow"
```

## 🧪 测试建议

当前仓库还没有完整的自动化测试，请至少确认：

- 项目可以成功启动
- 主页可以正常完成匿名登录
- 提示词提交流程可正常创建生成任务
- 图片生成可以返回真实结果
- 视频生成在开启选项后可以完成任务
- `/api/health` 能正确反映数据库与模型配置状态

## 📚 文档同步

如果你的改动涉及以下内容，请同步更新文档：

- 能力变更：更新 `README.md`
- 环境变量变更：更新 `.env.example`
- 数据结构变更：更新 `supabase/schema.sql`

## 🎯 当前优先方向

欢迎围绕以下方向继续完善项目：

1. 提升提示词分析与增强质量
2. 优化 DashScope 图片与视频生成参数
3. 增强前端任务进度展示
4. 增加失败重试、超时处理与任务取消能力
5. 为关键流程补充自动化测试

## 🤝 行为准则

- 尊重协作者
- 保持沟通清晰
- 欢迎建设性反馈
- 优先解决真实可复现的问题
