const ADJECTIVES = [
  '飞车', '稳如', '极限', '极速', '狂暴', '冷静',
  '热血', '越野', '闪电', '钢铁', '追风', '孤胆',
  '沙漠', '山巅', '深渊', '无畏', '暗夜', '黎明',
]

const NOUNS = [
  '骑士', '猎手', '老狗', '韭菜', '游侠', '车神',
  '达人', '先锋', '大师', '玩家', '浪人', '幽灵',
  '舵手', '赌怪', '操盘', '猎豹', '磐石', '烈焰',
]

export function randomName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return adjective + noun
}
