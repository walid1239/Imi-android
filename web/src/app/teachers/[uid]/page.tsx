'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {doc,getDoc} from 'firebase/firestore';
import {getDownloadURL,ref} from 'firebase/storage';
import {db,storage,firebaseConfigured} from '@/lib/firebase/client';
type Profile={bio:string;photoPath:string;badge:string;subjectIds:string[];levelIds:string[];verified:boolean;published:boolean};
export default function PublicTeacherPage(){
 const params=useParams<{uid:string}>(),uid=params.uid;
 const [profile,setProfile]=useState<Profile|null>(null),[photoUrl,setPhotoUrl]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{if(!firebaseConfigured||!uid){setLoading(false);return;}getDoc(doc(db,'teacherProfiles',uid)).then(async snap=>{if(!snap.exists()||snap.get('published')!==true){setProfile(null);return;}const data=snap.data() as Profile;setProfile(data);try{setPhotoUrl(await getDownloadURL(ref(storage,data.photoPath)));}catch{setPhotoUrl('');}}).catch(()=>setProfile(null)).finally(()=>setLoading(false));},[uid]);
 return <main dir="rtl" className="mx-auto min-h-screen max-w-3xl px-4 py-8 text-slate-100">
 {loading?<p className="p-8 text-center text-slate-400">جارٍ تحميل صفحة الأستاذ…</p>:!profile?<div className="rounded-2xl border border-white/10 p-8 text-center"><h1 className="font-bold">صفحة الأستاذ غير متاحة</h1><p className="mt-2 text-sm text-slate-400">قد تكون الصفحة غير منشورة أو لم يكتمل توثيقها.</p></div>:<article className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60"><div className="h-28 bg-gradient-to-l from-violet-600/30 to-blue-600/20"/><div className="-mt-12 px-6 pb-7"><div className="grid h-24 w-24 place-items-center overflow-hidden rounded-3xl border-4 border-slate-950 bg-slate-900 text-3xl">{photoUrl?<img src={photoUrl} alt="صورة الأستاذ" className="h-full w-full object-cover"/>:'👩‍🏫'}</div><div className="mt-4 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black">أستاذ IMI</h1>{profile.verified&&<span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">✓ أستاذ موثّق</span>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-slate-300">{profile.bio}</p><div className="mt-6"><h2 className="font-bold">المواد</h2><p className="mt-2 break-words text-sm text-slate-400">{profile.subjectIds.join(' · ')}</p></div><div className="mt-5"><h2 className="font-bold">المستويات</h2><p className="mt-2 break-words text-sm text-slate-400">{profile.levelIds.join(' · ')}</p></div><p className="mt-6 rounded-xl border border-white/10 p-3 text-xs leading-6 text-slate-500">الدروس والفيديوهات والبث المباشر ستظهر هنا بعد اعتمادها ونشرها. لا تتوفر مراسلة خاصة بين الأستاذ والتلميذ.</p></div></article>}
 </main>;
}
