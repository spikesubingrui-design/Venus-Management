/**
 * 内部知识库服务
 * 
 * AI助手优先查阅学校内部资料（模板、规则、准则）
 * 如果没有相关内部资料，再提示可以从网上搜索
 */

import { getData, saveData, STORAGE_KEYS } from './storageService';

// 知识库文档类型
export interface KnowledgeDocument {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  keywords: string[];          // 关键词，用于搜索匹配
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isTemplate: boolean;         // 是否为模板
  templateType?: TemplateType; // 模板类型
  priority: number;            // 优先级，越高越优先匹配
}

// 知识分类
export type KnowledgeCategory = 
  | 'policy'           // 政策规则
  | 'template'         // 工作模板
  | 'lesson_plan'      // 备课资料
  | 'safety'           // 安全规范
  | 'health'           // 健康卫生
  | 'communication'    // 家园沟通
  | 'hr'               // 人事相关
  | 'finance'          // 财务相关
  | 'curriculum'       // 课程教学
  | 'daily_work'       // 日常工作
  | 'emergency'        // 应急处理
  | 'other';           // 其他

// 模板类型
export type TemplateType = 
  | 'daily_summary'      // 每日工作总结
  | 'lesson_plan'        // 备课计划
  | 'parent_notice'      // 家长通知
  | 'incident_report'    // 事件报告
  | 'health_check'       // 健康检查
  | 'activity_plan'      // 活动策划
  | 'meeting_minutes'    // 会议纪要
  | 'refund_process'     // 退费流程
  | 'enrollment'         // 入园流程
  | 'evaluation';        // 评估报告

// 分类中文名
export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  policy: '政策规则',
  template: '工作模板',
  lesson_plan: '备课资料',
  safety: '安全规范',
  health: '健康卫生',
  communication: '家园沟通',
  hr: '人事相关',
  finance: '财务相关',
  curriculum: '课程教学',
  daily_work: '日常工作',
  emergency: '应急处理',
  other: '其他',
};

// 模板类型中文名
export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  daily_summary: '每日工作总结',
  lesson_plan: '备课计划',
  parent_notice: '家长通知',
  incident_report: '事件报告',
  health_check: '健康检查',
  activity_plan: '活动策划',
  meeting_minutes: '会议纪要',
  refund_process: '退费流程',
  enrollment: '入园流程',
  evaluation: '评估报告',
};

// 存储键
const KNOWLEDGE_BASE_KEY = 'kt_knowledge_base';

// 获取所有知识文档
export function getAllKnowledgeDocuments(): KnowledgeDocument[] {
  return getData<KnowledgeDocument>(KNOWLEDGE_BASE_KEY);
}

// 搜索知识库
export function searchKnowledgeBase(query: string): KnowledgeDocument[] {
  const docs = getAllKnowledgeDocuments();
  const queryLower = query.toLowerCase();
  const queryKeywords = queryLower.split(/[\s,，、]+/).filter(Boolean);
  
  // 计算匹配分数
  const scored = docs.map(doc => {
    let score = 0;
    
    // 标题匹配（最高权重）
    if (doc.title.toLowerCase().includes(queryLower)) {
      score += 100;
    }
    
    // 关键词匹配
    queryKeywords.forEach(kw => {
      if (doc.keywords.some(dk => dk.toLowerCase().includes(kw))) {
        score += 50;
      }
      if (doc.title.toLowerCase().includes(kw)) {
        score += 30;
      }
      if (doc.content.toLowerCase().includes(kw)) {
        score += 10;
      }
    });
    
    // 优先级加成
    score += doc.priority * 5;
    
    return { doc, score };
  });
  
  // 过滤出匹配的文档并按分数排序
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.doc);
}

// 根据分类获取文档
export function getDocumentsByCategory(category: KnowledgeCategory): KnowledgeDocument[] {
  return getAllKnowledgeDocuments().filter(doc => doc.category === category);
}

// 获取所有模板
export function getTemplates(templateType?: TemplateType): KnowledgeDocument[] {
  const docs = getAllKnowledgeDocuments().filter(doc => doc.isTemplate);
  if (templateType) {
    return docs.filter(doc => doc.templateType === templateType);
  }
  return docs;
}

// 根据ID获取文档
export function getDocumentById(id: string): KnowledgeDocument | undefined {
  return getAllKnowledgeDocuments().find(doc => doc.id === id);
}

// 保存文档
export function saveDocument(doc: KnowledgeDocument): void {
  const docs = getAllKnowledgeDocuments();
  const index = docs.findIndex(d => d.id === doc.id);
  if (index >= 0) {
    docs[index] = { ...doc, updatedAt: new Date().toISOString() };
  } else {
    docs.push({ ...doc, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  saveData(KNOWLEDGE_BASE_KEY, docs);
}

// 删除文档
export function deleteDocument(id: string): void {
  const docs = getAllKnowledgeDocuments().filter(doc => doc.id !== id);
  saveData(KNOWLEDGE_BASE_KEY, docs);
}

// AI智能搜索 - 为AI助手提供的接口
export interface AISearchResult {
  found: boolean;
  documents: KnowledgeDocument[];
  summary: string;
  suggestWebSearch: boolean;
}

// AI搜索知识库
export function aiSearchKnowledge(userQuery: string): AISearchResult {
  const results = searchKnowledgeBase(userQuery);
  
  if (results.length === 0) {
    return {
      found: false,
      documents: [],
      summary: '内部知识库中未找到相关资料。',
      suggestWebSearch: true,
    };
  }
  
  // 生成摘要
  const topResults = results.slice(0, 3);
  const summary = topResults.map(doc => 
    `【${CATEGORY_LABELS[doc.category]}】${doc.title}`
  ).join('\n');
  
  return {
    found: true,
    documents: topResults,
    summary: `找到 ${results.length} 份相关资料：\n${summary}`,
    suggestWebSearch: false,
  };
}

// 获取模板内容（用于AI填充）
export function getTemplateContent(templateType: TemplateType): string | null {
  const templates = getTemplates(templateType);
  if (templates.length > 0) {
    return templates[0].content;
  }
  return null;
}

// 初始化默认知识库
export function initializeKnowledgeBase(): void {
  const existing = getAllKnowledgeDocuments();
  if (existing.length > 0) return; // 已有数据，不重复初始化
  
  const defaultDocs: KnowledgeDocument[] = [
    // ============ 退费准则 ============
    {
      id: 'kb_refund_policy',
      title: '金星幼儿园退费管理规定',
      category: 'finance',
      keywords: ['退费', '退款', '退园', '费用', '学费', '保教费', '伙食费', '押金'],
      content: `# 金星幼儿园退费管理规定

## 一、退费原则
1. 保教费按月计算，以自然月为单位
2. 伙食费按实际出勤天数结算
3. 校服、被褥等物品费用不予退还

## 二、退费标准

### 2.1 主动退园
- 开学前申请退园：全额退还保教费、伙食费
- 开学后15日内申请：退还当月保教费的70%
- 开学后15-30日申请：退还当月保教费的50%
- 开学30日后申请：当月费用不予退还，次月费用全退

### 2.2 请假退费
- 连续请假超过5个工作日（含）：按实际出勤天数退还伙食费
- 病假需提供医院证明
- 事假需提前3天申请

### 2.3 特殊情况
- 因园方原因导致停课：全额退还停课期间费用
- 不可抗力因素（如疫情）：按上级部门规定执行

## 三、退费流程
1. 家长向班主任提出申请
2. 班主任填写《退费申请表》
3. 园长审批
4. 财务核算退费金额
5. 7个工作日内原路退还

## 四、注意事项
- 退费以入园协议为准
- 优惠减免部分按比例扣除
- 有欠费的需先补齐欠费

---
审核：园长办公室
更新日期：2024年9月`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: false,
      priority: 100,
    },
    
    // ============ 每日工作总结模板 ============
    {
      id: 'kb_daily_summary_template',
      title: '教师每日工作总结模板',
      category: 'template',
      keywords: ['工作总结', '日报', '每日总结', '工作汇报', '今日工作'],
      content: `# 每日工作总结

## 基本信息
- 日期：【填写日期】
- 班级：【填写班级】
- 填写人：【填写姓名】

## 一、今日出勤情况
- 应到人数：____ 人
- 实到人数：____ 人
- 请假人数：____ 人（病假 ___ 人，事假 ___ 人）
- 请假幼儿：【列出请假幼儿姓名及原因】

## 二、教学活动完成情况
| 时间段 | 活动内容 | 完成情况 | 幼儿表现 |
|--------|----------|----------|----------|
| 上午 | | | |
| 下午 | | | |

## 三、特别关注幼儿
【记录今日需要特别关注的幼儿及原因】

## 四、安全卫生工作
- [ ] 晨检完成
- [ ] 午睡检查
- [ ] 教室消毒
- [ ] 玩具清洗
- [ ] 安全隐患排查

## 五、家长沟通记录
【记录今日与家长的重要沟通】

## 六、明日工作计划
【列出明日重点工作】

## 七、问题与建议
【记录工作中遇到的问题及改进建议】`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: true,
      templateType: 'daily_summary',
      priority: 90,
    },
    
    // ============ 备课计划模板 ============
    {
      id: 'kb_lesson_plan_template',
      title: '教师备课计划模板',
      category: 'template',
      keywords: ['备课', '教案', '课程计划', '教学设计', '活动设计'],
      content: `# 教学活动设计

## 基本信息
- 活动名称：【填写活动名称】
- 适用班级：【填写班级】
- 活动领域：【语言/数学/科学/艺术/健康/社会】
- 活动时长：【预计时长】分钟
- 设计教师：【填写姓名】

## 一、活动目标
### 1. 认知目标
【幼儿能够了解/认识...】

### 2. 能力目标
【幼儿能够学会/掌握...】

### 3. 情感目标
【培养幼儿的...情感/态度】

## 二、活动重难点
- **重点**：【本次活动的核心内容】
- **难点**：【幼儿较难掌握的部分】

## 三、活动准备
### 1. 经验准备
【幼儿需要的前期经验】

### 2. 物质准备
【教具、学具、环境布置等】

## 四、活动过程

### 环节一：导入（约 ___ 分钟）
【激发兴趣的方式：故事/游戏/提问/情境等】

### 环节二：基本活动（约 ___ 分钟）
【核心教学内容和方法】

### 环节三：巩固练习（约 ___ 分钟）
【游戏/操作/表演等巩固方式】

### 环节四：总结延伸（约 ___ 分钟）
【回顾要点，延伸活动】

## 五、活动延伸
- 区域活动：【在区角可以...】
- 家园共育：【请家长配合...】

## 六、活动反思
【课后填写：活动效果、幼儿表现、改进建议】`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: true,
      templateType: 'lesson_plan',
      priority: 90,
    },
    
    // ============ 家长通知模板 ============
    {
      id: 'kb_parent_notice_template',
      title: '家长通知模板',
      category: 'template',
      keywords: ['通知', '家长通知', '告家长书', '公告', '放假通知'],
      content: `# 告家长书

尊敬的家长朋友：

您好！

【正文内容：说明通知的具体事项】

**具体安排如下：**
1. 时间：
2. 地点：
3. 注意事项：
   - 
   - 
   - 

如有疑问，请联系班主任老师。

感谢您的配合与支持！

金星幼儿园
【日期】`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: true,
      templateType: 'parent_notice',
      priority: 80,
    },
    
    // ============ 入园流程 ============
    {
      id: 'kb_enrollment_process',
      title: '新生入园流程',
      category: 'policy',
      keywords: ['入园', '入学', '报名', '新生', '招生', '注册'],
      content: `# 新生入园流程

## 一、报名条件
1. 年龄要求：
   - 小班：3周岁（当年8月31日前满3周岁）
   - 中班：4周岁
   - 大班：5周岁
2. 身体健康，无传染性疾病

## 二、报名流程

### 第一步：参观咨询
- 预约参观园所
- 了解办园理念和收费标准

### 第二步：提交材料
- 幼儿户口本复印件
- 幼儿出生证明复印件
- 预防接种证
- 幼儿一寸照片4张
- 家长身份证复印件
- 入园体检报告（县级以上医院）

### 第三步：面谈评估
- 与幼儿简单互动
- 了解幼儿基本情况

### 第四步：缴费注册
- 缴纳第一学期费用
- 签订入园协议
- 领取入园须知

### 第五步：入园准备
- 参加新生家长会
- 准备入园物品
- 开始适应性入园

## 三、收费标准
【详见收费公示栏】

## 四、咨询电话
招生办：【电话号码】`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: false,
      priority: 85,
    },
    
    // ============ 安全管理规定 ============
    {
      id: 'kb_safety_rules',
      title: '幼儿园安全管理规定',
      category: 'safety',
      keywords: ['安全', '安全管理', '接送', '门禁', '应急', '消防'],
      content: `# 幼儿园安全管理规定

## 一、接送安全
1. 家长凭接送卡入园接送幼儿
2. 委托他人接送需提前报备，并核验身份证
3. 接送时间：早7:30-8:30，晚16:30-17:30
4. 迟接幼儿需提前电话通知

## 二、门禁管理
1. 非接送时间大门上锁
2. 来访人员需登记并佩戴访客证
3. 禁止无关人员进入园区

## 三、日常安全
1. 教师全程看护，不得离岗
2. 户外活动前检查场地和器械
3. 危险物品远离幼儿
4. 药品由保健医统一管理

## 四、应急处理
1. 发现异常立即报告
2. 幼儿受伤先处理后通知家长
3. 紧急情况启动应急预案

## 五、消防安全
1. 每月消防演练
2. 消防通道保持畅通
3. 定期检查消防设施

## 六、食品安全
1. 严格执行食品留样制度
2. 食堂人员持健康证上岗
3. 禁止外来食品进入园区`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: false,
      priority: 95,
    },
    
    // ============ 请假制度 ============
    {
      id: 'kb_leave_policy',
      title: '教职工请假制度',
      category: 'hr',
      keywords: ['请假', '假期', '休假', '事假', '病假', '年假', '产假'],
      content: `# 教职工请假制度

## 一、请假类型
1. **事假**：因私事请假，无薪
2. **病假**：因病请假，需医院证明
3. **年假**：按工龄享受带薪年假
4. **婚假**：法定3天
5. **产假**：按国家规定执行
6. **丧假**：直系亲属3天

## 二、审批权限
| 请假天数 | 审批人 |
|----------|--------|
| 1天以内 | 年级组长 |
| 1-3天 | 园长 |
| 3天以上 | 园长 + 集团备案 |

## 三、请假流程
1. 提前填写请假申请表
2. 找代班老师
3. 提交审批
4. 通知家长（如需）
5. 销假报到

## 四、注意事项
- 紧急情况可电话请假，事后补假条
- 请假期间保持电话畅通
- 未经批准擅自离岗按旷工处理`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: false,
      priority: 80,
    },
    
    // ============ 活动策划模板 ============
    {
      id: 'kb_activity_plan_template',
      title: '园所活动策划模板',
      category: 'template',
      keywords: ['活动', '策划', '方案', '节日', '亲子活动', '运动会', '表演'],
      content: `# 活动策划方案

## 一、活动概述
- **活动名称**：【填写活动名称】
- **活动时间**：【日期和时间】
- **活动地点**：【具体地点】
- **参与对象**：【班级/全园/亲子等】
- **活动主题**：【活动核心主题】

## 二、活动目标
1. 
2. 
3. 

## 三、活动流程
| 时间 | 环节 | 内容 | 负责人 |
|------|------|------|--------|
| | 签到入场 | | |
| | 开场仪式 | | |
| | 主体活动 | | |
| | 互动环节 | | |
| | 颁奖/合影 | | |
| | 退场 | | |

## 四、人员分工
| 岗位 | 职责 | 负责人 |
|------|------|--------|
| 总协调 | 统筹全场 | |
| 主持人 | 串场主持 | |
| 摄影 | 拍照摄像 | |
| 后勤 | 物资保障 | |
| 安全 | 秩序维护 | |

## 五、物资准备
- [ ] 
- [ ] 
- [ ] 

## 六、安全预案
1. 
2. 
3. 

## 七、预算
| 项目 | 金额 | 备注 |
|------|------|------|
| | | |
| 合计 | | |

## 八、活动总结
【活动结束后填写】`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: true,
      templateType: 'activity_plan',
      priority: 85,
    },
    
    // ============ 事件报告模板 ============
    {
      id: 'kb_incident_report_template',
      title: '安全事件报告模板',
      category: 'template',
      keywords: ['事故', '事件', '报告', '意外', '受伤', '磕碰'],
      content: `# 安全事件报告

## 一、基本信息
- 报告日期：
- 报告人：
- 事件发生时间：
- 事件发生地点：

## 二、涉及人员
- 幼儿姓名：
- 班级：
- 年龄：

## 三、事件经过
【详细描述事件发生的经过】

## 四、伤情描述
- 受伤部位：
- 伤情程度：□轻微 □一般 □严重
- 处理方式：□园内处理 □送医治疗

## 五、现场处理
【描述事发后的处理措施】

## 六、家长通知
- 通知时间：
- 通知方式：□电话 □当面
- 家长反应：

## 七、后续跟进
【描述后续处理计划】

## 八、事件分析与改进
- 事件原因：
- 改进措施：

---
报告人签名：
园长签名：
日期：`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: true,
      templateType: 'incident_report',
      priority: 90,
    },
    
    // ============ 幼儿评估报告模板 ============
    {
      id: 'kb_evaluation_template',
      title: '幼儿发展评估报告模板',
      category: 'template',
      keywords: ['评估', '评价', '发展', '报告', '成长档案', '期末评语'],
      content: `# 幼儿发展评估报告

## 基本信息
- 幼儿姓名：
- 班级：
- 评估时间：
- 评估教师：

## 一、健康领域
### 身体发育
- 身高：___cm   体重：___kg
- 发育评价：□优秀 □良好 □一般 □需关注

### 动作发展
- 大肌肉动作：
- 精细动作：

### 生活习惯
- 饮食习惯：
- 睡眠习惯：
- 卫生习惯：

## 二、语言领域
- 倾听理解：
- 口语表达：
- 阅读兴趣：

## 三、社会领域
- 人际交往：
- 社会适应：
- 情绪管理：

## 四、科学领域
- 探索兴趣：
- 数学认知：
- 科学知识：

## 五、艺术领域
- 艺术感受：
- 艺术表现：

## 六、综合评价
【总体评价和发展建议】

## 七、家园共育建议
【给家长的具体建议】

---
评估教师签名：
日期：`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: true,
      templateType: 'evaluation',
      priority: 85,
    },
    
    // ============ 健康检查规范 ============
    {
      id: 'kb_health_check',
      title: '幼儿健康检查规范',
      category: 'health',
      keywords: ['晨检', '健康', '检查', '卫生', '体检', '消毒'],
      content: `# 幼儿健康检查规范

## 一、晨检制度（一摸二看三问四查）

### 一摸
- 摸额头和手心，检测体温是否正常

### 二看
- 看精神状态、面色、皮肤
- 观察有无皮疹、红肿

### 三问
- 询问在家情况
- 了解饮食、睡眠、大小便

### 四查
- 检查口腔、手足
- 查看有无携带危险物品

## 二、体温标准
- 正常：36.2℃-37.2℃
- 低热：37.3℃-38℃（通知家长，观察）
- 中热：38.1℃-39℃（通知家长，隔离）
- 高热：>39℃（立即通知家长接回）

## 三、因病缺勤追踪
1. 当日电话询问病情
2. 记录缺勤原因
3. 传染病报告

## 四、复课证明
- 传染病康复需县级医院证明
- 发热退烧48小时后方可返园

## 五、日常消毒
| 项目 | 频次 | 方式 |
|------|------|------|
| 桌椅 | 每日 | 擦拭消毒 |
| 玩具 | 每周 | 浸泡/紫外线 |
| 被褥 | 每月 | 日晒 |
| 空气 | 每日 | 开窗通风 |`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isTemplate: false,
      priority: 90,
    },
  ];
  
  saveData(KNOWLEDGE_BASE_KEY, defaultDocs);
  console.log('[知识库] 已初始化默认知识库文档');
}

// 为AI生成上下文
export function generateAIContext(query: string): string {
  const searchResult = aiSearchKnowledge(query);
  
  if (!searchResult.found) {
    return `用户询问：${query}\n\n注意：内部知识库中未找到相关资料，你可以根据通用知识回答，但建议用户确认学校具体规定。`;
  }
  
  const docsContent = searchResult.documents
    .map(doc => `### ${doc.title}\n${doc.content}`)
    .join('\n\n---\n\n');
  
  return `用户询问：${query}

## 以下是从学校内部知识库找到的相关资料：

${docsContent}

---
请根据以上内部资料回答用户的问题。如果资料中没有涵盖用户的具体问题，可以结合资料内容给出建议。`;
}



