import {readFileSync,writeFileSync} from 'node:fs';
const resources=JSON.parse(readFileSync(new URL('./dist/resources.json',import.meta.url),'utf8'));
writeFileSync(new URL('./dist/data.js',import.meta.url),'globalThis.ATLAS_RESOURCES = '+JSON.stringify(resources,null,2)+';\n');
