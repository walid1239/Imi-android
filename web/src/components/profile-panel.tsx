'use client';

import { FormEvent, useEffect, useState } from 'react';
import { EmailAuthProvider, User, linkWithCredential, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useRouter } from 'next/navigation';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase/client';

type ProfileData = {
  displayName: string;
  city: string;
  photoPath?: string;
};

export default function ProfilePanel({ user }: { user: User }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [city, setCity] = useState('');
  const [photoPath, setPhotoPath] = useState('');
  const [photoUrl, setPhotoUrl] = useState(user.photoURL || '');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getDoc(doc(db, 'publicProfiles', user.uid)).then(snapshot => {
      if (!active) return;
      if (snapshot.exists()) {
        setDisplayName(snapshot.get('displayName') || user.displayName || '');
        setCity(snapshot.get('city') || '');
        const path = snapshot.get('photoPath');
        if (typeof path === 'string' && path) {
          setPhotoPath(path);
          getDownloadURL(ref(storage, path)).then(url => {
            if (active) setPhotoUrl(url);
          }).catch(() => {
            if (active) setPhotoUrl('');
          });
        }
      } else {
        setDisplayName(user.displayName || user.email?.split('@')[0] || 'مستخدم IMI');
      }
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الملف الشخصي.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user.uid, user.displayName, user.email]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = displayName.trim();
    const location = city.trim();
    if (name.length < 2 || name.length > 60) {
      setError('الاسم يجب أن يكون بين حرفين و60 حرفاً.');
      return;
    }
    if (location.length > 80) {
      setError('اسم المدينة طويل جداً.');
      return;
    }
    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('الصورة يجب أن تكون JPEG أو PNG أو WebP.');
      return;
    }
    if (file && file.size >= 5 * 1024 * 1024) {
      setError('حجم الصورة يجب أن يكون أقل من 5 ميغابايت.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    let uploadedPath = '';
    try {
      let nextPhotoPath = photoPath;
      if (file) {
        const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        nextPhotoPath = `users/${user.uid}/avatars/avatar-${Date.now()}.${extension}`;
        await uploadBytes(ref(storage, nextPhotoPath), file, { contentType: file.type });
        uploadedPath = nextPhotoPath;
      }

      const profile: ProfileData = {
        displayName: name,
        city: location,
        ...(nextPhotoPath ? { photoPath: nextPhotoPath } : {}),
      };
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid), {
        ...profile,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batch.set(doc(db, 'publicProfiles', user.uid), {
        uid: user.uid,
        ...profile,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await batch.commit();

      if (file && uploadedPath) {
        const url = await getDownloadURL(ref(storage, uploadedPath));
        setPhotoPath(uploadedPath);
        setPhotoUrl(url);
        setFile(null);
        const input = document.getElementById('imi-profile-photo') as HTMLInputElement | null;
        if (input) input.value = '';
      }
      setNotice('تم حفظ ملفك الشخصي وتحديث بياناتك الظاهرة في دليل IMI.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ الملف الشخصي. تحقق من اتصال Firebase وصلاحياته.');
    } finally {
      setSaving(false);
    }
  }

  async function linkGuestAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user.isAnonymous) return;
    setAccountBusy(true); setError(''); setNotice('');
    try {
      await linkWithCredential(user, EmailAuthProvider.credential(linkEmail.trim(), linkPassword));
      setLinkPassword('');
      setNotice('تم ربط بريدك بالحساب الحالي مع الاحتفاظ بمعرّفك وبياناتك.');
    } catch (reason) {
      const code = typeof reason === 'object' && reason && 'code' in reason ? String((reason as {code:string}).code) : '';
      setError(code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use'
        ? 'هذا البريد مرتبط بحساب آخر. سجّل الدخول إلى ذلك الحساب بدلاً من ربطه بالضيف.'
        : 'تعذر تحويل حساب الضيف. تحقق من تفعيل Email/Password وكلمة المرور.');
    } finally { setAccountBusy(false); }
  }



  return <section dir="rtl" className="mx-auto max-w-2xl space-y-5">
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-center gap-4">
        {photoUrl
          ? <img src={photoUrl} alt="الصورة الشخصية" className="h-20 w-20 rounded-full border border-white/10 object-cover" />
          : <div className="grid h-20 w-20 place-items-center rounded-full bg-blue-600/20 text-2xl font-black text-blue-200">{(displayName || 'I').slice(0, 1)}</div>}
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{displayName || 'ملفي الشخصي'}</h2>
          <p className="mt-1 truncate text-xs text-slate-400">{user.email || 'جلسة ضيف'} · {city || 'لم تحدد المدينة'}</p>
        </div>
      </div>
    </div>

    <form onSubmit={save} className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <h3 className="font-bold">معلومات الحساب</h3>
      <label className="block text-sm text-slate-300">الاسم الظاهر
        <input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={60} required disabled={loading || saving} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-500" />
      </label>
      <label className="block text-sm text-slate-300">المدينة
        <input value={city} onChange={event => setCity(event.target.value)} maxLength={80} disabled={loading || saving} placeholder="مثال: الدار البيضاء" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-500" />
      </label>
      <label className="block text-sm text-slate-300">الصورة الشخصية
        <input id="imi-profile-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} disabled={loading || saving} className="mt-2 block w-full text-sm text-slate-300 file:ml-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-slate-100" />
        <span className="mt-1 block text-xs text-slate-500">JPEG أو PNG أو WebP، أقل من 5 ميغابايت.</span>
      </label>
      {error && <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-6 text-emerald-200">{notice}</p>}
      <button disabled={loading || saving} className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold disabled:opacity-40">{loading ? 'جارٍ تحميل الحساب…' : saving ? 'جارٍ الحفظ…' : 'حفظ الملف الشخصي'}</button>
      <p className="text-xs leading-6 text-slate-500">الاسم والمدينة ومسار الصورة فقط تظهر في دليل المستخدمين للمسجلين. رقم الهاتف والبريد لا يُنشران في الملف العام.</p>
    </form>

    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <h3 className="font-bold">أمان الحساب والبيانات</h3>
      {user.isAnonymous ? <form onSubmit={linkGuestAccount} className="space-y-3 rounded-xl border border-blue-400/15 p-4">
        <p className="text-sm font-semibold text-blue-200">تحويل حساب الضيف إلى حساب دائم</p>
        <p className="text-xs leading-6 text-slate-500">يربط البريد بالحساب الحالي ويحافظ على UID والبيانات، ولا ينشئ حساباً منفصلاً.</p>
        <label className="block text-sm">البريد الإلكتروني<input required type="email" value={linkEmail} onChange={e=>setLinkEmail(e.target.value)} className="mt-2 w-full rounded-xl bg-slate-900 p-3"/></label>
        <label className="block text-sm">كلمة المرور<input required minLength={6} type="password" value={linkPassword} onChange={e=>setLinkPassword(e.target.value)} className="mt-2 w-full rounded-xl bg-slate-900 p-3"/></label>
        <button disabled={accountBusy} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold disabled:opacity-50">ربط البريد بالحساب الحالي</button>
      </form> : <p className="text-xs leading-6 text-slate-500">حسابك مرتبط بطريقة دخول دائمة. استخدم «نسيت كلمة المرور؟» من شاشة الدخول لاستعادتها.</p>}
      <div className="space-y-3 rounded-xl border border-red-400/20 p-4">
        <p className="text-sm font-bold text-red-200">حذف الحساب والبيانات</p>
        <p className="text-xs leading-6 text-amber-200">الحذف معطّل مؤقتاً. لن نعرض زر تنفيذ حتى يثبت اختبار المحاكي إزالة كل البيانات والملفات والمراجع التابعة للحساب دون ترك بيانات يتيمة.</p>
        <button type="button" disabled className="cursor-not-allowed rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-500 opacity-60">حذف الحساب غير متاح حالياً</button>
      </div>
    </section>
  </section>;
}
