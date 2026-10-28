import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const guides = json('content/guides.json');
const news = json('content/frontier.json');
const papers = json('content/robot-papers.json');
const figures = json('content/paper-figures.json');
const diagrams = json('content/diagrams.json');
const resources = json('dist/resources.json');
const courses = json('content/courses.json').courses;

function ids(items, label) {
  assert.ok(Array.isArray(items) && items.length, `${label}: expected entries`);
  const result = new Set();
  for (const item of items) {
    assert.ok(typeof item.id === 'string' && item.id, `${label}: missing id`);
    assert.ok(!result.has(item.id), `${label}: duplicate id ${item.id}`);
    result.add(item.id);
  }
  return result;
}
const guideIds = ids(guides, 'guides');
const resourceIds = ids(resources, 'resources');
let assetReferences = 0;
ids(courses, 'courses');
let lectureCount = 0;
const articlesById = new Map();
let courseTopicCount = 0;
const resourceKinds = new Set(['website', 'repository', 'video', 'slides', 'interactive', 'reading', 'assignment']);
function courseResources(resources, context) {
  assert.ok(Array.isArray(resources), `${context}: resources must be an array`);
  for (const resource of resources) {
    assert.ok(resource.label && resourceKinds.has(resource.kind), `${context}: invalid resource metadata`);
    assert.equal(new URL(resource.url).protocol, 'https:', `${context}: public materials must use HTTPS`);
  }
}
for (const course of courses) {
  assert.match(course.id, /^[a-z0-9-]+$/, 'course id must be URL-safe');
  assert.ok(course.title && course.subtitle && course.summary && course.category && Array.isArray(course.tags) && course.provider && course.term && Array.isArray(course.lectures), `${course.id}: incomplete course`);
  const courseArticles = json(`content/course-articles/${course.id}.json`);
  const courseMigration = json(`dist/course-articles/${course.id}/index.json`);
  assert.equal(courseArticles.courseId, course.id, 'course summary metadata mismatch');
  assert.equal(courseMigration.courseId, course.id, 'course migration metadata mismatch');
  const summariesById = new Map(courseArticles.lectures.map(article => [article.lectureId, article]));
  const migratedById = new Map(courseMigration.lectures.map(article => [article.lectureId, article]));
  assert.equal(summariesById.size, courseArticles.lectures.length, 'duplicate course summary id');
  assert.equal(migratedById.size, courseMigration.lectures.length, 'duplicate migrated article id');
  ids(course.lectures, `${course.id} lectures`);
  assert.equal(course.lectures.length, courseMigration.lectures.length, 'every lecture needs a migrated article');
  assert.equal(course.lectures.length, courseArticles.lectures.length, 'every lecture needs an introduction');
  courseTopicCount += courseMigration.lectures.reduce((sum, article) => sum + article.toc.length, 0);
  courseResources(course.resources, course.id);
  const numbers = course.lectures.map(lecture => lecture.number);
  assert.equal(new Set(numbers).size, numbers.length, `${course.id}: duplicate lecture numbers`);
  const stageNumbers = (course.stages || []).flatMap(stage => {
    assert.ok(stage.title && stage.summary && stage.lectures?.length, `${course.id}: incomplete learning stage`);
    return stage.lectures;
  });
  assert.deepEqual([...stageNumbers].sort((a,b) => a-b), [...numbers].sort((a,b) => a-b), `${course.id}: learning stages must cover lectures exactly once`);
  for (const lecture of course.lectures) {
    assert.ok(Number.isInteger(lecture.number) && lecture.number > 0, `${lecture.id}: invalid lecture number`);
    assert.ok(lecture.title && lecture.summary && lecture.instructor, `${lecture.id}: missing lecture metadata`);
    assert.match(lecture.date, /^\d{4}-\d{2}-\d{2}$/, `${lecture.id}: invalid date`);
    const summary = summariesById.get(lecture.id);
    const migration = migratedById.get(lecture.id);
    assert.ok(summary?.lead && summary.takeaway && migration?.toc?.length, `${lecture.id}: incomplete native article`);
    assert.deepEqual(migration.unknownMacros, {}, `${lecture.id}: unsupported source content`);
    assert.equal(migration.headings, migration.sourceHeadings, `${lecture.id}: missing source headings`);
    assert.equal(migration.inlineImages, migration.sourceFigureRefs, `${lecture.id}: missing source figures`);
    assert.equal(migration.codeBlocks || 0, migration.sourceCodeBlocks, `${lecture.id}: missing source code blocks`);
    asset(migration.file, lecture.id);
    const fragment = read('dist/' + migration.file.replace(/^\.\//, ''));
    assert.equal(Buffer.byteLength(fragment), migration.htmlBytes, `${lecture.id}: stale migration index`);
    assert.ok(!/<(?:script|iframe|object|embed)\b|\son[a-z]+\s*=/i.test(fragment), `${lecture.id}: executable article content`);
    assert.ok(!/course-unmapped-macro|<ns\d+:math\b/.test(fragment), `${lecture.id}: broken source rendering`);
    const articleIds = new Set([...fragment.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    for (const item of migration.toc) assert.ok(articleIds.has(item.id), `${lecture.id}: missing heading ${item.id}`);
    for (const match of fragment.matchAll(/\bsrc="([^"]+)"/g)) asset(match[1], lecture.id);
    courseResources(lecture.resources, `${course.id}/${lecture.id}`);
    articlesById.set(`${course.id}/${lecture.id}`, {...summary, ...migration});
    lectureCount++;
  }
}
ids(figures, 'paper figures');
ids(diagrams, 'diagrams');
ids(papers.papers, 'robot papers');

function asset(src, context) {
  if (/^(?:https?:|data:|#)/.test(src)) return;
  const name = decodeURIComponent(src.split(/[?#]/)[0]);
  const local = path.resolve(dist, name);
  assert.ok(local.startsWith(dist + path.sep), `${context}: asset must be relative: ${src}`);
  assert.ok(fs.existsSync(local) && fs.statSync(local).isFile(), `${context}: missing ${src}`);
  assetReferences++;
}

let equations = 0;
function walk(value, context) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.src === 'string') asset(value.src, context);
  if (typeof value.latex === 'string' && value.plain) {
    assert.equal(value.mathmlSource, value.latex, `${context}: stale formula`);
    assert.ok(value.mathml?.startsWith('<math ') && value.mathml.includes('alttext='), `${context}: missing formula rendering`);
    equations++;
  }
  for (const child of Object.values(value)) walk(child, context);
}

for (const guide of guides) {
  assert.ok(guide.knowledge?.title && guide.knowledge?.summary, `${guide.id}: missing title or summary`);
  assert.ok(guide.knowledge.essentials?.length, `${guide.id}: missing explanation`);
  assert.ok(guide.knowledge.flow?.steps?.length, `${guide.id}: missing flow`);
  for (const id of guide.knowledge.connections || []) assert.ok(guideIds.has(id), `${guide.id}: unknown related guide ${id}`);
  for (const id of guide.resourceIds || []) assert.ok(resourceIds.has(id), `${guide.id}: unknown resource ${id}`);
  walk(guide, guide.id);
}
walk(figures, 'paper figures');
walk(diagrams, 'diagrams');
walk(papers, 'robot papers');

// Check the generated payload matches the edited source.
const dataContext = vm.createContext({});
for (const file of ['guide-data.js', 'robot-paper-data.js', 'course-data.js', 'data.js']) {
  vm.runInContext(read('dist/' + file), dataContext, {filename: file});
}
const same = (generated, source, label) => assert.equal(JSON.stringify(generated), JSON.stringify(source), `${label}: run the build script`);
same(dataContext.ATLAS_GUIDES, guides, 'guide data');
same(dataContext.ATLAS_EXTRA_NEWS, news, 'frontier data');
same(dataContext.ATLAS_ROBOT_PAPERS, papers, 'robot paper data');
same(dataContext.ATLAS_COURSES, courses.map(course => ({...course, lectures: course.lectures.map(lecture => ({...lecture, article: articlesById.get(`${course.id}/${lecture.id}`)}))})), 'course data');
same(dataContext.ATLAS_RESOURCES, resources, 'resource data');

const html = read('dist/index.html');
assert.match(html, /<html\b/);
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) asset(match[1], 'index.html');
const scriptFiles = [...html.matchAll(/<script\b[^>]*src=["']\.\/([^"']+)["']/g)].map(m => m[1]);
for (const file of scriptFiles) new vm.Script(read('dist/' + file), {filename: file});
console.log(`Checked ${guides.length} guides, ${lectureCount} complete native course articles, ${courseTopicCount} source headings, ${equations} guide formulas, ${assetReferences} asset references and ${scriptFiles.length} scripts.`);
