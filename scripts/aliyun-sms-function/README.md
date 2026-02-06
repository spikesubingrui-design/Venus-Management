# 阿里云短信云函数部署指南

## 前置条件

### 1. 开通阿里云短信服务
- 登录 [阿里云短信控制台](https://dysms.console.aliyun.com/)
- 完成实名认证

### 2. 创建短信签名
1. 进入「国内消息」→「签名管理」
2. 点击「添加签名」
3. 填写：
   - 签名名称：`金星幼儿园`
   - 适用场景：验证码
   - 签名来源：选择合适的类型
4. 等待审核通过（约1-2小时）

### 3. 创建短信模板
1. 进入「模板管理」→「添加模板」
2. 填写：
   - 模板名称：`登录验证码`
   - 模板类型：验证码
   - 模板内容：`您的验证码是${code}，5分钟内有效，请勿泄露给他人。`
3. 等待审核通过
4. **记录模板CODE**（如 SMS_123456789）

## 部署到阿里云函数计算

### 方式一：控制台部署（推荐新手）

1. 登录 [阿里云函数计算控制台](https://fcnext.console.aliyun.com/)

2. 创建服务：
   - 服务名称：`kindergarten-sms`
   - 描述：幼儿园短信服务

3. 创建函数：
   - 函数名称：`send-sms`
   - 运行环境：Node.js 16
   - 请求处理程序：index.handler
   - 代码来源：上传本目录的代码

4. 配置触发器：
   - 类型：HTTP触发器
   - 认证类型：无需认证
   - 请求方法：POST

5. 获取HTTP触发器URL，格式类似：
   ```
   https://xxx.cn-beijing.fc.aliyuncs.com/2016-08-15/proxy/kindergarten-sms/send-sms/
   ```

### 方式二：命令行部署

```bash
# 安装 Serverless Devs
npm install -g @serverless-devs/s

# 配置阿里云密钥
s config add

# 部署
s deploy
```

## 配置模板CODE

部署前，请修改 `index.js` 中的模板CODE：

```javascript
const CONFIG = {
  // ...
  templateCode: 'SMS_XXXXXXXX', // 替换为您的模板CODE
};
```

## 配置小程序

部署成功后，修改小程序的短信服务配置：

文件：`taro-app/src/services/smsService.ts`

```typescript
// 启用真实短信
const USE_REAL_SMS = true

// 配置云函数URL
const SMS_CONFIG = {
  functionUrl: '您的云函数HTTP触发器URL',
}
```

## 添加域名白名单

在微信公众平台添加云函数域名到合法域名列表：
- 域名格式：`https://xxx.cn-beijing.fc.aliyuncs.com`

## 测试

```bash
# 发送验证码
curl -X POST https://your-function-url/ \
  -H "Content-Type: application/json" \
  -d '{"action":"send","phone":"13800138000"}'

# 验证验证码
curl -X POST https://your-function-url/ \
  -H "Content-Type: application/json" \
  -d '{"action":"verify","phone":"13800138000","code":"123456"}'
```

## 费用说明

- 短信费用：约 0.045元/条
- 函数计算：有免费额度，正常使用基本免费

## 注意事项

1. 短信签名和模板需要审核通过才能使用
2. 首次使用需要充值短信余额
3. 建议设置发送频率限制，防止恶意刷短信
