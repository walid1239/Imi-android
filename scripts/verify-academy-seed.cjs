const { initializeApp, getApps } = require('../functions/node_modules/firebase-admin/app');
const { getFirestore } = require('../functions/node_modules/firebase-admin/firestore');
const projectId = process.env.GCLOUD_PROJECT || 'demo-imi-academy';
if (!process.env.FIRESTORE_EMULATOR_HOST || !projectId.startsWith('demo-')) throw new Error('Verification is Emulator-only.');
if (!getApps().length) initializeApp({ projectId });
async function main() {
  const db = getFirestore();
  const [tree, courses, lessons] = await Promise.all([
    db.collection('curriculumNodes').get(),
    db.collection('courses').get(),
    db.collectionGroup('lessons').get(),
  ]);
  if (tree.size !== 880) throw new Error('Expected 880 curriculum nodes, found ' + tree.size);
  const ids = new Set(tree.docs.map(d => d.id));
  for (const d of tree.docs) {
    const n = d.data();
    if (n.type === 'lesson') throw new Error('Curriculum tree must not contain lesson nodes.');
    if (n.parentId !== null && !ids.has(n.parentId)) throw new Error('Missing parent for ' + d.id);
    if (n.needsReview !== true || n.status !== 'hidden') throw new Error('Every seeded curriculum node must await manual admin approval: ' + d.id);
    if (n.type === 'unit' && n.status !== 'hidden') throw new Error('Unit placeholders must remain hidden.');
  }
  if (!courses.empty || !lessons.empty) throw new Error('Emulator must contain no seeded courses or lessons.');
  process.stdout.write('PASS: 880 curriculum nodes all hidden pending manual admin approval; zero seeded courses and lessons.\\n');
}
main().catch(error => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });
