/**
 * 部署到阿里云OSS的脚本
 * 使用方法: node scripts/deploy-oss.js
 */

import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 阿里云OSS配置 - 使用与数据存储相同的凭证
const config = {
  region: 'oss-cn-beijing',
  bucket: 'venus-management',  // 静态网站托管的bucket
  accessKeyId: 'LTAI5t8bGTe6ZJAuKSQXi3Di',
  accessKeySecret: 'eu2urgQIcJ6eK0s87UkZLEbgk1qacj',
};

const client = new OSS(config);

// 递归获取目录下所有文件
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });
  
  return arrayOfFiles;
}

// 根据文件扩展名获取Content-Type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };
  return types[ext] || 'application/octet-stream';
}

async function deploy() {
  const distPath = path.join(__dirname, '..', 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ dist 目录不存在！请先运行 npm run build');
    process.exit(1);
  }
  
  console.log('🚀 开始部署到阿里云OSS...');
  console.log(`📦 Bucket: ${config.bucket}`);
  console.log(`🌍 Region: ${config.region}`);
  console.log('');
  
  // 先删除旧文件
  console.log('🗑️ 清理旧文件...');
  try {
    const listResult = await client.list();
    if (listResult.objects && listResult.objects.length > 0) {
      const deleteNames = listResult.objects.map(obj => obj.name);
      await client.deleteMulti(deleteNames);
      console.log(`   已删除 ${deleteNames.length} 个旧文件`);
    }
  } catch (err) {
    console.log('   无旧文件需要清理');
  }
  console.log('');
  
  const files = getAllFiles(distPath);
  let successCount = 0;
  let failCount = 0;
  
  for (const filePath of files) {
    const relativePath = path.relative(distPath, filePath).replace(/\\/g, '/');
    const contentType = getContentType(filePath);
    
    try {
      // 读取文件内容
      const fileContent = fs.readFileSync(filePath);
      
      // 使用 Buffer 上传，明确指定 Content-Type
      const result = await client.put(relativePath, fileContent, {
        mime: contentType.split(';')[0].trim(), // 只取 MIME 类型部分
        headers: {
          'Content-Type': contentType,
          'Cache-Control': relativePath === 'index.html' ? 'no-cache, no-store, must-revalidate' : 'max-age=31536000',
        }
      });
      
      console.log(`✅ ${relativePath}`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   URL: ${result.url}`);
      successCount++;
    } catch (err) {
      console.error(`❌ ${relativePath}: ${err.message}`);
      failCount++;
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`📊 部署完成: ${successCount} 成功, ${failCount} 失败`);
  console.log('');
  console.log('🌐 访问地址:');
  console.log(`   http://${config.bucket}.${config.region}.aliyuncs.com/index.html`);
  console.log('═══════════════════════════════════════');
}

deploy().catch(err => {
  console.error('部署失败:', err);
  process.exit(1);
});

