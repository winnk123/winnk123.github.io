import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const data={};vm.runInNewContext(read('dist/course-data.js'),data);
const original=data.ATLAS_COURSES[0];
const other=JSON.parse(JSON.stringify(original));
other.id='another-course';other.title='Another Course';other.category='其他方向';
other.lectures=other.lectures.slice(0,1);
other.lectures[0].article.file='./course-articles/another-course/lecture-01.html';
const html=read('dist/index.html');
class Element{
  constructor(){this.value='';this.innerHTML='';this.textContent='';this.hidden=false;this.listeners={};}
  addEventListener(event,fn){this.listeners[event]=fn;}
  querySelectorAll(){return [];}
  contains(){return false;}
  scrollIntoView(){}
}
const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Element()]));
const pending=[];let deferred=false,fetches=0;
const context=vm.createContext({
  ATLAS_COURSES:[original,other],URLSearchParams,requestAnimationFrame:fn=>fn(),
  document:{getElementById:id=>elements.get(id),title:''},
  fetch:async file=>{
    fetches++;
    const response={ok:true,text:async()=>file.includes('another-course')?'<p>Another course article</p>':read('dist/'+file.replace(/^\.\//,''))};
    return deferred?new Promise(resolve=>pending.push(()=>resolve(response))):response;
  },
});
vm.runInContext(read('dist/courses.js'),context);
const render=query=>context.AtlasCourses.render(new URLSearchParams(query));
const element=id=>elements.get(id);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
context.AtlasCourses.init();
render('');
assert.equal(element('course-catalog-view').hidden,false);
assert.equal(element('course-home-view').hidden,true);
assert.ok(element('courses-grid').innerHTML.includes('Another Course'));
assert.equal(fetches,0,'Catalog must not download lecture bodies');
element('courses-query').value='不存在的课程';element('courses-query').listeners.input();
assert.ok(element('courses-grid').innerHTML.includes('没有找到'));
element('courses-query').value='CS336';element('courses-query').listeners.input();
assert.ok(!element('courses-grid').innerHTML.includes('Another Course'));
render('course=cs336');
assert.equal(element('course-home-view').hidden,false);
assert.equal(element('course-reading-view').hidden,true);
assert.equal((element('course-schedule').innerHTML.match(/class="course-schedule-card"/g)||[]).length,18);
assert.ok(element('course-schedule').innerHTML.includes('暂未找到官方公开课件'));
assert.equal(fetches,0,'Course home must not download lecture bodies');
element('course-home-query').value='AlpacaFarm';element('course-home-query').listeners.input();
assert.ok(element('course-schedule').innerHTML.includes('lecture=lecture-16'));
element('course-home-query').value='';element('course-stage-filter').value='0';element('course-stage-filter').listeners.change();
assert.equal((element('course-schedule').innerHTML.match(/class="course-schedule-card"/g)||[]).length,4);
render('course=cs336&lecture=lecture-01');await tick();
assert.equal(element('course-reading-view').hidden,false);
assert.ok(element('course-article-body').innerHTML.includes('course-native-article'));
assert.ok(element('course-article-toc').innerHTML.includes('course=cs336&amp;lecture=lecture-01&amp;section='));
const previousFetches=fetches;
render('lecture=lecture-01');await tick();
assert.equal(fetches,previousFetches,'Legacy link should reuse the loaded article');
render('course=another-course&lecture=lecture-01');await tick();
assert.ok(element('course-article-body').innerHTML.includes('Another course article'),'Lecture ids must be scoped by course');
assert.ok(element('course-list').innerHTML.includes('course=another-course'));
render('course=missing');assert.equal(element('course-missing-view').hidden,false);
render('course=cs336&lecture=missing');assert.equal(element('course-missing-view').hidden,false);
deferred=true;render('course=cs336&lecture=lecture-18');
render('');const before=element('course-article-body').innerHTML;
pending.forEach(resolve=>resolve());await tick();
assert.equal(element('course-article-body').innerHTML,before,'Stale fetch must not overwrite hidden reader');
assert.equal(element('course-catalog-view').hidden,false);

// Exercise the real synchronizer with two independent courses sharing a lecture id.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-course-sync-'));
try{
  fs.copyFileSync(path.join(root,'sync-courses.mjs'),path.join(temp,'sync-courses.mjs'));
  const fixtures=[original,other].map(course=>({...course,lectures:course.lectures.slice(0,1).map(lecture=>{
    const {article,...metadata}=lecture;return metadata;
  })}));
  fs.mkdirSync(path.join(temp,'content/course-articles'),{recursive:true});
  fs.writeFileSync(path.join(temp,'content/courses.json'),JSON.stringify({courses:fixtures}));
  for(const course of fixtures){
    const article=JSON.parse(JSON.stringify(original.lectures[0].article));
    delete article.lead;delete article.takeaway;
    article.file=`./course-articles/${course.id}/lecture-01.html`;
    const directory=path.join(temp,'dist/course-articles',course.id);
    fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'lecture-01.html'),'<p>Fixture article</p>');
    fs.writeFileSync(path.join(directory,'index.json'),JSON.stringify({courseId:course.id,lectures:[article]}));
    fs.writeFileSync(path.join(temp,'content/course-articles',course.id+'.json'),JSON.stringify({courseId:course.id,lectures:[{lectureId:'lecture-01',lead:course.title+' lead',takeaway:'takeaway'}]}));
  }
  const result=spawnSync(process.execPath,['sync-courses.mjs'],{cwd:temp,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const generated={};vm.runInNewContext(fs.readFileSync(path.join(temp,'dist/course-data.js'),'utf8'),generated);
  assert.equal(generated.ATLAS_COURSES.length,2);
  assert.equal(generated.ATLAS_COURSES[1].lectures[0].article.lead,'Another Course lead');
  assert.ok(generated.ATLAS_COURSES[1].lectures[0].article.file.includes('/another-course/'));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('PASS: course catalog/home/reader routes, old links, full-text/stage filters, missing pages, lazy loading, stale requests and independent multi-course sync.');
