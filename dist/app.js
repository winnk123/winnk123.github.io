'use strict';
const R = globalThis.ATLAS_RESOURCES;
const byId = Object.fromEntries(R.map(r=>[r.id,r]));
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const e = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const external = (url,label,cls='') => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer" class="${cls}">${label}</a>`;
const defaultState = {category:'all',level:'all',type:'all',language:'all',frontier:false,saved:false,sort:'recommended',query:''};
let state = {...defaultState};
let bookmarks = {saved:[]};
let newsTopic = 'all';
let currentPage = 'home';
let openResource = null;
let storageAvailable = true;
let toastTimer;
try { const raw = localStorage.getItem('learning-atlas-bookmarks-v2') ?? localStorage.getItem('embodied-atlas-progress-v1'); if(raw) bookmarks = AtlasCore.sanitizeBookmarks(JSON.parse(raw),R.map(r=>r.id)); } catch { storageAvailable=false; }
const news = [
 {id:'api-loop',date:'2026.10.13',label:'部署与数据反馈',title:'Pi API beta：连接数据、训练与部署',teaser:'从上传数据、微调到推理，机器人学习的工具链正在成为研究与部署之间的重要连接。',lead:'Physical Intelligence 发布 Pi API beta，将数据上传、托管微调和云端推理连接起来。对学习者来说，值得关注的是失败分析如何反过来指导下一轮数据采集。',change:'这套工作流提供托管训练与云端推理，开发者可以根据评估结果继续补充示范数据、微调策略并测试表现。',learn:'学习建议：读完 LeRobot 的数据流程，再画一遍采集、训练、评估与补数据的循环，区分模型误差和系统延迟造成的失败。',sources:['pi-api-beta'],related:['lerobot','pi-recap']},
 {id:'reason-and-act',date:'2026.07.30',label:'具身推理与全身控制',title:'Gemini Robotics 2：推理、监控与动作各司其职',teaser:'把高层任务推理和低层运动执行分开，理解多步骤任务与多机器人协作的系统结构。',lead:'官方发布包含 Robotics 2、ER 2 与 On-Device 2。VLA 输出动作，ER 模型负责任务推理、进度理解与工具编排，设备端版本关注本地运行。',change:'研究从桌面动作扩展到全身控制与协作，通过持续观察跟踪任务进展，并将精细操作纳入评测。',learn:'学习建议：先读 OpenVLA，再分析“决定下一步做什么”和“产生连续动作”分别需要哪些数据与评价方式。把成功检测作为单独模块检查。',sources:['gemini-robotics-er2'],related:['openvla','libero']},
 {id:'groot-workflow',date:'2026.07.07',label:'开放模型与仿真工作流',title:'GR00T N1.7：读模型，也读完整实验流程',teaser:'把仿真、遥操作、数据转换、后训练与闭环评测放回同一个实验中理解。',lead:'NVIDIA 的端到端教程以 GR00T N1.7 为核心，连接仿真环境、示范采集、LeRobot 格式转换、模型适配与策略执行。',change:'教程让模型输入输出之外的环节变得具体：底层控制器、机器人动作接口、观测配置和数据格式都会影响最终表现。',learn:'学习建议：先掌握 Isaac Lab 与 LeRobot，逐项写出环境、策略与控制器的接口。比较模型时保持数据和评测设置一致。',sources:['groot17'],related:['isaac-lab','lerobot']},
 {id:'steerable-vla',date:'2026.04.16',label:'组合泛化与条件控制',title:'π0.7：用多模态提示引导通用策略',teaser:'语言指令、策略元数据与视觉子目标，共同构成通用策略的上下文。',lead:'π0.7 研究语言、元数据和视觉子目标等上下文，如何帮助模型利用混合来源的数据并适应新任务。它为“通用策略如何被引导”提供了新的研究材料。',change:'实验分别探索自主执行、分步语言提示与高层策略适配，展示不同条件如何影响新任务的表现。',learn:'学习建议：先阅读 openpi，再给论文中的每个实验标出新任务、新环境、新机体和使用的提示条件。把这些条件与成功率一起记录。',sources:['pi07'],related:['openpi','open-x-embodiment']},
 {id:'sim-data',date:'2026.03.11',label:'合成数据与 sim-to-real',title:'MolmoBot：仿真数据能带我们走多远？',teaser:'用程序生成的多样数据训练策略，把注意力放在跨越仿真与真实世界的条件上。',lead:'Ai2 的 MolmoBot 探索大规模仿真数据驱动的机器人操作，并报告在其测试平台上的无需真机微调迁移。官方随后在 3 月 27 日更新了代码与数据发布信息。',change:'这提供了区别于扩充真机示范的研究路径。关键问题是：仿真覆盖了哪些几何、视觉与动力学变化，哪些变化仍在分布之外？',learn:'学习建议：用 Isaac Lab 学习域随机化，再从论文评测设置反推它验证了什么。用未覆盖的视角、物体或摩擦变化设计额外对照。',sources:['molmobot'],related:['isaac-lab','open-x-embodiment']},
 {id:'long-horizon-evaluation',date:'2026.02.18',label:'长任务与评测设计',title:'RoboCasa365：让长任务的失败可以被分析',teaser:'从一个抓取动作走向多步骤日常任务，更丰富的评测需要更明确的实验约定。',lead:'RoboCasa365 将厨房任务扩展到 365 项，提供多样化场景和示范；后续更新加入逐帧子任务标注，便于研究长任务中的过程与失败。',change:'逐帧子任务标注让长任务可以按步骤分析：定位失败阶段、比较策略表现，并探索层级策略学习。',learn:'学习建议：先用 LIBERO 建立评测习惯，再比较一个原子任务和一个复合任务的成功条件、轨迹长度与失败分布。',sources:['robocasa365'],related:['libero','stanford-cs224r']},
 {id:'dl-bridge',date:'2025—2026',label:'深度学习 → 机器人学习',title:'连接前沿，先补齐三块基础',teaser:'语言建模系统、视觉表征、连续生成方法，分别对应 VLA 系统中的不同能力。',lead:'2026 版 CS336 与 MIT Flow Matching / Diffusion 课程，加上 2025 年发布的 DINOv3，构成一组连接现代深度学习与机器人研究的材料。',change:'CS336 帮助理解数据、训练成本和后训练；DINOv3 提供视觉表征实验入口；flow matching 帮助理解连续动作生成的数学结构。',learn:'按当前问题选择学习方向：训练与数据问题读 CS336，视觉迁移问题读 DINOv3，动作分布与采样问题读 flow matching。',sources:['cs336','dinov3','mit-flow-diffusion'],related:['openpi','smolvla']}
];
news.push(...(globalThis.ATLAS_EXTRA_NEWS??[]));
news.forEach(n=>{ n.category ??= n.id==='dl-bridge'?'llm':'embodied'; });
news.sort((a,b)=>b.date.localeCompare(a.date));
function notify(message) { $('#toast').textContent=message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200); }
function persist() { try { localStorage.setItem('learning-atlas-bookmarks-v2',JSON.stringify(bookmarks)); storageAvailable=true; } catch { storageAvailable=false; notify('浏览器存储不可用，记录暂存本页；请导出备份。'); } }
function savedButton(r) { const saved=bookmarks.saved.includes(r.id); return `<button class="save-button ${saved?'saved':''}" data-save="${r.id}" aria-label="${saved?'取消收藏':'收藏'} ${e(r.title)}" aria-pressed="${saved}">${saved?'★':'☆'}</button>`; }
function card(r) {return `<article class="resource-card"><div class="card-meta"><span><span class="type-badge ${r.category==='robot'?'robot':''}">${e(r.type)}</span>　${e(r.level)}</span>${savedButton(r)}</div><h3><button class="card-title" data-resource="${r.id}">${e(r.title)}</button></h3><div class="provider">${e(r.provider)}</div><p class="card-summary">${e(r.summary)}</p><div class="tags">${r.tags.slice(0,3).map(t=>`<span>${e(t)}</span>`).join('')}</div><div class="card-footer"><span>${e(r.language)} · ${r.year??'持续维护'}</span><div class="card-actions"><button data-resource="${r.id}">查看导读</button>${external(r.url,'↗','original-link')}</div></div></article>`;}
function renderHome(){
 $('#resource-total').textContent=6;
 Handbook.home();RobotPapers.home();
 $('#about-content-count').textContent=`2026-10-14 整理 · ${R.length} 条资料 · ${globalThis.ATLAS_GUIDES.length} 个核心主题 · ${news.length} 篇前沿观察。`;

 $('#home-frontier').innerHTML=news.slice(0,3).map(n=>`<a class="news-card" href="#frontier?article=${n.id}"><span class="news-meta">${n.date} · ${n.label}</span><h3>${n.title}</h3><p>${n.teaser}</p><span>研究导读 <b>↗</b></span></a>`).join('');
}
function renderCategories(){const categories=[['all','全部资料'],['robotics','机器人基础'],['dl','Deep Learning'],['llm','大模型'],['robot','Robot Learning']]; $('#category-filters').innerHTML=categories.map(([id,title])=>`<button class="category-button ${state.category===id?'active':''}" data-category="${id}" aria-pressed="${state.category===id}">${title}<span>${id==='all'?R.length:R.filter(r=>r.category===id).length}</span></button>`).join('');}
function renderLibrary(){
 renderCategories();
 const found=AtlasCore.selectResources(R,state,bookmarks.saved);
 $('#result-count').innerHTML=`找到 <strong>${found.length}</strong> 条资料${state.query?` · “${e(state.query)}”`:''}`;
 $('#resource-results').innerHTML=found.length?found.map(card).join(''):`<div class="empty-state"><div class="empty-icon">⌕</div><h3>${state.saved?'还没有符合条件的书签':'暂时没有找到匹配资料'}</h3><p>${state.saved?'点击资料卡片上的 ☆，把值得再读的内容收进来。':'试试更短的关键词，或者放宽筛选条件。'}</p><button data-action="reset">查看全部资料</button></div>`;
 $('#saved-count').textContent=bookmarks.saved.length;
}
function syncControls(){ $('#library-query').value=state.query; $('#level-filter').value=state.level; $('#type-filter').value=state.type; $('#language-filter').value=state.language; $('#sort-filter').value=state.sort; $('#frontier-filter').checked=state.frontier; $('#saved-filter').checked=state.saved; }
function replaceFilterURL(){const p=new URLSearchParams();for(const [k,v] of Object.entries(state)) if(v!==defaultState[k]) p.set(k,String(v));history.replaceState(null,'',`#sources${p.size?'?'+p:''}`);}
function updateFilters(){renderLibrary();replaceFilterURL();}
function renderFrontier(){
 const selected=news.filter(n=>newsTopic==='all'||n.category===newsTopic);
 $$('[data-news-topic]').forEach(b=>{b.classList.toggle('active',b.dataset.newsTopic===newsTopic);b.setAttribute('aria-pressed',b.dataset.newsTopic===newsTopic);});
 $('#frontier-articles').innerHTML=selected.map(n=>{
  const linked=(globalThis.ATLAS_GUIDES??[]).filter(g=>(g.resourceIds??[]).some(id=>[...n.related,...n.sources.filter(x=>typeof x==='string')].includes(id)));
  const relatedGuide=(globalThis.ATLAS_GUIDES??[]).find(g=>g.id===n.guideId)||linked.find(g=>g.track==='frontier')||linked[0];
  return `<article id="article-${n.id}" class="research-article"><div class="article-aside"><time>${n.date}</time><span>${n.category==='llm'?'大模型':'具身智能'} · ${n.label}</span></div><div class="article-body"><h2>${n.title}</h2><p class="article-lead">${n.lead}</p><details class="frontier-detail"><summary>方法与研究切入点</summary><div class="article-columns"><div><h4>方法与进展</h4><p>${n.change}</p></div><div><h4>理解基础</h4><p>${e(relatedGuide?.knowledge?.summary||n.learn)}</p></div></div></details>${relatedGuide?`<a class="frontier-guide-link" href="#guide?id=${relatedGuide.id}">核心知识：${e(relatedGuide.knowledge.title)} <span>→</span></a>`:''}<div class="article-links">${n.sources.map(source=>{const r=typeof source==='string'?byId[source]:source;return external(r.url,`${e(r.title.split(' · ')[0])} ↗`);}).join('')}</div><div class="article-links"><span class="related-label">相关资料</span>${n.related.filter(id=>byId[id]).map(id=>`<button data-resource="${id}">${e(byId[id].title.split(' · ')[0])} →</button>`).join('')}</div></div></article>`;
 }).join('');
}
function showResource(id){const r=byId[id];if(!r)return;openResource=id;const dialog=$('#resource-dialog');$('#dialog-content').innerHTML=`<div class="dialog-eyebrow">${({dl:'DEEP LEARNING',robot:'ROBOT LEARNING',robotics:'ROBOTICS',llm:'LARGE MODELS'})[r.category]} / ${e(r.type)} / ${e(r.level)}</div><h2 class="dialog-title" id="dialog-title">${e(r.title)}</h2><div class="dialog-provider">${e(r.provider)} · ${e(r.language)} · ${r.year??'持续维护'}</div><p class="dialog-summary">${e(r.summary)}</p><div class="tags">${r.tags.map(t=>`<span>${e(t)}</span>`).join('')}</div>${Handbook.resourceLinks(r.id)}<dl><div class="detail-row"><dt>为什么值得学</dt><dd>${e(r.why)}</dd></div><div class="detail-row"><dt>前置知识</dt><dd>${e(r.prereq)}</dd></div><div class="detail-row"><dt>相关主题</dt><dd>${r.tags.map(e).join(' · ')}</dd></div></dl>${r.access ? `<p class="resource-access">${e(r.access)}</p>` : ""}<p class="source-proof">${e(r.sourceNote)} · 整理于 ${e(r.checked)}</p><div class="dialog-actions">${external(r.url,'打开原始资料 ↗','primary-button')}${r.paperUrl?external(r.paperUrl,'论文 ↗','secondary-button'):''}${r.codeUrl&&r.codeUrl!==r.url?external(r.codeUrl,'代码 ↗','secondary-button'):''}<button class="secondary-button" data-save="${r.id}" aria-pressed="${bookmarks.saved.includes(id)}">${bookmarks.saved.includes(id)?'★ 已收藏':'☆ 收藏'}</button></div>`;
 if(!dialog.open) dialog.showModal(); dialog.scrollTop=0;
}
function toggleBookmark(id){if(!byId[id])return;const exists=bookmarks.saved.includes(id);bookmarks.saved=exists?bookmarks.saved.filter(x=>x!==id):[...bookmarks.saved,id];persist();renderHome();renderLibrary();if(openResource===id && $('#resource-dialog').open)showResource(id);if(storageAvailable)notify(exists?'已移出书签':'已加入书签');}
function navigate(hash){if(location.hash===hash) route();else location.hash=hash;}
function route(){
 const [raw,query='']=location.hash.slice(1).split('?');const params=new URLSearchParams(query);const page=raw==='sources'||(raw==='library'&&params.has('saved'))?'library':['paths','library'].includes(raw)?'guides':['home','guides','guide','robot-papers','frontier','about'].includes(raw)?raw:'home';currentPage=page;
 $$('.page').forEach(p=>p.hidden=p.id!==`page-${page}`);$$('[data-nav]').forEach(a=>{const inLLM=(page==='guides'&&params.get('topic')==='llm')||(page==='guide'&&globalThis.ATLAS_GUIDES.find(g=>g.id===params.get('id'))?.category==='llm');const active=a.dataset.nav===(inLLM?'llm':page==='guide'?'guides':page);a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 const titles={home:'深度学习与机器人智能',library:'原始资料索引',guides:'知识库',guide:'核心知识','robot-papers':'机器人论文精读',frontier:'前沿观察',about:'筛选标准'};document.title=`${titles[page]} · Learning Atlas`;
 if(page==='library'){state={...defaultState};for(const k of Object.keys(defaultState)){const v=params.get(k);if(v!==null)state[k]=typeof defaultState[k]==='boolean'?v==='true':v;} if(!['all','dl','robot','robotics','llm'].includes(state.category))state.category='all';syncControls();renderLibrary();}
 if(page==='guides')Handbook.renderIndex(params);
 if(page==='robot-papers')RobotPapers.render(params);
 if(page==='guide')Handbook.renderArticle(params.get('id'));
 if(page==='frontier'){newsTopic=params.get('topic')||'all';renderFrontier();}
 window.scrollTo({top:0,behavior:'instant'});
 if(page==='guide'&&params.get('section'))requestAnimationFrame(()=>Handbook.jumpToSection(params.get('section'),'instant'));
 if(page==='frontier' && params.get('article')){const article=document.getElementById('article-'+params.get('article'));if(article) requestAnimationFrame(()=>article.scrollIntoView({behavior:'instant',block:'start'}));}
}
function startSearch(query){navigate('#guides?query='+encodeURIComponent(query.trim()));}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-guide-link]') && $('#resource-dialog').open)$('#resource-dialog').close();
 const nt=event.target.closest('[data-news-topic]');if(nt){newsTopic=nt.dataset.newsTopic;history.replaceState(null,'','#frontier'+(newsTopic==='all'?'':'?topic='+newsTopic));renderFrontier();return;}
 const r=event.target.closest('[data-resource]');if(r){showResource(r.dataset.resource);return;}
 const save=event.target.closest('[data-save]');if(save){toggleBookmark(save.dataset.save);return;}
 const search=event.target.closest('[data-search]');if(search){startSearch(search.dataset.search);return;}
 const cat=event.target.closest('[data-category]');if(cat){state.category=cat.dataset.category;updateFilters();return;}
 const action=event.target.closest('[data-action]');if(action?.dataset.action==='collection')navigate('#sources?saved=true');if(action?.dataset.action==='reset'){state={...defaultState};syncControls();updateFilters();}
});
$('#hero-search').addEventListener('submit',ev=>{ev.preventDefault();startSearch($('#hero-query').value);});
$('#library-query').addEventListener('input',ev=>{state.query=ev.target.value;updateFilters();});
for(const [id,key] of [['level-filter','level'],['type-filter','type'],['language-filter','language'],['sort-filter','sort'],['frontier-filter','frontier'],['saved-filter','saved']]){document.getElementById(id).addEventListener('change',ev=>{state[key]=ev.target.type==='checkbox'?ev.target.checked:ev.target.value;updateFilters();});}
$('#reset-filters').addEventListener('click',()=>{state={...defaultState};syncControls();updateFilters();});
$('.dialog-close').addEventListener('click',()=>$('#resource-dialog').close());
$('#resource-dialog').addEventListener('close',()=>openResource=null);
$('#resource-dialog').addEventListener('click',ev=>{if(ev.target===$('#resource-dialog')){const r=ev.target.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)ev.target.close();}});
$('#export-bookmarks').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'learning-atlas-bookmarks-v2',exportedAt:new Date().toISOString(),...bookmarks},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='learning-atlas-bookmarks.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('书签已导出');});
$('#import-bookmarks').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async ev=>{const file=ev.target.files[0];if(!file)return;try{if(file.size>1000000)throw new Error('文件过大，请选择本站导出的记录文件。');const imported=AtlasCore.sanitizeBookmarks(JSON.parse(await file.text()),R.map(r=>r.id));bookmarks={saved:[...new Set([...bookmarks.saved,...imported.saved])]};persist();renderHome();renderLibrary();notify(storageAvailable?'书签已合并导入':'记录已导入本页；浏览器存储不可用，请保留备份。');}catch(err){notify(err instanceof SyntaxError?'无法读取 JSON，请选择正确的导出文件。':err.message);}ev.target.value='';});
$('#type-filter').innerHTML='<option value="all">全部类型</option>'+[...new Set(R.map(r=>r.type))].map(t=>`<option>${e(t)}</option>`).join('');
Handbook.init();renderHome();renderLibrary();renderFrontier();window.addEventListener('hashchange',route);route();
