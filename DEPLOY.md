# 金星教育系统 - 部署指南

## 🚀 快速部署

### 方式一：Vercel（推荐，免费）

1. **注册 Vercel 账号**
   - 访问 https://vercel.com
   - 使用 GitHub/GitLab 账号登录

2. **导入项目**
   ```bash
   # 安装 Vercel CLI
   npm i -g vercel
   
   # 登录
   vercel login
   
   # 部署
   cd "E:\Spike\03_Work_Business\Projects\金星幼儿园\Gemini"
   vercel --prod
   ```

3. **配置环境变量**
   - 在 Vercel 控制台 → Settings → Environment Variables
   - 添加：
     - `API_KEY`: 你的 Gemini API 密钥
     - `SUPABASE_URL`: Supabase URL（可选）
     - `SUPABASE_ANON_KEY`: Supabase 匿名密钥（可选）

4. **绑定自定义域名**
   - Vercel 控制台 → Settings → Domains
   - 添加你的域名，按提示配置 DNS

---

### 方式二：Netlify（免费）

1. **注册 Netlify 账号**
   - 访问 https://netlify.com

2. **部署**
   ```bash
   # 安装 Netlify CLI
   npm i -g netlify-cli
   
   # 登录
   netlify login
   
   # 构建
   npm run build
   
   # 部署
   netlify deploy --prod --dir=dist
   ```

3. **配置环境变量**
   - Netlify 控制台 → Site settings → Environment variables

---

### 方式三：GitHub Pages（免费）

1. **创建 GitHub 仓库**

2. **修改 vite.config.ts**
   ```typescript
   base: '/your-repo-name/',
   ```

3. **添加 GitHub Actions**
   创建 `.github/workflows/deploy.yml`

4. **推送代码**
   ```bash
   git push origin main
   ```

---

### 方式四：自托管服务器

1. **构建项目**
   ```bash
   npm run build
   ```

2. **部署 dist 文件夹**
   - 使用 Nginx/Apache 托管
   - 配置 SPA 路由重定向

**Nginx 配置示例：**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/kidda-system/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 启用 Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

---

## 🔧 环境变量配置

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `API_KEY` | 是 | Google Gemini AI API 密钥 |
| `SUPABASE_URL` | 否 | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | 否 | Supabase 匿名密钥 |

### 获取 Gemini API 密钥
1. 访问 https://makersuite.google.com/app/apikey
2. 创建新的 API 密钥
3. 复制密钥到环境变量

### 获取 Supabase 配置（可选）
1. 访问 https://supabase.com
2. 创建新项目
3. 在 Settings → API 获取 URL 和 anon key

---

## 📱 首次使用

1. 访问部署后的网址
2. 系统会提示初始化设置
3. 输入管理员手机号和验证码
4. 创建超级管理员账号
5. 登录后配置园区信息

---

## 🔒 安全建议

- [ ] 启用 HTTPS
- [ ] 配置 CSP 头
- [ ] 定期备份数据
- [ ] 接入真实短信验证服务
- [ ] 配置防火墙规则

---

## 📞 技术支持

如有问题，请联系技术支持。








