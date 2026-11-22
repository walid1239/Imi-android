import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

type NodeType = "level" | "track" | "subject" | "unit";
type CurriculumNodeInput = {
  id?: unknown; nodeId?: unknown; parentId?: unknown; type?: unknown;
  nameAr?: unknown; nameFr?: unknown; language?: unknown; order?: unknown;
};
type ActionInput = CurriculumNodeInput & {
  action?: unknown; nodes?: unknown; delta?: unknown; targetId?: unknown;
};

const NODE_TYPES: NodeType[] = ["level", "track", "subject", "unit"];
const CHILD_TYPE: Record<NodeType, NodeType | null> = {
  level: "track", track: "subject", subject: "unit", unit: null,
};

function requiredText(value: unknown, label: string, min: number, max: number, optional = false): string {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string") throw new HttpsError("invalid-argument", label + " غير صالح.");
  const result = value.trim();
  if (result.length < min || result.length > max) throw new HttpsError("invalid-argument", label + " غير صالح.");
  return result;
}
function nodeId(value: unknown, label = "معرّف عنصر المنهاج"): string {
  const id = requiredText(value, label, 2, 101);
  if (!/^[a-z0-9][a-z0-9_-]{1,100}$/.test(id)) throw new HttpsError("invalid-argument", label + " غير صالح.");
  return id;
}
function nodeType(value: unknown): NodeType {
  if (typeof value !== "string" || !NODE_TYPES.includes(value as NodeType)) {
    throw new HttpsError("invalid-argument", "نوع عنصر المنهاج غير صالح.");
  }
  return value as NodeType;
}
function nodeOrder(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 100000) {
    throw new HttpsError("invalid-argument", "ترتيب عنصر المنهاج غير صالح.");
  }
  return value;
}
function parentValue(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : nodeId(value, "العنصر الأب");
}
function languageValue(value: unknown): string {
  return ["ar", "fr", "mixed", "unknown"].includes(String(value)) ? String(value) : "ar";
}
function requireAdmin(request: { auth?: { uid: string; token: Record<string, unknown> } | null }): string {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  if (request.auth.token.admin !== true) throw new HttpsError("permission-denied", "المشرف الموثق فقط يمكنه إدارة المنهاج.");
  return request.auth.uid;
}
function assertParentType(childType: NodeType, parentType: NodeType | null): void {
  const expected = childType === "level" ? null : NODE_TYPES[NODE_TYPES.indexOf(childType) - 1];
  if (parentType !== expected) {
    throw new HttpsError("failed-precondition", childType === "level"
      ? "عنصر المستوى لا يحتاج إلى عنصر أب."
      : "نوع العنصر الأب لا يتوافق مع التسلسل الهرمي للمنهاج.");
  }
}
function normalizedNode(value: unknown, index?: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", `بيانات العنصر رقم ${(index ?? 0) + 1} غير صالحة.`);
  }
  const item = value as Record<string, unknown>;
  const id = nodeId(item.id ?? item.nodeId);
  const type = nodeType(item.type);
  const nameAr = requiredText(item.nameAr, "الاسم العربي", 1, 160);
  const nameFr = requiredText(item.nameFr, "الاسم الفرنسي", 0, 160, true);
  const parentId = parentValue(item.parentId);
  const order = nodeOrder(item.order);
  return { id, type, nameAr, nameFr, parentId, order, language: languageValue(item.language) };
}

export const academyCurriculumAdminAction = onCall<ActionInput>(async request => {
  const actorUid = requireAdmin(request);
  const action = request.data?.action;
  const db = getFirestore();
  const nodes = db.collection("curriculumNodes");

  if (action === "createCurriculumNode") {
    const item = normalizedNode(request.data);
    const ref = nodes.doc(item.id);
    await db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (existing.exists) throw new HttpsError("already-exists", "معرّف عنصر المنهاج مستخدم.");
      let parentType: NodeType | null = null;
      if (item.parentId) {
        const parent = await tx.get(nodes.doc(item.parentId));
        if (!parent.exists) throw new HttpsError("not-found", "العنصر الأب غير موجود.");
        parentType = nodeType(parent.get("type"));
      }
      assertParentType(item.type, parentType);
      tx.create(ref, {
        id: item.id, parentId: item.parentId, type: item.type, nameAr: item.nameAr,
        nameFr: item.nameFr, language: item.language, order: item.order,
        semester: null, officialSource: null, needsReview: true, status: "hidden",
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        createdBy: actorUid,
      });
    });
    return { nodeId: item.id, status: "hidden", needsReview: true };
  }

  if (action === "importCurriculumNodes") {
    if (!Array.isArray(request.data?.nodes) || request.data.nodes.length < 1 || request.data.nodes.length > 5) {
      throw new HttpsError("invalid-argument", "استيراد المنهاج يقبل من 1 إلى 5 عناصر في الدفعة الواحدة.");
    }
    const batch = request.data.nodes.map((value, index) => normalizedNode(value, index));
    const ids = new Set(batch.map(item => item.id));
    if (ids.size !== batch.length) throw new HttpsError("invalid-argument", "ملف الاستيراد يحتوي على معرّفات مكررة.");
    const byId = new Map(batch.map(item => [item.id, item]));
    for (const item of batch) {
      const visited = new Set([item.id]);
      let parentId = item.parentId;
      while (parentId && byId.has(parentId)) {
        if (visited.has(parentId)) throw new HttpsError("invalid-argument", "ملف الاستيراد يحتوي على حلقة في شجرة المنهاج.");
        visited.add(parentId);
        parentId = byId.get(parentId)!.parentId;
      }
      const inBatchParent = item.parentId ? byId.get(item.parentId) : undefined;
      if (inBatchParent) assertParentType(item.type, inBatchParent.type);
      else if (!item.parentId) assertParentType(item.type, null);
    }
    await db.runTransaction(async tx => {
      const existing = await Promise.all(batch.map(item => tx.get(nodes.doc(item.id))));
      if (existing.some(snapshot => snapshot.exists)) throw new HttpsError("already-exists", "يوجد معرّف عنصر مستخدم مسبقاً.");
      const externalParents = [...new Set(batch
        .map(item => item.parentId)
        .filter((id): id is string => !!id && !ids.has(id)))];
      const parents = await Promise.all(externalParents.map(id => tx.get(nodes.doc(id))));
      const parentTypes = new Map<string, NodeType>();
      for (let i = 0; i < parents.length; i++) {
        if (!parents[i].exists) throw new HttpsError("not-found", "يوجد عنصر أب غير موجود في قاعدة البيانات.");
        parentTypes.set(externalParents[i], nodeType(parents[i].get("type")));
      }
      for (const item of batch) {
        if (item.parentId && !ids.has(item.parentId)) {
          assertParentType(item.type, parentTypes.get(item.parentId) ?? null);
        }
      }
      for (const item of batch) {
        tx.create(nodes.doc(item.id), {
          id: item.id, parentId: item.parentId, type: item.type, nameAr: item.nameAr,
          nameFr: item.nameFr, language: item.language, order: item.order,
          semester: null, officialSource: null, needsReview: true, status: "hidden",
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
          createdBy: actorUid,
        });
      }
    });
    return { imported: batch.length, status: "hidden", needsReview: true };
  }

  if (action === "reorderCurriculumNode") {
    const id = nodeId(request.data?.nodeId, "عنصر المنهاج");
    const delta = request.data?.delta === -1 ? -1 : request.data?.delta === 1 ? 1 : null;
    if (delta === null) throw new HttpsError("invalid-argument", "قيمة تغيير الترتيب غير صالحة.");
    const ref = nodes.doc(id);
    return db.runTransaction(async tx => {
      const node = await tx.get(ref);
      if (!node.exists) throw new HttpsError("not-found", "عنصر المنهاج غير موجود.");
      const current = node.get("order");
      const order = Math.max(1, (typeof current === "number" && Number.isSafeInteger(current) ? current : 1) + delta);
      tx.update(ref, { order, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid });
      return { nodeId: id, order };
    });
  }

  if (action === "mergeCurriculumNode") {
    const id = nodeId(request.data?.nodeId, "العنصر المراد دمجه");
    const targetId = nodeId(request.data?.targetId, "العنصر الهدف");
    if (id === targetId) throw new HttpsError("invalid-argument", "لا يمكن دمج العنصر في نفسه.");
    const sourceRef = nodes.doc(id), targetRef = nodes.doc(targetId);
    return db.runTransaction(async tx => {
      const [source, target] = await Promise.all([tx.get(sourceRef), tx.get(targetRef)]);
      if (!source.exists || !target.exists) throw new HttpsError("not-found", "العنصر المصدر أو الهدف غير موجود.");
      const sourceType = nodeType(source.get("type"));
      if (sourceType !== nodeType(target.get("type"))) throw new HttpsError("failed-precondition", "يجب أن يكون العنصران من النوع نفسه.");
      if (target.get("status") !== "published" || target.get("needsReview") === true) {
        throw new HttpsError("failed-precondition", "يجب أن يكون العنصر الهدف منشوراً ومعتمداً.");
      }
      let ancestorId = target.get("parentId");
      const seen = new Set([targetId]);
      while (typeof ancestorId === "string" && ancestorId) {
        if (ancestorId === id) throw new HttpsError("failed-precondition", "لا يمكن الدمج داخل أحد أحفاد العنصر المصدر.");
        if (seen.has(ancestorId)) throw new HttpsError("failed-precondition", "تحتوي شجرة المنهاج على حلقة غير صالحة.");
        seen.add(ancestorId);
        const ancestor = await tx.get(nodes.doc(ancestorId));
        if (!ancestor.exists) break;
        ancestorId = ancestor.get("parentId");
      }
      const children = await tx.get(nodes.where("parentId", "==", id));
      if (children.size > 450) throw new HttpsError("resource-exhausted", "عدد أبناء العنصر كبير جداً للدمج الآمن في معاملة واحدة.");
      const expectedChild = CHILD_TYPE[sourceType];
      for (const child of children.docs) {
        if (!expectedChild || child.get("type") !== expectedChild) {
          throw new HttpsError("failed-precondition", "تحتوي شجرة المنهاج على ابن من نوع غير متوافق؛ أوقف الدمج للمراجعة.");
        }
      }
      for (const child of children.docs) {
        tx.update(child.ref, { parentId: targetId, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid });
      }
      tx.update(sourceRef, {
        status: "hidden", needsReview: false, mergedInto: targetId,
        updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid,
      });
      return { nodeId: id, targetId, movedChildren: children.size, status: "hidden" };
    });
  }

  throw new HttpsError("invalid-argument", "عملية إدارة المنهاج غير معروفة.");
});
