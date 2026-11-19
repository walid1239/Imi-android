const { initializeApp, getApps } = require('../functions/node_modules/firebase-admin/app');
const { getFirestore } = require('../functions/node_modules/firebase-admin/firestore');
const projectId = process.env.GCLOUD_PROJECT || 'demo-imi-academy';
if (!process.env.FIRESTORE_EMULATOR_HOST || !projectId.startsWith('demo-')) throw new Error('Verification is Emulator-only.');
if (!getApps().length) initializeApp({ projectId });
async function main() {
  const db = getFirestore();
  const [tree, course] = await Promise.all([
    db.collection('curriculumNodes').get(),
    db.doc('courses/general-skills-android-migration').get(),
  ]);
  if (tree.size !== 880) throw new Error('Expected 880 curriculum nodes, found ' + tree.size);
  const ids = new Set(tree.docs.map(d => d.id));
  for (const d of tree.docs) {
    const n = d.data();
    if (n.type === 'lesson') throw new Error('Curriculum tree must not contain lesson nodes.');
    if (n.parentId !== null && !ids.has(n.parentId)) throw new Error('Missing parent for ' + d.id);
    if (n.type === 'unit' && n.status !== 'hidden') throw new Error('Unit placeholders must remain hidden.');
  }
  if (!course.exists || course.get('published') !== false || course.get('category') !== 'مهارات عامة') {
    throw new Error('Legacy general-skills migration course is missing or not a draft.');
  }
  const lessons = await course.ref.collection('lessons').get();
  if (lessons.size !== 3 || lessons.docs.some(d => d.get('published') !== false || d.get('needsHumanReview') !== true)) {
    throw new Error('Expected exactly three unpublished human-review lesson drafts.');
  }
  process.stdout.write('PASS: 880 curriculum nodes, zero lesson nodes, three private general-skills drafts.\n');
}
main().catch(error => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });
