// 卡牌改出来的全部属性。武器、敌人、玩家都从这里读，避免循环依赖
export const mods = {};
export const skills = {};
export function resetStats() {
  Object.assign(mods, {
    dmg: 1, rate: 1, mag: 1, reload: 1, spread: 1, pellets: 0,
    headMul: 2, armorK: 0.12,          // 爆头倍率、打正面装甲的伤害系数
    lifesteal: 0, armorSteal: 0, chain: 0, // 击杀回血/回甲、连锁爆破伤害
    // 燃烧流派：点燃概率、燃烧伤害倍率、持续秒数、对燃烧敌人增伤、烧死回甲
    burn: 0, burnDmg: 1, burnDur: 3, burnBonus: 0, burnArmor: 0,
    // 电击流派：放电概率、电弧伤害倍率、跳几个、跳多远、麻痹秒数、每 N 发必放电
    arc: 0, arcDmg: 1, arcJumps: 2, arcRange: 6, arcStun: 0, arcEvery: 0,
    // 爆炸流派：范围倍率、伤害倍率、爆头引爆、高爆弹头、爆炸回甲
    boomR: 1, boomDmg: 1, boomCrit: 0, he: 0, boomArmor: 0,
    sets: {},                          // 已激活的流派套装 fire / shock / boom
  });
  for (const k in skills) delete skills[k]; // hook / dash
}
resetStats();
