# 金星教育系统 - 生产环境上线指南

本文档将指导你完成软件的完整上线流程，让所有功能真实可用。

---

## 📋 上线前准备清单

| 项目 | 是否必需 | 用途 |
|------|---------|------|
| Google Gemini API Key | ✅ 必需 | AI 功能（食谱生成、AI 助手） |
| Supabase 项目 | ✅ 必需 | 云端数据库、用户验证 |
| 阿里云短信服务 | 可选 | 真实短信验证码 |
| 域名 | 可选 | 自定义访问地址 |

---

## 🚀 步骤一：获取 Google Gemini API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 使用 Google 账号登录
3. 点击 "Create API Key"
4. 复制生成的 API Key

**费用说明**：Gemini API 有免费额度，小规模使用无需付费。

---

## 🗄️ 步骤二：配置 Supabase 云端数据库

### 2.1 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com) 并注册账号
2. 点击 "New Project"
3. 填写项目名称（如：jinxing-edu）
4. 设置数据库密码（请记住！）
5. 选择区域（推荐：Singapore 或 Tokyo）
6. 等待项目创建完成（约 2 分钟）

### 2.2 创建数据库表

1. 在 Supabase Dashboard 中，点击左侧 "SQL Editor"
2. 点击 "New Query"
3. 复制 `supabase/schema.sql` 文件的全部内容
4. 粘贴到 SQL Editor 中
5. 点击 "Run" 执行

### 2.3 获取 API 密钥

1. 在 Dashboard 左侧点击 "Settings"（齿轮图标）
2. 点击 "API"
3. 复制以下信息：
   - **Project URL**：类似 `https://xxx.supabase.co`
   - **anon public key**：一长串字符

---

## 📱 步骤三：配置短信验证码服务（可选）

如果需要真实的短信验证码，请配置阿里云短信服务。

### 3.1 开通阿里云短信服务

1. 访问 [阿里云短信服务](https://dysms.console.aliyun.com)
2. 开通服务（需实名认证）
3. 申请短信签名（如："金星教育"）
4. 申请短信模板，内容示例：
   ```
   您的验证码是${code}，有效期5分钟，请勿泄露。
   ```
5. 等待审核通过（通常 1-2 小时）

### 3.2 创建 AccessKey

1. 访问 [阿里云 RAM 控制台](https://ram.console.aliyun.com)
2. 创建一个子用户
3. 授予 "AliyunDysmsFullAccess" 权限
4. 创建并保存 AccessKey ID 和 Secret

### 3.3 部署 Supabase Edge Functions

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 关联项目（从 Dashboard 获取 Project Reference ID）
supabase link --project-ref your-project-ref

# 设置短信服务密钥
supabase secrets set ALIYUN_ACCESS_KEY=your_access_key
supabase secrets set ALIYUN_SECRET_KEY=your_secret_key
supabase secrets set SMS_SIGN_NAME=金星教育
supabase secrets set SMS_TEMPLATE_CODE=SMS_xxxxxx

# 部署函数
supabase functions deploy send-sms
supabase functions deploy verify-code
```

---

## ⚙️ 步骤四：配置环境变量

### 本地开发

1. 复制 `env.example` 为 `.env`
2. 填入你获取的密钥：

```env
API_KEY=你的_Gemini_API_Key
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_ANON_KEY=你的_anon_key
NODE_ENV=development
```

### Vercel 部署

1. 在 Vercel Dashboard 中打开你的项目
2. 进入 Settings → Environment Variables
3. 添加以下变量：
   - `API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

---

## 🌐 步骤五：部署到生产环境

### 方式一：Vercel（推荐）

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

首次部署会询问项目配置，按提示操作即可。

### 方式二：Netlify

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 构建并部署
npm run build
netlify deploy --prod --dir=dist
```

---

## 🔧 步骤六：首次初始化

1. 访问你部署后的网址
2. 系统会显示"系统初始化"页面
3. 输入管理员手机号
4. 获取验证码（开发模式会直接显示）
5. 点击"初始化系统"
6. 创建成功后自动登录

---

## ✅ 功能验证清单

上线后请验证以下功能：

- [ ] 短信验证码能正常发送和验证
- [ ] 用户注册和登录正常
- [ ] 数据能保存到云端
- [ ] AI 食谱生成功能正常
- [ ] AI 助手能正常对话
- [ ] 数据在不同设备间同步

---

## 🛡️ 安全建议

1. **保护 API 密钥**：不要将密钥提交到代码仓库
2. **启用 HTTPS**：Vercel/Netlify 默认启用
3. **定期备份数据**：可通过 Supabase Dashboard 导出
4. **监控异常**：关注 Supabase 的日志和告警

---

## 💰 费用说明

| 服务 | 免费额度 | 超出后费用 |
|------|---------|-----------|
| Gemini API | 每分钟 60 次请求 | 按量付费 |
| Supabase | 500MB 数据库 / 1GB 带宽 | $25/月起 |
| Vercel | 100GB 带宽 / 无限部署 | $20/月起 |
| 阿里云短信 | 无免费额度 | 约 0.04 元/条 |

对于幼儿园规模，免费额度通常足够使用。

---

## 🆘 常见问题

### Q: 验证码发送失败？
A: 检查阿里云短信签名和模板是否审核通过。

### Q: AI 功能无响应？
A: 确认 API_KEY 配置正确，检查是否超出调用限制。

### Q: 数据没有同步？
A: 确认 Supabase 配置正确，检查网络连接。

### Q: 部署后页面空白？
A: 检查构建日志是否有错误，确认环境变量已配置。

---

## 📞 技术支持

如有问题，请联系开发团队。




