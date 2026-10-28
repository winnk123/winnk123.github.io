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
const courseArticles = json('content/course-articles.json');

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
assert.equal(courseArticles.courseId, courses[0]?.id, 'course articles must match course metadata');
const articlesById = new Map(courseArticles.lectures.map(article => [article.lectureId, article]));
assert.equal(articlesById.size, courseArticles.lectures.length, 'duplicate course article id');
for (const course of courses) {
  assert.ok(course.title && course.subtitle && Array.isArray(course.lectures), `${course.id}: incomplete course`);
  ids(course.lectures, `${course.id} lectures`);
  for (const lecture of course.lectures) {
    assert.ok(Number.isInteger(lecture.number) && lecture.number > 0, `${lecture.id}: invalid lecture number`);
    assert.ok(lecture.title && lecture.summary && lecture.instructor, `${lecture.id}: missing lecture metadata`);
    assert.match(lecture.date, /^\d{4}-\d{2}-\d{2}$/, `${lecture.id}: invalid date`);
    const article = articlesById.get(lecture.id);
    assert.ok(article?.lead && article.takeaway && article.sections?.length >= 3, `${lecture.id}: incomplete native article`);
    for (const section of article.sections) {
      assert.ok(section.title && section.paragraphs?.length, `${lecture.id}: empty article section`);
      if (section.equation) assert.ok(section.equation.display && section.equation.label && section.equation.plain, `${lecture.id}/${section.title}: incomplete equation`);
      if (section.figure) asset(`./assets/courses/${course.id}/${lecture.id}/${section.figure.src.split('/').at(-1)}`, `${lecture.id}/${section.title}`);
    }
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
same(dataContext.ATLAS_COURSES, courses.map(course => ({...course, lectures: course.lectures.map(lecture => ({...lecture, article: articlesById.get(lecture.id)}))})), 'course data');
same(dataContext.ATLAS_RESOURCES, resources, 'resource data');

const html = read('dist/index.html');
assert.match(html, /<html\b/);
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) asset(match[1], 'index.html');
const scriptFiles = [...html.matchAll(/<script\b[^>]*src=["']\.\/([^"']+)["']/g)].map(m => m[1]);
for (const file of scriptFiles) new vm.Script(read('dist/' + file), {filename: file});
console.log(`Checked ${guides.length} guides, ${lectureCount} native course articles, ${equations} formulas, ${assetReferences} asset references and ${scriptFiles.length} scripts.`);
