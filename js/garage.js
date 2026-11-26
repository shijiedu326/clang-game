// 菜单子页面：车库（花零件解锁开局武器 / 开局卡 / 天赋）、每日挑战（今日规则 + 历史成绩）
import { save } from './save.js';
import { ICON } from './hud.js';
import { G_WEAPONS, G_CARDS, TALENTS, tlv, talentCost, cardOf, buyUnlock, buyTalent, equip, RULES, dailyInfo, dailyHistory, dailyBest, keyText } from './meta.js';

let tab = 'w';
const art = c => c.icon ? `<svg viewBox="0 0 66 32"><path d="${ICON[c.icon]}"/></svg>` : `<b class="gr-gl">${c.glyph}</b>`;
function item({ slot, v, key, cost, a, name, desc, rar }) {
  const own = !!save.unlocks[key], on = save.loadout[slot] === v, poor = !own && save.parts < cost;
  return `<div class="gr-it${own ? ' own' : ''}${on ? ' on' : ''}${poor ? ' poor' : ''}${rar ? ' r' + rar : ''}" data-slot="${slot}" data-v="${v}" data-key="${key}" data-cost="${cost}">
    <div class="gr-art">${a}</div><b>${name}</b><small>${desc}</small>
    <button class="gr-btn">${on ? '✓ 已装备' : own ? '装备' : `⚙ ${cost} 解锁`}</button></div>`;
}
export function garagePage(p, close, onChange) {
  const draw = () => {
    const tabs = [['w', '开局武器'], ['c', '开局卡'], ['t', '天赋']].map(([k, t]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('');
    let body = '';
    if (tab === 'w') {
      body = `<p class="tip">解锁后可以挑一把带进每一局（手枪一直都在）。再点一次“已装备”就是不带。</p><div class="gr-grid">` +
        G_WEAPONS.map(w => { const c = cardOf('w_' + w.k); return item({ slot: 'weapon', v: w.k, key: 'w:' + w.k, cost: w.cost, a: art({ icon: w.k }), name: w.name, desc: c ? c.desc : '' }); }).join('') + '</div>';
    } else if (tab === 'c') {
      body = `<p class="tip">开局卡在第 1 关开打前就生效，只能带一张。</p><div class="gr-grid">` +
        G_CARDS.map(g => { const c = cardOf(g.id); return item({ slot: 'card', v: g.id, key: 'c:' + g.id, cost: g.cost, a: art(c), name: c.name, desc: c.desc, rar: c.rarity }); }).join('') + '</div>';
    } else {
      body = `<p class="tip">天赋永久生效，每一局开局自动带上；越往上越贵。</p><div class="gr-tls">` + TALENTS.map(T => {
        const l = tlv(T.id), full = l >= T.max, cost = talentCost(T);
        const pips = Array.from({ length: T.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
        return `<div class="gr-tl${full ? ' full' : ''}${!full && save.parts < cost ? ' poor' : ''}" data-id="${T.id}"><span class="gr-g">${T.glyph}</span>
          <div class="gr-tn"><b>${T.name} <em>Lv ${l}/${T.max}</em></b><small>每级：${T.per}</small></div><span class="gr-pips">${pips}</span>
          <button class="gr-btn">${full ? '已满' : `⚙ ${cost} 升级`}</button></div>`;
      }).join('') + '</div>';
    }
    p.innerHTML = close + `<h3>车库 GARAGE <span class="gr-bank">⚙ <b>${save.parts}</b> 零件</span><span class="tabs">${tabs}</span></h3>${body}
      <p class="tip">零件：打怪掉的（大家伙和精英给得多，Boss 给 25），每过一关、局结束时自动存进车库。每日挑战不吃车库加成。</p>`;
    p.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    p.querySelectorAll('.gr-it .gr-btn').forEach(b => b.onclick = () => {
      const d = b.closest('.gr-it').dataset;
      if (save.unlocks[d.key]) equip(d.slot, d.v); else if (!buyUnlock(d.key, +d.cost)) return nope(b);
      draw(); onChange();
    });
    p.querySelectorAll('.gr-tl .gr-btn').forEach(b => b.onclick = () => {
      const T = TALENTS.find(t => t.id === b.closest('.gr-tl').dataset.id);
      if (!buyTalent(T)) return nope(b);
      draw(); onChange();
    });
    p.querySelector('.x').onclick = () => { p.className = ''; p.innerHTML = ''; };
  };
  draw();
}
function nope(b) { b.classList.remove('gr-no'); void b.offsetWidth; b.classList.add('gr-no'); }

export function dailyPage(p, close, onStart) {
  const D = dailyInfo(), H = dailyHistory(14), B = dailyBest(), rec = D.rec;
  const prev = H.slice(0, -1).reverse().find(h => h.rec && h.rec.best);
  const max = Math.max(1, ...H.map(h => h.rec ? h.rec.best : 0));
  const bars = H.map(h => {
    const r = h.rec, m = Math.floor(h.key / 100) % 100, d = h.key % 100, today = h.key === D.key;
    return `<div class="dy-bar${today ? ' today' : ''}${r && r.best ? '' : ' none'}"><em>${r && r.best ? r.best : ''}</em><i style="height:${r ? Math.max(3, r.best / max * 100) : 0}%"></i><span>${today ? '今天' : m + '/' + d}</span></div>`;
  }).join('');
  let cmp = '';
  if (rec && rec.best && prev) { const dlt = rec.best - prev.rec.best; cmp = ` · 比 ${keyText(prev.key).slice(5)} ${dlt >= 0 ? '<b class="up">+' + dlt + '</b>' : '<b class="down">' + dlt + '</b>'}`; }
  p.innerHTML = close + `<h3>每日挑战 DAILY <small>${keyText(D.key)} · 种子 #${D.key}</small></h3>
    <div class="dy-rules">${D.rules.map(r => `<div class="dy-r"><b class="dy-g">${RULES[r].glyph}</b><div><b>${RULES[r].name}</b><small>${RULES[r].desc}</small></div></div>`).join('')}</div>
    <p class="tip">今天的关卡、刷怪和选卡对所有人都一样，零点换一套。车库的开局装备和天赋不生效，从第 1 关打起；零件照样带出来。</p>
    <div class="dy-me">今日最佳 <b>${rec && rec.best ? rec.best : '—'}</b>${rec && rec.best ? `（第 ${rec.level} 关）` : ''} · 已试 <b>${rec ? rec.tries : 0}</b> 次${cmp}<br>每日挑战个人最高 <b>${B && B.best ? B.best : '—'}</b>${B && B.best ? `（${keyText(B.key)}，第 ${B.level} 关）` : ''}</div>
    <div class="dy-hist">${bars}</div>
    <button class="dy-go">开始今日挑战 ▶</button>`;
  p.querySelector('.dy-go').onclick = onStart;
}
