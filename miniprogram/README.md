# 金星幼儿园微信小程序

## 使用说明

### 1. 注册小程序账号
1. 打开 https://mp.weixin.qq.com/
2. 点击「立即注册」→「小程序」
3. 选择「企业」主体
4. 填写企业信息完成注册

### 2. 获取 AppID
1. 登录小程序后台
2. 左侧菜单「开发」→「开发管理」→「开发设置」
3. 复制 AppID

### 3. 配置业务域名
⚠️ **重要：必须先完成此步骤**

1. 登录小程序后台
2. 「开发」→「开发管理」→「开发设置」
3. 找到「业务域名」，点击「开始配置」
4. 下载校验文件，上传到你的网站根目录
5. 添加你的网站域名（必须是 https）

### 4. 修改代码中的域名
打开 `pages/index/index.js`，修改 `webUrl` 为你的网站地址：
```javascript
webUrl: 'https://你的网站域名'
```

### 5. 下载微信开发者工具
下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

### 6. 导入项目
1. 打开微信开发者工具
2. 点击「导入项目」
3. 选择 `miniprogram` 文件夹
4. 填写你的 AppID
5. 点击「导入」

### 7. 上传发布
1. 在开发者工具中点击「上传」
2. 填写版本号和备注
3. 登录小程序后台提交审核

## 文件结构
```
miniprogram/
├── app.js          # 小程序入口
├── app.json        # 小程序配置
├── app.wxss        # 全局样式
├── project.config.json  # 项目配置
├── sitemap.json    # 搜索配置
└── pages/
    └── index/
        ├── index.js    # 页面逻辑
        ├── index.json  # 页面配置
        ├── index.wxml  # 页面结构
        └── index.wxss  # 页面样式
```
