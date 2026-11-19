#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, getApps } = require('../functions/node_modules/firebase-admin/app');
const { getFirestore, FieldValue } = require('../functions/node_modules/firebase-admin/firestore');
function arg(name){const prefix='--'+name+'=';const item=process.argv.find(value=>value.startsWith(prefix));return item?item.slice(prefix.length):'';}
async function main(){
 const mode=process.argv[2],projectId=arg('project')||process.env.GCLOUD_PROJECT||'';
 const emulator=mode==='--emulator',production=mode==='--production';
 if(!emulator&&!production)throw new Error('Use --emulator or --production explicitly.');
 if(emulator&&(!process.env.FIRESTORE_EMULATOR_HOST||!projectId.startsWith('demo-')))throw new Error('Emulator mode requires FIRESTORE_EMULATOR_HOST and a demo-* project.');
 if(production&&(process.env.FIRESTORE_EMULATOR_HOST||projectId!=='imi-indroid'||arg('confirm')!=='imi-indroid'))throw new Error('Production mode requires no emulator and --project=imi-indroid --confirm=imi-indroid.');
 const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/general-skills-android-migration.json'),'utf8'));
 if(!data.courseId||data.category!=='مهارات عامة'||!Array.isArray(data.lessons)||data.lessons.length!==3)throw new Error('Expected exactly three legacy general-skills lessons.');
 if(!getApps().length)initializeApp({projectId});
 const db=getFirestore(),course=db.collection('courses').doc(data.courseId);
 if((await course.get()).exists)throw new Error('Migration target already exists; refusing to overwrite existing content.');
 const now=FieldValue.serverTimestamp();
 await course.create({title:data.title,category:data.category,description:'ثلاثة دروس تأسيسية نُقلت من النسخة المحلية لتطبيق Android. جميعها مسودات تنتظر مراجعة بشرية.',published:false,needsHumanReview:true,createdBy:'android-legacy-migration',createdAt:now,updatedAt:now});
 const batch=db.batch();
 for(const lesson of data.lessons){
  batch.create(course.collection('lessons').doc(lesson.id),{title:lesson.title,content:lesson.content,summary:lesson.summary,order:data.lessons.indexOf(lesson)+1,published:false,needsHumanReview:true,sourceType:'original',sourceName:'محتوى تأسيسي محلي من تطبيق IMI Android',license:'IMI original draft - verify rights before publication',permissionNote:'مهاجر من محتوى محلي قديم؛ يحتاج مراجعة بشرية وتأكيد الحقوق قبل النشر.',reviewStatus:'pending',addedBy:'android-legacy-migration',createdAt:now,updatedAt:now});
 }
 await batch.commit();
 process.stdout.write('Imported 3 legacy lessons as unpublished drafts into '+data.courseId+' on '+projectId+'.\n');
}
main().catch(error=>{process.stderr.write(String(error.stack||error)+'\n');process.exitCode=1;});
