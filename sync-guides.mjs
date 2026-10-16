import {readFileSync,writeFileSync,mkdirSync,readdirSync,unlinkSync} from 'node:fs';
const root=new URL('./',import.meta.url);
const guides=JSON.parse(readFileSync(new URL('content/guides.json',root),'utf8'));
const news=JSON.parse(readFileSync(new URL('content/frontier.json',root),'utf8'));
writeFileSync(new URL('dist/guide-data.js',root),'globalThis.ATLAS_GUIDES = '+JSON.stringify(guides,null,2)+';\nglobalThis.ATLAS_EXTRA_NEWS = '+JSON.stringify(news,null,2)+';\n');
const robotPapers=JSON.parse(readFileSync(new URL('content/robot-papers.json',root),'utf8'));
writeFileSync(new URL('dist/robot-paper-data.js',root),'globalThis.ATLAS_ROBOT_PAPERS = '+JSON.stringify(robotPapers,null,2)+';\n');
const examples=new URL('dist/examples/',root);
mkdirSync(examples,{recursive:true});
for(const file of readdirSync(examples))if(/^[a-z0-9-]+-\d+\.(py|txt)$/.test(file))unlinkSync(new URL(file,examples));
for(const g of guides)for(const [i,s]of g.sections.entries())if(s.code){const ext=s.codeLanguage&&s.codeLanguage!=='python'?'txt':'py';writeFileSync(new URL(`${g.id}-${i+1}.${ext}`,examples),s.code+'\n');}
console.log(`Synced ${guides.length} guides and ${news.length} frontier notes.`);
