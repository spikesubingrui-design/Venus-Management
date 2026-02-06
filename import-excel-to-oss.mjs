/**
 * Excel 数据导入脚本
 * 将学校真实数据从 Excel 导入到阿里云 OSS
 * 
 * 运行方式: node import-excel-to-oss.mjs
 */

import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import OSS from 'ali-oss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const seenIds = new Set(); // 用于去重
    
    workbook.SheetNames.forEach(sheetName => {
      console.log(`  处理工作表: ${sheetName}`);
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      if (rows.length < 2) return;
      
      // 查找表头行（包含"姓名"或"名字"的行）
      let headerRowIndex = -1;
      let headers = [];
      
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const row = rows[i];
        if (row && Array.isArray(row)) {
          const rowStr = row.join(',');
          if (rowStr.includes('姓名') || rowStr.includes('名字') || rowStr.includes('电话') || rowStr.includes('手机')) {
            headerRowIndex = i;
            headers = row;
            console.log(`  找到表头行 [${i}]: ${JSON.stringify(headers)}`);
            break;
          }
        }
      }
      
      if (headerRowIndex === -1) {
        // 如果没找到表头，尝试直接用列位置（假设：姓名、电话、职位...）
        console.log(`  未找到标准表头，尝试按位置解析...`);
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 2) continue;
          
          // 跳过标题行（只有一个单元格或者是标题文字）
          const firstCell = String(row[0] || '').trim();
          if (firstCell.includes('通讯录') || firstCell.includes('幼儿园') || firstCell.length > 10) continue;
          
          // 检查是否像是数据行（有姓名和电话）
          const name = String(row[0] || '').trim();
          const phone = String(row[1] || '').trim();
          
          // 跳过表头行
          if (name === '姓名' || name === '名字') continue;
          
          // 验证是否是有效数据
          if (name && name.length >= 2 && name.length <= 5) {
            const staff = {
              id: `staff_${name}_${phone.slice(-4) || i}`,
              name: name,
              phone: phone,
              position: String(row[2] || '').trim() || '教师',
              department: String(row[3] || '').trim() || sheetName,
              campus: '金星幼儿园',
              status: '在职',
              updatedAt: new Date().toISOString(),
            };
            
            if (staff.name) {
              if (seenIds.has(staff.id)) {
                console.log(`    ⚠️ 跳过重复教职工: ${staff.name}`);
              } else {
                seenIds.add(staff.id);
                allStaff.push(staff);
              }
            }
          }
        }
      } else {
        // 使用找到的表头解析
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row[0]) continue;
          
          const name = findValue(headers, row, ['姓名', '名字', 'name']);
          const phone = findValue(headers, row, ['手机号码', '电话', '手机', '联系电话', 'phone']);
          const gender = findValue(headers, row, ['性别', 'gender']);
          const classGroup = findValue(headers, row, ['班级', 'class']);
          const position = findValue(headers, row, ['岗位', '职位', '职务', 'position']);
          const department = findValue(headers, row, ['部门', '科室', 'department']);
          
          const staff = {
            id: `staff_${name}_${(phone || '').slice(-4) || i}`,
            name: name,
            phone: phone,
            gender: gender,
            class: classGroup,
            className: classGroup,
            position: position || '教师',
            department: department || sheetName,
            campus: '金星幼儿园',
            entryDate: findValue(headers, row, ['入职日期', '入职时间', '入职']),
            status: '在职',
            updatedAt: new Date().toISOString(),
          };
          
          if (staff.name) {
            if (seenIds.has(staff.id)) {
              console.log(`    ⚠️ 跳过重复教职工: ${staff.name}`);
            } else {
              seenIds.add(staff.id);
              allStaff.push(staff);
            }
          }
        }
      }
    });
    
    console.log(`  ✅ 共解析 ${allStaff.length} 条教职工数据（已去重）`);
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
    const seenIds = new Set(); // 用于去重
    
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
        
        const name = findValue(headers, row, ['姓名', '学生姓名', '幼儿姓名', 'name']);
        const phone = findValue(headers, row, ['家长电话', '联系电话', '手机', 'phone']) || '';
        const className = findValue(headers, row, ['班级', '所在班级', 'class']) || sheetName;
        
        // 使用稳定ID：姓名+手机后4位+班级，避免重复导入
        const stableId = `stu_${name}_${phone.slice(-4)}_${className}`.replace(/\s/g, '');
        
        // 解析各字段
        const gender = findValue(headers, row, ['性别', 'gender']) || '男';
        const birthDate = findValue(headers, row, ['出生日期', '生日', '出生年月', 'birthday']);
        const enrollDate = findValue(headers, row, ['入园日期', '入学日期', '入园时间']) || new Date().toISOString().split('T')[0];
        const parentName = findValue(headers, row, ['家长姓名', '父母姓名', '监护人', '家长']);
        const parentRelation = findValue(headers, row, ['与幼儿关系', '关系', '称谓']) || '父亲';
        const bloodType = findValue(headers, row, ['血型']) || '未知';
        const allergies = findValue(headers, row, ['过敏史', '过敏']);
        const dietaryRestrictions = findValue(headers, row, ['饮食禁忌', '忌口']);
        const emergencyContact = findValue(headers, row, ['紧急联系人', '备用联系人']);
        const emergencyPhone = findValue(headers, row, ['紧急联系电话', '备用电话']);
        const emergencyRelation = findValue(headers, row, ['紧急联系人关系']);
        const address = findValue(headers, row, ['家庭地址', '住址', '地址']);
        const idNumber = findValue(headers, row, ['身份证号', '身份证']);
        const studentNumber = findValue(headers, row, ['学号', '编号']);
        const specialNeeds = findValue(headers, row, ['特殊需求', '备注']);
        const height = findValue(headers, row, ['身高']);
        const weight = findValue(headers, row, ['体重']);
        const classType = findValue(headers, row, ['班型']) || 'standard';
        const campus = findValue(headers, row, ['园所', '校区', '园区']) || '十七幼';
        
        // 计算年龄
        let age = 0;
        if (birthDate) {
          const birth = new Date(birthDate);
          const today = new Date();
          age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
        }
        
        const student = {
          id: stableId,
          name: name,
          gender: gender === '女' ? '女' : '男',
          birthDate: birthDate,
          age: age,
          class: className,
          className: className,
          campus: campus,
          avatar: '',
          status: 'present',
          last_activity: new Date().toISOString(),
          
          // 健康信息
          height: height ? parseFloat(height) : undefined,
          weight: weight ? parseFloat(weight) : undefined,
          bloodType: ['A', 'B', 'AB', 'O'].includes(bloodType) ? bloodType : '未知',
          allergies: allergies ? allergies.split(/[,，、\s]+/).filter(a => a.trim()) : [],
          healthNotes: '',
          
          // 家长信息
          parent_name: parentName,
          parentName: parentName,
          parent_phone: phone,
          parentPhone: phone,
          parent_relation: ['父亲', '母亲', '爷爷', '奶奶', '外公', '外婆'].includes(parentRelation) ? parentRelation : '其他',
          
          // 紧急联系人
          emergency_contact: emergencyContact || undefined,
          emergency_phone: emergencyPhone || undefined,
          emergency_relation: emergencyRelation || undefined,
          
          // 家庭信息
          address: address || undefined,
          idNumber: idNumber || undefined,
          
          // 入园信息
          enrollDate: enrollDate,
          studentNumber: studentNumber || undefined,
          
          // 特殊需求
          dietaryRestrictions: dietaryRestrictions || undefined,
          specialNeeds: specialNeeds || undefined,
          
          // 班型
          classType: classType === 'excellence' ? 'excellence' : classType === 'music' ? 'music' : 'standard',
          
          updatedAt: new Date().toISOString(),
        };
        
        // 只有有姓名的才加入，并且去重
        if (student.name) {
          if (seenIds.has(student.id)) {
            console.log(`    ⚠️ 跳过重复学生: ${student.name} (${student.className})`);
          } else {
            seenIds.add(student.id);
            allStudents.push(student);
          }
        }
      }
    });
    
    console.log(`  ✅ 共解析 ${allStudents.length} 条学生数据（已去重）`);
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
 * 删除OSS上的旧文件
 */
async function deleteOldFiles(storageKey) {
  console.log(`\n🗑️ 清理旧文件: ${storageKey}...`);
  
  try {
    // 列出所有相关文件
    const result = await client.list({
      prefix: `jinxing-edu/${storageKey}`,
      'max-keys': 100,
    });
    
    if (result.objects && result.objects.length > 0) {
      for (const obj of result.objects) {
        try {
          await client.delete(obj.name);
          console.log(`  删除: ${obj.name}`);
        } catch (e) {
          console.log(`  删除失败: ${obj.name}`);
        }
      }
      console.log(`  ✅ 已删除 ${result.objects.length} 个旧文件`);
    } else {
      console.log(`  无旧文件`);
    }
  } catch (e) {
    console.log(`  清理失败: ${e.message}`);
  }
}

/**
 * 简单上传（不分批，直接覆盖）
 */
async function simpleUpload(storageKey, data) {
  const filePath = `jinxing-edu/${storageKey}.json`;
  
  try {
    await client.put(filePath, Buffer.from(JSON.stringify(data, null, 2)));
    console.log(`  ✅ 上传成功: ${filePath} (${data.length}条)`);
    return true;
  } catch (e) {
    console.error(`  ❌ 上传失败:`, e.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('🚀 金星幼儿园数据导入工具（全新导入）');
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
  console.log(`教职工: ${staffData.length}条`);
  console.log(`学生: ${studentData.length}条`);
  
  if (studentData.length > 0) {
    console.log('\n学生示例:');
    console.log(JSON.stringify(studentData[0], null, 2));
  }

  // 3. 删除旧数据
  console.log('\n========================================');
  console.log('🗑️ 清理云端旧数据');
  console.log('========================================');
  
  await deleteOldFiles('kt_students');
  await deleteOldFiles('kt_staff');
  await deleteOldFiles('kt_authorized_phones');

  // 4. 上传新数据
  console.log('\n========================================');
  console.log('☁️ 上传新数据到阿里云 OSS');
  console.log('========================================');

  console.log('\n📤 上传学生数据...');
  await simpleUpload('kt_students', studentData);
  
  console.log('\n📤 上传教职工数据...');
  await simpleUpload('kt_staff', staffData);

  // 5. 提取手机号作为授权名单
  const authorizedPhones = [
    ...staffData.map(s => s.phone).filter(p => p && p.length >= 11),
    ...studentData.map(s => s.parentPhone).filter(p => p && p.length >= 11),
  ];
  const uniquePhones = [...new Set(authorizedPhones)];
  
  console.log('\n📤 上传授权手机号...');
  console.log(`  共 ${uniquePhones.length} 个手机号`);
  await simpleUpload('kt_authorized_phones', uniquePhones);

  console.log('\n========================================');
  console.log('✅ 导入完成！');
  console.log('========================================');
  console.log('');
  console.log('📋 下一步操作:');
  console.log('');
  console.log('1. 在网站浏览器控制台执行:');
  console.log('   localStorage.removeItem("kt_students");');
  console.log('   localStorage.removeItem("kt_staff");');
  console.log('   location.reload();');
  console.log('');
  console.log('2. 刷新后网站会自动从云端同步新数据');
  console.log('3. 小程序重新登录会自动同步');
  console.log('');
}

// 运行
main().catch(console.error);
