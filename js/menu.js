import { settings, save, saveSettings, DEFAULTS } from './save.js';
import { TYPES } from './enemies.js';
import { POOL } from './cards.js';
import { ICON } from './hud.js';
import { BOSS_ORDER } from './bosses.js';
import { MAPS, mapForLevel } from './world.js';

// 菜单：主菜单 / 暂停 / 结算 三种导航，子页面：选关、图鉴、设置
export const menu = { on: {}, portrait: null, mode: null };
const $ = id => document.getElementById(id);
const NAV = {
  main: [['start', '开始游戏 ▶', 1], ['levels', '选关'], ['codex', '图鉴 CODEX'], ['settings', '设置']],
  pause: [['resume', '继续 ▶', 1], ['settings', '设置'], ['codex', '图鉴 CODEX'], ['quit', '回主菜单']],
  over: [['retry', '再来一次 ▶', 1], ['levels', '选关'], ['quit', '回主菜单']],
};
export function showMenu(mode, info = '') {
  menu.mode = mode;
  const m = $('menu'); m.style.display = 'flex'; m.className = 'm-' + mode;
  $('nav').innerHTML = NAV[mode].map(([k, t, big]) => `<button data-k="${k}" class="${big ? 'big' : ''}">${t}</button>`).join('');
  $('nav').querySelectorAll('button').forEach(b => b.onclick = () => act(b.dataset.k));
  $('mtitle').innerHTML = mode === 'pause' ? '<div class="logo sm">PAUSED</div>' : mode === 'over' ? '<div class="logo sm red">GAME OVER</div>' : '<div class="logo big"><span class="l1">SCRAP</span><span class="l2">RIOT!</span><i class="bolt">⚙</i></div><div class="sub">废铁暴动 · 拆机废品场</div><div class="tag3">SCRAP. SHOOT. SURVIVE.</div>';
  $('minfo').innerHTML = info || (mode === 'main' ? `最高分 <b>${save.best}</b> · 最远第 <b>${save.bestLevel || 0}</b> 关 · 已玩 <b>${save.runs}</b> 局` : '');
  page(null);
}
export function hideMenu() { $('menu').style.display = 'none'; page(null); }
function act(k) {
  if (k === 'start') menu.on.start(1);
  else if (k === 'retry') menu.on.start(menu.lastStart || 1);
  else if (k === 'resume') menu.on.resume();
  else if (k === 'quit') menu.on.quit();
  else page(k);
}
function page(k) {
  const p = $('page'); p.className = k ? 'on p-' + k : ''; if (!k) { p.innerHTML = ''; return; }
  const close = '<button class="x" title="关闭">✕</button>';
  if (k === 'levels') {
    const bossName = lv => TYPES[BOSS_ORDER[(lv / 5 - 1) % 6]].name;
    p.innerHTML = close + `<h3>选关 <small>从第 1 关或打到过的 Boss 关开始；跳关会自动补发卡牌；每 10 关换一张地图</small></h3><div class="lvgrid">` +
      [1, 5, 10, 15, 20, 25, 30].map(lv => {
        const ok = save.reached.includes(lv);
        return `<div class="lv ${ok ? '' : 'lock'}" data-lv="${lv}"><b>${lv}</b><span>${lv === 1 ? '从头开始' : ok ? 'BOSS · ' + bossName(lv) : '未到达'}</span>${lv > 1 && ok ? `<i>补发 ${Math.floor((lv - 1) / 2)} 张卡</i>` : ''}<em class="lvmap lvmap-${mapForLevel(lv)}">${MAPS[mapForLevel(lv)].name}</em></div>`;
      }).join('') + '</div>';
    p.querySelectorAll('.lv:not(.lock)').forEach(d => d.onclick = () => { menu.lastStart = +d.dataset.lv; menu.on.start(+d.dataset.lv); });
  } else if (k === 'codex') {
    p.innerHTML = close + `<h3>图鉴 CODEX <span class="tabs"><button data-t="foe" class="on">敌人</button><button data-t="boss">BOSS</button><button data-t="card">卡牌</button></span></h3><div class="cxgrid"></div>`;
    const fill = t => {
      p.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      const g = p.querySelector('.cxgrid');
      if (t === 'card') {
        g.innerHTML = POOL.map(c => save.cards[c.id] ? `<div class="cx card r${c.rarity}"><div class="art">${c.icon ? `<svg viewBox="0 0 66 32"><path d="${ICON[c.icon]}"/></svg>` : `<b>${c.glyph}</b>`}</div><b>${c.name}</b><small>${c.desc}</small></div>` : `<div class="cx card lock"><div class="art"><b>?</b></div><b>？？？</b><small>还没抽到过</small></div>`).join('');
        return;
      }
      const ids = Object.keys(TYPES).filter(id => !!TYPES[id].boss === (t === 'boss')).sort((a, b) => TYPES[a].no - TYPES[b].no);
      g.innerHTML = ids.map(id => {
        const T = TYPES[id], ok = save.codex[id];
        return ok ? `<div class="cx"><img data-id="${id}"><div class="no">#${String(T.no).padStart(2, '0')}</div><b>${T.name} <i>${T.en}</i></b>
          <small>攻击：${T.atk}<br>弱点：${T.weak}${T.armor ? '<br>' + T.armor : ''}<br>血量：${T.hp}</small></div>`
          : `<div class="cx lock"><div class="ph">?</div><div class="no">#${String(T.no).padStart(2, '0')}</div><b>？？？</b><small>还没遇到过</small></div>`;
      }).join('');
      // 头像渲染比较慢，逐个异步填
      const imgs = [...g.querySelectorAll('img[data-id]')];
      (function next() { const im = imgs.shift(); if (!im) return; im.src = menu.portrait(im.dataset.id); setTimeout(next, 0); })();
    };
    p.querySelectorAll('.tabs button').forEach(b => b.onclick = () => fill(b.dataset.t));
    fill('foe');
  } else if (k === 'settings') {
    const row = (key, label, min, max, step, fmt) => `<label class="st"><span>${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}"><em data-v="${key}">${fmt(settings[key])}</em></label>`;
    const pc = v => Math.round(v * 100) + '%';
    p.innerHTML = close + `<h3>设置</h3>
      ${row('sens', '鼠标灵敏度', 0.3, 2.5, 0.05, v => (+v).toFixed(2) + '×')}
      ${row('fov', '视野', 65, 100, 1, v => v + '°')}
      ${row('music', '音乐音量', 0, 1, 0.01, pc)}
      ${row('sfx', '音效音量', 0, 1, 0.01, pc)}
      <label class="st"><span>画质</span><span class="seg">${['high', 'mid', 'low'].map(q => `<button data-q="${q}" class="${settings.quality === q ? 'on' : ''}">${{ high: '高', mid: '中', low: '低（不卡优先）' }[q]}</button>`).join('')}</span></label>
      <p class="tip">高：阴影 + 1.5 倍清晰度；中：阴影 + 1 倍；低：关阴影、降分辨率。设置自动保存。</p>
      <button class="reset">恢复默认</button>`;
    const fmts = { sens: v => (+v).toFixed(2) + '×', fov: v => v + '°', music: pc, sfx: pc };
    p.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { settings[r.dataset.k] = +r.value; p.querySelector(`[data-v=${r.dataset.k}]`).textContent = fmts[r.dataset.k](r.value); saveSettings(); menu.on.apply(); });
    p.querySelectorAll('.seg button').forEach(b => b.onclick = () => { settings.quality = b.dataset.q; saveSettings(); menu.on.apply(); page('settings'); });
    p.querySelector('.reset').onclick = () => { Object.assign(settings, DEFAULTS); saveSettings(); menu.on.apply(); page('settings'); };
  }
  p.querySelector('.x').onclick = () => page(null);
}
