/**
 * 相关性阈值：只有得分超过此值的记忆才会被视为潜在相关。
 */
export const RELEVANCE_THRESHOLD = 5

/**
 * 记忆被选为"高相关"时增加的分数。
 */
export const SCORE_INCREMENT_TOP = 5

/**
 * 记忆被选为"次相关"时增加的分数。
 */
export const SCORE_INCREMENT_NEXT = 2

/**
 * 时间衰减因子：用于模拟遗忘，随着时间推移，记忆的相关性会下降。
 */
export const TIME_DECAY_FACTOR_EXP = 2e-9

/**
 * 最大因时间久远扣除的分数。
 */
export const MAX_TIME_PENALTY = 15

/**
 * 时间周期性加成的最大值。
 */
export const TIME_OF_DAY_MAX_BONUS = 3

/**
 * 时间周期性加成的标准差（分钟），决定时间窗口的宽窄。
 */
export const TIME_OF_DAY_STD_DEV_MINUTES = 120

/**
 * 随机回闪的基础权重。
 */
export const BASE_RANDOM_WEIGHT = 1

/**
 * 越新的记忆越容易随机浮现的权重因子。
 */
export const RANDOM_WEIGHT_RECENCY_FACTOR = 1.7

/**
 * 分数越高的记忆越容易随机浮现的权重因子。
 */
export const RANDOM_WEIGHT_SCORE_FACTOR = 1.1

/**
 * 参与随机权重计算的分数上限。
 */
export const MAX_SCORE_FOR_RANDOM_WEIGHT = 50

/**
 * 只有权重高于此值的词才会被视为关键词。
 */
export const KEYWORD_MIN_WEIGHT = 0.8

/**
 * 内存清理间隔（毫秒），每24小时清理一次。
 */
export const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * 记忆保留有效期（毫秒），1年。
 */
export const MEMORY_TTL_MS = 365 * 24 * 60 * 60 * 1000

/**
 * 清理时，相关性低于此分数的记忆可能被删除。
 */
export const CLEANUP_MIN_SCORE_THRESHOLD = -5

/**
 * 即使分数低，最少也要保留的记忆条数。
 */
export const MIN_RETAINED_MEMORIES = 512

/**
 * 不同记忆之间的时间间隔至少10分钟（避免同一对话的重复片段）。
 */
export const MIN_TIME_DIFFERENCE_ANY_MS = 10 * 60 * 1000

/**
 * 当前对话的记忆需要间隔20分钟才会被提取（避免复读刚才说的话）。
 */
export const MIN_TIME_DIFFERENCE_SAME_CHAT_MS = 20 * 60 * 1000

/**
 * 最终Prompt中"高相关"记忆的数量上限。
 */
export const MAX_TOP_RELEVANT = 2

/**
 * 最终Prompt中"次相关"记忆的数量上限。
 */
export const MAX_NEXT_RELEVANT = 1

/**
 * 最终Prompt中"随机回闪"记忆的数量上限。
 */
export const MAX_RANDOM_FLASHBACK = 2

/**
 * 关键词结构
 * @typedef {{
 *   word: string,
 *   weight: number
 * }} KeywordInfo
 */

/**
 * 记忆条目结构
 * @typedef {{
 * 	time_stamp: Date,       // 记忆发生的时间
 * 	text: string,           // 记忆文本内容（通常是对话快照）
 * 	keywords: KeywordInfo[],// 包含的关键词及其权重
 * 	score: number,          // 记忆的基础分数（会被强化或遗忘）
 * 	chat_name: string,      // 来源的聊天/会话名称
 * }} MemoryEntry
 */
