'use client';
import {useEffect,useState} from 'react';
import {onAuthStateChanged,User} from 'firebase/auth';
import {collection,doc,getDocs,query,serverTimestamp,setDoc,where} from 'firebase/firestore';
import {ref,uploadBytes} from 'firebase/storage';
import {auth,db,storage,firebaseConfigured} from '@/lib/firebase/client';
type Option={id:string;nameAr:string};
export default function TeacherApplicationPanel(){
 const [user,setUser]=useState<User|null>(null),[levels,setLevels]=useState<Option[]>([]),[subjects,setSubjects]=useState<Option[]>([]);
 const [name,setName]=useState(''),[levelIds,setLevelIds]=useState<string[]>([]),[subjectIds,setSubjectIds]=useState<string[]>([]);
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>onAuthStateChanged(auth,setUser),[]);
 useEffect(()=>{if(!firebaseConfigured)return;getDocs(query(collection(db,'curriculumNodes'),where('status','==','published'))).then(s=>{const a=s.docs.map(d=>({id:d.id,type:d.get('type'),nameAr:String(d.get('nameAr')||'')}));setLevels(a.filter(x=>x.type==='level'));setSubjects(a.filter(x=>x.type==='subject'));}).catch(()=>setError('تعذر تحميل مستويات ومواد الأكاديمية.'));},[]);
 async function submit(e:React.FormEvent){
  e.preventDefault();
  setError('إرسال طلبات توثيق الأساتذة متوقف مؤقتاً حتى نقل العملية إلى IMI API؛ لم يتم رفع أي ملف.');
  setNotice('');
 }
 return <main dir="rtl" className="mx-auto min-h-screen max-w-3xl px-4 py-8 text-slate-100">
  <header className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-950 p-6"><p className="text-xs font-bold text-violet-300">IMI ACADEMY · TEACHERS</p><h1 className="mt-3 text-2xl font-black">طلب الانضمام كأستاذ</h1><p className="mt-2 text-sm leading-7 text-slate-400">وثيقة الإثبات تُرفع في مسار خاص ولا يستطيع قراءتها إلا المشرف الموثق. لا تُمنح صلاحية الأستاذ من الواجهة.</p></header>
  {!user&&<p className="mt-5 rounded-xl border border-amber-400/20 p-4 text-sm text-amber-100">يجب تسجيل الدخول قبل إرسال الطلب.</p>}
  <form onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
   <label className="block space-y-2 text-sm">الاسم الكامل<input required minLength={3} maxLength={80} value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 p-3" /></label>
   <label className="block space-y-2 text-sm">المستويات التي تدرّسها<select multiple value={levelIds} onChange={e=>setLevelIds(Array.from(e.target.selectedOptions,o=>o.value))} className="min-h-36 w-full rounded-xl border border-white/10 bg-slate-900 p-3">{levels.map(x=><option key={x.id} value={x.id}>{x.nameAr}</option>)}</select></label>
   <label className="block space-y-2 text-sm">المواد التي تدرّسها<select multiple value={subjectIds} onChange={e=>setSubjectIds(Array.from(e.target.selectedOptions,o=>o.value))} className="min-h-36 w-full rounded-xl border border-white/10 bg-slate-900 p-3">{subjects.map(x=><option key={x.id} value={x.id}>{x.nameAr}</option>)}</select></label>
   <label className="block space-y-2 text-sm">شهادة أو إثبات مؤسسة (PDF/JPEG/PNG، 10MB كحد أقصى)<input required type="file" accept=".pdf,image/jpeg,image/png,application/pdf" onChange={e=>setFile(e.target.files?.[0]??null)} className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm" /></label>
   <button disabled={busy||!user} className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold disabled:opacity-50">{busy?'جارٍ إرسال الطلب…':'إرسال طلب التوثيق'}</button>
   {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-300">{notice}</p>}
  </form>
  <p className="mt-4 text-xs leading-6 text-slate-500">لا يُسمح بنشر دروس أو جدولة بث قبل اعتماد الطلب، وإكمال صفحة الأستاذ، وقبول اتفاقية الحقوق وقواعد حماية القاصرين.</p>
 </main>;
}
