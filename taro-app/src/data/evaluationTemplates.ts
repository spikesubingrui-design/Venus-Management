// 幼儿成长评价模板数据
// 基于《3-6岁儿童学习与发展指南》标准

export type ItemType = 'boolean' | 'rating' | 'text'

export interface EvaluationItem {
  id: string
  name: string
  type: ItemType
  description?: string
}

export interface EvaluationTemplate {
  id: string
  name: string
  grade: '托班' | '小班' | '中班' | '大班'
  domain: string
  semester: string
  icon: string
  iconClass: string
  items: EvaluationItem[]
}

// ==================== 托班评价模板 ====================

const tuoban_tinen: EvaluationTemplate = {
  id: 'tuoban_tinen',
  name: '托班幼儿体能发展评价',
  grade: '托班',
  domain: '体能发展',
  semester: '全学期',
  icon: '🏃',
  iconClass: 'sport',
  items: [
    { id: 't1', name: '能独立行走，步态稳定', type: 'boolean' },
    { id: 't2', name: '能跑几步不摔倒', type: 'boolean' },
    { id: 't3', name: '能双脚离地跳', type: 'boolean' },
    { id: 't4', name: '能扶栏杆上下楼梯', type: 'boolean' },
    { id: 't5', name: '能踢球', type: 'boolean' },
    { id: 't6', name: '能抛接大球', type: 'boolean' },
    { id: 't7', name: '能攀爬低矮器械', type: 'boolean' },
    { id: 't8', name: '能钻过障碍物', type: 'boolean' },
    { id: 't9', name: '手眼协调能力发展良好', type: 'rating' },
    { id: 't10', name: '教师综合评语', type: 'text' },
  ]
}

const tuoban_yuedu: EvaluationTemplate = {
  id: 'tuoban_yuedu',
  name: '托班幼儿阅读能力评价',
  grade: '托班',
  domain: '语言阅读',
  semester: '全学期',
  icon: '📖',
  iconClass: 'lang',
  items: [
    { id: 'y1', name: '喜欢听故事', type: 'boolean' },
    { id: 'y2', name: '能安静地听完一个简短故事', type: 'boolean' },
    { id: 'y3', name: '喜欢翻看图画书', type: 'boolean' },
    { id: 'y4', name: '能指认图书中熟悉的事物', type: 'boolean' },
    { id: 'y5', name: '能说出简单的词语', type: 'boolean' },
    { id: 'y6', name: '愿意跟读简单儿歌', type: 'boolean' },
    { id: 'y7', name: '能用手势和简单词语表达需求', type: 'boolean' },
    { id: 'y8', name: '语言理解能力', type: 'rating' },
    { id: 'y9', name: '教师综合评语', type: 'text' },
  ]
}

const tuoban_shenghuo: EvaluationTemplate = {
  id: 'tuoban_shenghuo',
  name: '托班宝宝生活经验评价',
  grade: '托班',
  domain: '生活自理',
  semester: '全学期',
  icon: '🍼',
  iconClass: 'life',
  items: [
    { id: 's1', name: '能自己用勺子吃饭', type: 'boolean' },
    { id: 's2', name: '能自己喝水', type: 'boolean' },
    { id: 's3', name: '能自己脱简单的衣服', type: 'boolean' },
    { id: 's4', name: '能自己穿简单的鞋子', type: 'boolean' },
    { id: 's5', name: '能表达大小便需求', type: 'boolean' },
    { id: 's6', name: '能在成人帮助下洗手', type: 'boolean' },
    { id: 's7', name: '能适应幼儿园生活作息', type: 'boolean' },
    { id: 's8', name: '情绪稳定，乐于来园', type: 'boolean' },
    { id: 's9', name: '生活自理能力综合评价', type: 'rating' },
    { id: 's10', name: '教师综合评语', type: 'text' },
  ]
}

// ==================== 小班评价模板 ====================

const xiaoban_tinen: EvaluationTemplate = {
  id: 'xiaoban_tinen',
  name: '小班幼儿体能发展评价',
  grade: '小班',
  domain: '体能发展',
  semester: '全学期',
  icon: '🏃',
  iconClass: 'sport',
  items: [
    { id: 'xt1', name: '能平稳地走和跑', type: 'boolean' },
    { id: 'xt2', name: '能双脚连续向前跳', type: 'boolean' },
    { id: 'xt3', name: '能单脚站立片刻', type: 'boolean' },
    { id: 'xt4', name: '能沿地面直线或在较宽的平衡木上走', type: 'boolean' },
    { id: 'xt5', name: '能双手抱球向前抛', type: 'boolean' },
    { id: 'xt6', name: '能手脚并用在攀爬架上爬', type: 'boolean' },
    { id: 'xt7', name: '能钻过较低的障碍物', type: 'boolean' },
    { id: 'xt8', name: '能使用小勺自己吃饭', type: 'boolean' },
    { id: 'xt9', name: '能用剪刀沿直线剪', type: 'boolean' },
    { id: 'xt10', name: '大肌肉动作发展', type: 'rating' },
    { id: 'xt11', name: '小肌肉动作发展', type: 'rating' },
    { id: 'xt12', name: '教师综合评语', type: 'text' },
  ]
}

const xiaoban_quyu: EvaluationTemplate = {
  id: 'xiaoban_quyu',
  name: '小班幼儿区域活动操作能力评价',
  grade: '小班',
  domain: '区域操作',
  semester: '全学期',
  icon: '🧩',
  iconClass: 'play',
  items: [
    { id: 'xq1', name: '能主动选择区域活动', type: 'boolean' },
    { id: 'xq2', name: '能遵守区域活动规则', type: 'boolean' },
    { id: 'xq3', name: '能专注地进行区域活动', type: 'boolean' },
    { id: 'xq4', name: '能完成简单的拼图', type: 'boolean' },
    { id: 'xq5', name: '能进行简单的角色扮演游戏', type: 'boolean' },
    { id: 'xq6', name: '能整理归放玩具材料', type: 'boolean' },
    { id: 'xq7', name: '能与同伴分享材料', type: 'boolean' },
    { id: 'xq8', name: '区域活动参与度', type: 'rating' },
    { id: 'xq9', name: '教师综合评语', type: 'text' },
  ]
}

const xiaoban_jiangou: EvaluationTemplate = {
  id: 'xiaoban_jiangou',
  name: '小班幼儿建构区能力测评',
  grade: '小班',
  domain: '建构能力',
  semester: '全学期',
  icon: '🏗️',
  iconClass: 'build',
  items: [
    { id: 'xj1', name: '能认识基本的积木形状', type: 'boolean' },
    { id: 'xj2', name: '能进行简单的堆高', type: 'boolean' },
    { id: 'xj3', name: '能进行简单的围合', type: 'boolean' },
    { id: 'xj4', name: '能用积木搭建简单造型', type: 'boolean' },
    { id: 'xj5', name: '能给自己的作品命名', type: 'boolean' },
    { id: 'xj6', name: '能专注完成建构任务', type: 'boolean' },
    { id: 'xj7', name: '能爱护建构材料', type: 'boolean' },
    { id: 'xj8', name: '建构能力综合评价', type: 'rating' },
    { id: 'xj9', name: '教师综合评语', type: 'text' },
  ]
}

const xiaoban_wenming: EvaluationTemplate = {
  id: 'xiaoban_wenming',
  name: '小班幼儿文明交往习惯评价',
  grade: '小班',
  domain: '社会交往',
  semester: '全学期',
  icon: '🤝',
  iconClass: 'social',
  items: [
    { id: 'xw1', name: '能主动向老师问好', type: 'boolean' },
    { id: 'xw2', name: '能使用礼貌用语（谢谢、请等）', type: 'boolean' },
    { id: 'xw3', name: '能与同伴友好相处', type: 'boolean' },
    { id: 'xw4', name: '能分享玩具和食物', type: 'boolean' },
    { id: 'xw5', name: '能轮流等待', type: 'boolean' },
    { id: 'xw6', name: '不打人、不骂人', type: 'boolean' },
    { id: 'xw7', name: '能遵守基本的集体规则', type: 'boolean' },
    { id: 'xw8', name: '社交能力综合评价', type: 'rating' },
    { id: 'xw9', name: '教师综合评语', type: 'text' },
  ]
}

const xiaoban_zili: EvaluationTemplate = {
  id: 'xiaoban_zili',
  name: '小班幼儿生活自理能力评价',
  grade: '小班',
  domain: '生活自理',
  semester: '全学期',
  icon: '👕',
  iconClass: 'life',
  items: [
    { id: 'xz1', name: '能自己进餐，不挑食', type: 'boolean' },
    { id: 'xz2', name: '能正确使用餐具', type: 'boolean' },
    { id: 'xz3', name: '能自己穿脱衣服', type: 'boolean' },
    { id: 'xz4', name: '能自己穿脱鞋袜', type: 'boolean' },
    { id: 'xz5', name: '能独立如厕', type: 'boolean' },
    { id: 'xz6', name: '能自己洗手', type: 'boolean' },
    { id: 'xz7', name: '能整理自己的物品', type: 'boolean' },
    { id: 'xz8', name: '有良好的作息习惯', type: 'boolean' },
    { id: 'xz9', name: '生活自理能力综合评价', type: 'rating' },
    { id: 'xz10', name: '教师综合评语', type: 'text' },
  ]
}

const xiaoban_kexue: EvaluationTemplate = {
  id: 'xiaoban_kexue',
  name: '小班幼儿科学探究能力评价',
  grade: '小班',
  domain: '科学探究',
  semester: '全学期',
  icon: '🔬',
  iconClass: 'science',
  items: [
    { id: 'xk1', name: '对周围事物感兴趣', type: 'boolean' },
    { id: 'xk2', name: '喜欢问"为什么"', type: 'boolean' },
    { id: 'xk3', name: '能用感官感知物体特征', type: 'boolean' },
    { id: 'xk4', name: '能区分颜色', type: 'boolean' },
    { id: 'xk5', name: '能区分大小', type: 'boolean' },
    { id: 'xk6', name: '能认识常见动植物', type: 'boolean' },
    { id: 'xk7', name: '能感知天气变化', type: 'boolean' },
    { id: 'xk8', name: '科学探究兴趣', type: 'rating' },
    { id: 'xk9', name: '教师综合评语', type: 'text' },
  ]
}

const xiaoban_yishu: EvaluationTemplate = {
  id: 'xiaoban_yishu',
  name: '小班幼儿艺术表现能力评价',
  grade: '小班',
  domain: '艺术表现',
  semester: '全学期',
  icon: '🎨',
  iconClass: 'art',
  items: [
    { id: 'xy1', name: '喜欢自然界与生活中美的事物', type: 'boolean' },
    { id: 'xy2', name: '喜欢欣赏多种形式的艺术作品', type: 'boolean' },
    { id: 'xy3', name: '能用自己喜欢的方式进行艺术表现', type: 'boolean' },
    { id: 'xy4', name: '喜欢唱歌并能基本唱准', type: 'boolean' },
    { id: 'xy5', name: '能用身体动作表现音乐节奏', type: 'boolean' },
    { id: 'xy6', name: '喜欢涂涂画画', type: 'boolean' },
    { id: 'xy7', name: '能用简单材料进行手工制作', type: 'boolean' },
    { id: 'xy8', name: '乐于参与集体艺术活动', type: 'boolean' },
    { id: 'xy9', name: '艺术表现能力综合评价', type: 'rating' },
    { id: 'xy10', name: '教师综合评语', type: 'text' },
  ]
}

const xiaoban_shehui: EvaluationTemplate = {
  id: 'xiaoban_shehui',
  name: '小班幼儿社会性发展评价',
  grade: '小班',
  domain: '社会性',
  semester: '全学期',
  icon: '👨‍👩‍👧',
  iconClass: 'social',
  items: [
    { id: 'xs1', name: '能适应幼儿园集体生活', type: 'boolean' },
    { id: 'xs2', name: '愿意与同伴交往', type: 'boolean' },
    { id: 'xs3', name: '能感受到老师的关爱', type: 'boolean' },
    { id: 'xs4', name: '知道自己的姓名、年龄、性别', type: 'boolean' },
    { id: 'xs5', name: '能认识家庭成员', type: 'boolean' },
    { id: 'xs6', name: '有初步的自我保护意识', type: 'boolean' },
    { id: 'xs7', name: '情绪比较稳定', type: 'boolean' },
    { id: 'xs8', name: '社会性发展综合评价', type: 'rating' },
    { id: 'xs9', name: '教师综合评语', type: 'text' },
  ]
}

const xiaoban_yuyan: EvaluationTemplate = {
  id: 'xiaoban_yuyan',
  name: '小班幼儿阅读及语言能力评价',
  grade: '小班',
  domain: '语言阅读',
  semester: '全学期',
  icon: '📚',
  iconClass: 'lang',
  items: [
    { id: 'xyu1', name: '认真听并能听懂常用语言', type: 'boolean' },
    { id: 'xyu2', name: '能根据指令做出相应反应', type: 'boolean' },
    { id: 'xyu3', name: '愿意讲话并能清楚地表达', type: 'boolean' },
    { id: 'xyu4', name: '能简单讲述熟悉的事情', type: 'boolean' },
    { id: 'xyu5', name: '喜欢听故事、看图书', type: 'boolean' },
    { id: 'xyu6', name: '能复述简单故事', type: 'boolean' },
    { id: 'xyu7', name: '能朗诵简单的儿歌', type: 'boolean' },
    { id: 'xyu8', name: '语言表达能力综合评价', type: 'rating' },
    { id: 'xyu9', name: '教师综合评语', type: 'text' },
  ]
}

// ==================== 中班评价模板 ====================

const zhongban_tinen: EvaluationTemplate = {
  id: 'zhongban_tinen',
  name: '中班幼儿体能发展评价',
  grade: '中班',
  domain: '体能发展',
  semester: '全学期',
  icon: '🏃',
  iconClass: 'sport',
  items: [
    { id: 'zt1', name: '能平稳地快跑', type: 'boolean' },
    { id: 'zt2', name: '能连续行进跳', type: 'boolean' },
    { id: 'zt3', name: '能单脚连续向前跳', type: 'boolean' },
    { id: 'zt4', name: '能在较窄的平衡木上平稳行走', type: 'boolean' },
    { id: 'zt5', name: '能单手向前抛球', type: 'boolean' },
    { id: 'zt6', name: '能接住抛来的球', type: 'boolean' },
    { id: 'zt7', name: '能灵活协调地攀爬', type: 'boolean' },
    { id: 'zt8', name: '能用筷子进餐', type: 'boolean' },
    { id: 'zt9', name: '能沿线剪出图形', type: 'boolean' },
    { id: 'zt10', name: '身体协调性', type: 'rating' },
    { id: 'zt11', name: '教师综合评语', type: 'text' },
  ]
}

const zhongban_quyu: EvaluationTemplate = {
  id: 'zhongban_quyu',
  name: '中班幼儿区域活动操作能力评价',
  grade: '中班',
  domain: '区域操作',
  semester: '全学期',
  icon: '🧩',
  iconClass: 'play',
  items: [
    { id: 'zq1', name: '能有目的地选择区域活动', type: 'boolean' },
    { id: 'zq2', name: '能持续专注地进行活动', type: 'boolean' },
    { id: 'zq3', name: '能解决活动中遇到的简单问题', type: 'boolean' },
    { id: 'zq4', name: '能与同伴合作完成任务', type: 'boolean' },
    { id: 'zq5', name: '能主动分享自己的发现', type: 'boolean' },
    { id: 'zq6', name: '能爱护和整理材料', type: 'boolean' },
    { id: 'zq7', name: '能遵守区域活动规则', type: 'boolean' },
    { id: 'zq8', name: '区域活动能力综合评价', type: 'rating' },
    { id: 'zq9', name: '教师综合评语', type: 'text' },
  ]
}

const zhongban_wenming: EvaluationTemplate = {
  id: 'zhongban_wenming',
  name: '中班幼儿文明交往习惯评价',
  grade: '中班',
  domain: '社会交往',
  semester: '全学期',
  icon: '🤝',
  iconClass: 'social',
  items: [
    { id: 'zw1', name: '能主动问候他人', type: 'boolean' },
    { id: 'zw2', name: '能恰当使用礼貌用语', type: 'boolean' },
    { id: 'zw3', name: '能主动与同伴交往', type: 'boolean' },
    { id: 'zw4', name: '能与同伴合作游戏', type: 'boolean' },
    { id: 'zw5', name: '能轮流和分享', type: 'boolean' },
    { id: 'zw6', name: '能用协商的方式解决冲突', type: 'boolean' },
    { id: 'zw7', name: '能关心帮助他人', type: 'boolean' },
    { id: 'zw8', name: '能遵守集体规则', type: 'boolean' },
    { id: 'zw9', name: '社交能力综合评价', type: 'rating' },
    { id: 'zw10', name: '教师综合评语', type: 'text' },
  ]
}

const zhongban_zili: EvaluationTemplate = {
  id: 'zhongban_zili',
  name: '中班幼儿生活自理能力评价',
  grade: '中班',
  domain: '生活自理',
  semester: '全学期',
  icon: '👕',
  iconClass: 'life',
  items: [
    { id: 'zz1', name: '能独立进餐，不浪费', type: 'boolean' },
    { id: 'zz2', name: '能熟练使用筷子', type: 'boolean' },
    { id: 'zz3', name: '能自己穿脱衣服并整理', type: 'boolean' },
    { id: 'zz4', name: '能自己系鞋带', type: 'boolean' },
    { id: 'zz5', name: '能独立完成盥洗', type: 'boolean' },
    { id: 'zz6', name: '能整理自己的床铺', type: 'boolean' },
    { id: 'zz7', name: '能管理自己的物品', type: 'boolean' },
    { id: 'zz8', name: '有良好的卫生习惯', type: 'boolean' },
    { id: 'zz9', name: '生活自理能力综合评价', type: 'rating' },
    { id: 'zz10', name: '教师综合评语', type: 'text' },
  ]
}

const zhongban_kexue: EvaluationTemplate = {
  id: 'zhongban_kexue',
  name: '中班幼儿科学探究能力评价',
  grade: '中班',
  domain: '科学探究',
  semester: '全学期',
  icon: '🔬',
  iconClass: 'science',
  items: [
    { id: 'zk1', name: '对周围事物保持好奇心', type: 'boolean' },
    { id: 'zk2', name: '能提出有意义的问题', type: 'boolean' },
    { id: 'zk3', name: '能通过观察发现事物特征', type: 'boolean' },
    { id: 'zk4', name: '能进行简单的分类', type: 'boolean' },
    { id: 'zk5', name: '能比较事物的异同', type: 'boolean' },
    { id: 'zk6', name: '能进行简单的测量', type: 'boolean' },
    { id: 'zk7', name: '能记录简单的观察结果', type: 'boolean' },
    { id: 'zk8', name: '能尝试用不同方法解决问题', type: 'boolean' },
    { id: 'zk9', name: '科学探究能力综合评价', type: 'rating' },
    { id: 'zk10', name: '教师综合评语', type: 'text' },
  ]
}

const zhongban_yishu: EvaluationTemplate = {
  id: 'zhongban_yishu',
  name: '中班幼儿艺术表现能力评价',
  grade: '中班',
  domain: '艺术表现',
  semester: '全学期',
  icon: '🎨',
  iconClass: 'art',
  items: [
    { id: 'zy1', name: '能感受和欣赏美的事物', type: 'boolean' },
    { id: 'zy2', name: '能用自己的方式表达对美的感受', type: 'boolean' },
    { id: 'zy3', name: '能有表情地唱歌', type: 'boolean' },
    { id: 'zy4', name: '能随音乐节奏做简单律动', type: 'boolean' },
    { id: 'zy5', name: '能用绘画表达自己的想法', type: 'boolean' },
    { id: 'zy6', name: '能使用多种材料进行手工制作', type: 'boolean' },
    { id: 'zy7', name: '能大胆展示自己的作品', type: 'boolean' },
    { id: 'zy8', name: '能欣赏和评价同伴的作品', type: 'boolean' },
    { id: 'zy9', name: '艺术表现能力综合评价', type: 'rating' },
    { id: 'zy10', name: '教师综合评语', type: 'text' },
  ]
}

const zhongban_shehui: EvaluationTemplate = {
  id: 'zhongban_shehui',
  name: '中班幼儿社会性发展评价',
  grade: '中班',
  domain: '社会性',
  semester: '全学期',
  icon: '👨‍👩‍👧',
  iconClass: 'social',
  items: [
    { id: 'zs1', name: '能积极参与集体活动', type: 'boolean' },
    { id: 'zs2', name: '能与多个同伴建立友谊', type: 'boolean' },
    { id: 'zs3', name: '能理解并遵守规则', type: 'boolean' },
    { id: 'zs4', name: '有初步的责任感', type: 'boolean' },
    { id: 'zs5', name: '能表达自己的情绪', type: 'boolean' },
    { id: 'zs6', name: '能理解他人的情绪', type: 'boolean' },
    { id: 'zs7', name: '有初步的集体荣誉感', type: 'boolean' },
    { id: 'zs8', name: '能完成力所能及的任务', type: 'boolean' },
    { id: 'zs9', name: '社会性发展综合评价', type: 'rating' },
    { id: 'zs10', name: '教师综合评语', type: 'text' },
  ]
}

const zhongban_yuyan: EvaluationTemplate = {
  id: 'zhongban_yuyan',
  name: '中班幼儿阅读语言能力评价',
  grade: '中班',
  domain: '语言阅读',
  semester: '全学期',
  icon: '📚',
  iconClass: 'lang',
  items: [
    { id: 'zyu1', name: '能认真倾听他人讲话', type: 'boolean' },
    { id: 'zyu2', name: '能听懂较复杂的语言', type: 'boolean' },
    { id: 'zyu3', name: '能清楚连贯地讲述', type: 'boolean' },
    { id: 'zyu4', name: '能有序地讲述事情', type: 'boolean' },
    { id: 'zyu5', name: '喜欢阅读图书', type: 'boolean' },
    { id: 'zyu6', name: '能理解图书内容', type: 'boolean' },
    { id: 'zyu7', name: '能续编或创编简单故事', type: 'boolean' },
    { id: 'zyu8', name: '有初步的书写兴趣', type: 'boolean' },
    { id: 'zyu9', name: '语言能力综合评价', type: 'rating' },
    { id: 'zyu10', name: '教师综合评语', type: 'text' },
  ]
}

// ==================== 大班评价模板 ====================

const daban_tinen: EvaluationTemplate = {
  id: 'daban_tinen',
  name: '大班幼儿体能评价',
  grade: '大班',
  domain: '体能发展',
  semester: '全学期',
  icon: '🏃',
  iconClass: 'sport',
  items: [
    { id: 'dt1', name: '能快速灵活地跑', type: 'boolean' },
    { id: 'dt2', name: '能连续跳绳', type: 'boolean' },
    { id: 'dt3', name: '能单脚连续向前跳8米以上', type: 'boolean' },
    { id: 'dt4', name: '能在斜坡、荡桥上行走', type: 'boolean' },
    { id: 'dt5', name: '能投掷目标', type: 'boolean' },
    { id: 'dt6', name: '能拍球、运球', type: 'boolean' },
    { id: 'dt7', name: '能协调灵活地攀爬', type: 'boolean' },
    { id: 'dt8', name: '能熟练使用筷子、剪刀', type: 'boolean' },
    { id: 'dt9', name: '能系鞋带、扣纽扣', type: 'boolean' },
    { id: 'dt10', name: '运动能力综合评价', type: 'rating' },
    { id: 'dt11', name: '教师综合评语', type: 'text' },
  ]
}

const daban_shijian: EvaluationTemplate = {
  id: 'daban_shijian',
  name: '大班幼儿实践操作能力评价',
  grade: '大班',
  domain: '实践操作',
  semester: '全学期',
  icon: '🛠️',
  iconClass: 'practice',
  items: [
    { id: 'ds1', name: '能有计划地完成任务', type: 'boolean' },
    { id: 'ds2', name: '能专注完成复杂操作', type: 'boolean' },
    { id: 'ds3', name: '能发现问题并尝试解决', type: 'boolean' },
    { id: 'ds4', name: '能与同伴分工合作', type: 'boolean' },
    { id: 'ds5', name: '能灵活使用各种工具', type: 'boolean' },
    { id: 'ds6', name: '能按步骤完成制作任务', type: 'boolean' },
    { id: 'ds7', name: '能对自己的作品进行改进', type: 'boolean' },
    { id: 'ds8', name: '实践操作能力综合评价', type: 'rating' },
    { id: 'ds9', name: '教师综合评语', type: 'text' },
  ]
}

const daban_tanjiu: EvaluationTemplate = {
  id: 'daban_tanjiu',
  name: '大班幼儿探究能力评价',
  grade: '大班',
  domain: '科学探究',
  semester: '全学期',
  icon: '🔬',
  iconClass: 'science',
  items: [
    { id: 'dta1', name: '能主动探索感兴趣的问题', type: 'boolean' },
    { id: 'dta2', name: '能提出有价值的问题', type: 'boolean' },
    { id: 'dta3', name: '能进行有目的的观察', type: 'boolean' },
    { id: 'dta4', name: '能做简单的实验验证想法', type: 'boolean' },
    { id: 'dta5', name: '能用图画或符号记录观察结果', type: 'boolean' },
    { id: 'dta6', name: '能分析比较得出结论', type: 'boolean' },
    { id: 'dta7', name: '能与同伴交流分享发现', type: 'boolean' },
    { id: 'dta8', name: '科学探究能力综合评价', type: 'rating' },
    { id: 'dta9', name: '教师综合评语', type: 'text' },
  ]
}

const daban_wenming: EvaluationTemplate = {
  id: 'daban_wenming',
  name: '大班幼儿文明交往习惯评价',
  grade: '大班',
  domain: '社会交往',
  semester: '全学期',
  icon: '🤝',
  iconClass: 'social',
  items: [
    { id: 'dw1', name: '能礼貌待人', type: 'boolean' },
    { id: 'dw2', name: '能主动关心帮助他人', type: 'boolean' },
    { id: 'dw3', name: '能与同伴协商合作', type: 'boolean' },
    { id: 'dw4', name: '能用恰当方式解决冲突', type: 'boolean' },
    { id: 'dw5', name: '能尊重他人的意见和权利', type: 'boolean' },
    { id: 'dw6', name: '能遵守公共规则', type: 'boolean' },
    { id: 'dw7', name: '能承担责任', type: 'boolean' },
    { id: 'dw8', name: '社交能力综合评价', type: 'rating' },
    { id: 'dw9', name: '教师综合评语', type: 'text' },
  ]
}

const daban_zili: EvaluationTemplate = {
  id: 'daban_zili',
  name: '大班幼儿生活自理能力评价',
  grade: '大班',
  domain: '生活自理',
  semester: '全学期',
  icon: '👕',
  iconClass: 'life',
  items: [
    { id: 'dz1', name: '能独立完成进餐', type: 'boolean' },
    { id: 'dz2', name: '能自己整理穿戴', type: 'boolean' },
    { id: 'dz3', name: '能独立完成盥洗', type: 'boolean' },
    { id: 'dz4', name: '能整理自己的物品和床铺', type: 'boolean' },
    { id: 'dz5', name: '能管理自己的学习用品', type: 'boolean' },
    { id: 'dz6', name: '有时间观念', type: 'boolean' },
    { id: 'dz7', name: '能为集体做力所能及的事', type: 'boolean' },
    { id: 'dz8', name: '有良好的生活习惯', type: 'boolean' },
    { id: 'dz9', name: '生活自理能力综合评价', type: 'rating' },
    { id: 'dz10', name: '教师综合评语', type: 'text' },
  ]
}

const daban_jimu: EvaluationTemplate = {
  id: 'daban_jimu',
  name: '大班幼儿积木区能力评价',
  grade: '大班',
  domain: '建构能力',
  semester: '全学期',
  icon: '🏗️',
  iconClass: 'build',
  items: [
    { id: 'dji1', name: '能有计划地进行建构', type: 'boolean' },
    { id: 'dji2', name: '能搭建复杂的造型', type: 'boolean' },
    { id: 'dji3', name: '能运用多种搭建技巧', type: 'boolean' },
    { id: 'dji4', name: '能与同伴合作完成大型建构', type: 'boolean' },
    { id: 'dji5', name: '能介绍和展示自己的作品', type: 'boolean' },
    { id: 'dji6', name: '能对作品进行改进完善', type: 'boolean' },
    { id: 'dji7', name: '有创意和想象力', type: 'boolean' },
    { id: 'dji8', name: '建构能力综合评价', type: 'rating' },
    { id: 'dji9', name: '教师综合评语', type: 'text' },
  ]
}

const daban_yishu: EvaluationTemplate = {
  id: 'daban_yishu',
  name: '大班幼儿艺术领域评价',
  grade: '大班',
  domain: '艺术表现',
  semester: '全学期',
  icon: '🎨',
  iconClass: 'art',
  items: [
    { id: 'dy1', name: '能感受和鉴赏艺术美', type: 'boolean' },
    { id: 'dy2', name: '能用多种形式表达艺术感受', type: 'boolean' },
    { id: 'dy3', name: '能有感情地演唱歌曲', type: 'boolean' },
    { id: 'dy4', name: '能创编简单的舞蹈动作', type: 'boolean' },
    { id: 'dy5', name: '能用多种材料和方式进行艺术创作', type: 'boolean' },
    { id: 'dy6', name: '作品有创意和个人风格', type: 'boolean' },
    { id: 'dy7', name: '能欣赏评价自己和他人的作品', type: 'boolean' },
    { id: 'dy8', name: '艺术表现能力综合评价', type: 'rating' },
    { id: 'dy9', name: '教师综合评语', type: 'text' },
  ]
}

const daban_shehui: EvaluationTemplate = {
  id: 'daban_shehui',
  name: '大班幼儿社会性发展评价',
  grade: '大班',
  domain: '社会性',
  semester: '全学期',
  icon: '👨‍👩‍👧',
  iconClass: 'social',
  items: [
    { id: 'dsh1', name: '有较强的集体归属感', type: 'boolean' },
    { id: 'dsh2', name: '能承担集体任务', type: 'boolean' },
    { id: 'dsh3', name: '能理解和遵守社会规则', type: 'boolean' },
    { id: 'dsh4', name: '有初步的是非观念', type: 'boolean' },
    { id: 'dsh5', name: '能管理和调节自己的情绪', type: 'boolean' },
    { id: 'dsh6', name: '有自信心', type: 'boolean' },
    { id: 'dsh7', name: '能面对困难和挫折', type: 'boolean' },
    { id: 'dsh8', name: '为入学做好心理准备', type: 'boolean' },
    { id: 'dsh9', name: '社会性发展综合评价', type: 'rating' },
    { id: 'dsh10', name: '教师综合评语', type: 'text' },
  ]
}

const daban_yuyan: EvaluationTemplate = {
  id: 'daban_yuyan',
  name: '大班阅读、语言能力评价',
  grade: '大班',
  domain: '语言阅读',
  semester: '上学期',
  icon: '📖',
  iconClass: 'lang',
  items: [
    { id: 'dyu1', name: '认真听并能听懂常用语言', type: 'boolean' },
    { id: 'dyu2', name: '能根据指令做出相应反应', type: 'boolean' },
    { id: 'dyu3', name: '愿意讲话并能清楚地表达', type: 'boolean' },
    { id: 'dyu4', name: '能有序、连贯地讲述事情', type: 'boolean' },
    { id: 'dyu5', name: '喜欢听故事、看图书', type: 'boolean' },
    { id: 'dyu6', name: '能理解图书内容并讲述', type: 'boolean' },
    { id: 'dyu7', name: '对汉字产生兴趣', type: 'boolean' },
    { id: 'dyu8', name: '愿意用图画和符号表达想法', type: 'boolean' },
    { id: 'dyu9', name: '正确书写自己的名字', type: 'boolean' },
    { id: 'dyu10', name: '有良好的阅读习惯', type: 'boolean' },
    { id: 'dyu11', name: '语言能力综合评价', type: 'rating' },
    { id: 'dyu12', name: '教师综合评语', type: 'text' },
  ]
}

// ==================== 导出所有模板 ====================

export const ALL_TEMPLATES: EvaluationTemplate[] = [
  // 托班
  tuoban_tinen,
  tuoban_yuedu,
  tuoban_shenghuo,
  // 小班
  xiaoban_tinen,
  xiaoban_quyu,
  xiaoban_jiangou,
  xiaoban_wenming,
  xiaoban_zili,
  xiaoban_kexue,
  xiaoban_yishu,
  xiaoban_shehui,
  xiaoban_yuyan,
  // 中班
  zhongban_tinen,
  zhongban_quyu,
  zhongban_wenming,
  zhongban_zili,
  zhongban_kexue,
  zhongban_yishu,
  zhongban_shehui,
  zhongban_yuyan,
  // 大班
  daban_tinen,
  daban_shijian,
  daban_tanjiu,
  daban_wenming,
  daban_zili,
  daban_jimu,
  daban_yishu,
  daban_shehui,
  daban_yuyan,
]

// 按年级分组
export const TEMPLATES_BY_GRADE = {
  '托班': ALL_TEMPLATES.filter(t => t.grade === '托班'),
  '小班': ALL_TEMPLATES.filter(t => t.grade === '小班'),
  '中班': ALL_TEMPLATES.filter(t => t.grade === '中班'),
  '大班': ALL_TEMPLATES.filter(t => t.grade === '大班'),
}

// 按领域分组
export const TEMPLATES_BY_DOMAIN = ALL_TEMPLATES.reduce((acc, t) => {
  if (!acc[t.domain]) acc[t.domain] = []
  acc[t.domain].push(t)
  return acc
}, {} as Record<string, EvaluationTemplate[]>)

export default ALL_TEMPLATES
