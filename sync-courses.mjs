import {existsSync,readFileSync,writeFileSync} from 'node:fs';

const root=new URL('./',import.meta.url);
const read=file=>JSON.parse(readFileSync(new URL(file,root),'utf8'));
const courses=read('content/courses.json').courses;
const courseIds=new Set();
let articleCount=0,textCharacters=0;
for(const course of courses){
 if(!/^[a-z0-9-]+$/.test(course.id)||courseIds.has(course.id))throw new Error(`Invalid/duplicate course id: ${course.id}`);
 courseIds.add(course.id);
 const summaries=read(`content/course-articles/${course.id}.json`);
 const migrated=read(`dist/course-articles/${course.id}/index.json`);
 if(summaries.courseId!==course.id||migrated.courseId!==course.id)throw new Error(`Course/article data do not match: ${course.id}`);
 const summariesById=new Map(summaries.lectures.map(article=>[article.lectureId,article]));
 const migratedById=new Map(migrated.lectures.map(article=>[article.lectureId,article]));
 const lectureIds=new Set(course.lectures.map(lecture=>lecture.id));
 if(lectureIds.size!==course.lectures.length||summariesById.size!==summaries.lectures.length||migratedById.size!==migrated.lectures.length)throw new Error(`Duplicate course article id: ${course.id}`);
 if(summariesById.size!==lectureIds.size||migratedById.size!==lectureIds.size||[...migratedById.keys(),...summariesById.keys()].some(id=>!lectureIds.has(id)))throw new Error(`Incomplete course coverage: ${course.id}`);
 for(const lecture of course.lectures){
  const summary=summariesById.get(lecture.id);
  const article=migratedById.get(lecture.id);
  if(!summary?.lead||!summary.takeaway||!article?.toc?.length||article.textCharacters<500)throw new Error(`Incomplete migrated article: ${course.id}/${lecture.id}`);
  const relative=article.file.replace(/^\.\//,'');
  const file=new URL(`dist/${relative}`,root);
  if(!relative.startsWith(`course-articles/${course.id}/`)||relative.split('/').includes('..')||!existsSync(file))throw new Error(`Missing native article HTML: ${article.file}`);
  lecture.article={...summary,...article};
  articleCount++;
  textCharacters+=article.textCharacters;
 }
}
writeFileSync(new URL('dist/course-data.js',root),'globalThis.ATLAS_COURSES = '+JSON.stringify(courses,null,2)+';\n');
console.log(`Synced ${courses.length} courses and ${articleCount} complete native articles (${textCharacters.toLocaleString()} visible text characters).`);
