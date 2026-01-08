# 🚀 金星教育系统 - 立即部署

## 构建状态：✅ 已完成

生产文件已准备就绪：`dist/` 目录

---

## 方式一：Vercel 部署（推荐，最简单）

### 步骤 1：登录 Vercel
1. 打开 https://vercel.com/
2. 点击 "Sign Up" 或 "Log In"（支持 GitHub/GitLab/邮箱登录）

### 步骤 2：导入项目
1. 点击 "Add New..." → "Project"
2. 选择 "Import Git Repository" 或 "Upload Folder"
3. 如果选择 **Upload Folder**：直接拖拽 `dist` 文件夹上传

### 步骤 3：配置环境变量
在 Vercel 项目设置中添加以下环境变量：

| 变量名 | 值 |
|--------|-----|
| `API_KEY` | `4af189ab-83aa-4a05-8e97-9104e9a9fcf6` |

### 步骤 4：部署
点击 "Deploy" 按钮，等待 1-2 分钟即可上线！

---

## 方式二：Netlify 部署

### 步骤 1：登录 Netlify
1. 打开 https://app.netlify.com/
2. 点击 "Sign up" 或 "Log in"

### 步骤 2：拖拽部署
1. 在 Netlify 首页，找到 "Sites" 区域
2. 直接将 `dist` 文件夹拖拽到页面上

### 步骤 3：配置环境变量
1. 进入项目设置 → Build & deploy → Environment
2. 添加环境变量：
   - `API_KEY` = `4af189ab-83aa-4a05-8e97-9104e9a9fcf6`

### 步骤 4：重新部署
触发重新部署以应用环境变量

---

## 方式三：命令行部署（需要登录）

### Vercel
```powershell
npx vercel login
npx vercel --prod
```

### Netlify
```powershell
npx netlify login
npx netlify deploy --prod --dir=dist
```

---

## ⚡ 环境变量清单

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `API_KEY` | 豆包 API Key | ✅ |
| `SUPABASE_URL` | Supabase 项目 URL | ❌（暂未使用） |
| `SUPABASE_ANON_KEY` | Supabase 匿名 Key | ❌（暂未使用） |

---

## 🎉 部署完成后

你将获得一个类似以下的网址：
- Vercel: `https://your-project.vercel.app`
- Netlify: `https://your-project.netlify.app`

这就是你的软件上线地址！

---

## 需要帮助？

如果遇到问题，请提供错误截图，我可以帮你解决。




