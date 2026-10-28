'use strict';
(() => {
  const courses=globalThis.ATLAS_COURSES||[];
  const course=courses.find(item=>item.id==='cs336');
  const byId=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let selectedId=null;

  function renderList(query=''){
    if(!course)return;
    const needle=query.trim().toLocaleLowerCase();
    const matches=course.lectures.filter(lecture=>!needle||`${lecture.title} ${lecture.summary} ${lecture.instructor} ${lecture.number} ${lecture.article.sections.map(section=>`${section.title} ${section.paragraphs.join(' ')}`).join(' ')}`.toLocaleLowerCase().includes(needle));
    byId('course-result-count').textContent=`${matches.length} / ${course.lectures.length} 讲`;
    byId('course-list').innerHTML=matches.length?matches.map(lecture=>`<a class="course-lecture${lecture.id===selectedId?' active':''}" href="#courses?lecture=${lecture.id}"${lecture.id===selectedId?' aria-current="page"':''}><span class="course-lecture-number">${String(lecture.number).padStart(2,'0')}</span><span class="course-lecture-text"><strong>${escapeHtml(lecture.title)}</strong><small>${escapeHtml(lecture.summary)}</small></span><span class="course-lecture-arrow" aria-hidden="true">→</span></a>`).join(''):'<p class="course-empty">没有找到匹配的讲次。</p>';
  }

  function renderArticle(lecture){
    const article=lecture.article;
    byId('course-article-progress').textContent=`${article.sections.length} 个主题`;
    byId('course-article-toc').innerHTML=`<div class="course-article-toc-title">本讲内容</div>${article.sections.map((section,index)=>`<a href="#courses?lecture=${lecture.id}&section=${index}" data-course-section="${index}"><span>${String(index+1).padStart(2,'0')}</span>${escapeHtml(section.title)}</a>`).join('')}`;
    byId('course-article-body').innerHTML=`<p class="course-article-lead">${escapeHtml(article.lead)}</p>${article.sections.map((section,index)=>`<section class="course-content-section" id="course-section-${index}"><div class="course-section-index">${String(index+1).padStart(2,'0')}</div><div class="course-section-content"><h3>${escapeHtml(section.title)}</h3>${section.paragraphs.map(paragraph=>`<p>${escapeHtml(paragraph)}</p>`).join('')}${section.equation?`<figure class="course-equation"><div>${escapeHtml(section.equation.display)}</div><figcaption><strong>${escapeHtml(section.equation.label)}</strong><span>${escapeHtml(section.equation.plain)}</span></figcaption></figure>`:''}${section.figure?`<figure class="course-figure"><img src="./assets/courses/cs336/lecture-${String(lecture.number).padStart(2,'0')}/${escapeHtml(section.figure.src.split('/').pop())}" alt="${escapeHtml(section.figure.caption)}" loading="lazy"><figcaption>${escapeHtml(section.figure.caption)}</figcaption></figure>`:''}</div></section>`).join('')}<aside class="course-takeaway"><span class="eyebrow muted">本讲要点</span><p>${escapeHtml(article.takeaway)}</p></aside>`;
    const previous=course.lectures.find(item=>item.number===lecture.number-1);
    const next=course.lectures.find(item=>item.number===lecture.number+1);
    byId('course-lecture-pagination').innerHTML=`${previous?`<a href="#courses?lecture=${previous.id}"><span>上一讲 · ${String(previous.number).padStart(2,'0')}</span><strong>${escapeHtml(previous.title)} ←</strong></a>`:'<span></span>'}${next?`<a class="next" href="#courses?lecture=${next.id}"><span>下一讲 · ${String(next.number).padStart(2,'0')}</span><strong>→ ${escapeHtml(next.title)}</strong></a>`:''}`;
  }

  function render(params){
    if(!course)return;
    const requested=params.get('lecture');
    const lecture=course.lectures.find(item=>item.id===requested)||course.lectures[0];
    if(!lecture)return;
    selectedId=lecture.id;
    byId('course-total').textContent=String(course.lectures.length);
    byId('course-lecture-number').textContent=String(lecture.number).padStart(2,'0');
    byId('course-lecture-title').textContent=lecture.title;
    byId('course-lecture-summary').textContent=lecture.summary;
    byId('course-lecture-meta').textContent=`第 ${lecture.number} 讲 · ${lecture.instructor} · ${lecture.date}`;
    renderArticle(lecture);
    renderList(byId('course-query').value);
    const section=params.get('section');
    if(section!==null&&Number.isInteger(Number(section))&&lecture.article.sections[Number(section)])requestAnimationFrame(()=>byId(`course-section-${Number(section)}`)?.scrollIntoView({behavior:'instant',block:'start'}));
  }

  function init(){
    byId('course-query').addEventListener('input',event=>renderList(event.currentTarget.value));
  }

  globalThis.AtlasCourses={init,render};
})();
