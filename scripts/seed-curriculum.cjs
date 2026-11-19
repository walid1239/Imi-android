#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, getApps } = require('../functions/node_modules/firebase-admin/app');
const { getFirestore, FieldValue } = require('../functions/node_modules/firebase-admin/firestore');
function arg(name){const p=`--${name}=`;const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):'';}
const mode=process.argv[2], projectId=arg('project')||process.env.GCLOUD_PROJECT||'';
const file=path.resolve(__dirname,'../data/curriculum.json');
function validate(nodes){
 const types=new Set(['level','track','subject','unit']),ids=new Set();
 for(const n of nodes){
  if(!n||typeof n.id!=='string'||!/^[a-z0-9][a-z0-9_-]{1,100}$/.test(n.id)||ids.has(n.id))throw new Error('Invalid or duplicate node id.');
  ids.add(n.id);
  if(!types.has(n.type)||typeof n.nameAr!=='string'||!n.nameAr.trim()||typeof n.nameFr!=='string'||typeof n.language!=='string'||!Number.isInteger(n.order)||typeof n.needsReview!=='boolean'||!['hidden','published'].includes(n.status))throw new Error(`Invalid node metadata: ${n.id}`);
  if(n.needsReview===true&&n.status!=='hidden')throw new Error(`Unreviewed curriculum nodes must remain hidden: ${n.id}`);
  if(n.type==='unit'&&n.status!=='hidden')throw new Error(`Unit placeholders must remain hidden: ${n.id}`);
 }
 for(const n of nodes)if(n.parentId!==null&&!ids.has(n.parentId))throw new Error(`Missing parent for ${n.id}`);
}
async function main(){
 const emulator=mode==='--emulator',production=mode==='--production';
 if(!emulator&&!production)throw new Error('Use --emulator or --production explicitly.');
 if(emulator&&(!process.env.FIRESTORE_EMULATOR_HOST||!projectId.startsWith('demo-')))throw new Error('Emulator mode requires FIRESTORE_EMULATOR_HOST and a demo-* project.');
 if(production&&(process.env.FIRESTORE_EMULATOR_HOST||projectId!=='imi-indroid'||arg('confirm')!=='imi-indroid'))throw new Error('Production mode requires no emulator and --project=imi-indroid --confirm=imi-indroid.');
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(data.noLessons!==true||!Array.isArray(data.nodes))throw new Error('Invalid no-lessons seed file.');
 validate(data.nodes);
 if(!getApps().length)initializeApp({projectId});
 const db=getFirestore();let batch=db.batch(),pending=0;
 for(const node of data.nodes){
  const ref=db.collection('curriculumNodes').doc(node.id),existing=await ref.get();
  batch.set(ref,{...node,createdAt:existing.exists&&existing.get('createdAt')?existing.get('createdAt'):FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
  if(++pending>=400){await batch.commit();batch=db.batch();pending=0;}
 }
 if(pending)await batch.commit();
 process.stdout.write(`Seeded ${data.nodes.length} curriculum nodes to ${projectId}; no lessons created.\n`);
}
main().catch(e=>{process.stderr.write(`${e.stack||e}\n`);process.exitCode=1;});
