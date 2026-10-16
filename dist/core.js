'use strict';
globalThis.AtlasCore = (() => {
  const aliases = { 'robot learning':'机器人 模仿学习 强化学习', 'deep learning':'深度学习 神经网络', '强化学习':'reinforcement rl', '模仿学习':'imitation 行为克隆 act diffusion', '扩散':'diffusion', '具身':'robot vla 机器人', '世界模型':'world model', 'flow matching':'流匹配', 'pytorch':'torch', 'vla':'视觉语言动作', 'ik':'逆运动学', 'llm':'大模型', 'calibration':'标定' };
  const normalize = s => String(s ?? '').toLowerCase().normalize('NFKC').replace(/π/g,'pi').replace(/[·/]/g,' ');
  function matchesQuery(resource, query) {
    const q = normalize(query).trim();
    if (!q) return true;
    const hay = normalize([resource.title,resource.provider,resource.summary,resource.why,resource.prereq,resource.type,resource.level,...resource.tags,({dl:'deep learning 深度学习',robot:'robot learning 机器人 具身智能',robotics:'kinematics calibration ik 机器人基础 运动学 标定',llm:'llm 大模型 language model'})[resource.category]].join(' '));
    if(hay.includes(q)) return true;
    if(q === 'deep learning') return resource.category === 'dl';
    if(q === 'robot learning') return resource.category === 'robot';
    if(aliases[q] && aliases[q].split(' ').some(t => hay.includes(t))) return true;
    return q.split(/\s+/).every(t => hay.includes(t));
  }
  function selectResources(resources, state, saved = []) {
    const selected = resources.filter(r => (state.category === 'all' || r.category === state.category) && (state.level === 'all' || r.level === state.level) && (state.type === 'all' || r.type === state.type) && (state.language === 'all' || (state.language === 'zh' ? r.language.includes('中') : r.language.includes('英'))) && (!state.frontier || r.frontier) && (!state.saved || saved.includes(r.id)) && matchesQuery(r,state.query));
    if(state.sort === 'newest') selected.sort((a,b)=>(b.year ?? 0)-(a.year ?? 0));
    return selected;
  }
  function sanitizeBookmarks(value, validIds) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.saved)) throw new Error('记录格式不正确，请选择本站导出的 JSON 文件。');
    const valid = new Set(validIds);
    return {saved:[...new Set(value.saved.filter(x=>typeof x==='string' && valid.has(x)))]};
  }
  return {selectResources,matchesQuery,sanitizeBookmarks};
})();
