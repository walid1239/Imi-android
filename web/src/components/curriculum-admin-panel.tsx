'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase/client';

type N = {
  id: string;
  parentId: string | null;
  type: 'level' | 'track' | 'subject' | 'unit';
  nameAr: string;
  nameFr: string;
  language: string;
  order: number;
  semester: string | null;
  officialSource: string | null;
  needsReview: boolean;
  status: 'hidden' | 'published';
  mergedInto?: string;
};

export default function CurriculumAdminPanel({ user }: { user: User }) {
  const [nodes, setNodes] = useState<N[]>([]);
  const [id, setId] = useState('');
  const [parentId, setParentId] = useState('');
  const [type, setType] = useState<N['type']>('level');
  const [nameAr, setNameAr] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [language, setLanguage] = useState('ar');
  const [order, setOrder] = useState('1');
  const [mergeTarget, setMergeTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => onSnapshot(query(collection(db, 'curriculumNodes')), snapshot => {
    setNodes(snapshot.docs.map(item => ({
      id: item.id,
      parentId: item.get('parentId') ?? null,
      type: item.get('type'),
      nameAr: item.get('nameAr') || '',
      nameFr: item.get('nameFr') || '',
      language: item.get('language') || 'unknown',
      order: item.get('order') || 0,
      semester: item.get('semester') ?? null,
      officialSource: item.get('officialSource') ?? null,
      needsReview: item.get('needsReview') === true,
      status: item.get('status') || 'hidden',
      mergedInto: item.get('mergedInto'),
    })).sort((a, b) => a.order - b.order));
  }, reason => setError(reason.message)), []);

  const active = useMemo(() => nodes.filter(node => node.status === 'published'), [nodes]);

  async function adminPost(action: string, payload: Record<string, unknown> = {}) {
    const token = await user.getIdToken();
    const response = await fetch('/api/v1/academy/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json() as { error?: string; movedChildren?: number };
    if (!response.ok) throw new Error(result.error || 'تعذر تنفيذ العملية.');
    return result;
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      if (!/^[a-z0-9][a-z0-9_-]{1,100}$/.test(id) || nodes.some(node => node.id === id)) {
        throw new Error('المعرّف غير صالح أو مستخدم.');
      }
      if (parentId && !nodes.some(node => node.id === parentId)) throw new Error('العقدة الأب غير موجودة.');
      await adminPost('createCurriculumNode', {
        nodeId: id, parentId: parentId || null, type, nameAr: nameAr.trim(),
        nameFr: nameFr.trim(), language, order: Number(order),
      });
      setNotice('أُضيفت العقدة مخفية وتنتظر اعتماد المشرف.');
      setId(''); setNameAr(''); setNameFr('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إضافة العقدة.');
    } finally { setBusy(false); }
  }

  async function review(node: N, approved: boolean) {
    setBusy(true); setError(''); setNotice('');
    try {
      await adminPost('reviewCurriculumNode', { nodeId: node.id, approved });
      setNotice(approved ? 'تم اعتماد العنصر ونشره.' : 'تم رفض العنصر وإبقاؤه مخفياً.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تسجيل قرار المراجعة.');
    } finally { setBusy(false); }
  }

  async function reorder(node: N, delta: number) {
    setBusy(true); setError(''); setNotice('');
    try {
      await adminPost('reorderCurriculumNode', { nodeId: node.id, delta });
      setNotice('تم تحديث الترتيب.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تغيير الترتيب.');
    } finally { setBusy(false); }
  }

  async function merge(node: N) {
    setError(''); setNotice('');
    const target = nodes.find(item => item.id === mergeTarget);
    if (!target || target.id === node.id || target.type !== node.type || target.status !== 'published') {
      setError('اختر عقدة هدفاً منشورة ومختلفة ومن النوع نفسه.');
      return;
    }
    setBusy(true);
    try {
      const result = await adminPost('mergeCurriculumNode', { nodeId: node.id, targetId: target.id });
      setNotice('تم نقل ' + (result.movedChildren ?? 0) + ' من الأبناء وإخفاء العقدة المدمجة.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر دمج العقدتين.');
    } finally { setBusy(false); }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, nodes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'imi-curriculum-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    setBusy(true); setError(''); setNotice('');
    try {
      const parsed = JSON.parse(await file.text()) as { nodes?: N[] };
      if (!Array.isArray(parsed.nodes) || parsed.nodes.length < 1 || parsed.nodes.length > 5) {
        throw new Error('الاستيراد الآمن يقبل من 1 إلى 5 عناصر في الدفعة الواحدة.');
      }
      const nodesToImport = parsed.nodes.map(node => ({
        id: node.id, parentId: node.parentId ?? null, type: node.type,
        nameAr: node.nameAr, nameFr: node.nameFr || '',
        language: node.language || 'unknown', order: node.order,
      }));
      if (new TextEncoder().encode(JSON.stringify(nodesToImport)).length > 6000) {
        throw new Error('حجم دفعة الاستيراد أكبر من الحد الآمن. قسّم الملف إلى دفعات أصغر.');
      }
      await adminPost('importCurriculumNodes', { nodes: nodesToImport });
      setNotice('تم استيراد ' + nodesToImport.length + ' عناصر مخفية تنتظر مراجعة المشرف.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر استيراد ملف JSON.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return <section dir="rtl" className="space-y-4 rounded-2xl border border-violet-400/20 bg-slate-950/50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-bold">إدارة شجرة المنهاج</h3><p className="mt-1 text-xs text-slate-500">{nodes.length} عقدة · {active.length} منشورة</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={exportJson} className="rounded-lg border border-white/15 px-3 py-2 text-xs">تصدير JSON</button>
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-50">استيراد JSON (حتى 5 عناصر)</button>
        <input ref={input} hidden type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) void importJson(file); }} />
      </div>
    </div>

    <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
      <input required placeholder="معرّف فريد مثل grade-1" value={id} onChange={event => setId(event.target.value)} className="rounded-xl bg-slate-900 p-3 text-sm" />
      <select value={type} onChange={event => setType(event.target.value as N['type'])} className="rounded-xl bg-slate-900 p-3 text-sm">
        <option value="level">مستوى</option><option value="track">شعبة / مسلك</option><option value="subject">مادة</option><option value="unit">وحدة / محور</option>
      </select>
      <input placeholder="المعرّف الأب (اتركه فارغاً للجذر)" value={parentId} onChange={event => setParentId(event.target.value)} className="rounded-xl bg-slate-900 p-3 text-sm" />
      <input required maxLength={160} placeholder="الاسم بالعربية" value={nameAr} onChange={event => setNameAr(event.target.value)} className="rounded-xl bg-slate-900 p-3 text-sm" />
      <input maxLength={160} placeholder="الاسم بالفرنسية" value={nameFr} onChange={event => setNameFr(event.target.value)} className="rounded-xl bg-slate-900 p-3 text-sm" />
      <select value={language} onChange={event => setLanguage(event.target.value)} className="rounded-xl bg-slate-900 p-3 text-sm">
        <option value="ar">العربية</option><option value="fr">الفرنسية</option><option value="mixed">مختلط</option><option value="unknown">قيد التحديد</option>
      </select>
      <input type="number" min="1" max="100000" step="1" value={order} onChange={event => setOrder(event.target.value)} className="rounded-xl bg-slate-900 p-3 text-sm" aria-label="الترتيب" />
      <p className="text-xs text-amber-200">كل عنصر جديد يُحفظ مخفياً، ولا يظهر للمتعلمين حتى يعتمد المشرف نشره يدوياً.</p>
      <button disabled={busy} className="rounded-xl bg-violet-600 p-3 text-sm font-bold disabled:opacity-50">إضافة عقدة مخفية للمراجعة</button>
    </form>

    <div className="max-h-96 space-y-2 overflow-y-auto">
      {nodes.map(node => <article key={node.id} className="rounded-xl border border-white/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><strong className="text-sm">{node.nameAr}</strong><p className="text-[10px] text-slate-500">{node.id} · {node.type} · {node.status} {node.needsReview ? '· needsReview' : ''}</p></div>
          <div className="flex gap-1">
            <button type="button" disabled={busy} onClick={() => void reorder(node, -1)} className="rounded border border-white/10 px-2 py-1 text-xs disabled:opacity-50">↑</button>
            <button type="button" disabled={busy} onClick={() => void reorder(node, 1)} className="rounded border border-white/10 px-2 py-1 text-xs disabled:opacity-50">↓</button>
            <button type="button" disabled={busy || node.status === 'hidden'} onClick={() => void review(node, false)} className="rounded border border-amber-400/20 px-2 py-1 text-xs text-amber-200 disabled:opacity-50">إخفاء</button>
          </div>
        </div>
        {node.needsReview && <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} onClick={() => void review(node, true)} className="rounded border border-emerald-400/30 px-3 py-2 text-xs text-emerald-200 disabled:opacity-50">اعتماد ونشر</button>
          <button type="button" disabled={busy} onClick={() => void review(node, false)} className="rounded border border-amber-400/30 px-3 py-2 text-xs text-amber-200 disabled:opacity-50">رفض وإخفاء</button>
        </div>}
        {node.status === 'published' && <div className="mt-2 flex gap-2">
          <select value={mergeTarget} onChange={event => setMergeTarget(event.target.value)} className="min-w-0 flex-1 rounded bg-slate-900 p-2 text-xs">
            <option value="">دمج مع…</option>
            {nodes.filter(item => item.type === node.type && item.id !== node.id && item.status === 'published').map(item => <option key={item.id} value={item.id}>{item.nameAr}</option>)}
          </select>
          <button type="button" disabled={busy || !mergeTarget} onClick={() => void merge(node)} className="rounded border border-red-400/20 px-3 py-2 text-xs text-red-200 disabled:opacity-50">دمج</button>
        </div>}
      </article>)}
    </div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
  </section>;
}
