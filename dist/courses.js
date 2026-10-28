'use strict';
(() => {
  const courses=globalThis.ATLAS_COURSES||[];
  const course=courses.find(item=>item.id==='cs336');
  const byId=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let selectedId=null;
  let articleRequest=0;
  let loadedLecture=null;
  const articleCache=new Map();

  function renderList(query=''){
    if(!course)return;
    const needle=query.trim().toLocaleLowerCase();
    const matches=course.lectures.filter(lecture=>!needle||`${lecture.title} ${lecture.summary} ${lecture.instructor} ${lecture.number} ${lecture.article.searchText}`.toLocaleLowerCase().includes(needle));
    byId('course-result-count').textContent=`${matches.length} / ${course.lectures.length} 讲`;
    byId('course-list').innerHTML=matches.length?matches.map(lecture=>`<a class="course-lecture${lecture.id===selectedId?' active':''}" href="#courses?lecture=${lecture.id}"${lecture.id===selectedId?' aria-current="page"':''}><span class="course-lecture-number">${String(lecture.number).padStart(2,'0')}</span><span class="course-lecture-text"><strong>${escapeHtml(lecture.title)}</strong><small>${escapeHtml(lecture.summary)}</small></span><span class="course-lecture-arrow" aria-hidden="true">→</span></a>`).join(''):'<p class="course-empty">没有找到匹配的讲次。</p>';
  }

  async function renderArticle(lecture,params){
    const article=lecture.article;
    const request=++articleRequest;
    const jump=()=>{
      const section=params.get('section');
      if(section)requestAnimationFrame(()=>byId(section)?.scrollIntoView({behavior:'instant',block:'start'}));
    };
    byId('course-article-progress').textContent=`${article.toc.length} 个目录项`;
    byId('course-article-toc').innerHTML=`<div class="course-article-toc-title">本讲内容</div>${article.toc.map((item,index)=>`<a class="${item.level>3?'nested':''}" href="#courses?lecture=${lecture.id}&section=${encodeURIComponent(item.id)}"><span>${String(index+1).padStart(2,'0')}</span>${escapeHtml(item.title)}</a>`).join('')}`;
    const previous=course.lectures.find(item=>item.number===lecture.number-1);
    const next=course.lectures.find(item=>item.number===lecture.number+1);
    byId('course-lecture-pagination').innerHTML=`${previous?`<a href="#courses?lecture=${previous.id}"><span>上一讲 · ${String(previous.number).padStart(2,'0')}</span><strong>${escapeHtml(previous.title)} ←</strong></a>`:'<span></span>'}${next?`<a class="next" href="#courses?lecture=${next.id}"><span>下一讲 · ${String(next.number).padStart(2,'0')}</span><strong>→ ${escapeHtml(next.title)}</strong></a>`:''}`;
    if(loadedLecture===lecture.id){jump();return;}
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
      if(request!==articleRequest||byId('page-courses').hidden)return;
      byId('course-article-body').innerHTML=`<p class="course-article-lead">${escapeHtml(article.lead)}</p><div class="course-native-article">${html}</div><aside class="course-takeaway"><span class="eyebrow muted">本讲要点</span><p>${escapeHtml(article.takeaway)}</p></aside>`;
      byId('course-article-body').querySelectorAll('.course-native-article img').forEach(image=>{
        image.tabIndex=0;
        image.setAttribute('role','button');
        image.setAttribute('aria-label',`放大图表：${image.alt}`);
      });
      loadedLecture=lecture.id;
      jump();
    }catch(error){
      if(request!==articleRequest||byId('page-courses').hidden)return;
      byId('course-article-body').innerHTML=`<div class="course-load-error"><strong>课程正文暂时无法载入。</strong><span>${escapeHtml(error.message)}</span></div>`;
    }

  }

  function render(params){
    if(!course)return;
    const requested=params.get('lecture');
    const lecture=course.lectures.find(item=>item.id===requested)||course.lectures[0];
    if(!lecture)return;
    selectedId=lecture.id;
    document.title=`${lecture.title} · CS336 · Learning Atlas`;
    byId('course-total').textContent=String(course.lectures.length);
    byId('course-lecture-number').textContent=String(lecture.number).padStart(2,'0');
    byId('course-lecture-title').textContent=lecture.title;
    byId('course-lecture-summary').textContent=lecture.summary;
    byId('course-lecture-meta').textContent=`第 ${lecture.number} 讲 · ${lecture.instructor} · ${lecture.date}`;
    renderArticle(lecture,params);
    renderList(byId('course-query').value);
  }

  function zoomFigure(image){
    const dialog=byId('paper-dialog');
    byId('paper-dialog-title').textContent=image.alt||'课程图表';
    byId('paper-dialog-image').src=image.src;
    byId('paper-dialog-image').alt=image.alt;
    byId('paper-dialog-source').href=image.src;
    byId('paper-dialog-source').textContent='新窗口查看课程图表 ↗';
    if(!dialog.open)dialog.showModal();
  }

  function init(){
    byId('course-query').addEventListener('input',event=>renderList(event.currentTarget.value));
    byId('course-article-body').addEventListener('click',event=>{
      const image=event.target.closest('.course-native-article img');
      if(image)zoomFigure(image);
    });
    byId('course-article-body').addEventListener('keydown',event=>{
      if(!['Enter',' '].includes(event.key))return;
      const image=event.target.closest('.course-native-article img');
      if(image){event.preventDefault();zoomFigure(image);}
    });
  }

  globalThis.AtlasCourses={init,render};
})();
