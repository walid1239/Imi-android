'use client';
import {useEffect,useState} from 'react';
import {getIdTokenResult,onAuthStateChanged,User} from 'firebase/auth';
import {collection,doc,getDoc,getDocs,query,where} from 'firebase/firestore';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {auth,db,firebaseConfigured} from '@/lib/firebase/client';
import TeacherContentPanel from '@/components/teacher-content-panel';
type N={id:string;nameAr:string};
export default function TeacherStudioPanel(){
 const [user,setUser]=useState<User|null>(null),[verified,setVerified]=useState(false),[levels,setLevels]=useState<N[]>([]),[subjects,setSubjects]=useState<N[]>([]);
 const [levelIds,setLevelIds]=useState<string[]>([]),[subjectIds,setSubjectIds]=useState<string[]>([]),[bio,setBio]=useState('');
 const [contentAgreement,setContentAgreement]=useState(false),[childSafetyAgreement,setChildSafetyAgreement]=useState(false),[profileComplete,setProfileComplete]=useState(false);
 const [title,setTitle]=useState(''),[subjectId,setSubjectId]=useState(''),[startsAt,setStartsAt]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>onAuthStateChanged(auth,async u=>{setUser(u);if(!u){setVerified(false);return;}try{const token=await getIdTokenResult(u,true);setVerified(token.claims.teacherVerified===true);}catch{setVerified(false);}}),[]);
 useEffect(()=>{if(!user||!verified||!firebaseConfigured)return;getDoc(doc(db,'teacherProfiles',user.uid)).then(s=>setProfileComplete(s.exists()&&s.get('profileComplete')===true&&s.get('published')===true)).catch(()=>setProfileComplete(false));},[user,verified]);
 useEffect(()=>{if(!firebaseConfigured)return;getDocs(query(collection(db,'curriculumNodes'),where('status','==','published'))).then(s=>{const rows=s.docs.map(d=>({id:d.id,type:d.get('type'),nameAr:String(d.get('nameAr')||'')}));setLevels(rows.filter(x=>x.type==='level'));setSubjects(rows.filter(x=>x.type==='subject'));}).catch(()=>setError('تعذر تحميل فهرس الأكاديمية.'));},[]);
 async function saveProfile(e:React.FormEvent){
  e.preventDefault();
  setError('');setNotice('رفع صورة الأستاذ ونشر الملف متوقفان مؤقتاً في المرحلة المجانية الأولى؛ لن يتم إرسال أي ملف إلى Firebase Storage.');
 }
 async function schedule(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{const result=await httpsCallable(getFunctions(),'scheduleTeacherLiveSession')({title,subjectId,startsAt:new Date(startsAt).toISOString()});const data=result.data as {sessionId:string;status:string;liveEnabled:boolean};setNotice('تم إنشاء موعد تجريبي فقط ('+data.status+'). البث الحقيقي غير مفعّل ولا يوجد رابط انضمام.');setTitle('');}catch(e){setError(e instanceof Error?e.message:'تعذرت جدولة الموعد.');}finally{setBusy(false);}}
 if(!firebaseConfigured)return <main dir="rtl" className="mx-auto max-w-3xl p-6 text-amber-200">إعداد Firebase غير مكتمل.</main>;
 if(!user)return <main dir="rtl" className="mx-auto max-w-3xl p-6 text-slate-300">سجّل الدخول للوصول إلى استوديو الأستاذ.</main>;
 if(!verified)return <main dir="rtl" className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-black">استوديو الأستاذ</h1><p className="mt-3 text-slate-400">حسابك غير موثّق كأستاذ. قدّم طلب التوثيق أولاً.</p><a href="/teacher/apply" className="mt-4 inline-block rounded-xl bg-violet-600 px-4 py-2 font-bold">طلب توثيق</a></main>;
 return <main dir="rtl" className="mx-auto min-h-screen max-w-3xl space-y-5 p-5 text-slate-100">
 <header className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-950 p-6"><p className="text-xs font-bold text-violet-300">IMI ACADEMY · TEACHER STUDIO</p><h1 className="mt-2 text-2xl font-black">استوديو الأستاذ</h1><p className="mt-2 text-sm text-slate-400">لا يمكنك جدولة بث حقيقي حالياً. يجب إكمال الصفحة والاتفاقيات أولاً؛ طبقة البث الحالية mock فقط.</p></header>
 <section className="space-y-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5"><h2 className="font-bold">ملف الأستاذ</h2><p className="text-sm leading-7 text-amber-100">نشر صفحة الأستاذ ورفع الصورة متوقفان مؤقتاً حتى نقل العملية إلى خادم موثوق وتوفير تخزين مجاني مناسب. لن يظهر زر رفع غير عامل ولن يتم إرسال ملفات إلى Firebase Storage.</p></section>
 {profileComplete&&<TeacherContentPanel user={user}/>}
 <form onSubmit={schedule} className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5"><div className="flex items-center gap-2"><h2 className="font-bold">جدولة جلسة مباشرة</h2><span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs font-bold text-amber-200">تجريبي</span></div><label className="block space-y-2 text-sm">عنوان اللقاء<input required minLength={4} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl bg-slate-900 p-3"/></label><label className="block space-y-2 text-sm">المادة<select required value={subjectId} onChange={e=>setSubjectId(e.target.value)} className="w-full rounded-xl bg-slate-900 p-3"><option value="">اختر المادة</option>{subjects.filter(x=>subjectIds.includes(x.id)).map(x=><option key={x.id} value={x.id}>{x.nameAr}</option>)}</select></label><label className="block space-y-2 text-sm">الموعد<input required type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} className="w-full rounded-xl bg-slate-900 p-3"/></label><button disabled={busy||!profileComplete} className="rounded-xl border border-blue-400/30 px-4 py-3 font-bold text-blue-200 disabled:opacity-40">إنشاء موعد mock فقط</button><p className="text-xs text-amber-200">لا يتم إنشاء غرفة فيديو أو رابط اتصال أو تسجيل. اختيار مزود حقيقي يحتاج موافقة منفصلة.</p></form>
 {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-300">{notice}</p>}
 </main>;
}
