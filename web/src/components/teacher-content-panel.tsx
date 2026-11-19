'use client';
import {useEffect,useMemo,useState} from 'react';
import {User} from 'firebase/auth';
import {collection,doc,getDocs,query,where} from 'firebase/firestore';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {ref,uploadBytes} from 'firebase/storage';
import {db,storage} from '@/lib/firebase/client';
type Node={id:string;parentId:string|null;type:string;nameAr:string};
export default function TeacherContentPanel({user}:{user:User}){
 const [nodes,setNodes]=useState<Node[]>([]),[levelId,setLevelId]=useState(''),[trackId,setTrackId]=useState(''),[subjectId,setSubjectId]=useState(''),[unitId,setUnitId]=useState('');
 const [title,setTitle]=useState(''),[kind,setKind]=useState<'text'|'video'|'image'|'pdf'>('text'),[body,setBody]=useState(''),[file,setFile]=useState<File|null>(null);
 const [sourceType,setSourceType]=useState('original'),[sourceName,setSourceName]=useState('محتوى أصلي من الأستاذ'),[sourceUrl,setSourceUrl]=useState(''),[license,setLicense]=useState('محتوى أصلي من الأستاذ'),[permissionNote,setPermissionNote]=useState('أؤكد امتلاك حقوق هذا المحتوى وأطلب مراجعته قبل النشر.');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{getDocs(query(collection(db,'curriculumNodes'),where('status','==','published'))).then(s=>setNodes(s.docs.map(d=>({id:d.id,parentId:d.get('parentId')??null,type:String(d.get('type')),nameAr:String(d.get('nameAr')||'')})))).catch(()=>setError('تعذر تحميل فهرس المواد.'));},[]);
 const levels=useMemo(()=>nodes.filter(n=>n.type==='level'&&n.parentId===null),[nodes]),tracks=useMemo(()=>nodes.filter(n=>n.type==='track'&&n.parentId===levelId),[nodes,levelId]),subjects=useMemo(()=>nodes.filter(n=>n.type==='subject'&&n.parentId===trackId),[nodes,trackId]),units=useMemo(()=>nodes.filter(n=>n.type==='unit'&&n.parentId===subjectId),[nodes,subjectId]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(!levelId||!trackId||!subjectId)throw new Error('اختر المستوى والشعبة والمادة.');
   if(kind==='text'&&body.trim().length<50)throw new Error('الدرس النصي يحتاج إلى 50 حرفاً على الأقل.');
   let mediaPath:string|null=null,contentType:string|null=null,fileName:string|null=null;
   const id=doc(collection(db,'teacherContent')).id;
   if(kind!=='text'){
    if(!file)throw new Error('اختر ملفاً للرفع.');
    const allowed=kind==='video'?['video/mp4','video/webm']:kind==='image'?['image/jpeg','image/png','image/webp']:['application/pdf'];
    const max=kind==='video'?100*1024*1024:kind==='image'?10*1024*1024:20*1024*1024;
    if(!allowed.includes(file.type)||file.size<=0||file.size>max)throw new Error('نوع الملف أو حجمه غير مسموح. فيديو 100MB، صورة 10MB، PDF 20MB.');
    fileName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);contentType=file.type;mediaPath='teacher-content/'+user.uid+'/'+id+'/'+fileName;
    await uploadBytes(ref(storage,mediaPath),file,{contentType});
   }
   await httpsCallable(getFunctions(),'createTeacherContent')({contentId:id,title,kind,content:body,levelId,trackId,subjectId,unitId:unitId||null,mediaPath,contentType,fileName,sourceType,sourceName,sourceUrl,license,permissionNote});
   setNotice('حُفظ المحتوى كمسودة تنتظر مراجعة المشرف. لن يظهر للمتعلمين قبل اعتماده.');setTitle('');setBody('');setFile(null);
  }catch(e){setError(e instanceof Error?e.message:'تعذر حفظ المحتوى.');}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
  <div><h2 className="font-bold">إضافة محتوى أكاديمي</h2><p className="mt-1 text-xs leading-6 text-slate-500">كل إضافة تبدأ مسودة وتخضع لمراجعة بشرية قبل النشر. لا تنشر محتوى لا تملك حقوقه.</p></div>
  <label className="block space-y-2 text-sm">عنوان المحتوى<input required minLength={4} maxLength={140} value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl bg-slate-900 p-3"/></label>
  <label className="block space-y-2 text-sm">نوع المحتوى<select value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setFile(null);}} className="w-full rounded-xl bg-slate-900 p-3"><option value="text">درس نصي</option><option value="video">فيديو</option><option value="image">صورة تعليمية</option><option value="pdf">ملف PDF</option></select></label>
  {kind==='text'?<label className="block space-y-2 text-sm">شرح الدرس<textarea required minLength={50} maxLength={20000} value={body} onChange={e=>setBody(e.target.value)} className="min-h-40 w-full rounded-xl bg-slate-900 p-3"/></label>:<label className="block space-y-2 text-sm">الملف<input required type="file" accept={kind==='video'?'video/mp4,video/webm':kind==='image'?'image/jpeg,image/png,image/webp':'application/pdf'} onChange={e=>setFile(e.target.files?.[0]??null)} className="w-full rounded-xl bg-slate-900 p-3"/><span className="text-xs text-slate-500">الفيديو 100MB، الصورة 10MB، PDF 20MB.</span></label>}
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="space-y-2 text-sm">المستوى<select required value={levelId} onChange={e=>{setLevelId(e.target.value);setTrackId('');setSubjectId('');setUnitId('');}} className="w-full rounded-xl bg-slate-900 p-3"><option value="">اختر المستوى</option>{levels.map(n=><option key={n.id} value={n.id}>{n.nameAr}</option>)}</select></label>
   <label className="space-y-2 text-sm">الشعبة<select required value={trackId} onChange={e=>{setTrackId(e.target.value);setSubjectId('');setUnitId('');}} className="w-full rounded-xl bg-slate-900 p-3"><option value="">اختر الشعبة</option>{tracks.map(n=><option key={n.id} value={n.id}>{n.nameAr}</option>)}</select></label>
   <label className="space-y-2 text-sm">المادة<select required value={subjectId} onChange={e=>{setSubjectId(e.target.value);setUnitId('');}} className="w-full rounded-xl bg-slate-900 p-3"><option value="">اختر المادة</option>{subjects.map(n=><option key={n.id} value={n.id}>{n.nameAr}</option>)}</select></label>
   <label className="space-y-2 text-sm">الوحدة / المحور (اختياري حالياً)<select value={unitId} onChange={e=>setUnitId(e.target.value)} className="w-full rounded-xl bg-slate-900 p-3"><option value="">لا توجد وحدة منشورة</option>{units.map(n=><option key={n.id} value={n.id}>{n.nameAr}</option>)}</select></label>
  </div>
  <div className="space-y-3 rounded-xl border border-white/10 p-3"><h3 className="text-sm font-bold">المصدر والحقوق</h3>
   <label className="block space-y-2 text-sm">نوع المصدر<select value={sourceType} onChange={e=>setSourceType(e.target.value)} className="w-full rounded-xl bg-slate-900 p-3"><option value="original">إنتاج أصلي</option><option value="teacher-agreement">اتفاق مع صاحب المحتوى</option><option value="official">مصدر رسمي</option><option value="open-license">رخصة مفتوحة</option><option value="embed">تضمين مرخّص</option></select></label>
   <label className="block space-y-2 text-sm">اسم المصدر<input required value={sourceName} onChange={e=>setSourceName(e.target.value)} className="w-full rounded-xl bg-slate-900 p-3"/></label>
   {sourceType!=='original'&&<label className="block space-y-2 text-sm">رابط المصدر HTTPS<input required type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} className="w-full rounded-xl bg-slate-900 p-3"/></label>}
   <label className="block space-y-2 text-sm">الرخصة<input required value={license} onChange={e=>setLicense(e.target.value)} className="w-full rounded-xl bg-slate-900 p-3"/></label>
   <label className="block space-y-2 text-sm">ملاحظة الإذن والحقوق<textarea required minLength={5} maxLength={600} value={permissionNote} onChange={e=>setPermissionNote(e.target.value)} className="min-h-20 w-full rounded-xl bg-slate-900 p-3"/></label>
  </div>
  <button disabled={busy} className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold disabled:opacity-50">{busy?'جارٍ رفع وحفظ المسودة…':'حفظ للمراجعة'}</button>
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-300">{notice}</p>}
 </form>;
}
