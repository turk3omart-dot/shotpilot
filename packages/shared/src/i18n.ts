export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const RTL_LOCALES: readonly Locale[] = ["ar"];
export const isRtl = (l: Locale) => RTL_LOCALES.includes(l);

const en = {
  "app.tagline": "From the first idea to the final frame.",
  "nav.home": "Home",
  "nav.projects": "Projects",
  "nav.inbox": "Inbox",
  "nav.calendar": "Calendar",
  "nav.assistant": "Assistant",
  "project.overview": "Overview",
  "project.script": "Script",
  "project.breakdown": "Breakdown",
  "project.budget": "Budget",
  "project.crew": "Crew",
  "project.schedule": "Schedule",
  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.signOut": "Sign out",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.name": "Full name",
  "workspace.create": "Create workspace",
  "project.create": "New project",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "provenance.parser": "Found in script",
  "provenance.ai": "AI suggestion",
  "provenance.user": "Added by you",
  "confirmation.unconfirmed": "Needs review",
  "confirmation.confirmed": "Confirmed",
  "confirmation.rejected": "Rejected",
} as const;

export type MessageKey = keyof typeof en;

const ar: Record<MessageKey, string> = {
  "app.tagline": "من الفكرة الأولى إلى اللقطة الأخيرة.",
  "nav.home": "الرئيسية",
  "nav.projects": "المشاريع",
  "nav.inbox": "الرسائل",
  "nav.calendar": "التقويم",
  "nav.assistant": "المساعد",
  "project.overview": "نظرة عامة",
  "project.script": "السيناريو",
  "project.breakdown": "التفكيك",
  "project.budget": "الميزانية",
  "project.crew": "الطاقم",
  "project.schedule": "الجدول",
  "auth.signIn": "تسجيل الدخول",
  "auth.signUp": "إنشاء حساب",
  "auth.signOut": "تسجيل الخروج",
  "auth.email": "البريد الإلكتروني",
  "auth.password": "كلمة المرور",
  "auth.name": "الاسم الكامل",
  "workspace.create": "إنشاء مساحة عمل",
  "project.create": "مشروع جديد",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.confirm": "تأكيد",
  "provenance.parser": "موجود في السيناريو",
  "provenance.ai": "اقتراح ذكاء اصطناعي",
  "provenance.user": "أضفته أنت",
  "confirmation.unconfirmed": "بحاجة لمراجعة",
  "confirmation.confirmed": "مؤكد",
  "confirmation.rejected": "مرفوض",
};

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, ar };

export function t(locale: Locale, key: MessageKey): string {
  return dictionaries[locale]?.[key] ?? en[key];
}

export function formatMoney(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
