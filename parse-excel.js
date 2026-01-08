const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// 解析教职工通讯录
const staffFile = path.join(__dirname, '外界信息', '学校档案（data）', '1.教职工通讯录.xlsx');
const studentFile = path.join(__dirname, '外界信息', '学校档案（data）', '2.学生模板.xlsx');

console.log('=== 教职工通讯录 ===\n');
try {
  const staffWorkbook = XLSX.readFile(staffFile);
  staffWorkbook.SheetNames.forEach(sheetName => {
    console.log(`--- Sheet: ${sheetName} ---`);
    const sheet = staffWorkbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    data.forEach((row, i) => {
      if (row.length > 0) {
        console.log(JSON.stringify(row));
      }
    });
    console.log('');
  });
} catch (e) {
  console.log('Error reading staff file:', e.message);
}

console.log('\n=== 学生模板 ===\n');
try {
  const studentWorkbook = XLSX.readFile(studentFile);
  studentWorkbook.SheetNames.forEach(sheetName => {
    console.log(`--- Sheet: ${sheetName} ---`);
    const sheet = studentWorkbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    data.forEach((row, i) => {
      if (row.length > 0) {
        console.log(JSON.stringify(row));
      }
    });
    console.log('');
  });
} catch (e) {
  console.log('Error reading student file:', e.message);
}



