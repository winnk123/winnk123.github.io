'use strict';
(() => {
  const courses=globalThis.ATLAS_COURSES||[];
  const byId=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const route=(course,lecture,section)=>{
    const params=new URLSearchParams({course:course.id});
    if(lecture)params.set('lecture',lecture.id);
    if(section)params.set('section',section);
    return '#courses?'+params;
  };
  const link=(href,label,classes='')=>`<a class="${classes}" href="${escapeHtml(href)}">${label}</a>`;
  const external=resource=>`<a class="course-resource-link" href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resource.label)} <span aria-hidden="true">↗</span></a>`;
  const countMaterials=course=>course.lectures.filter(lecture=>(lecture.resources||[]).some(resource=>resource.kind!=='video')).length;
  let activeCourse=null,selectedId=null,loadedLecture=null,articleRequest=0,indexCategory='all';
  const articleCache=new Map();

  function matches(lecture,query){
    const needle=query.trim().toLocaleLowerCase();
    return !needle||`${lecture.title} ${lecture.summary} ${lecture.instructor} ${lecture.number} ${lecture.article.searchText}`.toLocaleLowerCase().includes(needle);
  }

  function renderCatalog(){
    const needle=byId('courses-query').value.trim().toLocaleLowerCase();
    const items=courses.filter(course=>(indexCategory==='all'||course.category===indexCategory)&&(!needle||`${course.title} ${course.displayTitle||''} ${course.subtitle} ${course.summary} ${course.provider} ${course.term} ${course.category} ${(course.tags||[]).join(' ')}`.toLocaleLowerCase().includes(needle)));
    byId('courses-result-count').textContent=`${items.length} 门课程 · ${items.reduce((sum,course)=>sum+course.lectures.length,0)} 篇完整笔记`;
    byId('courses-grid').innerHTML=items.length?items.map(course=>`<article class="course-catalog-card"><div class="course-card-meta"><span>${escapeHtml(course.provider)} · ${escapeHtml(course.term)}</span><span>${escapeHtml(course.category)}</span></div><div class="course-card-code">${escapeHtml(course.title)}</div><h2>${link(route(course),escapeHtml(course.displayTitle||course.subtitle))}</h2><p class="course-card-subtitle">${escapeHtml(course.subtitle)}</p><p>${escapeHtml(course.summary)}</p><div class="concept-tags">${(course.tags||[]).map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div><div class="course-card-path">${(course.stages||[]).map(stage=>escapeHtml(stage.title)).join('<span aria-hidden="true"> → </span>')}</div><div class="course-card-footer"><span>${course.lectures.length} 讲笔记 · ${countMaterials(course)} 讲官方资料</span>${link(route(course),'进入课程主页 <span aria-hidden="true">→</span>','course-card-open')}</div></article>`).join(''):'<p class="course-empty">没有找到匹配的课程。试试其他关键词或课程方向。</p>';
  }

  function renderList(query=''){
    if(!activeCourse)return;
    const course=activeCourse;
    const items=course.lectures.filter(lecture=>matches(lecture,query));
    byId('course-result-count').textContent=`${items.length} / ${course.lectures.length} 讲`;
    byId('course-list').innerHTML=items.length?items.map(lecture=>`<a class="course-lecture${lecture.id===selectedId?' active':''}" href="${escapeHtml(route(course,lecture))}"${lecture.id===selectedId?' aria-current="page"':''}><span class="course-lecture-number">${String(lecture.number).padStart(2,'0')}</span><span class="course-lecture-text"><strong>${escapeHtml(lecture.title)}</strong><small>${escapeHtml(lecture.summary)}</small></span><span class="course-lecture-arrow" aria-hidden="true">→</span></a>`).join(''):'<p class="course-empty">没有找到匹配的讲次。</p>';
  }

  function renderSchedule(){
    if(!activeCourse)return;
    const course=activeCourse;
    const stageIndex=byId('course-stage-filter').value;
    const stage=stageIndex==='all'?null:course.stages?.[Number(stageIndex)];
    const items=course.lectures.filter(lecture=>matches(lecture,byId('course-home-query').value)&&(!stage||stage.lectures.includes(lecture.number)));
    byId('course-schedule-count').textContent=`${items.length} / ${course.lectures.length} 讲`;
    byId('course-schedule').innerHTML=items.length?items.map(lecture=>`<article class="course-schedule-card"><div class="course-schedule-number">${String(lecture.number).padStart(2,'0')}</div><div class="course-schedule-content"><div class="course-schedule-meta">LECTURE ${String(lecture.number).padStart(2,'0')} <span>· ${escapeHtml(lecture.instructor)}</span></div><h3>${link(route(course,lecture),escapeHtml(lecture.title))}</h3><p>${escapeHtml(lecture.summary)}</p><div class="course-schedule-links">${link(route(course,lecture),'阅读完整笔记 →','course-note-link')}${(lecture.resources||[]).map(external).join('')}</div>${lecture.materialsNote?`<p class="course-materials-note">${escapeHtml(lecture.materialsNote)}</p>`:''}</div></article>`).join(''):'<p class="course-empty">当前筛选下没有匹配讲次。可以调整关键词或学习阶段。</p>';
  }

  function renderHome(course,params){
    document.title=`${course.title} · 课程主页 · Learning Atlas`;
    byId('course-home-code').textContent=course.title;
    byId('course-home-meta').textContent=`${course.provider} · ${course.term}`;
    byId('course-home-title').textContent=`${course.title} · ${course.displayTitle||course.subtitle}`;
    byId('course-home-cover-label').textContent=course.cover?.label||course.category;
    byId('course-home-cover-title').innerHTML=(course.cover?.lines||[course.title]).map(escapeHtml).join('<br>');
    byId('course-home-cover-caption').textContent=course.cover?.caption||course.provider;
    byId('course-home-subtitle').textContent=course.subtitle;
    byId('course-home-summary').textContent=course.summary;
    byId('course-home-actions').innerHTML=link(route(course,course.lectures[0]),'开始阅读笔记 →','course-primary-link')+link(route(course,null,'course-schedule-section'),'浏览全部讲次 ↓','course-secondary-link');
    const videoCount=course.lectures.filter(lecture=>(lecture.resources||[]).some(resource=>resource.kind==='video')).length;
    byId('course-home-stats').innerHTML=`<div><strong>${course.lectures.length}</strong><span>讲完整笔记</span></div><div><strong>${countMaterials(course)}</strong><span>讲官方资料</span></div><div><strong>${videoCount}</strong><span>个视频入口</span></div>`;
    byId('course-home-nav').innerHTML=link(route(course,null,'course-schedule-section'),'逐讲笔记与资料')+link(route(course,null,'course-resources'),'官方公开资料')+link(route(course,null,'course-learning-path'),'学习路线');
    byId('course-resources-list').innerHTML=(course.resources||[]).map(resource=>`<div class="course-hub-resource">${external(resource)}<p>${escapeHtml(resource.description||'')}</p></div>`).join('');
    byId('course-learning-stages').innerHTML=(course.stages||[]).map((stage,index)=>`<li><span>${String(index+1).padStart(2,'0')}</span><div><strong>${link(route(course,course.lectures.find(lecture=>lecture.number===stage.lectures[0])),escapeHtml(stage.title))}</strong><small>第 ${stage.lectures[0]}–${stage.lectures.at(-1)} 讲</small><p>${escapeHtml(stage.summary)}</p></div></li>`).join('');
    byId('course-stage-filter').innerHTML='<option value="all">全部学习阶段</option>'+(course.stages||[]).map((stage,index)=>`<option value="${index}">${escapeHtml(stage.title)}</option>`).join('');
    byId('course-stage-filter').value='all';
    renderSchedule();
    const section=params.get('section');
    if(['course-schedule-section','course-resources','course-learning-path'].includes(section))requestAnimationFrame(()=>byId(section)?.scrollIntoView({behavior:'instant',block:'start'}));
  }

  async function renderArticle(course,lecture,params){
    const article=lecture.article;
    const request=++articleRequest;
    const key=`${course.id}/${lecture.id}`;
    const jump=()=>{
      const section=params.get('section');
      if(section)requestAnimationFrame(()=>{
        if(request===articleRequest&&byId('course-article-body').contains(byId(section)))byId(section).scrollIntoView({behavior:'instant',block:'start'});
      });
    };
    byId('course-article-progress').textContent=`${article.toc.length} 个目录项`;
    byId('course-article-toc').innerHTML=`<div class="course-article-toc-title">本讲内容</div>${article.toc.map((item,index)=>link(route(course,lecture,item.id),`<span>${String(index+1).padStart(2,'0')}</span>${escapeHtml(item.title)}`,item.level>3?'nested':'')).join('')}`;
    const position=course.lectures.indexOf(lecture),previous=course.lectures[position-1],next=course.lectures[position+1];
    byId('course-lecture-pagination').innerHTML=`${previous?link(route(course,previous),`<span>上一讲 · ${String(previous.number).padStart(2,'0')}</span><strong>${escapeHtml(previous.title)} ←</strong>`):'<span></span>'}${next?link(route(course,next),`<span>下一讲 · ${String(next.number).padStart(2,'0')}</span><strong>→ ${escapeHtml(next.title)}</strong>`,'next'):''}`;
    if(loadedLecture===key){jump();return;}
    loadedLecture=null;
    byId('course-article-body').innerHTML=`<p class="course-article-lead">${escapeHtml(article.lead)}</p><div class="course-native-loading" role="status">正在载入完整课程正文…</div>`;
    try{
      let html=articleCache.get(article.file);
      if(html===undefined){
        const response=await fetch(article.file);
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        html=await response.text();
        articleCache.set(article.file,html);
      }
      if(request!==articleRequest||byId('page-courses').hidden||byId('course-reading-view').hidden)return;
      byId('course-article-body').innerHTML=`<p class="course-article-lead">${escapeHtml(article.lead)}</p><div class="course-native-article">${html}</div><aside class="course-takeaway"><span class="eyebrow muted">本讲要点</span><p>${escapeHtml(article.takeaway)}</p></aside>`;
      // Original CS336 footnotes retain their old URLs; add course context in the DOM.
      byId('course-article-body').querySelectorAll('a[href^="#courses?"]').forEach(anchor=>{
        const query=new URLSearchParams(anchor.getAttribute('href').split('?')[1]);
        if(!query.has('course'))query.set('course',course.id);
        anchor.setAttribute('href','#courses?'+query);
      });
      byId('course-article-body').querySelectorAll('.course-native-article img').forEach(image=>{
        image.tabIndex=0;
        image.setAttribute('role','button');
        image.setAttribute('aria-label',`放大图表：${image.alt}`);
      });
      loadedLecture=key;
      jump();
    }catch(error){
      if(request!==articleRequest||byId('page-courses').hidden||byId('course-reading-view').hidden)return;
      byId('course-article-body').innerHTML=`<div class="course-load-error"><strong>课程正文暂时无法载入。</strong><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  function showView(view){
    for(const name of ['catalog','home','reading','missing'])byId(`course-${name}-view`).hidden=name!==view;
  }
  function missing(message){
    ++articleRequest;
    showView('missing');
    document.title='未找到课程 · Learning Atlas';
    byId('course-missing-message').textContent=message;
  }
  function render(params){
    const requestedCourse=params.get('course'),requestedLecture=params.get('lecture');
    if(!requestedCourse&&!requestedLecture){
      ++articleRequest;activeCourse=null;selectedId=null;
      showView('catalog');document.title='基础课程 · Learning Atlas';
      renderCatalog();return;
    }
    // Keep already-published CS336 lecture/footnote deep links working.
    const course=requestedCourse?courses.find(item=>item.id===requestedCourse):courses.find(item=>item.id==='cs336'&&item.lectures.some(lecture=>lecture.id===requestedLecture))||courses.find(item=>item.lectures.some(lecture=>lecture.id===requestedLecture));
    if(!course){missing('没有找到这门课程。请返回课程总览选择已收录的课程。');return;}
    if(activeCourse?.id!==course.id){byId('course-query').value='';byId('course-home-query').value='';}
    activeCourse=course;
    if(!requestedLecture){
      ++articleRequest;selectedId=null;
      showView('home');renderHome(course,params);return;
    }
    const lecture=course.lectures.find(item=>item.id===requestedLecture);
    if(!lecture){missing('没有找到这篇讲次笔记。请返回课程主页查看目录。');return;}
    showView('reading');selectedId=lecture.id;
    document.title=`${lecture.title} · ${course.title} · Learning Atlas`;
    byId('course-reader-breadcrumb').innerHTML=link('#courses','基础课程')+'<span aria-hidden="true">/</span>'+link(route(course),escapeHtml(course.title))+'<span aria-hidden="true">/</span>'+`<span>第 ${lecture.number} 讲</span>`;
    byId('course-back-home').href=route(course);
    byId('course-reader-course').textContent=course.title;
    byId('course-lecture-number').textContent=String(lecture.number).padStart(2,'0');
    byId('course-lecture-title').textContent=lecture.title;
    byId('course-lecture-summary').textContent=lecture.summary;
    byId('course-lecture-meta').textContent=`第 ${lecture.number} 讲 · ${lecture.instructor} · ${lecture.date}`;
    byId('course-lecture-resources').innerHTML=(lecture.resources||[]).map(external).join('');
    renderArticle(course,lecture,params);renderList(byId('course-query').value);
  }

  function zoomFigure(image){
    const dialog=byId('paper-dialog');
    byId('paper-dialog-title').textContent=image.alt||'课程图表';
    byId('paper-dialog-image').src=image.src;byId('paper-dialog-image').alt=image.alt;
    byId('paper-dialog-source').href=image.src;byId('paper-dialog-source').textContent='新窗口查看课程图表 ↗';
    if(!dialog.open)dialog.showModal();
  }
  function init(){
    const categories=['all',...new Set(courses.map(course=>course.category))];
    byId('courses-category-tabs').innerHTML=categories.map(category=>`<button type="button" data-course-category="${escapeHtml(category)}" class="${category==='all'?'active':''}" aria-pressed="${category==='all'}">${category==='all'?'全部课程':escapeHtml(category)}</button>`).join('');
    byId('courses-category-tabs').addEventListener('click',event=>{
      const button=event.target.closest('[data-course-category]');if(!button)return;
      indexCategory=button.dataset.courseCategory;
      byId('courses-category-tabs').querySelectorAll('button').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));});
      renderCatalog();
    });
    byId('courses-query').addEventListener('input',renderCatalog);
    byId('course-home-query').addEventListener('input',renderSchedule);
    byId('course-stage-filter').addEventListener('change',renderSchedule);
    byId('course-query').addEventListener('input',event=>renderList(event.currentTarget.value));
    byId('course-article-body').addEventListener('click',event=>{const image=event.target.closest('.course-native-article img');if(image)zoomFigure(image);});
    byId('course-article-body').addEventListener('keydown',event=>{
      if(!['Enter',' '].includes(event.key))return;
      const image=event.target.closest('.course-native-article img');if(image){event.preventDefault();zoomFigure(image);}
    });
  }
  globalThis.AtlasCourses={init,render};
})();
