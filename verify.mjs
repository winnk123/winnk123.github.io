import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('dist/resources.json','utf8'));
const ids=data.map(r=>r.id);
assert.equal(new Set(ids).size,ids.length);
for(const r of data){
 for(const k of ['title','provider','summary','why','prereq','task','sourceNote','checked'])assert.ok(r[k],`${r.id} missing ${k}`);
 for(const k of ['url','paperUrl','codeUrl'])if(r[k])assert.equal(new URL(r[k]).protocol,'https:');
 assert.ok(['dl','robot','robotics','llm'].includes(r.category));
 assert.ok(!/turn\d+(?:view|search)/.test(r.sourceNote));
}
const html=fs.readFileSync('dist/index.html','utf8');
for(const file of [...html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)].map(m=>m[1]))assert.ok(fs.existsSync('dist/'+file),`Missing ${file}`);
const htmlIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(htmlIds).size,htmlIds.length);
const scrollEvents=[];
class Element{
 constructor(id){this.id=id;this.value='';this.innerHTML='';this.textContent='';this.hidden=false;this.open=false;this.checked=false;this.listeners={};this.dataset={};this.attributes={};this.classList={add(){},remove(){},toggle(){}};}
 addEventListener(event,fn){this.listeners[event]=fn;}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}showModal(){this.open=true;}close(){this.open=false;this.listeners.close?.();}focus(){}scrollIntoView(){scrollEvents.push(this.id);}click(){this.listeners.click?.({target:this});}
}
const elements=new Map(htmlIds.map(id=>[id,new Element(id)]));elements.set('.dialog-close',new Element('.dialog-close'));
const nav=['home','library','guides','frontier'].map(n=>{const el=new Element(n);el.dataset.nav=n;return el;});
const filters=['all','llm','embodied'].map(n=>{const el=new Element('news-'+n);el.dataset.newsTopic=n;return el;});
const events={};const docEvents={};const storage=new Map([['embodied-atlas-progress-v1',JSON.stringify({saved:['lerobot'],read:['d2l']})]]);const location={hash:'#home'};
function dynamicElement(id){if(!elements.has(id)){const markup=[...elements.values()].map(e=>e.innerHTML).join('');if(markup.includes(`id="${id}"`)||id.startsWith('[data-ik-'))elements.set(id,new Element(id));}return elements.get(id)||null;}
const document={title:'',querySelector(selector){return selector.startsWith('#')?dynamicElement(selector.slice(1)):selector.startsWith('[data-ik-')?dynamicElement(selector):elements.get(selector);},querySelectorAll(selector){return selector==='.page'?['home','library','guides','guide','robot-papers','frontier','about'].map(p=>elements.get('page-'+p)):selector==='[data-nav]'?nav:selector==='[data-news-topic]'?filters:[];},getElementById:dynamicElement,addEventListener(event,fn){(docEvents[event]??=[]).push(fn);},createElement(){return new Element('created');}};
const ctx=vm.createContext({document,location,history:{replaceState(a,b,hash){location.hash=hash;}},window:{scrollTo(){scrollEvents.push('page-top');},addEventListener(event,fn){events[event]=fn;}},localStorage:{getItem(k){return storage.get(k)??null;},setItem(k,v){storage.set(k,v);}},URL,URLSearchParams,Blob,console,navigator:{clipboard:{writeText:async()=>{}}},requestAnimationFrame:fn=>fn(),setTimeout:()=>1,clearTimeout(){}});
for(const file of [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m=>m[1]))vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),ctx,{filename:file});
const run=code=>vm.runInContext(code,ctx);
const guides=run('ATLAS_GUIDES');
assert.equal(guides.length,26);
const articleIds=new Set(guides.map(g=>g.id));
const directions=run('Handbook.directions');
assert.equal(directions.filter(d=>d.topic==='llm').length,6);
for(const d of directions)assert.ok(guides.some(g=>g.category===d.topic&&g.knowledge.direction===d.id),d.id+' empty direction');
assert.equal(new Set(guides.map(g=>g.id)).size,guides.length);
for(const g of guides){
 const k=g.knowledge;assert.ok(k.title&&k.summary,k.id+' missing knowledge');assert.equal(k.essentials.length,3);for(const block of k.essentials){assert.ok(block.title&&block.text&&block.paragraphs?.length>=2,k.id+' incomplete explanation');assert.ok(block.paragraphs.join('').length>=180,k.id+' missing mechanism');const equations=block.equations||(block.equation?[block.equation]:[]);for(const eq of equations){assert.equal(eq.mathmlSource,eq.latex,k.id+' stale equation');assert.ok(eq.mathml.startsWith('<math ')&&eq.mathml.includes('alttext='),k.id+' missing accessible MathML');assert.ok(eq.plain&&eq.terms.length>=2,k.id+' missing equation explanation');}}for(const id of k.connections)assert.ok(articleIds.has(id),k.id+' broken connection '+id);for(const source of k.sources){assert.ok(source.focus);assert.equal(new URL(source.url).protocol,'https:');}
 assert.ok(g.sources.length>=1);for(const s of g.sources)assert.equal(new URL(s.url).protocol,'https:');
 for(const id of g.resourceIds??[])assert.ok(ids.includes(id),`${g.id} unknown resource ${id}`);
 for(const [i,s]of g.sections.entries()){
  assert.ok(s.title&&s.paragraphs?.length,`${g.id}/${i} incomplete`);
  if(s.code){const ext=s.codeLanguage&&s.codeLanguage!=='python'?'txt':'py';assert.ok(fs.existsSync(`dist/examples/${g.id}-${i+1}.${ext}`),`Missing example ${g.id}-${i+1}`);assert.ok(s.expected,`${g.id}/${i} missing output`);}
 }
}
assert.equal((elements.get('resource-results').innerHTML.match(/class="resource-card"/g)||[]).length,data.length);
assert.equal((elements.get('home-guides').innerHTML.match(/knowledge-card/g)||[]).length,4);assert.equal((elements.get('home-llm-directions').innerHTML.match(/class="direction-card"/g)||[]).length,6);assert.ok(!html.includes('featured-resources'));assert.ok(!elements.get('home-guides').innerHTML.includes('两组关节角约为'));assert.ok(elements.get('home-guides').innerHTML.includes('Jacobian'));
for(const r of data)assert.ok(run(`Handbook.resourceLinks(${JSON.stringify(r.id)})`).includes('本站已提炼的核心知识'),r.id+' no guide');
assert.equal(run('news.every(n=>n.related.every(id=>!!byId[id])&&n.sources.every(s=>typeof s!=="string"||!!byId[s]))'),true);
assert.equal(run("AtlasCore.selectResources(R,{...defaultState,query:'no-result-4399'}).length"),0);
assert.ok(run("AtlasCore.selectResources(R,{...defaultState,category:'robot',level:'入门',query:'LeRobot'}).length")>0);
location.hash='#sources?saved=true';events.hashchange();assert.equal((elements.get('resource-results').innerHTML.match(/class="resource-card"/g)||[]).length,1);
run("toggleBookmark('lerobot')");assert.ok(elements.get('resource-results').innerHTML.includes('empty-state'));
run("toggleBookmark('d2l');showResource('d2l')");assert.ok(elements.get('dialog-content').innerHTML.includes('本站已提炼的核心知识'));assert.ok(!elements.get('dialog-content').innerHTML.includes('已读'));
assert.deepEqual(JSON.parse(storage.get('learning-atlas-bookmarks-v2')),{saved:['d2l']});
assert.equal(run("AtlasCore.sanitizeBookmarks({saved:['lerobot','fake','lerobot'],read:['old']},R.map(r=>r.id)).saved.length"),1);
assert.throws(()=>run("AtlasCore.sanitizeBookmarks({invalid:true},R.map(r=>r.id))"));
location.hash='#guides?topic=dl';events.hashchange();assert.ok(elements.get('guide-results').innerHTML.includes('训练与优化'));assert.equal(elements.get('page-guides').hidden,false);
location.hash='#guide?id=gradient-training';events.hashchange();assert.ok(elements.get('guide-reader').innerHTML.includes('9.0'));assert.ok(elements.get('guide-reader').innerHTML.includes('误差怎样传回每一个参数？'));
for(const g of guides){location.hash='#guide?id='+g.id;events.hashchange();const page=elements.get('guide-reader').innerHTML;assert.ok(page.includes(g.knowledge.title.replaceAll('&','&amp;')),g.id+' knowledge render');assert.ok(page.includes('class="concept-essentials"'),g.id+' explanation visible');for(const block of g.knowledge.essentials)assert.ok(page.includes(block.text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')),g.id+' missing concept');if(g.sections.some(s=>s.code)){assert.ok(page.includes('<details id="guide-section-example" class="concept-example">'),g.id+' example folded');assert.ok(page.indexOf('class="concept-essentials"')<page.indexOf('<details id="guide-section-example"'),g.id+' knowledge before examples');}assert.ok(page.includes('来源与原文定位'));}
const escaped=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let equationCount=0;
for(const g of guides){
 location.hash='#guide?id='+g.id;events.hashchange();const page=elements.get('guide-reader').innerHTML;
 for(const [i,section] of g.knowledge.essentials.entries()){
  assert.ok(page.includes(`id="guide-section-core-${i}"`)&&page.includes(`data-guide-section="core-${i}"`),g.id+' missing topic anchor');
  for(const paragraph of section.paragraphs)assert.ok(page.includes(escaped(paragraph)),g.id+' omitted explanatory paragraph');
  for(const eq of section.equations||(section.equation?[section.equation]:[])){
   equationCount++;assert.ok(page.includes(eq.mathml),g.id+' omitted rendered equation');
   for(const term of eq.terms)assert.ok(page.includes(escaped(term.meaning)),g.id+' omitted symbol definition');
  }
  for(const key of ['worked','decision'])if(section[key])assert.ok(page.includes(escaped(section[key].text)),g.id+' omitted '+key);
 }
}
assert.equal(equationCount,80);
// The new reading layer must expose the mechanism while retaining optional derivations.
const paperFigures=JSON.parse(fs.readFileSync('content/paper-figures.json','utf8'));
assert.equal(paperFigures.length,43);
for(const f of paperFigures){
 const png=fs.readFileSync('dist/'+f.src.replace(/^\.\//,''));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),f.width);assert.equal(png.readUInt32BE(20),f.height);
 assert.match(f.sourceUrl,/^https:\/\/arxiv\.org\/pdf\/\d+\.\d+v\d+$/);
 assert.equal(f.reading.length,3);assert.ok(f.figure&&f.page&&f.authors&&f.alt);
 for(const id of f.guideIds)assert.ok(articleIds.has(id));
}
for(const g of guides){
 assert.equal(g.knowledge.diagrams.length,2,g.id+' needs two inline drawings');
 assert.equal(g.knowledge.flow.steps.length,4);
 for(const step of g.knowledge.flow.steps)for(const key of ['label','input','operation','output'])assert.ok(step[key]);
 location.hash='#guide?id='+g.id;events.hashchange();const page=elements.get('guide-reader').innerHTML;
 assert.equal((page.match(/data-flow-step=/g)||[]).length,4);
 assert.ok((page.match(/<details class="math-disclosure">/g)||[]).length>=3);
 assert.ok(!page.includes('<details class="math-disclosure" open'));
 for(const s of g.knowledge.essentials){assert.equal(s.plain.length,2);for(const p of s.plain)assert.ok(page.includes(escaped(p)));}
 for(const d of g.knowledge.diagrams){
  const svg=fs.readFileSync('dist/'+d.src.replace(/^\.\//,''),'utf8');
  assert.match(svg,/<svg\b/);assert.match(svg,/<title[ >]/);assert.ok(!/<script\b|<foreignObject\b|(?:href|src)=["']https?:/i.test(svg));
  assert.ok(d.sectionIndex>=0&&d.sectionIndex<3);assert.ok(d.title&&d.caption&&d.alt);assert.equal(d.width,840);assert.equal(d.height,400);
  assert.ok(page.includes(`data-diagram-zoom="${d.id}"`));assert.ok(page.includes(escaped(d.caption)));assert.ok(page.includes(d.src));
  const sectionStart=page.indexOf(`id="guide-section-core-${d.sectionIndex}"`),nextSection=page.indexOf(`id="guide-section-core-${d.sectionIndex+1}"`);
  assert.ok(page.indexOf(`data-diagram-zoom="${d.id}"`)>sectionStart);if(nextSection>=0)assert.ok(page.indexOf(`data-diagram-zoom="${d.id}"`)<nextSection);
 }
 for(const f of g.knowledge.figures)assert.ok(paperFigures.some(x=>x.id===f.id));
}
const inlineDrawings=guides.flatMap(g=>g.knowledge.diagrams);assert.equal(inlineDrawings.length,52);assert.equal(new Set(inlineDrawings.map(x=>x.id)).size,52);
assert.equal((elements.get('home-guides').innerHTML.match(/class="diagram-card-preview"/g)||[]).length,4);
function clickData(selector,dataset={}){const target={dataset,closest:s=>s===selector?target:null};for(const fn of docEvents.click)fn({target,preventDefault(){}});}
function inputLab(control,value,checked=false){for(const fn of docEvents.input)fn({target:{dataset:{labControl:control},value:String(value),checked}});}
location.hash='#guide?id=action-policy-handbook';events.hashchange();
clickData('[data-flow-step]',{flowStep:'2'});
assert.ok(elements.get('flow-reading').innerHTML.includes(escaped(guides.find(g=>g.id==='action-policy-handbook').knowledge.flow.steps[2].operation)));
assert.ok(elements.get('flow-stages').innerHTML.includes('data-flow-step="2" aria-pressed="true"'));
clickData('[data-paper-tab]',{paperTab:'1'});assert.ok(elements.get('paper-content').innerHTML.includes('diffusion-policy.png'));
clickData('[data-paper-zoom]',{paperZoom:'1'});assert.equal(elements.get('paper-dialog').open,true);assert.ok(elements.get('paper-dialog-image').attributes.src.endsWith('diffusion-policy.png'));
clickData('[data-paper-close]');assert.equal(elements.get('paper-dialog').open,false);
const actionDrawing=guides.find(g=>g.id==='action-policy-handbook').knowledge.diagrams[0];
clickData('[data-diagram-zoom]',{diagramZoom:actionDrawing.id});assert.equal(elements.get('paper-dialog').open,true);assert.equal(elements.get('paper-dialog-image').attributes.src,actionDrawing.src);assert.equal(elements.get('paper-dialog-title').textContent,actionDrawing.title);
clickData('[data-paper-close]');assert.equal(elements.get('paper-dialog').open,false);
inputLab('horizon',1);assert.ok(elements.get('visual-lab-output').innerHTML.includes('0.02 秒'));
inputLab('horizon',8);assert.ok(elements.get('visual-lab-output').innerHTML.includes('0.16 秒'));
const visuals=ctx.LearningVisuals;
for(let row=0;row<4;row++)for(const temperature of [.3,1,2])for(const causal of [true,false]){
 const w=visuals.weights(row,temperature,causal);assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-12);assert.ok(w.every(x=>x>=0));
 if(causal)for(let j=row+1;j<4;j++)assert.equal(w[j],0);
}
assert.ok(Math.max(...visuals.weights(3,.3))>Math.max(...visuals.weights(3,2)));
let convergent=1,divergent=1;for(let i=0;i<10;i++){convergent=visuals.trainStep(convergent,.15);divergent=visuals.trainStep(divergent,.25);}
assert.ok(Math.abs(convergent)<.001);assert.ok(Math.abs(divergent)>50);
location.hash='#guide?id=gradient-training';events.hashchange();for(let i=0;i<21;i++)clickData('[data-train-step]');assert.equal(elements.get('lab-train-step').disabled,true);
clickData('[data-train-reset]');assert.equal(elements.get('lab-train-step').disabled,false);
assert.equal(visuals.project(1).u,400);assert.equal(visuals.project(2).u,360);assert.equal(visuals.project(2).v,260);
location.hash='#guide?id=camera-calibration';events.hashchange();inputLab('depth',2);assert.ok(elements.get('visual-lab-output').innerHTML.includes('360.0'));
assert.ok(visuals.samples(6).some(x=>Math.abs(x-2.4)<1e-9));assert.ok(!visuals.samples(3).some(x=>x>=2.4&&x<=2.8));
location.hash='#guide?id=multimodal-video-audio';events.hashchange();assert.ok(elements.get('guide-reader').innerHTML.includes('视频理解与时间建模'));
inputLab('frames',6);assert.ok(elements.get('visual-lab-output').innerHTML.includes('1 帧'));
inputLab('frames',3);assert.ok(elements.get('visual-lab-output').innerHTML.includes('0 帧'));
assert.ok(!/音频|音视频|语音|声学|声音|Whisper|Omni/.test(JSON.stringify(guides)+JSON.stringify(run('news'))));
assert.equal(run('news.length'),16);
for(const n of run('news'))if(n.guideId)assert.ok(articleIds.has(n.guideId));
location.hash='#guides?query=DAgger';events.hashchange();assert.ok(elements.get('guide-results').innerHTML.includes('模仿学习与动作生成'),'search must include new explanatory body');
location.hash='#guides?topic=llm';events.hashchange();assert.equal((elements.get('guide-results').innerHTML.match(/class="direction-card"/g)||[]).length,6);
location.hash='#guides?topic=llm&direction=multimodal-understanding';events.hashchange();assert.equal((elements.get('guide-results').innerHTML.match(/knowledge-card/g)||[]).length,2);assert.ok(elements.get('guide-results').innerHTML.includes('跨模态对齐'));assert.ok(!elements.get('guide-results').innerHTML.includes('检索增强'));
location.hash='#guides?query=奇异';events.hashchange();assert.ok(elements.get('guide-results').innerHTML.includes('Jacobian'));
location.hash='#guides?query=missingabcxyz';events.hashchange();assert.ok(elements.get('guide-results').innerHTML.includes('empty-state'));
location.hash='#library';events.hashchange();assert.equal(elements.get('page-guides').hidden,false);assert.equal((elements.get('guide-results').innerHTML.match(/class="knowledge-domain"/g)||[]).length,4);
const ik=guides.find(g=>g.demo==='ik');if(ik){location.hash='#guide?id='+ik.id;events.hashchange();assert.ok(elements.get('ik-plot').innerHTML.includes('<svg'));}
for(const [x,y]of[[1.2,.5],[-.8,.6],[.3,-.5],[1.7,0],[.3,0]])for(const branch of[1,-1]){const q=ctx.AtlasIK.solve(x,y,branch),p=ctx.AtlasIK.forward(q);assert.ok(Math.hypot(p[0]-x,p[1]-y)<1e-7);}
assert.equal(ctx.AtlasIK.solve(2,0),null);assert.equal(ctx.AtlasIK.solve(.2,0),null);let q=[.2,.9];for(let i=0;i<30;i++)q=ctx.AtlasIK.step(q,[1.2,.5]);const end=ctx.AtlasIK.forward(q);assert.ok(Math.hypot(end[0]-1.2,end[1]-.5)<1e-6);
location.hash='#frontier?topic=llm';events.hashchange();assert.equal(elements.get('page-frontier').hidden,false);assert.ok(elements.get('frontier-articles').innerHTML.includes('大模型'));
location.hash='#paths';events.hashchange();assert.equal(elements.get('page-guides').hidden,false);
location.hash='#not-a-page';events.hashchange();assert.equal(elements.get('page-home').hidden,false);
assert.ok(!html.includes('已读')&&!html.includes('进度'));
// Paper reading routes, content completeness, and independently computed PPO cases.
const readingCounts={'llm-agent-foundations':4,'llm-agent-memory':4,'multimodal-alignment':8,'vla-handbook':7,'action-policy-handbook':4,'robot-reinforcement':6,'camera-calibration':1,'hand-eye-calibration':1,'memory-world-handbook':1};
for(const [id,count] of Object.entries(readingCounts)){
 const k=guides.find(g=>g.id===id).knowledge;
 assert.equal(k.readings.lessons.length,count);
 assert.equal(k.readings.overview.rows.length,count);
 for(const lesson of k.readings.lessons){
  assert.ok(lesson.sections.length>=3);
  assert.ok(lesson.sections.flatMap(s=>s.paragraphs).join('').length>=250);
  assert.ok(lesson.sources.length>=1);
  for(const s of lesson.sources){assert.equal(new URL(s.url).protocol,'https:');assert.ok(s.focus);}
  location.hash=`#guide?id=${id}&section=reading-${lesson.id}`;events.hashchange();
  assert.equal(elements.get('guide-section-reading-'+lesson.id).open,true);
  const page=elements.get('guide-reader').innerHTML;
  for(const s of lesson.sections)for(const p of s.paragraphs)assert.ok(page.includes(escaped(p)));
  if(lesson.figureId)assert.ok(k.figures.some(f=>f.id===lesson.figureId));
 }
}
const rl=guides.find(g=>g.id==='robot-reinforcement').knowledge.rl;
assert.equal(rl.axes.length,4);assert.equal(rl.overview.rows.length,13);assert.equal(rl.lessons.length,5);
assert.equal(rl.lessons[0].steps.length,6);
let newEquations=0;
for(const lesson of rl.lessons){
 location.hash='#guide?id=robot-reinforcement&section=rl-lesson-'+lesson.id;events.hashchange();
 assert.equal(elements.get('guide-section-rl-lesson-'+lesson.id).open,true);
 for(const s of lesson.sections)for(const eq of s.equations||[]){newEquations++;assert.equal(eq.mathmlSource,eq.latex);assert.ok(elements.get('guide-reader').innerHTML.includes(eq.mathml));}
}
assert.equal(newEquations,8);
for(const [a,r,expected]of[[1,.5,.5],[1,1,1],[1,1.5,1.2],[-1,.5,-.8],[-1,1,-1],[-1,1.5,-1.5]]){
 assert.ok(Math.abs(ctx.ResearchNotes.clipped(r,a,.2)-expected)<1e-12);
}
for(const [a,r,slope]of[[1,.5,1],[1,1.5,0],[-1,.5,0],[-1,1.5,-1]]){
 const dx=1e-5,d=(ctx.ResearchNotes.clipped(r+dx,a,.2)-ctx.ResearchNotes.clipped(r-dx,a,.2))/(2*dx);
 assert.ok(Math.abs(d-slope)<1e-7);
}
location.hash='#guide?id=robot-reinforcement&section=rl-lesson-ppo';events.hashchange();
assert.ok(elements.get('ppo-plot').innerHTML.includes('实际目标 <b>1.20</b>'));
clickData('[data-ppo-advantage]',{ppoAdvantage:'-1'});
assert.ok(elements.get('ppo-plot').innerHTML.includes('实际目标 <b>-1.50</b>'));
for(const fn of docEvents.input)fn({target:{dataset:{ppoControl:'ratio'},value:'.5'}});
assert.ok(elements.get('ppo-plot').innerHTML.includes('实际目标 <b>-0.80</b>'));
assert.equal(elements.get('ppo-ratio-value').textContent,'0.50');
for(const fn of docEvents.input)fn({target:{dataset:{ppoControl:'epsilon'},value:'.4'}});
assert.ok(elements.get('ppo-plot').innerHTML.includes('实际目标 <b>-0.60</b>'));
for(const term of ['BLIP-2','GRPO','Qwen3-VL-Seg']){
 location.hash='#guides?query='+term;events.hashchange();assert.ok(elements.get('guide-results').innerHTML.includes('knowledge-card'));
}
assert.ok(!/五15\.8|turn\d+(?:search|view)/.test(JSON.stringify(guides)));
const robotIndex=run('ATLAS_ROBOT_PAPERS');
// Agent navigation, source-of-information stepper, and a full feedback cycle.
location.hash='#guide?id=llm-agent-foundations';events.hashchange();
assert.ok(elements.get('guide-reader').innerHTML.indexOf('concept-essentials')<elements.get('guide-reader').innerHTML.indexOf('guide-section-paper-map'));
assert.ok(elements.get('guide-reader').innerHTML.includes('Toolformer')&&elements.get('guide-reader').innerHTML.includes('Agent Scaling'));
for(const [stage,title]of[[1,'Action：提出可执行请求'],[2,'工具执行，取得外部结果'],[3,'Observation：把结果接回上下文'],[4,'Finish：对照目标提交结果']]){
 clickData('[data-agent-stage]',{agentStage:String(stage)});assert.ok(elements.get('agent-loop-output').innerHTML.includes(title));
}
clickData('[data-agent-next]');assert.ok(elements.get('agent-loop-output').innerHTML.includes('整理信息，选择下一步'));
for(let i=0;i<4;i++)clickData('[data-agent-next]');
assert.ok(elements.get('agent-loop-output').innerHTML.includes('整理信息，选择下一步'));
location.hash='#guide?id=llm-agent-foundations&section=agent-loop';events.hashchange();assert.equal(scrollEvents.at(-1),'guide-section-agent-loop');
for(const term of ['ReAct','Toolformer','Reflexion','LATS','AgentFold','CompactionRL','ToolVerse','Agent Scaling']){
 location.hash='#guides?query='+encodeURIComponent(term);events.hashchange();assert.ok(elements.get('guide-results').innerHTML.includes('knowledge-card'));
}
console.log('PASS: Agent capability map, 8 paper deep links, ReAct feedback cycle, tool/observation/finish branches and search.');
assert.equal(robotIndex.papers.length,22);assert.equal(robotIndex.tracks.length,4);
assert.equal(robotIndex.controlFocus.length,4);
location.hash='#robot-papers?track=control';events.hashchange();
for(const item of robotIndex.controlFocus){
 clickData('[data-control-paper]',{controlPaper:item.id});
 const panel=elements.get('robot-control-panel').innerHTML;
 assert.ok(panel.includes(escaped(item.question))&&panel.includes(escaped(item.ppo)));
 assert.equal(item.training.length,3);assert.equal(item.runtime.length,3);
 for(const node of [...item.training,...item.runtime])assert.ok(panel.includes(escaped(node.label))&&panel.includes(escaped(node.text)));
 assert.ok(panel.includes(ctx.RobotPapers.target(robotIndex.papers.find(p=>p.id===item.id))));
}
assert.equal((elements.get('robot-paper-results').innerHTML.match(/class="robot-paper-card"/g)||[]).length,8);
assert.equal(ctx.RobotPapers.select(robotIndex.papers,{track:'control',query:'',sort:'newest'})[0].id,'athlete');
assert.ok(elements.get('home-robot-papers').innerHTML.includes('SONIC')&&elements.get('home-robot-papers').innerHTML.includes('LATENT'));
for(const query of ['SONIC','银河通用','AdaPT','ATHLETE']){
 location.hash='#guides?query='+encodeURIComponent(query);events.hashchange();
 assert.ok(elements.get('guide-results').innerHTML.includes('robot-reinforcement'));
}
assert.equal(new Set(robotIndex.papers.map(p=>p.id)).size,22);
for(const t of robotIndex.tracks)for(const id of t.milestones)assert.ok(robotIndex.papers.some(p=>p.id===id&&p.track===t.id));
for(const p of robotIndex.papers){
 const k=guides.find(g=>g.id===p.guideId)?.knowledge;assert.ok(k);
 assert.equal(p.date.slice(0,4),String(p.year));assert.match(p.date,/^\d{4}-\d{2}$/);
 const section=p.section||'reading-'+p.lessonId;
 location.hash=ctx.RobotPapers.target(p);events.hashchange();
 assert.equal(elements.get('page-guide').hidden,false);
 assert.equal(elements.get('guide-section-'+section).open,true);
 assert.equal(scrollEvents.at(-1),'guide-section-'+section,'deep link must survive general route scroll');
 const lesson=[...(k.readings?.lessons||[]),...(k.rl?.lessons||[])].find(x=>x.id===p.lessonId);assert.ok(lesson);
 if(lesson.pipeline){assert.equal(lesson.pipeline.length,4);assert.ok(lesson.specs.rows.length>=4);for(const row of lesson.specs.rows){assert.equal(row.length,2);for(const cell of row)assert.ok(elements.get('guide-reader').innerHTML.includes(escaped(cell)));}}
 if(p.figureId)assert.ok(k.figures.some(f=>f.id===p.figureId));
}
location.hash='#robot-papers';events.hashchange();assert.equal(elements.get('page-robot-papers').hidden,false);assert.equal(elements.get('page-guide').hidden,true);
assert.equal((elements.get('robot-paper-results').innerHTML.match(/class="robot-paper-card"/g)||[]).length,22);
assert.equal((elements.get('home-robot-papers').innerHTML.match(/class="robot-paper-card"/g)||[]).length,3);
clickData('[data-robot-track]',{robotTrack:'geometry'});assert.equal((elements.get('robot-paper-results').innerHTML.match(/class="robot-paper-card"/g)||[]).length,2);assert.match(location.hash,/track=geometry/);
clickData('[data-robot-reset]');
for(const fn of docEvents.input)fn({target:{id:'robot-paper-query',dataset:{},value:'512'}});
assert.ok(elements.get('robot-paper-results').innerHTML.includes('DP3'));assert.equal((elements.get('robot-paper-results').innerHTML.match(/class="robot-paper-card"/g)||[]).length,2);
for(const fn of docEvents.input)fn({target:{id:'robot-paper-query',dataset:{},value:'absent-paper-94812'}});
assert.ok(elements.get('robot-paper-results').innerHTML.includes('empty-state'));
clickData('[data-robot-reset]');
for(const fn of docEvents.change||[])fn({target:{id:'robot-paper-sort',dataset:{},value:'oldest'}});
assert.match(location.hash,/sort=oldest/);
const ordered=ctx.RobotPapers.select(robotIndex.papers,{track:'all',query:'',sort:'oldest'});assert.equal(ordered[0].id,'tsai-lenz');for(let i=1;i<ordered.length;i++)assert.ok(ordered[i-1].date<=ordered[i].date);
location.hash='#robot-papers?track=generalist&query=MEM';events.hashchange();assert.equal(elements.get('robot-paper-query').value,'MEM');assert.ok(elements.get('robot-paper-results').innerHTML.includes('MEM'));
assert.equal(guides.filter(g=>['robotics','embodied'].includes(g.category)).flatMap(g=>g.knowledge.readings?.lessons||[]).length,20);
console.log('PASS: robot paper hub, 22 reading targets, 4 research tracks, 17 paper pipelines, search in paper bodies, filters, sort, home entries and deep-link scroll order.');
if(process.env.ATLAS_REVIEW_DIR){
 fs.mkdirSync(process.env.ATLAS_REVIEW_DIR,{recursive:true});
 location.hash='#guide?id=robot-reinforcement';events.hashchange();
 const save=name=>fs.writeFileSync(process.env.ATLAS_REVIEW_DIR+'/'+name+'.svg',elements.get('ppo-plot').innerHTML.match(/<svg[\s\S]*?<\/svg>/)[0].replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));
 save('ppo-positive');clickData('[data-ppo-advantage]',{ppoAdvantage:'-1'});save('ppo-negative');
}
console.log('PASS: 36 paper readings, 13 algorithm rows, 5 RL deep dives, 8 new equations, lesson deep links, six PPO numeric cases, four gradient cases and slider/sign events.');
console.log(`PASS: ${data.length} resources; ${guides.length} illustrated articles; 52 inline mechanism diagrams, correct section placement and zoom; 43 paper figures with provenance and PNG checks; illustrated article previews; 8 interactive diagrams; flow navigation; 80 folded equations; 6 LLM directions; video-only content and legacy route; numerical attention, gradient, projection, sampling and IK checks; search, bookmarks and article routes. Browser visual QA not run.`);
