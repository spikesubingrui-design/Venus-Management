/**
 * Excel 数据导入脚本
 * 将学校真实数据从 Excel 导入到阿里云 OSS
 * 
 * 运行方式: node import-excel-to-oss.js
 */

const XLSX = require('xlsx');
const path = require('path');
const OSS = require('ali-oss');

// 阿里云 OSS 配置
const OSS_CONFIG = {
  region: 'oss-cn-beijing',
  accessKeyId: 'LTAI5t8bGTe6ZJAuKSQXi3Di',
  accessKeySecret: 'eu2urgQIcJ6eK0s87UkZLEbgk1qacj',
  bucket: 'venus-data',
};

// 分批配置
const BATCH_SIZE = 200;

// 创建 OSS 客户端
const client = new OSS(OSS_CONFIG);

// Excel 文件路径
const staffFile = path.join(__dirname, '外界信息', '学校档案（data）', '1.教职工通讯录.xlsx');
const studentFile = path.join(__dirname, '外界信息', '学校档案（data）', '2.学生模板.xlsx');

/**
 * 解析教职工数据
 */
function parseStaffData() {
  console.log('\n📋 解析教职工通讯录...');
  
  try {
    const workbook = XLSX.readFile(staffFile);
    const allStaff = [];
    
    workbook.SheetNames.forEach(sheetName => {
      console.log(`  处理工作表: ${sheetName}`);
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      if (rows.length < 2) return;
      
      // 第一行是表头
      const headers = rows[0];
      console.log(`  表头: ${JSON.stringify(headers)}`);
      
      // 解析数据行
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || !row[0]) continue;
        
        // 尝试匹配常见字段
        const staff = {
          id: `staff_${Date.now()}_${i}`,
          name: findValue(headers, row, ['姓名', '名字', 'name']),
          phone: findValue(headers, row, ['电话', '手机', '联系电话', 'phone', '手机号']),
          position: findValue(headers, row, ['职位', '岗位', '职务', 'position']),
          department: findValue(headers, row, ['部门', '科室', 'department']) || sheetName,
          campus: findValue(headers, row, ['园所', '校区', 'campus']) || '金星幼儿园',
          entryDate: findValue(headers, row, ['入职日期', '入职时间', '入职']),
          status: '在职',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        // 只有有姓名的才加入
        if (staff.name) {
          allStaff.push(staff);
        }
      }
    });
    
    console.log(`  ✅ 共解析 ${allStaff.length} 条教职工数据`);
    return allStaff;
  } catch (e) {
    console.error('  ❌ 解析教职工数据失败:', e.message);
    return [];
  }
}

/**
 * 解析学生数据
 */
function parseStudentData() {
  console.log('\n📋 解析学生数据...');
  
  try {
    const workbook = XLSX.readFile(studentFile);
    const allStudents = [];
    
    workbook.SheetNames.forEach(sheetName => {
      console.log(`  处理工作表: ${sheetName}`);
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      if (rows.length < 2) return;
      
      // 第一行是表头
      const headers = rows[0];
      console.log(`  表头: ${JSON.stringify(headers)}`);
      
      // 解析数据行
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || !row[0]) continue;
        
        const student = {
          id: `student_${Date.now()}_${i}`,
          name: findValue(headers, row, ['姓名', '学生姓名', '幼儿姓名', 'name']),
          gender: findValue(headers, row, ['性别', 'gender']),
          birthDate: findValue(headers, row, ['出生日期', '生日', '出生年月', 'birthday']),
          className: findValue(headers, row, ['班级', '所在班级', 'class']) || sheetName,
          enrollmentDate: findValue(headers, row, ['入园日期', '入学日期', '入园时间']),
          parentName: findValue(headers, row, ['家长姓名', '父母姓名', '监护人']),
          parentPhone: findValue(headers, row, ['家长电话', '联系电话', '手机', 'phone']),
          address: findValue(headers, row, ['家庭地址', '住址', '地址']),
          campus: findValue(headers, row, ['园所', '校区']) || '金星幼儿园',
          status: '在读',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        // 只有有姓名的才加入
        if (student.name) {
          allStudents.push(student);
        }
      }
    });
    
    console.log(`  ✅ 共解析 ${allStudents.length} 条学生数据`);
    return allStudents;
  } catch (e) {
    console.error('  ❌ 解析学生数据失败:', e.message);
    return [];
  }
}

/**
 * 在表头中查找匹配的值
 */
function findValue(headers, row, possibleNames) {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => 
      h && h.toString().includes(name)
    );
    if (index >= 0 && row[index] !== undefined) {
      const value = row[index];
      // 处理日期
      if (typeof value === 'number' && value > 30000 && value < 50000) {
        // Excel 日期序列号
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
      }
      return String(value).trim();
    }
  }
  return '';
}

/**
 * 分批上传数据到 OSS
 */
async function uploadToOSS(storageKey, data) {
  if (data.length === 0) {
    console.log(`  ⏭️ ${storageKey}: 无数据，跳过`);
    return true;
  }

  console.log(`\n📤 上传 ${storageKey} (${data.length}条)...`);

  // 小数据直接上传
  if (data.length <= BATCH_SIZE) {
    try {
      const filePath = `jinxing-edu/${storageKey}.json`;
      await client.put(filePath, Buffer.from(JSON.stringify(data, null, 2)));
      console.log(`  ✅ 上传成功: ${filePath}`);
      return true;
    } catch (e) {
      console.error(`  ❌ 上传失败:`, e.message);
      return false;
    }
  }

  // 大数据分批上传
  const totalBatches = Math.ceil(data.length / BATCH_SIZE);
  console.log(`  📦 分${totalBatches}批上传...`);

  const batchResults = [];

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, data.length);
    const batchData = data.slice(start, end);
    const batchPath = `jinxing-edu/${storageKey}_part${i}.json`;

    try {
      await client.put(batchPath, Buffer.from(JSON.stringify(batchData)));
      console.log(`  ✅ 批次 ${i + 1}/${totalBatches} 上传成功 (${batchData.length}条)`);
      batchResults.push({ batchIndex: i, count: batchData.length, success: true });
    } catch (e) {
      console.error(`  ❌ 批次 ${i + 1} 上传失败:`, e.message);
      batchResults.push({ batchIndex: i, count: batchData.length, success: false });
    }

    // 延迟
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // 上传索引文件
  const indexData = {
    storageKey,
    totalRecords: data.length,
    totalBatches,
    batchSize: BATCH_SIZE,
    batches: batchResults,
    updatedAt: new Date().toISOString(),
  };

  try {
    const indexPath = `jinxing-edu/${storageKey}_index.json`;
    await client.put(indexPath, Buffer.from(JSON.stringify(indexData, null, 2)));
    console.log(`  📋 索引文件上传成功`);
  } catch (e) {
    console.error(`  ❌ 索引文件上传失败:`, e.message);
  }

  const successCount = batchResults.filter(r => r.success).length;
  console.log(`  📊 完成: ${successCount}/${totalBatches} 批成功`);

  return successCount === totalBatches;
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('🚀 金星幼儿园数据导入工具');
  console.log('========================================');
  console.log(`源文件:`);
  console.log(`  - 教职工: ${staffFile}`);
  console.log(`  - 学生: ${studentFile}`);
  console.log('');

  // 1. 解析数据
  const staffData = parseStaffData();
  const studentData = parseStudentData();

  // 2. 显示预览
  console.log('\n========================================');
  console.log('📊 数据预览');
  console.log('========================================');
  
  if (staffData.length > 0) {
    console.log('\n教职工示例:');
    console.log(JSON.stringify(staffData[0], null, 2));
  }
  
  if (studentData.length > 0) {
    console.log('\n学生示例:');
    console.log(JSON.stringify(studentData[0], null, 2));
  }

  // 3. 上传到 OSS
  console.log('\n========================================');
  console.log('☁️ 上传到阿里云 OSS');
  console.log('========================================');

  await uploadToOSS('kt_staff', staffData);
  await uploadToOSS('kt_students', studentData);

  // 4. 提取手机号作为授权名单
  const authorizedPhones = [
    ...staffData.map(s => s.phone).filter(p => p && p.length >= 11),
    ...studentData.map(s => s.parentPhone).filter(p => p && p.length >= 11),
  ];
  const uniquePhones = [...new Set(authorizedPhones)];
  
  console.log(`\n📱 授权手机号: ${uniquePhones.length}个`);
  await uploadToOSS('kt_authorized_phones', uniquePhones);

  console.log('\n========================================');
  console.log('✅ 导入完成！');
  console.log('========================================');
  console.log('');
  console.log('下一步:');
  console.log('1. 刷新网站，数据会自动从云端同步');
  console.log('2. 在小程序点击「从云端下载」同步数据');
  console.log('');
}

// 运行
main().catch(console.error);
