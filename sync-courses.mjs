import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const root=new URL('./',import.meta.url);
const courses=JSON.parse(readFileSync(new URL('content/courses.json',root),'utf8')).courses;
const articles=JSON.parse(readFileSync(new URL('content/course-articles.json',root),'utf8'));
if(courses.length!==1||articles.courseId!==courses[0].id)throw new Error('Course/article data do not match.');
const articleById=new Map(articles.lectures.map(article=>[article.lectureId,article]));
if(articleById.size!==articles.lectures.length)throw new Error('Duplicate course article id.');
for(const course of courses)for(const lecture of course.lectures){
 const article=articleById.get(lecture.id);
 if(!article||!article.lead||!article.takeaway||!Array.isArray(article.sections)||article.sections.length<3)throw new Error(`Incomplete native article: ${lecture.id}`);
 for(const section of article.sections){
  if(!section.title||!Array.isArray(section.paragraphs)||section.paragraphs.length<1)throw new Error(`Incomplete section: ${lecture.id}/${section.title}`);
  if(section.figure){
   if(!/^figures\/[a-z0-9._-]+$/i.test(section.figure.src))throw new Error(`Invalid course figure path: ${section.figure.src}`);
   const relative=`dist/assets/courses/${course.id}/${lecture.id.replace('lecture-','lecture-')}/${path.basename(section.figure.src)}`;
   if(!existsSync(new URL(relative,root)))throw new Error(`Missing course figure: ${relative}`);
  }
 }
 lecture.article=article;
}
writeFileSync(new URL('dist/course-data.js',root),'globalThis.ATLAS_COURSES = '+JSON.stringify(courses,null,2)+';\n');
console.log(`Synced ${courses.length} courses, ${articles.lectures.length} native articles and ${courses.reduce((n,course)=>n+course.lectures.length,0)} lectures.`);
