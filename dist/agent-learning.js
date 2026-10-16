'use strict';
globalThis.AgentLearning=(()=>{
 const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const $=id=>document.getElementById(id),base='llm-agent-foundations',front='llm-agent-memory';
 const topics=[
  ['交互循环','ReAct','模型怎样根据工具返回选择下一步',base,'react'],
  ['工具学习','Toolformer','调用时机与参数怎样进入模型能力',base,'toolformer'],
  ['反思与规划','Reflexion / LATS','复用尝试经验，比较候选行动路线',base,'lats'],
  ['长期记忆','AgentFold / CompactionRL','整理工作上下文，让任务跨片段继续',front,'agentfold'],
  ['Agent 强化学习','ToolVerse','环境、依赖链与逐轮奖励怎样设计',front,'toolverse'],
  ['多 Agent 协作','Agent Scaling','按任务依赖关系安排通信与核对',front,'agent-scaling']
 ];
 const steps=[
  {title:'整理信息，选择下一步',owner:'模型',input:'目标、工具说明、已有行动和真实返回',output:'下一步需要取得的信息，或已经满足的完成条件',text:'ReAct 用任务推理连接目标与行动。每轮都读取刚更新的上下文，重新判断当前缺少什么；完成条件满足时可以选择 Finish。'},
  {title:'Action：提出可执行请求',owner:'模型',input:'当前判断与可用工具的参数定义',output:'工具名称与结构化参数',text:'请求规定调用哪个函数、使用哪些参数。参数提交后，运行程序接手执行；同一请求的返回会用调用标识与它对应。'},
  {title:'工具执行，取得外部结果',owner:'运行程序与环境',input:'工具请求及当前环境状态',output:'查询数据、执行状态或错误信息',text:'工具在真实或模拟环境中运行。查询返回新的信息，修改操作还会改变环境；这些实际结果构成接下来的观察。'},
  {title:'Observation：把结果接回上下文',owner:'运行程序回写，模型读取',input:'行动及其实际返回',output:'更新后的历史，送入下一轮模型调用',text:'将行动与结果成对保存。模型利用新证据继续决策：空结果可以触发改写查询，参数错误可以触发修正，完整证据可以支持结束任务。'},
  {title:'Finish：对照目标提交结果',owner:'模型选择，运行程序结束循环',input:'当前任务状态、证据与完成条件',output:'最终结果与执行状态',text:'结束是决策的一条分支。系统汇集已完成的操作和必要结果并交付；运行时还可以按时间或调用预算结束本次执行。'}
 ];
 let step=0;
 function overview(k){if(!k.agentTopic)return '';return `<section class="agent-map"><div class="visual-kicker">AGENT · 从基础到前沿</div><h2>按六个问题，读懂 Agent 系统</h2><div class="agent-topic-grid">${topics.map(([title,paper,description,id,lesson],i)=>`<a href="#guide?id=${id}&section=reading-${lesson}"><span>0${i+1} · ${h(title)}</span><h3>${h(paper)}</h3><p>${h(description)}</p></a>`).join('')}</div><div class="agent-article-switch"><a href="#guide?id=${base}"${k.id===base?' aria-current="page"':''}>基础：循环、工具与规划 →</a><a href="#guide?id=${front}"${k.id===front?' aria-current="page"':''}>前沿：记忆、训练与协作 →</a></div></section>`;}
 function loop(k){if(k.id!==base)return '';return `<section id="guide-section-agent-loop" class="agent-loop"><div class="visual-kicker">REACT · 交互机制图</div><h2>沿着一次循环，看清谁在做什么</h2><p>点击环节，查看模型、运行程序和环境之间传递的信息。</p><div class="agent-loop-controls" role="group" aria-label="选择 ReAct 环节">${['判断','Action','工具执行','Observation','Finish'].map((t,i)=>`<button type="button" data-agent-stage="${i}" aria-pressed="${i===0}" aria-controls="agent-loop-output">${h(t)}</button>`).join('')}</div><div id="agent-loop-diagram"></div><div id="agent-loop-output" aria-live="polite"></div><button type="button" class="secondary-button" data-agent-next>沿循环走一步 →</button></section>`;}
 function draw(){const node=(i,x,y,w,title,sub)=>`<g><rect x="${x}" y="${y}" width="${w}" height="86" rx="10" fill="${step===i?'#365c42':'#f0f5e8'}" stroke="${step===i?'#365c42':'#c6d6b9'}" stroke-width="2"/><text x="${x+18}" y="${y+33}" fill="${step===i?'#fff':'#35573b'}" font-size="18" font-weight="600">${title}</text><text x="${x+18}" y="${y+61}" fill="${step===i?'#e2eddb':'#68815a'}" font-size="14">${sub}</text></g>`;$('agent-loop-diagram').innerHTML=`<svg viewBox="0 0 840 370" role="img" aria-label="ReAct 闭环：模型判断、行动请求、工具执行、观测回写；模型判断也可选择 Finish 结束"><defs><marker id="agent-loop-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#8aa27b"/></marker></defs><g fill="none" stroke="#8aa27b" stroke-width="2" marker-end="url(#agent-loop-arrow)"><path d="M325 93H500"/><path d="M652 136V238"/><path d="M500 281H325"/><path d="M180 238V136"/><path d="M260 136V185H354"/></g><text x="412" y="78" text-anchor="middle" fill="#7d8e6c" font-size="13">产生请求</text><text x="663" y="191" fill="#7d8e6c" font-size="13">交给工具</text><text x="412" y="307" text-anchor="middle" fill="#7d8e6c" font-size="13">返回实际结果</text><text x="169" y="191" text-anchor="end" fill="#7d8e6c" font-size="13">下一轮</text>${node(0,35,50,290,'01 · 整理与决策','目标 + 已有行动 + 最新反馈')}${node(1,500,50,305,'02 · Action 工具请求','工具名 + 参数')}${node(2,500,238,305,'03 · 工具执行','程序运行，环境产生结果')}${node(3,35,238,290,'04 · Observation 回写','行动和结果成对进入历史')}<rect x="355" y="162" width="130" height="48" rx="8" fill="${step===4?'#946c38':'#faf3e6'}" stroke="#c9ad82"/><text x="420" y="192" text-anchor="middle" fill="${step===4?'#fff':'#88683f'}" font-size="16">Finish 结束</text></svg>`;const s=steps[step];$('agent-loop-output').innerHTML=`<div class="agent-loop-note"><span>${h(s.owner)}</span><h3>${h(s.title)}</h3><dl><div><dt>输入</dt><dd>${h(s.input)}</dd></div><div><dt>输出</dt><dd>${h(s.output)}</dd></div></dl><p>${h(s.text)}</p></div>`;document.querySelectorAll('[data-agent-stage]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.agentStage)===step));}
 function mount(k){if(k.id!==base)return;step=0;draw();}
 document.addEventListener('click',ev=>{const button=ev.target.closest('[data-agent-stage]');if(button){const n=Number(button.dataset.agentStage);if(Number.isInteger(n)&&n>=0&&n<steps.length){step=n;draw();}}if(ev.target.closest('[data-agent-next]')){step=step<3?step+1:0;draw();}});
 return {overview,loop,mount};
})();
