/**
 * 数据初始化服务 - 导入教职工和学生数据
 */

import { getData, saveData, STORAGE_KEYS, logOperation } from './storageService';
import type { Teacher, Student } from '../types';

// 教职工数据
const staffData = [
  { name: "柳晓娜", phone: "13080106000", gender: "女", class: null, role: "园长", department: "行政部门" },
  { name: "安义娜", phone: "18749919970", gender: "女", class: null, role: "园长", department: "行政部门" },
  { name: "金洪贤", phone: "13633933405", gender: "女", class: "书田中二", role: "保教主任", department: "保教部门" },
  { name: "葛亚南", phone: "15639307857", gender: "女", class: "星语大一", role: "班长", department: "保教部门" },
  { name: "蔺俊霞", phone: "13939310505", gender: "女", class: "花开小二", role: "配班", department: "保教部门" },
  { name: "刘海燕", phone: "18236061335", gender: "女", class: "星语大二", role: "班长", department: "保教部门" },
  { name: "杨欢", phone: "18238366221", gender: "女", class: "悦芽班", role: "配班", department: "保教部门" },
  { name: "付康月", phone: "13213911570", gender: "女", class: "星语大二", role: "配班", department: "保教部门" },
  { name: "杨孟婷", phone: "18638392849", gender: "女", class: null, role: "美术老师", department: "保教部门" },
  { name: "陈鸽", phone: "18539305982", gender: "女", class: "花开小二", role: "班长", department: "保教部门" },
  { name: "胡喜英", phone: "15738035922", gender: "女", class: "花开小三", role: "保育员", department: "保教部门" },
  { name: "刘瑞利", phone: "15239301973", gender: "女", class: "花开小三", role: "配班", department: "保教部门" },
  { name: "苗珊", phone: "15239325316", gender: "女", class: "悦芽班", role: "班长", department: "保教部门" },
  { name: "王红梅", phone: "13703485717", gender: "女", class: null, role: "后勤主任", department: "后勤保障" },
  { name: "谢英", phone: "13513901033", gender: "女", class: null, role: "舞蹈老师", department: "保教部门" },
  { name: "杨家慧", phone: "13663938707", gender: "女", class: "书田中一", role: "配班", department: "保教部门" },
  { name: "王宁超", phone: "13513919205", gender: "女", class: "星语大一", role: "配班", department: "保教部门" },
  { name: "张一帆", phone: "15090219520", gender: "女", class: "花开小一", role: "班长", department: "保教部门" },
  { name: "赵菲菲", phone: "15690600207", gender: "女", class: "书田中二", role: "配班", department: "保教部门" },
  { name: "潘兰兰", phone: "15517557794", gender: "女", class: null, role: "英语老师", department: "保教部门" },
  { name: "刘庆立", phone: "15939312708", gender: "男", class: null, role: "门卫", department: "后勤保障" },
  { name: "刘艺荣", phone: "15286937872", gender: "女", class: "花开小一", role: "保育员", department: "保教部门" },
  { name: "张楠", phone: "13721777163", gender: "女", class: "星语大二", role: "保育员", department: "保教部门" },
  { name: "潘瑞荣", phone: "15803939569", gender: "女", class: "花开小三", role: "班长", department: "保教部门" },
  { name: "李欣欣", phone: "13461777329", gender: "女", class: "书田中一", role: "班长", department: "保教部门" },
  { name: "李恒", phone: "15090233778", gender: "男", class: null, role: "体育老师", department: "保教部门" },
  { name: "陈雪丽", phone: "13839377789", gender: "女", class: "花开小一", role: "保育员", department: "保教部门" },
  { name: "满丽", phone: "15303935928", gender: "女", class: "悦芽班", role: "保育员", department: "保教部门" },
  { name: "王生盼", phone: "17539399129", gender: "女", class: "星语大一", role: "配班", department: "保教部门" },
  { name: "宋雯", phone: "18749916619", gender: "女", class: "花开小一", role: "配班", department: "保教部门" },
  { name: "户洪玲", phone: "15890464935", gender: "女", class: null, role: "保洁", department: "后勤保障" },
  { name: "赵迷竹", phone: "15738040108", gender: "女", class: null, role: "厨师长", department: "后勤保障" },
  { name: "郝玉华", phone: "15083254089", gender: "女", class: null, role: "保洁", department: "后勤保障" },
  { name: "申明艳", phone: "13839398679", gender: "女", class: null, role: "保洁", department: "后勤保障" },
  { name: "库青丽", phone: "13461666948", gender: "女", class: null, role: "帮厨", department: "后勤保障" },
  { name: "王新龙", phone: "13849302033", gender: "男", class: null, role: "体育老师", department: "保教部门" },
  { name: "吕昭路", phone: "15729428895", gender: "男", class: null, role: "体育老师", department: "保教部门" },
  { name: "张照茹", phone: "13137345368", gender: "女", class: null, role: "英语老师", department: "保教部门" },
];

// 学生数据
const studentData = [
  { class: "悦芽一班", name: "马记崧", phone: "18337274351", gender: "男", birthDate: "2022-11-17" },
  { class: "悦芽一班", name: "许洋铭", phone: "18339308186", gender: "男", birthDate: "2022-12-08" },
  { class: "悦芽一班", name: "洪思岢", phone: "13225076367", gender: "女", birthDate: "2023-01-07" },
  { class: "悦芽一班", name: "于泽晔", phone: "17896733322", gender: "男", birthDate: "2022-11-11" },
  { class: "悦芽一班", name: "张佳菘", phone: "18239379992", gender: "男", birthDate: "2023-12-02" },
  { class: "悦芽一班", name: "张知栩", phone: "13939316169", gender: "男", birthDate: "2023-02-10" },
  { class: "悦芽一班", name: "李若淳", phone: "15518577888", gender: "女", birthDate: "2021-09-05" },
  { class: "花开小一", name: "王沐锦", phone: "13535612396", gender: "女", birthDate: "2022-05-02" },
  { class: "花开小一", name: "胡涵玥", phone: "13598876909", gender: "女", birthDate: "2022-08-07" },
  { class: "花开小一", name: "陈佑恩", phone: "18749919970", gender: "男", birthDate: "2021-11-27" },
  { class: "花开小一", name: "刘之瑶", phone: "15939393999", gender: "女", birthDate: "2022-06-22" },
  { class: "花开小一", name: "张熙承", phone: "15286948697", gender: "男", birthDate: "2022-03-01" },
  { class: "花开小一", name: "吉宪屹", phone: "18239306662", gender: "男", birthDate: "2022-05-18" },
  { class: "花开小一", name: "王佐之", phone: "15039986031", gender: "男", birthDate: "2022-03-15" },
  { class: "花开小一", name: "王翊禾", phone: "15639320323", gender: "男", birthDate: "2021-09-27" },
  { class: "花开小一", name: "靳柏宇", phone: "13213911570", gender: "男", birthDate: "2022-03-27" },
  { class: "花开小一", name: "姚沐苒", phone: "13513926930", gender: "女", birthDate: "2022-01-21" },
  { class: "花开小一", name: "刘嘉诚", phone: "13140170628", gender: "男", birthDate: "2021-10-15" },
  { class: "花开小一", name: "赵汐苒", phone: "18037529666", gender: "女", birthDate: "2022-01-06" },
  { class: "花开小一", name: "来芯儿", phone: "15893289503", gender: "女", birthDate: "2021-10-08" },
  { class: "花开小一", name: "徐诗悦", phone: "18603933890", gender: "女", birthDate: "2023-07-25" },
  { class: "花开小一", name: "王斯淳", phone: "18790972640", gender: "男", birthDate: "2022-08-08" },
  { class: "花开小一", name: "何姜颖", phone: "18539309597", gender: "女", birthDate: "2022-06-14" },
  { class: "花开小二", name: "王兮玥", phone: "18860322786", gender: "女", birthDate: "2022-04-19" },
  { class: "花开小二", name: "王亦辰", phone: "15539332323", gender: "男", birthDate: "2022-04-06" },
  { class: "花开小二", name: "余玥柠", phone: "18639309396", gender: "女", birthDate: "2022-03-19" },
  { class: "花开小二", name: "杨锦茁", phone: "18300651963", gender: "男", birthDate: "2021-12-18" },
  { class: "花开小二", name: "付亦多", phone: "18939308588", gender: "女", birthDate: "2022-01-01" },
  { class: "花开小二", name: "栗岚", phone: "18939307799", gender: "女", birthDate: "2022-03-21" },
  { class: "花开小二", name: "刘小满", phone: "17639331188", gender: "女", birthDate: "2021-12-15" },
  { class: "花开小二", name: "赵嘉恒", phone: "16639365533", gender: "男", birthDate: "2021-12-10" },
  { class: "花开小二", name: "郭一墨", phone: "17639399204", gender: "女", birthDate: "2022-02-05" },
  { class: "花开小二", name: "李欣玥", phone: "13663932935", gender: "女", birthDate: "2021-12-28" },
  { class: "花开小二", name: "杨明泽", phone: "18238371398", gender: "男", birthDate: "2021-12-03" },
  { class: "花开小二", name: "贾启润", phone: "13839260079", gender: "男", birthDate: "2022-04-20" },
  { class: "花开小二", name: "王景瑶", phone: "17603932786", gender: "女", birthDate: "2022-10-11" },
  { class: "花开小三", name: "刘子赫", phone: "13903931608", gender: "男", birthDate: "2021-09-09" },
  { class: "花开小三", name: "胡诗煜", phone: "18239375832", gender: "女", birthDate: "2022-08-13" },
  { class: "花开小三", name: "张希玥", phone: "18568181996", gender: "女", birthDate: "2022-07-16" },
  { class: "花开小三", name: "王子昱", phone: "17603939371", gender: "男", birthDate: "2022-09-25" },
  { class: "花开小三", name: "马沐禾", phone: "18839322209", gender: "女", birthDate: "2021-11-13" },
  { class: "花开小三", name: "王绎之", phone: "13939368867", gender: "男", birthDate: "2022-02-03" },
  { class: "花开小三", name: "程梓予", phone: "17639356615", gender: "男", birthDate: "2022-06-08" },
  { class: "花开小三", name: "张屿燊", phone: "18530309990", gender: "男", birthDate: "2022-02-26" },
  { class: "花开小三", name: "王奕泽", phone: "13721750466", gender: "男", birthDate: "2021-10-07" },
  { class: "花开小三", name: "赵嘉宁", phone: "18236075856", gender: "男", birthDate: "2022-04-20" },
  { class: "花开小三", name: "陈嘉烨", phone: "13721752718", gender: "男", birthDate: "2021-09-16" },
  { class: "花开小三", name: "陈林汐", phone: "17639323939", gender: "女", birthDate: "2022-09-21" },
  { class: "花开小三", name: "陈星睿", phone: "13137331117", gender: "男", birthDate: "2022-03-16" },
  { class: "花开小三", name: "谢佳烜", phone: "15083292787", gender: "男", birthDate: "2022-08-20" },
  { class: "花开小三", name: "张昊宁", phone: "13223976666", gender: "男", birthDate: "2022-07-23" },
  { class: "书田中一", name: "张艺宸", phone: "18821315555", gender: "男", birthDate: "2021-01-01" },
  { class: "书田中一", name: "李语诚", phone: "15518535553", gender: "男", birthDate: "2021-03-12" },
  { class: "书田中一", name: "安岱梁", phone: "19939319818", gender: "男", birthDate: "2020-12-06" },
  { class: "书田中一", name: "弓禧", phone: "18803605558", gender: "女", birthDate: "2022-02-09" },
  { class: "书田中一", name: "张芷妤", phone: "18939373999", gender: "女", birthDate: "2021-06-26" },
  { class: "书田中一", name: "李昭时", phone: "15518572119", gender: "男", birthDate: "2021-04-14" },
  { class: "书田中一", name: "闫奕", phone: "17739382222", gender: "女", birthDate: "2021-02-06" },
  { class: "书田中一", name: "毕朔闻", phone: "17749475133", gender: "男", birthDate: "2021-02-24" },
  { class: "书田中一", name: "刘宸熙", phone: "18749919970", gender: "女", birthDate: "2021-02-07" },
  { class: "书田中一", name: "闫珝琳", phone: "16690995188", gender: "女", birthDate: "2020-09-05" },
  { class: "书田中一", name: "李梓元", phone: "18939328199", gender: "男", birthDate: "2020-12-24" },
  { class: "书田中一", name: "王瑾一", phone: "17729710333", gender: "女", birthDate: "2021-03-04" },
  { class: "书田中一", name: "荣璟一", phone: "19139738888", gender: "男", birthDate: "2021-06-14" },
  { class: "书田中一", name: "李卓", phone: "13525612396", gender: "男", birthDate: "2021-08-31" },
  { class: "书田中二", name: "张佑涵", phone: "15039333393", gender: "女", birthDate: "2021-07-28" },
  { class: "书田中二", name: "黄星烁", phone: "18439303662", gender: "男", birthDate: "2021-06-15" },
  { class: "书田中二", name: "卢潇禾", phone: "18339319000", gender: "男", birthDate: "2021-01-01" },
  { class: "书田中二", name: "杨宇晟", phone: "17339368002", gender: "男", birthDate: "2021-09-04" },
  { class: "书田中二", name: "王家铭", phone: "13673020897", gender: "男", birthDate: "2021-09-28" },
  { class: "书田中二", name: "邱昱皓", phone: "13243206666", gender: "男", birthDate: "2021-04-25" },
  { class: "书田中二", name: "李一凡", phone: "15738854388", gender: "男", birthDate: "2021-02-11" },
  { class: "书田中二", name: "岳乘风", phone: "18839328288", gender: "男", birthDate: "2021-05-29" },
  { class: "书田中二", name: "谢佳翊", phone: "15286908664", gender: "男", birthDate: "2021-07-22" },
  { class: "书田中二", name: "李官桐", phone: "13673013221", gender: "女", birthDate: "2022-07-23" },
  { class: "书田中二", name: "张宇骁", phone: "18039368199", gender: "男", birthDate: "2010-12-20" },
  { class: "书田中二", name: "张予诺", phone: "15738005606", gender: "女", birthDate: "2020-12-01" },
  { class: "星语大一", name: "王恬", phone: "18339334850", gender: "女", birthDate: "2020-05-31" },
  { class: "星语大一", name: "王子骞", phone: "15239981139", gender: "男", birthDate: "2020-01-26" },
  { class: "星语大一", name: "李奥纳多", phone: "18639389312", gender: "男", birthDate: "2020-05-24" },
  { class: "星语大一", name: "王嘉懿", phone: "15139380168", gender: "女", birthDate: "2019-09-06" },
  { class: "星语大一", name: "甘爽", phone: "15539372255", gender: "男", birthDate: "2019-09-28" },
  { class: "星语大一", name: "任予晗", phone: "18639333604", gender: "女", birthDate: "2019-12-21" },
  { class: "星语大一", name: "张梓潼", phone: "15090226666", gender: "女", birthDate: "2019-12-23" },
  { class: "星语大一", name: "林汐", phone: "18238366221", gender: "男", birthDate: "2020-01-07" },
  { class: "星语大一", name: "许诺", phone: "16639386888", gender: "女", birthDate: "2020-01-18" },
  { class: "星语大一", name: "许嘉禾", phone: "15039387027", gender: "女", birthDate: "2020-01-25" },
  { class: "星语大一", name: "晁阳铮", phone: "15518520260", gender: "男", birthDate: "2019-10-31" },
  { class: "星语大一", name: "武文楷", phone: "13839392330", gender: "男", birthDate: "2020-01-17" },
  { class: "星语大一", name: "张毓然", phone: "18530305716", gender: "男", birthDate: "2020-01-21" },
  { class: "星语大一", name: "洪思远", phone: "13225076367", gender: "男", birthDate: "2020-08-27" },
  { class: "星语大一", name: "王凯栎", phone: "18860322786", gender: "男", birthDate: "2019-12-13" },
  { class: "星语大一", name: "绳凯严", phone: "13633931704", gender: "男", birthDate: "2020-08-21" },
  { class: "星语大一", name: "宋允儿", phone: "13839296666", gender: "女", birthDate: "2019-11-10" },
  { class: "星语大一", name: "闫初心", phone: "18238303123", gender: "女", birthDate: "2019-10-06" },
  { class: "星语大一", name: "张煦", phone: "15893276071", gender: "男", birthDate: "2020-02-18" },
  { class: "星语大一", name: "陈治豪", phone: "15286901018", gender: "男", birthDate: "2020-01-03" },
  { class: "星语大二", name: "付悠澈", phone: "18839318030", gender: "女", birthDate: "2019-12-27" },
  { class: "星语大二", name: "张云瀚", phone: "13603839671", gender: "男", birthDate: "2020-02-14" },
  { class: "星语大二", name: "李青阳", phone: "13939368870", gender: "男", birthDate: "2020-03-28" },
  { class: "星语大二", name: "刘子正", phone: "17739350555", gender: "男", birthDate: "2020-01-08" },
  { class: "星语大二", name: "高若嫣", phone: "13939332957", gender: "女", birthDate: "2019-12-01" },
  { class: "星语大二", name: "赵沐泽", phone: "13633939966", gender: "男", birthDate: "2019-10-18" },
  { class: "星语大二", name: "焦梓硕", phone: "15738038000", gender: "男", birthDate: "2020-07-08" },
  { class: "星语大二", name: "齐梓睿", phone: "15639307857", gender: "女", birthDate: "2019-12-24" },
  { class: "星语大二", name: "王朝森", phone: "13839295009", gender: "男", birthDate: "2020-04-10" },
  { class: "星语大二", name: "付湘然", phone: "13461619073", gender: "女", birthDate: "2020-07-03" },
  { class: "星语大二", name: "卢佳琳", phone: "13839321391", gender: "女", birthDate: "2020-06-26" },
  { class: "星语大二", name: "李亦宸", phone: "15137111189", gender: "男", birthDate: "2020-03-29" },
  { class: "星语大二", name: "李锦昊", phone: "17739361119", gender: "男", birthDate: "2020-12-18" },
  { class: "星语大二", name: "宋奕达", phone: "18639341717", gender: "男", birthDate: "2020-03-25" },
  { class: "星语大二", name: "赵贝汐", phone: "17516956789", gender: "女", birthDate: "2019-11-19" },
  { class: "星语大二", name: "张知亦", phone: "13939316169", gender: "女", birthDate: "2020-08-29" },
  { class: "星语大二", name: "赵佳妤", phone: "13513938555", gender: "女", birthDate: "2020-07-09" },
  { class: "星语大二", name: "巩持析", phone: "18639937679", gender: "男", birthDate: "2020-08-02" },
  { class: "星语大二", name: "赵子昱", phone: "13199133143", gender: "男", birthDate: "2019-10-14" },
];

// 计算年龄
function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// 生成ID
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 生成教职工头像（简约可爱风格）
function generateStaffAvatar(name: string, gender: string): string {
  // 使用 notionists 风格，简约友好
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// 生成幼儿头像（简约可爱风格）
function generateChildAvatar(name: string, gender: string): string {
  // 使用 notionists 风格，简约可爱
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// 转换教职工数据为系统格式
function convertStaffData(): Teacher[] {
  return staffData.map((staff) => ({
    id: generateId('staff'),
    name: staff.name,
    role: staff.role,
    phone: staff.phone,
    avatar: generateStaffAvatar(staff.name, staff.gender),
    assignedClass: staff.class || '',
    performanceScore: 90 + Math.floor(Math.random() * 10),
    campus: '金星第十七幼儿园',
    hireDate: '2024-01-01',
    education: '本科',
    certificates: [],
    status: 'active' as const,
  }));
}

// 转换学生数据为系统格式
function convertStudentData(): Student[] {
  return studentData.map((student) => ({
    id: generateId('student'),
    name: student.name,
    gender: student.gender as '男' | '女',
    birthDate: student.birthDate,
    age: calculateAge(student.birthDate),
    class: student.class,
    campus: '金星第十七幼儿园',
    avatar: generateChildAvatar(student.name, student.gender),
    status: 'present' as const,
    last_activity: new Date().toISOString(),
    parent_name: '',
    parent_phone: student.phone,
    parent_relation: '父亲' as const,
    enrollDate: '2024-09-01',
  }));
}

/**
 * 初始化导入所有数据
 */
export function initializeData(): { staffCount: number; studentCount: number } {
  // 检查是否已经导入过（使用标记）
  const importFlag = localStorage.getItem('kt_data_imported_v6');
  
  if (importFlag === 'true') {
    console.log('[DataInit] 数据已导入，跳过初始化');
    return { staffCount: 0, studentCount: 0 };
  }
  
  console.log('[DataInit] 开始导入数据...');
  
  const newStaff = convertStaffData();
  const newStudents = convertStudentData();
  
  saveData(STORAGE_KEYS.STAFF, newStaff);
  saveData(STORAGE_KEYS.STUDENTS, newStudents);
  
  // 同时保存到视图组件使用的存储键
  localStorage.setItem('kt_students_local', JSON.stringify(newStudents));  // StudentsView 使用
  localStorage.setItem('kt_teachers', JSON.stringify(newStaff));          // StaffView 使用
  
  // 设置导入标记
  localStorage.setItem('kt_data_imported_v6', 'true');
  
  logOperation(
    'system',
    '系统',
    'SUPER_ADMIN',
    'CREATE',
    '数据管理',
    '初始化数据',
    'batch_import',
    '批量导入数据',
    `批量导入${newStaff.length}名教职工和${newStudents.length}名学生数据`,
    null,
    { staffCount: newStaff.length, studentCount: newStudents.length }
  );
  
  console.log(`[DataInit] ✅ 导入完成: ${newStaff.length}名教职工, ${newStudents.length}名学生`);
  
  return { staffCount: newStaff.length, studentCount: newStudents.length };
}

/**
 * 强制重新导入所有数据（会覆盖现有数据）
 */
export function forceReimportData(): { staffCount: number; studentCount: number } {
  const newStaff = convertStaffData();
  const newStudents = convertStudentData();
  
  saveData(STORAGE_KEYS.STAFF, newStaff);
  saveData(STORAGE_KEYS.STUDENTS, newStudents);
  
  logOperation(
    'system',
    '系统',
    'SUPER_ADMIN',
    'UPDATE',
    '数据管理',
    '全量数据',
    'force_reimport',
    '强制重新导入数据',
    `重新导入${newStaff.length}名教职工和${newStudents.length}名学生数据`,
    null,
    { staffCount: newStaff.length, studentCount: newStudents.length }
  );
  
  return { staffCount: newStaff.length, studentCount: newStudents.length };
}

/**
 * 获取数据统计
 */
export function getDataStats() {
  const staff = getData<Teacher>(STORAGE_KEYS.STAFF);
  const students = getData<Student>(STORAGE_KEYS.STUDENTS);
  
  // 按班级统计学生
  const classCounts: Record<string, number> = {};
  students.forEach(s => {
    classCounts[s.class] = (classCounts[s.class] || 0) + 1;
  });
  
  // 按部门统计教职工
  const deptCounts: Record<string, number> = {};
  staff.forEach(s => {
    const dept = s.role.includes('园长') || s.role.includes('主任') ? '行政' : 
                 s.role.includes('老师') || s.role.includes('班长') || s.role.includes('配班') || s.role.includes('保育员') ? '保教' : '后勤';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });
  
  return {
    totalStaff: staff.length,
    totalStudents: students.length,
    classCounts,
    deptCounts,
  };
}

