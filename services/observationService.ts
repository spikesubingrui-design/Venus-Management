/**
 * 观察记录服务 - AI润色生成专业观察记录
 * 基于《3-6岁儿童学习与发展指南》自动生成专业观察记录与建议
 */

import { ObservationDraft, ProfessionalObservation, Student } from '../types';
import { getData, saveData } from './storageService';

// 豆包 API 配置 - Doubao-Seed-1.6
const DOUBAO_API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const DOUBAO_MODEL = "doubao-seed-1-6-251015";

// 获取 API Key
const getApiKey = (): string => {
  return process.env.DOUBAO_API_KEY || process.env.API_KEY || "";
};

/**
 * 调用豆包 API 进行观察记录分析
 */
async function callObservationAI(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("豆包 API Key 未配置");
    throw new Error("API_KEY_MISSING");
  }

  const requestBody = {
    model: DOUBAO_MODEL,
    messages: [
      { 
        role: "system", 
        content: "你是一位专业的幼儿园教师，精通《3-6岁儿童学习与发展指南》。请严格按照要求的JSON格式输出，不要输出其他任何内容。" 
      },
      { 
        role: "user", 
        content: [{ type: "text", text: prompt }]
      }
    ],
    temperature: 0.7,
    max_completion_tokens: 4096,
    reasoning_effort: "medium",
    response_format: { type: "json_object" }
  };

  console.log("🤖 调用豆包 AI 分析观察记录...");

  const response = await fetch(DOUBAO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("豆包 API 错误:", response.status, errorText);
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  console.log("✅ AI 分析完成");
  return content;
}

// 存储键
const OBSERVATION_KEYS = {
  DRAFTS: 'kt_observation_drafts',
  PROFESSIONAL: 'kt_professional_observations',
};

// 《3-6岁儿童学习与发展指南》五大领域参考
const DEVELOPMENT_GUIDE = {
  健康: {
    goals: [
      '身心状况：具有健康的体态、情绪安定愉快、具有一定的适应能力',
      '动作发展：具有一定的平衡能力、动作协调灵敏、具有一定的力量和耐力',
      '生活习惯与生活能力：具有良好的生活与卫生习惯、具有基本的生活自理能力、具备基本的安全知识和自我保护能力',
    ],
    indicators: {
      '3-4岁': ['能独立吃饭', '能自己穿脱衣服鞋袜', '能保持良好的坐姿'],
      '4-5岁': ['能整理自己的物品', '能遵守基本的安全规则', '动作较协调'],
      '5-6岁': ['具有较强的自理能力', '能主动参与体育活动', '有良好的作息习惯'],
    }
  },
  语言: {
    goals: [
      '倾听与表达：认真听并能听懂常用语言、愿意讲话并能清楚表达、具有文明的语言习惯',
      '阅读与书写准备：喜欢听故事看图书、具有初步的阅读理解能力、具有书面表达的愿望和初步技能',
    ],
    indicators: {
      '3-4岁': ['喜欢听故事', '能用简单的语言表达需求', '喜欢看图书'],
      '4-5岁': ['能清楚讲述简单的事情', '喜欢与人交谈', '能复述简短的故事'],
      '5-6岁': ['能有序连贯地讲述', '对文字符号感兴趣', '能认识自己的名字'],
    }
  },
  社会: {
    goals: [
      '人际交往：愿意与人交往、能与同伴友好相处、具有自尊自信自主的表现、关心尊重他人',
      '社会适应：喜欢并适应群体生活、遵守基本的行为规范、具有初步的归属感',
    ],
    indicators: {
      '3-4岁': ['愿意和小朋友一起游戏', '能跟着老师做事情', '知道基本的礼貌用语'],
      '4-5岁': ['能和同伴合作游戏', '能遵守游戏规则', '能感受到他人的情绪'],
      '5-6岁': ['能主动关心他人', '能解决同伴间的矛盾', '有较强的集体荣誉感'],
    }
  },
  科学: {
    goals: [
      '科学探究：亲近自然喜欢探究、具有初步的探究能力、在探究中认识周围事物和现象',
      '数学认知：初步感知生活中数学的有用和有趣、感知和理解数量及数量关系、感知形状与空间关系',
    ],
    indicators: {
      '3-4岁': ['对周围事物有好奇心', '能用感官探索物体', '能点数5以内的物体'],
      '4-5岁': ['喜欢提问', '能比较物体的异同', '能理解简单的数量关系'],
      '5-6岁': ['能提出问题并尝试解决', '能用简单的方法验证猜想', '能进行简单的分类统计'],
    }
  },
  艺术: {
    goals: [
      '感受与欣赏：喜欢自然界与生活中美的事物、喜欢欣赏多种多样的艺术形式和作品',
      '表现与创造：喜欢进行艺术活动并大胆表现、具有初步的艺术表现与创造能力',
    ],
    indicators: {
      '3-4岁': ['喜欢唱歌跳舞', '喜欢涂涂画画', '能跟着音乐做简单动作'],
      '4-5岁': ['能用多种方式表达感受', '绘画能表现简单的情节', '能随音乐节奏运动'],
      '5-6岁': ['能用艺术方式表达想法', '作品有一定的创意', '能与同伴合作表演'],
    }
  }
};

/**
 * 保存观察草稿
 */
export function saveDraft(draft: ObservationDraft): void {
  const drafts = getData<ObservationDraft>(OBSERVATION_KEYS.DRAFTS);
  const existingIndex = drafts.findIndex(d => d.id === draft.id);
  
  if (existingIndex >= 0) {
    drafts[existingIndex] = draft;
  } else {
    drafts.unshift(draft);
  }
  
  saveData(OBSERVATION_KEYS.DRAFTS, drafts);
}

/**
 * 获取观察草稿
 */
export function getDrafts(filters?: {
  studentId?: string;
  class?: string;
  domain?: string;
  aiProcessed?: boolean;
}): ObservationDraft[] {
  let drafts = getData<ObservationDraft>(OBSERVATION_KEYS.DRAFTS);
  
  if (filters) {
    if (filters.studentId) drafts = drafts.filter(d => d.studentId === filters.studentId);
    if (filters.class) drafts = drafts.filter(d => d.class === filters.class);
    if (filters.domain) drafts = drafts.filter(d => d.domain === filters.domain);
    if (filters.aiProcessed !== undefined) drafts = drafts.filter(d => d.aiProcessed === filters.aiProcessed);
  }
  
  return drafts;
}

/**
 * 保存专业观察记录
 */
export function saveProfessionalObservation(observation: ProfessionalObservation): void {
  const observations = getData<ProfessionalObservation>(OBSERVATION_KEYS.PROFESSIONAL);
  const existingIndex = observations.findIndex(o => o.id === observation.id);
  
  if (existingIndex >= 0) {
    observations[existingIndex] = observation;
  } else {
    observations.unshift(observation);
  }
  
  saveData(OBSERVATION_KEYS.PROFESSIONAL, observations);
}

/**
 * 获取专业观察记录
 */
export function getProfessionalObservations(filters?: {
  studentId?: string;
  class?: string;
  status?: ProfessionalObservation['status'];
}): ProfessionalObservation[] {
  let observations = getData<ProfessionalObservation>(OBSERVATION_KEYS.PROFESSIONAL);
  
  if (filters) {
    if (filters.studentId) observations = observations.filter(o => o.studentId === filters.studentId);
    if (filters.class) observations = observations.filter(o => o.class === filters.class);
    if (filters.status) observations = observations.filter(o => o.status === filters.status);
  }
  
  return observations;
}

/**
 * AI润色生成专业观察记录（使用豆包 Doubao-Seed-1.6）
 */
export async function generateProfessionalObservation(
  draft: ObservationDraft,
  student: Student,
  onStream?: (text: string) => void
): Promise<ProfessionalObservation> {
  const ageGroup = student.age <= 4 ? '3-4岁' : student.age <= 5 ? '4-5岁' : '5-6岁';
  const domainInfo = draft.domain ? DEVELOPMENT_GUIDE[draft.domain as keyof typeof DEVELOPMENT_GUIDE] : null;
  
  const prompt = `请将以下教师的简单观察记录润色成专业的幼儿观察记录。

该幼儿信息：
- 姓名：${student.name}
- 年龄：${student.age}岁（${ageGroup}年龄段）
- 班级：${student.class}
${draft.domain ? `- 观察领域：${draft.domain}` : ''}
${draft.activity ? `- 活动场景：${draft.activity}` : ''}

${domainInfo ? `
《3-6岁指南》${draft.domain}领域参考：
目标：${domainInfo.goals.join('；')}
${ageGroup}典型表现：${(domainInfo.indicators as any)[ageGroup]?.join('；') || ''}
` : ''}

教师原始记录：
${draft.rawContent}

请严格按以下JSON格式输出，不要输出其他任何内容：
{
  "title": "观察标题（简洁有力，如：小明在建构区的专注力表现）",
  "background": "观察背景（描述时间、地点、活动背景，100字以内）",
  "behavior": "行为描述（客观详细描述观察到的行为，不加主观评价，200字左右）",
  "analysis": "行为分析（基于《3-6岁指南》分析行为背后的发展意义，150字左右）",
  "developmentLevel": "发展水平评估（与指南对照的发展水平判断，如：符合该年龄段典型表现/超出预期/需关注支持）",
  "suggestions": ["教育建议1（具体可操作）", "教育建议2", "教育建议3"],
  "parentTips": "家长沟通建议（告诉家长可以如何在家配合，100字以内）",
  "guidelineRefs": [{"domain": "领域名", "goal": "对应目标", "indicator": "对应典型表现"}]
}`;

  if (onStream) onStream('🤖 正在调用豆包 AI 分析观察记录...');
  
  let parsed: any;
  
  try {
    const fullResponse = await callObservationAI(prompt);
    if (onStream) onStream('✅ AI 分析完成，正在解析结果...');
    
    // 清理并解析 JSON
    let cleanJson = fullResponse.trim();
    cleanJson = cleanJson.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    parsed = JSON.parse(cleanJson);
    console.log("✅ JSON 解析成功:", parsed.title);
    
  } catch (e: any) {
    console.error('AI生成或解析失败:', e.message);
    if (onStream) onStream(`⚠️ AI 生成遇到问题: ${e.message}`);
    
    // 如果解析失败，使用默认结构但保留原始内容
    parsed = {
      title: `${student.name}的${draft.domain || '日常'}观察记录`,
      background: draft.activity || '日常活动观察',
      behavior: draft.rawContent,
      analysis: `基于教师观察，${student.name}在${draft.domain || '活动'}中表现出一定的发展特点，建议继续关注并记录更多细节。`,
      developmentLevel: '需进一步观察以做准确评估',
      suggestions: [
        '继续观察记录该领域的行为表现',
        '创设更多相关活动机会',
        '与家长沟通了解在家表现'
      ],
      parentTips: '建议家长在家多关注孩子这方面的表现，可以适当提供相关活动机会。',
      guidelineRefs: draft.domain ? [{ domain: draft.domain, goal: '', indicator: '' }] : []
    };
  }

  const now = new Date().toISOString();
  const observation: ProfessionalObservation = {
    id: `obs_${draft.id}_${Date.now()}`,
    draftId: draft.id,
    studentId: draft.studentId,
    studentName: draft.studentName,
    class: draft.class,
    title: parsed.title,
    background: parsed.background,
    behavior: parsed.behavior,
    analysis: parsed.analysis,
    developmentLevel: parsed.developmentLevel,
    suggestions: parsed.suggestions || [],
    parentTips: parsed.parentTips,
    guidelineRefs: parsed.guidelineRefs,
    status: 'draft',
    sharedToParent: false,
    createdAt: now,
    updatedAt: now,
  };

  // 更新草稿状态
  draft.aiProcessed = true;
  draft.aiProcessedAt = now;
  saveDraft(draft);

  // 保存专业记录
  saveProfessionalObservation(observation);

  return observation;
}

/**
 * 获取学生的观察记录统计
 */
export function getStudentObservationStats(studentId: string): {
  totalDrafts: number;
  totalProfessional: number;
  sharedToParent: number;
  byDomain: Record<string, number>;
} {
  const drafts = getDrafts({ studentId });
  const professional = getProfessionalObservations({ studentId });
  
  const byDomain: Record<string, number> = {};
  drafts.forEach(d => {
    if (d.domain) {
      byDomain[d.domain] = (byDomain[d.domain] || 0) + 1;
    }
  });

  return {
    totalDrafts: drafts.length,
    totalProfessional: professional.length,
    sharedToParent: professional.filter(o => o.sharedToParent).length,
    byDomain,
  };
}

/**
 * 分享观察记录给家长
 */
export function shareToParent(observationId: string): ProfessionalObservation | null {
  const observations = getData<ProfessionalObservation>(OBSERVATION_KEYS.PROFESSIONAL);
  const observation = observations.find(o => o.id === observationId);
  
  if (!observation) return null;
  
  observation.sharedToParent = true;
  observation.sharedAt = new Date().toISOString();
  observation.status = 'shared';
  
  saveData(OBSERVATION_KEYS.PROFESSIONAL, observations);
  return observation;
}

/**
 * 删除草稿
 */
export function deleteDraft(draftId: string): boolean {
  const drafts = getData<ObservationDraft>(OBSERVATION_KEYS.DRAFTS);
  const filtered = drafts.filter(d => d.id !== draftId);
  
  if (filtered.length < drafts.length) {
    saveData(OBSERVATION_KEYS.DRAFTS, filtered);
    return true;
  }
  return false;
}

