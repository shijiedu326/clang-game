// 卡牌改出来的全部属性。武器、敌人、玩家都从这里读，避免循环依赖
export const mods = {};
export const skills = {};
export function resetStats() {
  Object.assign(mods, {
    dmg: 1, rate: 1, mag: 1, reload: 1, spread: 1, pellets: 0,
    headMul: 2, armorK: 0.12,          // 爆头倍率、打正面装甲的伤害系数
    lifesteal: 0, armorSteal: 0, chain: 0, // 击杀回血/回甲、连锁爆破伤害
  });
  for (const k in skills) delete skills[k]; // hook / dash
}
resetStats();
