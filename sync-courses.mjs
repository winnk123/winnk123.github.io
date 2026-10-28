import {existsSync,readFileSync,writeFileSync} from 'node:fs';

const root=new URL('./',import.meta.url);
const courses=JSON.parse(readFileSync(new URL('content/courses.json',root),'utf8')).courses;
const summaries=JSON.parse(readFileSync(new URL('content/course-articles.json',root),'utf8'));
const migrated=JSON.parse(readFileSync(new URL('dist/course-articles/cs336/index.json',root),'utf8'));
if(courses.length!==1||summaries.courseId!==courses[0].id||migrated.courseId!==courses[0].id)throw new Error('Course/article data do not match.');
const summariesById=new Map(summaries.lectures.map(article=>[article.lectureId,article]));
const migratedById=new Map(migrated.lectures.map(article=>[article.lectureId,article]));
if(summariesById.size!==summaries.lectures.length||migratedById.size!==migrated.lectures.length)throw new Error('Duplicate course article id.');

for(const course of courses)for(const lecture of course.lectures){
 const summary=summariesById.get(lecture.id);
 const article=migratedById.get(lecture.id);
 if(!summary?.lead||!summary.takeaway||!article?.toc?.length||article.textCharacters<500)throw new Error(`Incomplete migrated article: ${lecture.id}`);
 const relative=article.file.replace(/^\.\//,'');
 const file=new URL(`dist/${relative}`,root);
 if(!relative.startsWith('course-articles/cs336/')||!existsSync(file))throw new Error(`Missing native article HTML: ${article.file}`);
 lecture.article={...summary,...article};
}

writeFileSync(new URL('dist/course-data.js',root),'globalThis.ATLAS_COURSES = '+JSON.stringify(courses,null,2)+';\n');
console.log(`Synced ${courses.length} courses and ${migrated.lectures.length} complete native articles (${migrated.lectures.reduce((sum,item)=>sum+item.textCharacters,0).toLocaleString()} visible text characters).`);
