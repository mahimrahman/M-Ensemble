import { useState, useEffect, createContext, useContext } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// ─── Fix leaflet default icons ────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── i18n ─────────────────────────────────────────────────────────────────────
type Lang = "fr" | "en" | "ar";

const T = {
  fr: {
    feed: "Fil d'actualité",
    mosques: "Mosquées",
    myStuff: "Moi",
    profile: "Profil",
    all: "Tout",
    volunteer: "Bénévolat",
    event: "Événement",
    class: "Cours",
    announcement: "Annonce",
    nextPrayer: "Prochaine prière",
    in: "dans",
    slots: "places",
    full: "Complet",
    signup: "Je m'inscris",
    withdraw: "Se désinscrire",
    back: "← Retour",
    coordinator: "Vue coordinateur",
    schedule: "Horaire",
    location: "Lieu",
    details: "Détails",
    checkin: "Pointer",
    present: "Présent",
    qrDisplay: "Afficher le QR de pointage",
    qrSub: "Les bénévoles scannent à l'arrivée",
    prayer: "Prière",
    adhan: "Adhan",
    iqamah: "Iqamah",
    upcoming: "Prochaines activités",
    hoursTotal: "heures bénévoles",
    activitiesMonth: "activités ce mois",
    next: "À venir",
    history: "Historique",
    interests: "Centres d'intérêt",
    notifications: "Notifications",
    newVolunteer: "Nouveaux postes de bénévolat",
    reminder: "Rappels 1h avant",
    mosqueAnnounce: "Annonces de la mosquée",
    signout: "Déconnexion",
    todayPrayers: "Horaires du jour",
    volunteers: "bénévoles",
    interactiveProto: "Prototype interactif",
    clickToExplore: "Cliquez sur un post pour explorer",
    nearbyMosques: "Mosquées à proximité",
    directions: "Itinéraire",
    covered: "Couvert ✓",
    presencelist: "Liste des présences",
  },
  en: {
    feed: "News Feed",
    mosques: "Mosques",
    myStuff: "Me",
    profile: "Profile",
    all: "All",
    volunteer: "Volunteer",
    event: "Event",
    class: "Class",
    announcement: "Notice",
    nextPrayer: "Next prayer",
    in: "in",
    slots: "slots",
    full: "Full",
    signup: "Sign me up",
    withdraw: "Withdraw",
    back: "← Back",
    coordinator: "Coordinator view",
    schedule: "Schedule",
    location: "Location",
    details: "Details",
    checkin: "Check in",
    present: "Present",
    qrDisplay: "Show check-in QR",
    qrSub: "Volunteers scan on arrival",
    prayer: "Prayer",
    adhan: "Adhan",
    iqamah: "Iqamah",
    upcoming: "Upcoming activities",
    hoursTotal: "volunteer hours",
    activitiesMonth: "activities this month",
    next: "Upcoming",
    history: "History",
    interests: "Interests",
    notifications: "Notifications",
    newVolunteer: "New volunteer posts",
    reminder: "Reminders 1h before",
    mosqueAnnounce: "Mosque announcements",
    signout: "Sign out",
    todayPrayers: "Today's prayer times",
    volunteers: "volunteers",
    interactiveProto: "Interactive prototype",
    clickToExplore: "Click a post to explore",
    nearbyMosques: "Mosques near you",
    directions: "Directions",
    covered: "Covered ✓",
    presencelist: "Attendance list",
  },
  ar: {
    feed: "آخر الأخبار",
    mosques: "المساجد",
    myStuff: "أنا",
    profile: "الملف",
    all: "الكل",
    volunteer: "تطوع",
    event: "فعالية",
    class: "درس",
    announcement: "إعلان",
    nextPrayer: "الصلاة القادمة",
    in: "في",
    slots: "أماكن",
    full: "مكتمل",
    signup: "أشترك",
    withdraw: "إلغاء",
    back: "رجوع →",
    coordinator: "عرض المنسق",
    schedule: "الموعد",
    location: "الموقع",
    details: "التفاصيل",
    checkin: "تسجيل حضور",
    present: "حاضر",
    qrDisplay: "عرض رمز QR للحضور",
    qrSub: "يمسح المتطوعون عند الوصول",
    prayer: "الصلاة",
    adhan: "الأذان",
    iqamah: "الإقامة",
    upcoming: "الأنشطة القادمة",
    hoursTotal: "ساعات تطوع",
    activitiesMonth: "نشاط هذا الشهر",
    next: "القادم",
    history: "السجل",
    interests: "الاهتمامات",
    notifications: "الإشعارات",
    newVolunteer: "مناصب تطوعية جديدة",
    reminder: "تذكيرات قبل ساعة",
    mosqueAnnounce: "إعلانات المسجد",
    signout: "تسجيل الخروج",
    todayPrayers: "مواقيت اليوم",
    volunteers: "متطوع",
    interactiveProto: "نموذج تفاعلي",
    clickToExplore: "اضغط على منشور للاستكشاف",
    nearbyMosques: "المساجد القريبة",
    directions: "الاتجاهات",
    covered: "مكتمل ✓",
    presencelist: "قائمة الحضور",
  },
} as const;

const LangCtx = createContext<{ lang: Lang; t: typeof T["fr"]; isAr: boolean }>({
  lang: "fr",
  t: T.fr,
  isAr: false,
});
const useLang = () => useContext(LangCtx);

// ─── Types ────────────────────────────────────────────────────────────────────
type PostType = "volunteer" | "event" | "class" | "announcement";
type Screen = "feed" | "detail" | "coverage" | "mosque" | "mystuff" | "profile";
type Tab = "feed" | "mosque" | "mystuff" | "profile";

interface Post {
  _id: string;
  mosqueId: string;
  mosqueName: string;
  mosqueInitial: string;
  type: PostType;
  title: string;
  descFr: string;
  descEn: string;
  descAr: string;
  startAt: string;
  endAt: string;
  location: string;
  slotsNeeded?: number;
  slotsFilled: number;
  capacity?: number;
  createdAt: string;
  image?: string;
}

interface Signup {
  _id: string;
  postId: string;
  name: string;
  status: "confirmed" | "withdrawn";
  checkedInAt?: string;
}

interface MosqueLocation {
  id: string;
  name: string;
  nameAr: string;
  address: string;
  lat: number;
  lng: number;
  mapsUrl: string;
  color: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOSQUES: MosqueLocation[] = [
  {
    id: "m1",
    name: "Mosquée Khadija",
    nameAr: "مسجد خديجة",
    address: "3456 rue Jean-Talon Est",
    lat: 45.5640,
    lng: -73.5870,
    mapsUrl: "https://www.openstreetmap.org/directions?from=&to=45.5640%2C-73.5870",
    color: "#0A5247",
  },
  {
    id: "m2",
    name: "Mosquée Madina",
    nameAr: "مسجد المدينة",
    address: "5890 boul. Saint-Laurent",
    lat: 45.5240,
    lng: -73.6100,
    mapsUrl: "https://www.openstreetmap.org/directions?from=&to=45.5240%2C-73.6100",
    color: "#0A3530",
  },
  {
    id: "m3",
    name: "Mosquée Al-Rawdah",
    nameAr: "مسجد الروضة",
    address: "1248 av. Décarie",
    lat: 45.4850,
    lng: -73.6500,
    mapsUrl: "https://www.openstreetmap.org/directions?from=&to=45.4850%2C-73.6500",
    color: "#0C6358",
  },
  {
    id: "m4",
    name: "Centre islamique de Laval",
    nameAr: "المركز الإسلامي في لافال",
    address: "3325 boul. Dagenais O.",
    lat: 45.5670,
    lng: -73.7200,
    mapsUrl: "https://www.openstreetmap.org/directions?from=&to=45.5670%2C-73.7200",
    color: "#0A3530",
  },
];

const POSTS: Post[] = [
  {
    _id: "p1",
    mosqueId: "m1",
    mosqueName: "Mosquée Khadija",
    mosqueInitial: "K",
    type: "volunteer",
    title: "Installation iftar — Ramadan J14",
    descFr: "Besoin de 4 bénévoles pour installer les tables et préparer les plats. Arrivée 30 min avant l'iftar.",
    descEn: "Need 4 volunteers to set up tables and prepare dishes. Arrive 30 min before iftar.",
    descAr: "نحتاج 4 متطوعين لترتيب الطاولات وتحضير الأطباق. الوصول قبل 30 دقيقة من الإفطار.",
    startAt: "19:45",
    endAt: "21:30",
    location: "Salle communautaire",
    slotsNeeded: 4,
    slotsFilled: 2,
    createdAt: "23 min",
    image: "https://images.unsplash.com/photo-1547119879-c379a507fd2a?w=800&h=420&fit=crop&auto=format",
  },
  {
    _id: "p2",
    mosqueId: "m2",
    mosqueName: "Mosquée Madina",
    mosqueInitial: "M",
    type: "event",
    title: "Conférence : Islam et environnement",
    descFr: "Discussion sur la responsabilité environnementale dans la tradition islamique. Ouvert à tous.",
    descEn: "Discussion on environmental responsibility in Islamic tradition. Open to all.",
    descAr: "نقاش حول المسؤولية البيئية في التراث الإسلامي. مفتوح للجميع.",
    startAt: "14:00",
    endAt: "16:30",
    location: "Grande salle de prière",
    capacity: 120,
    slotsFilled: 0,
    createdAt: "2h",
    image: "https://images.unsplash.com/photo-1573939705721-9fa2cdcda901?w=800&h=420&fit=crop&auto=format",
  },
  {
    _id: "p3",
    mosqueId: "m1",
    mosqueName: "Mosquée Khadija",
    mosqueInitial: "K",
    type: "volunteer",
    title: "Nettoyage post-vendredi",
    descFr: "Nettoyage de la salle de prière après le vendredi. Matériel fourni.",
    descEn: "Cleaning the prayer hall after Friday prayer. Equipment provided.",
    descAr: "تنظيف قاعة الصلاة بعد صلاة الجمعة. المعدات متوفرة.",
    startAt: "13:30",
    endAt: "14:30",
    location: "Salle de prière principale",
    slotsNeeded: 6,
    slotsFilled: 6,
    createdAt: "3h",
  },
  {
    _id: "p4",
    mosqueId: "m1",
    mosqueName: "Mosquée Khadija",
    mosqueInitial: "K",
    type: "class",
    title: "Cours de tajwid — niveau intermédiaire",
    descFr: "Révision des règles de madd et de waqf. Apportez votre Coran. Places limitées.",
    descEn: "Review of madd and waqf rules. Bring your Quran. Limited seats.",
    descAr: "مراجعة أحكام المد والوقف. أحضر قرآنك. الأماكن محدودة.",
    startAt: "10:00",
    endAt: "11:30",
    location: "Salle B",
    capacity: 18,
    slotsFilled: 0,
    createdAt: "hier",
    image: "https://images.unsplash.com/photo-1712249239061-7d4f49ec9d44?w=800&h=420&fit=crop&auto=format",
  },
  {
    _id: "p5",
    mosqueId: "m2",
    mosqueName: "Mosquée Madina",
    mosqueInitial: "M",
    type: "announcement",
    title: "Travaux — entrée principale fermée sam–lun",
    descFr: "L'entrée principale sera fermée pour réfection du parquet. Utiliser l'entrée latérale rue des Muriers.",
    descEn: "Main entrance closed for flooring renovation. Use side entrance on rue des Muriers.",
    descAr: "المدخل الرئيسي مغلق لتجديد الأرضية. استخدم المدخل الجانبي في شارع المورييه.",
    startAt: "",
    endAt: "",
    location: "Entrée principale",
    slotsFilled: 0,
    createdAt: "hier",
  },
];

const SIGNUPS: Signup[] = [
  { _id: "s1", postId: "p1", name: "Fatima B.", status: "confirmed", checkedInAt: "19:48" },
  { _id: "s2", postId: "p1", name: "Karim D.", status: "confirmed" },
];

const PRAYER_TIMES = [
  { name: "Fajr",    nameAr: "الفجر",    adhan: "05:18", iqamah: "05:35" },
  { name: "Dhuhr",   nameAr: "الظهر",    adhan: "13:02", iqamah: "13:30" },
  { name: "Asr",     nameAr: "العصر",    adhan: "16:41", iqamah: "17:00" },
  { name: "Maghrib", nameAr: "المغرب",   adhan: "19:47", iqamah: "19:52" },
  { name: "Isha",    nameAr: "العشاء",   adhan: "21:22", iqamah: "21:45" },
];
const CURRENT_PRAYER_IDX = 3; // Maghrib is next

const TYPE_CFG: Record<PostType, { color: string; bg: string }> = {
  volunteer:    { color: "#0A5247", bg: "#E2F0EE" },
  event:        { color: "#0C6358", bg: "#D6EDE9" },
  class:        { color: "#0A3530", bg: "#D0E7E4" },
  announcement: { color: "#527570", bg: "#E4EFED" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDesc(post: Post, lang: Lang) {
  return lang === "ar" ? post.descAr : lang === "en" ? post.descEn : post.descFr;
}
function getTypeLabel(type: PostType, t: typeof T["fr"]) {
  return t[type as keyof typeof t] as string;
}

// ─── Leaflet: fly to mosque ───────────────────────────────────────────────────
function MapFlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], 15, { duration: 1 }); }, [lat, lng]);
  return null;
}

// ─── Custom teal mosque icon ──────────────────────────────────────────────────
const makeIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:32px;height:38px;
      background:${color};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [32, 38],
    iconAnchor: [16, 38],
    popupAnchor: [0, -40],
  });

// ─── SlotBar ──────────────────────────────────────────────────────────────────
function SlotBar({ filled, needed }: { filled: number; needed: number }) {
  const { t } = useLang();
  const pct = Math.min(100, Math.round((filled / needed) * 100));
  const full = filled >= needed;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono-face)", fontSize: 12, color: full ? "#0A5247" : "var(--muted-foreground)" }}>
          {filled}/{needed} {t.volunteers}
        </span>
        {full && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "#0A5247", background: "#D4EDEA", borderRadius: 20, padding: "2px 8px" }}>
            {t.full} ✓
          </span>
        )}
      </div>
      <div style={{ height: 4, background: "var(--muted)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: full ? "#0A5247" : "#0C6358",
          borderRadius: 10,
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Feed Screen (Facebook-style) ────────────────────────────────────────────
const FEED_FILTERS = [
  { key: "all" },
  { key: "volunteer" },
  { key: "event" },
  { key: "class" },
  { key: "announcement" },
] as const;

function FeedPost({ post, onPress }: { post: Post; onPress: () => void }) {
  const { t, lang } = useLang();
  const [liked, setLiked] = useState(false);
  const typeLabel = getTypeLabel(post.type, t);
  const cfg = TYPE_CFG[post.type];
  const desc = getDesc(post, lang);

  return (
    <div style={{
      background: "var(--card)",
      borderBottom: "1px solid var(--border)",
    }}>
      {/* Post header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px 8px",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--primary)",
          color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 700, flexShrink: 0,
          fontFamily: "var(--font-display)",
        }}>
          {post.mosqueInitial}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
            {post.mosqueName}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{t.in} {post.createdAt}</span>
            <span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>·</span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: cfg.color,
              background: cfg.bg,
              borderRadius: 4, padding: "1px 6px",
            }}>
              {typeLabel}
            </span>
          </div>
        </div>
        {post.type === "volunteer" && post.slotsNeeded != null && post.slotsFilled < post.slotsNeeded && (
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#0C6358",
            boxShadow: "0 0 0 3px #A8D8D2",
          }} />
        )}
      </div>

      {/* Title + short desc */}
      <div style={{ padding: "0 16px 10px" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--foreground)",
            marginBottom: 4,
            cursor: "pointer",
            direction: lang === "ar" ? "rtl" : "ltr",
          }}
          onClick={onPress}
        >
          {post.title}
        </div>
        <div style={{
          fontSize: 13.5,
          color: "var(--muted-foreground)",
          lineHeight: 1.5,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          direction: lang === "ar" ? "rtl" : "ltr",
          textAlign: lang === "ar" ? "right" : "left",
        }}>
          {desc}
        </div>

        {/* Time pill */}
        {post.startAt && (
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 8,
            padding: "4px 10px",
            background: "var(--muted)",
            borderRadius: 20,
          }}>
            <span style={{ fontSize: 13 }}>🕐</span>
            <span style={{ fontFamily: "var(--font-mono-face)", fontSize: 12, color: "var(--foreground)", fontWeight: 500 }}>
              {post.startAt} – {post.endAt}
            </span>
          </div>
        )}
      </div>

      {/* Image */}
      {post.image && (
        <div
          style={{
            width: "100%",
            height: 200,
            background: "var(--muted)",
            overflow: "hidden",
            cursor: "pointer",
          }}
          onClick={onPress}
        >
          <img
            src={post.image}
            alt={post.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      {/* Slot bar */}
      {post.type === "volunteer" && post.slotsNeeded != null && (
        <div style={{ padding: "10px 16px" }}>
          <SlotBar filled={post.slotsFilled} needed={post.slotsNeeded} />
        </div>
      )}

      {/* Action row */}
      <div style={{
        display: "flex",
        borderTop: "1px solid var(--border)",
        margin: "0 16px",
      }}>
        <button
          onClick={() => setLiked(l => !l)}
          style={{
            flex: 1,
            padding: "10px",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: liked ? "#0A5247" : "var(--muted-foreground)",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "var(--font-body)",
            transition: "color 0.15s",
          }}
        >
          <span style={{ fontSize: 16 }}>{liked ? "♥" : "♡"}</span>
        </button>
        <div style={{ width: 1, background: "var(--border)", margin: "6px 0" }} />
        <button
          onClick={onPress}
          style={{
            flex: 1,
            padding: "10px",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "var(--muted-foreground)",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "var(--font-body)",
          }}
        >
          <span style={{ fontSize: 14 }}>→</span>
          {post.type === "volunteer" ? t.signup : lang === "ar" ? "تفاصيل" : lang === "en" ? "Details" : "Détails"}
        </button>
      </div>
    </div>
  );
}

// ─── Prayer Card (premium) ────────────────────────────────────────────────────
function PrayerCard() {
  const { t, lang, isAr } = useLang();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const remaining = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 47) as unknown as number - (now as unknown as number);
  const hrs = Math.floor(Math.max(0, remaining) / 3600000);
  const mins = Math.floor((Math.max(0, remaining) % 3600000) / 60000);
  const secs = Math.floor((Math.max(0, remaining) % 60000) / 1000);
  const countdown = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const prayerName = isAr ? PRAYER_TIMES[CURRENT_PRAYER_IDX].nameAr : PRAYER_TIMES[CURRENT_PRAYER_IDX].name;

  return (
    <div style={{
      background: "linear-gradient(145deg, #061E1B 0%, #0A3530 50%, #0A5247 100%)",
      padding: "20px 20px 16px",
      flexShrink: 0,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 2,
            fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)",
            direction: isAr ? "rtl" : "ltr",
          }}>
            {t.nextPrayer}
          </div>
          <div style={{
            fontFamily: isAr ? "var(--font-arabic)" : "var(--font-display)",
            fontSize: 26,
            fontWeight: 600,
            color: "#FFFFFF",
            lineHeight: 1.1,
          }}>
            {prayerName}
          </div>
          <div style={{ fontFamily: "var(--font-mono-face)", fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
            {PRAYER_TIMES[CURRENT_PRAYER_IDX].adhan} → {PRAYER_TIMES[CURRENT_PRAYER_IDX].iqamah}
          </div>
        </div>

        {/* Countdown badge */}
        <div style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          padding: "12px 16px",
          textAlign: "center",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
            {t.in}
          </div>
          <div style={{
            fontFamily: "var(--font-mono-face)",
            fontSize: 22,
            fontWeight: 500,
            color: "#FFFFFF",
            letterSpacing: "0.02em",
          }}>
            {countdown}
          </div>
        </div>
      </div>

      {/* Prayer strip */}
      <div style={{
        display: "flex",
        gap: 4,
        overflowX: "auto",
        direction: isAr ? "rtl" : "ltr",
      }} className="scrollbar-hide">
        {PRAYER_TIMES.map((p, i) => {
          const isActive = i === CURRENT_PRAYER_IDX;
          const isPast = i < CURRENT_PRAYER_IDX;
          const name = isAr ? p.nameAr : p.name;
          return (
            <div
              key={p.name}
              style={{
                flex: "0 0 auto",
                padding: "8px 10px",
                borderRadius: 10,
                background: isActive
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.05)",
                border: isActive
                  ? "1px solid rgba(255,255,255,0.25)"
                  : "1px solid transparent",
                textAlign: "center",
                minWidth: 58,
                transition: "all 0.2s",
              }}
            >
              <div style={{
                fontSize: isAr ? 12 : 11,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#FFFFFF" : isPast ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)",
                marginBottom: 3,
                fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)",
              }}>
                {name}
              </div>
              <div style={{
                fontFamily: "var(--font-mono-face)",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#FFFFFF" : isPast ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.55)",
              }}>
                {p.adhan}
              </div>
              {isActive && (
                <div style={{
                  width: 4, height: 4, borderRadius: "50%",
                  background: "#4EC9B8",
                  margin: "4px auto 0",
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeedScreen({ onSelectPost }: { onSelectPost: (post: Post) => void }) {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? POSTS : POSTS.filter(p => p.type === filter);

  const filterLabel = (key: string) => {
    if (key === "all") return t.all;
    return t[key as keyof typeof t] as string;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PrayerCard />

      {/* Filter chips */}
      <div style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "10px 14px",
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }} className="scrollbar-hide">
        {FEED_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              flexShrink: 0,
              padding: "5px 14px",
              borderRadius: 20,
              border: `1.5px solid ${filter === f.key ? "var(--primary)" : "var(--border)"}`,
              background: filter === f.key ? "var(--primary)" : "transparent",
              color: filter === f.key ? "#FFFFFF" : "var(--muted-foreground)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              transition: "all 0.15s",
            }}
          >
            {filterLabel(f.key)}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: "auto", background: "var(--background)" }} className="scrollbar-hide">
        {filtered.map(post => (
          <FeedPost key={post._id} post={post} onPress={() => onSelectPost(post)} />
        ))}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

// ─── Post Detail ──────────────────────────────────────────────────────────────
function PostDetailScreen({
  post, onBack, onCoverage,
}: { post: Post; onBack: () => void; onCoverage: () => void }) {
  const { t, lang, isAr } = useLang();
  const [signedUp, setSignedUp] = useState(false);
  const [slots, setSlots] = useState(post.slotsFilled);
  const isFull = post.slotsNeeded != null && slots >= post.slotsNeeded;
  const desc = getDesc(post, lang);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #061E1B, #0A5247)",
        padding: "14px 20px 20px",
        flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.7)", fontSize: 14,
          fontFamily: "var(--font-body)", padding: 0, marginBottom: 10,
          direction: isAr ? "rtl" : "ltr",
        }}>
          {t.back}
        </button>
        <h2 style={{
          fontFamily: isAr ? "var(--font-arabic)" : "var(--font-display)",
          fontSize: 20, fontWeight: 600, color: "#fff",
          margin: "0 0 4px", lineHeight: 1.25,
          direction: isAr ? "rtl" : "ltr",
        }}>
          {post.title}
        </h2>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>{post.mosqueName}</div>
      </div>

      {post.image && (
        <div style={{ height: 180, background: "var(--muted)", flexShrink: 0 }}>
          <img src={post.image} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 100px" }} className="scrollbar-hide">
        {/* Time / location */}
        {post.startAt && (
          <div style={{
            display: "flex", gap: 16,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12, padding: "14px 16px", marginBottom: 14,
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                {t.schedule}
              </div>
              <div style={{ fontFamily: "var(--font-mono-face)", fontSize: 15, fontWeight: 500 }}>
                {post.startAt} – {post.endAt}
              </div>
            </div>
            <div style={{ width: 1, background: "var(--border)" }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                {t.location}
              </div>
              <div style={{ fontSize: 13.5 }}>{post.location}</div>
            </div>
          </div>
        )}

        {/* Slots */}
        {post.type === "volunteer" && post.slotsNeeded != null && (
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 12, padding: 16, marginBottom: 14,
          }}>
            <SlotBar filled={slots} needed={post.slotsNeeded} />
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {SIGNUPS.filter(s => s.postId === post._id && s.status === "confirmed").map(s => (
                <div key={s._id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", background: "var(--muted)", borderRadius: 8,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--primary)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>
                    {s.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.name}</div>
                    {s.checkedInAt && (
                      <div style={{ fontSize: 11, color: "#0A5247", fontFamily: "var(--font-mono-face)" }}>
                        ✓ {t.present} · {s.checkedInAt}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {signedUp && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px",
                  background: "#D4EDEA",
                  borderRadius: 8,
                  border: "1px dashed #0A5247",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "#0A5247", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                  }}>V</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0A5247", flex: 1 }}>
                    {lang === "ar" ? "أنتم" : lang === "en" ? "You" : "Vous"}
                  </div>
                  <span style={{ fontSize: 11, color: "#0A5247", background: "#A8D8D2", borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>
                    ✓
                  </span>
                </div>
              )}
            </div>
            <button onClick={onCoverage} style={{
              marginTop: 12, width: "100%", padding: "9px",
              background: "none", border: "1.5px solid var(--border)",
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: "var(--primary)", cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}>
              {t.coordinator} →
            </button>
          </div>
        )}

        {/* Description */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            {t.details}
          </div>
          <p style={{
            fontSize: 14, lineHeight: 1.65, margin: 0,
            direction: isAr ? "rtl" : "ltr",
            textAlign: isAr ? "right" : "left",
            fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)",
          }}>
            {desc}
          </p>
        </div>
      </div>

      {/* CTA */}
      {post.type === "volunteer" && post.slotsNeeded != null && (
        <div style={{ position: "absolute", bottom: 72, left: 16, right: 16 }}>
          <button
            onClick={() => {
              if (signedUp) { setSlots(s => Math.max(0, s - 1)); setSignedUp(false); }
              else if (!isFull) { setSlots(s => s + 1); setSignedUp(true); }
            }}
            style={{
              width: "100%", padding: "15px",
              borderRadius: 14, border: "none",
              background: signedUp ? "var(--muted)" : isFull ? "var(--muted)" : "var(--primary)",
              color: signedUp ? "#DC2626" : isFull ? "var(--muted-foreground)" : "#fff",
              fontSize: 15, fontWeight: 600,
              cursor: isFull && !signedUp ? "default" : "pointer",
              fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)",
              boxShadow: !signedUp && !isFull ? "0 4px 20px rgba(10,82,71,0.4)" : "none",
              transition: "all 0.2s",
            }}
          >
            {signedUp ? t.withdraw : isFull ? t.full : t.signup}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Coverage Screen ──────────────────────────────────────────────────────────
function CoverageScreen({ post, onBack }: { post: Post; onBack: () => void }) {
  const { t, isAr } = useLang();
  const [checkedIn, setCheckedIn] = useState<string[]>(["s1"]);
  const confirmeds = SIGNUPS.filter(s => s.postId === post._id && s.status === "confirmed");
  const filled = confirmeds.length;
  const needed = post.slotsNeeded ?? 0;
  const pct = Math.min(100, Math.round((filled / needed) * 100));
  const full = pct === 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: "#061E1B", padding: "14px 20px 20px", flexShrink: 0 }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.6)", fontSize: 13, padding: 0,
          fontFamily: "var(--font-body)", marginBottom: 10,
        }}>
          {t.back}
        </button>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
          {t.coordinator}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            border: `3px solid ${full ? "#4EC9B8" : "#0C6358"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: "var(--font-mono-face)", fontSize: 18,
              fontWeight: 500, color: full ? "#4EC9B8" : "#FFFFFF",
            }}>
              {pct}%
            </span>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono-face)", fontSize: 28, fontWeight: 500, color: "#fff" }}>
              {filled}<span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}> / {needed}</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{t.volunteers}</div>
          </div>
          {full && (
            <div style={{
              marginLeft: "auto", background: "#4EC9B8",
              color: "#061E1B", fontSize: 12, fontWeight: 700,
              borderRadius: 8, padding: "6px 10px",
            }}>
              {t.covered}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }} className="scrollbar-hide">
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
          {t.presencelist}
        </div>

        {confirmeds.map(s => {
          const isIn = checkedIn.includes(s._id);
          return (
            <div key={s._id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px",
              background: isIn ? "#E2F0EE" : "var(--card)",
              border: `1px solid ${isIn ? "#A8D8D2" : "var(--border)"}`,
              borderRadius: 12, marginBottom: 10, transition: "all 0.2s",
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: isIn ? "var(--primary)" : "var(--muted)",
                color: isIn ? "#fff" : "var(--muted-foreground)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700, flexShrink: 0,
              }}>
                {s.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 500 }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: isIn ? "#0A5247" : "var(--muted-foreground)", fontFamily: "var(--font-mono-face)" }}>
                  {isIn ? `✓ ${t.present} · ${s.checkedInAt ?? "19:55"}` : "—"}
                </div>
              </div>
              <button
                onClick={() => setCheckedIn(prev => isIn ? prev.filter(id => id !== s._id) : [...prev, s._id])}
                style={{
                  padding: "7px 12px", borderRadius: 8,
                  border: isIn ? "none" : "1.5px solid var(--border)",
                  background: isIn ? "var(--primary)" : "transparent",
                  color: isIn ? "#fff" : "var(--foreground)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "var(--font-body)", transition: "all 0.15s",
                }}
              >
                {isIn ? t.present : t.checkin}
              </button>
            </div>
          );
        })}

        <div style={{
          marginTop: 8, padding: 16,
          background: "var(--card)", border: "1.5px dashed var(--border)",
          borderRadius: 12, textAlign: "center",
        }}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>⬛</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t.qrDisplay}</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{t.qrSub}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Mosque Screen with OSM Map ───────────────────────────────────────────────
function MosqueScreen() {
  const { t, lang, isAr } = useLang();
  const [active, setActive] = useState<MosqueLocation>(MOSQUES[0]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([45.530, -73.620]);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  const selectMosque = (m: MosqueLocation) => {
    setActive(m);
    setFlyTarget({ lat: m.lat, lng: m.lng });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #061E1B, #0A5247)",
        padding: "16px 20px 14px", flexShrink: 0,
      }}>
        <h2 style={{
          fontFamily: isAr ? "var(--font-arabic)" : "var(--font-display)",
          fontSize: 22, fontWeight: 600, color: "#fff",
          margin: 0, direction: isAr ? "rtl" : "ltr",
        }}>
          {t.mosques}
        </h2>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
          {t.nearbyMosques}
        </div>
      </div>

      {/* OSM Map */}
      <div style={{ height: 220, flexShrink: 0, position: "relative" }}>
        <MapContainer
          center={mapCenter}
          zoom={12}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {flyTarget && <MapFlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}
          {MOSQUES.map(m => (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={makeIcon(m.id === active.id ? "#0A5247" : "#0A3530")}
              eventHandlers={{ click: () => selectMosque(m) }}
            >
              <Popup>
                <div style={{ minWidth: 150 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0A5247", marginBottom: 2 }}>
                    {isAr ? m.nameAr : m.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#527570", marginBottom: 8 }}>{m.address}</div>
                  <a
                    href={m.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      padding: "5px 12px",
                      background: "#0A5247",
                      color: "#fff",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    {t.directions} ↗
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Mosque list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }} className="scrollbar-hide">
        {MOSQUES.map(m => (
          <button
            key={m.id}
            onClick={() => selectMosque(m)}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px",
              background: m.id === active.id ? "var(--teal-50, #EDF7F6)" : "var(--card)",
              border: `1.5px solid ${m.id === active.id ? "#A8D8D2" : "var(--border)"}`,
              borderRadius: 12, marginBottom: 10,
              cursor: "pointer", textAlign: "left",
              transition: "all 0.15s",
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: m.id === active.id ? "var(--primary)" : "var(--muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>
              🕌
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: m.id === active.id ? "var(--primary)" : "var(--foreground)",
                direction: isAr ? "rtl" : "ltr",
                fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)",
              }}>
                {isAr ? m.nameAr : m.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>
                {m.address}
              </div>
            </div>
            <a
              href={m.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                padding: "6px 10px",
                background: "var(--muted)",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--primary)",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              ↗
            </a>
          </button>
        ))}

        {/* Prayer table for active mosque */}
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            {t.todayPrayers} · {isAr ? active.nameAr : active.name}
          </div>
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 12, overflow: "hidden",
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              padding: "8px 16px",
              background: "var(--muted)",
              borderBottom: "1px solid var(--border)",
            }}>
              {[t.prayer, t.adhan, t.iqamah].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {h}
                </div>
              ))}
            </div>
            {PRAYER_TIMES.map((p, i) => {
              const isNext = i === CURRENT_PRAYER_IDX;
              return (
                <div key={p.name} style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  padding: "11px 16px",
                  borderBottom: i < 4 ? "1px solid var(--border)" : "none",
                  background: isNext ? "#E2F0EE" : "transparent",
                  alignItems: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isNext && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }} />}
                    <span style={{
                      fontSize: 13.5,
                      fontWeight: isNext ? 600 : 400,
                      color: isNext ? "var(--primary)" : "var(--foreground)",
                      fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)",
                    }}>
                      {isAr ? p.nameAr : p.name}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono-face)", fontSize: 13 }}>{p.adhan}</div>
                  <div style={{ fontFamily: "var(--font-mono-face)", fontSize: 13, color: "var(--primary)", fontWeight: 500 }}>{p.iqamah}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── My Stuff Screen ──────────────────────────────────────────────────────────
function MyStuffScreen() {
  const { t, isAr } = useLang();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        background: "linear-gradient(135deg, #061E1B, #0A5247)",
        padding: "20px 20px 24px", flexShrink: 0,
      }}>
        <h2 style={{
          fontFamily: isAr ? "var(--font-arabic)" : "var(--font-display)",
          fontSize: 22, fontWeight: 600, color: "#fff",
          margin: "0 0 14px",
          direction: isAr ? "rtl" : "ltr",
        }}>
          {t.next}
        </h2>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { val: "6.5", label: t.hoursTotal },
            { val: "4", label: t.activitiesMonth },
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "14px 16px",
            }}>
              <div style={{ fontFamily: "var(--font-mono-face)", fontSize: 30, fontWeight: 500, color: "#fff" }}>{stat.val}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2,
                fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)",
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }} className="scrollbar-hide">
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
          {t.next}
        </div>

        {[
          { title: "Installation iftar — Ramadan J14", mosque: "Mosquée Khadija", time: "19:45" },
          { title: "Nettoyage post-vendredi", mosque: "Mosquée Khadija", time: "13:30" },
        ].map((c, i) => (
          <div key={i} style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 12, padding: "14px 16px", marginBottom: 12,
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: "#E2F0EE", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>🕌</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.mosque}</div>
              <div style={{ fontFamily: "var(--font-mono-face)", fontSize: 12, color: "var(--primary)", marginTop: 4 }}>
                {c.time} · ✓
              </div>
            </div>
          </div>
        ))}

        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "20px 0 12px" }}>
          {t.history}
        </div>
        {[
          { title: "Iftar setup J7", mosque: "Mosquée Khadija", date: "22 mars", hours: 1.5 },
          { title: "Déjeuner communautaire", mosque: "Mosquée Madina", date: "15 mars", hours: 3 },
          { title: "Nettoyage post-vendredi", mosque: "Mosquée Khadija", date: "6 mars", hours: 1 },
        ].map((h, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center",
            padding: "12px 0",
            borderBottom: i < 2 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{h.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{h.mosque} · {h.date}</div>
            </div>
            <div style={{
              fontFamily: "var(--font-mono-face)", fontSize: 14, fontWeight: 500,
              color: "var(--primary)", background: "#E2F0EE",
              borderRadius: 8, padding: "4px 10px",
            }}>
              {h.hours}h
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────
function ProfileScreen() {
  const { t, isAr } = useLang();
  const interests = isAr
    ? ["إفطار", "تعليم", "نظافة", "فعاليات"]
    : ["Iftar", "Éducation", "Entretien", "Événements"];
  const [selected, setSelected] = useState([0, 1]);
  const [notifs, setNotifs] = useState([true, true, false]);

  const notifLabels = [t.newVolunteer, t.reminder, t.mosqueAnnounce];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        background: "linear-gradient(135deg, #061E1B, #0A5247)",
        padding: "20px 20px 28px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, direction: isAr ? "rtl" : "ltr" }}>
          <div style={{
            width: 58, height: 58, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            border: "2.5px solid rgba(255,255,255,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, color: "#fff",
            fontFamily: "var(--font-display)", flexShrink: 0,
          }}>
            Y
          </div>
          <div>
            <div style={{ fontFamily: isAr ? "var(--font-arabic)" : "var(--font-display)", fontSize: 20, fontWeight: 600, color: "#fff" }}>
              {isAr ? "ياسمين حاج" : "Yasmine Hadj"}
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>yasmine@gmail.com</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }} className="scrollbar-hide">
        {/* Interests */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 16, marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, direction: isAr ? "rtl" : "ltr" }}>{t.interests}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, direction: isAr ? "rtl" : "ltr" }}>
            {interests.map((item, i) => (
              <button
                key={i}
                onClick={() => setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                style={{
                  padding: "7px 14px", borderRadius: 20,
                  border: `1.5px solid ${selected.includes(i) ? "var(--primary)" : "var(--border)"}`,
                  background: selected.includes(i) ? "#E2F0EE" : "transparent",
                  color: selected.includes(i) ? "var(--primary)" : "var(--muted-foreground)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)",
                  transition: "all 0.15s",
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 16, marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, direction: isAr ? "rtl" : "ltr" }}>{t.notifications}</div>
          {notifLabels.map((label, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0",
              borderBottom: i < 2 ? "1px solid var(--border)" : "none",
              flexDirection: isAr ? "row-reverse" : "row",
            }}>
              <span style={{ fontSize: 13, fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)" }}>{label}</span>
              <div
                onClick={() => setNotifs(prev => prev.map((v, j) => j === i ? !v : v))}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: notifs[i] ? "var(--primary)" : "var(--muted)",
                  position: "relative", cursor: "pointer", flexShrink: 0,
                  transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute", width: 16, height: 16, background: "#fff",
                  borderRadius: "50%", top: 3,
                  left: notifs[i] ? 21 : 3, transition: "left 0.2s",
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Sign out */}
        <button style={{
          width: "100%", padding: "13px",
          borderRadius: 12, border: "1.5px solid #FCA5A5",
          background: "transparent", color: "#DC2626",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)",
        }}>
          {t.signout}
        </button>
      </div>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
const NAV_ITEMS: { key: Tab; icon: string; labelKey: "feed" | "mosques" | "myStuff" | "profile" }[] = [
  { key: "feed",    icon: "⊟", labelKey: "feed" },
  { key: "mosque",  icon: "🕌", labelKey: "mosques" },
  { key: "mystuff", icon: "☑", labelKey: "myStuff" },
  { key: "profile", icon: "◎", labelKey: "profile" },
];

// ─── Language Switcher ────────────────────────────────────────────────────────
function LangSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div style={{
      position: "absolute", top: -48, left: "50%", transform: "translateX(-50%)",
      display: "flex", gap: 4,
      background: "rgba(6,30,27,0.85)",
      backdropFilter: "blur(8px)",
      borderRadius: 20, padding: "4px",
    }}>
      {(["fr", "en", "ar"] as Lang[]).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            padding: "5px 12px",
            borderRadius: 16,
            border: "none",
            background: lang === l ? "#0A5247" : "transparent",
            color: lang === l ? "#fff" : "rgba(255,255,255,0.55)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            transition: "all 0.15s",
            letterSpacing: l === "ar" ? "0" : "0.04em",
          }}
        >
          {l === "fr" ? "FR" : l === "en" ? "EN" : "عر"}
        </button>
      ))}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState<Lang>("fr");
  const [tab, setTab] = useState<Tab>("feed");
  const [screen, setScreen] = useState<Screen>("feed");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const t = T[lang];
  const isAr = lang === "ar";

  const handleSelectPost = (post: Post) => {
    setSelectedPost(post);
    setScreen("detail");
  };

  const handleBack = () => {
    setScreen(tab as Screen);
    setSelectedPost(null);
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setScreen(t as Screen);
    setSelectedPost(null);
  };

  const showNav = ["feed", "mosque", "mystuff", "profile"].includes(screen);

  // Header bg for status bar
  const headerBg = screen === "coverage" ? "#061E1B" : "linear-gradient(90deg, #061E1B, #0A5247)";

  const renderScreen = () => {
    if (screen === "detail" && selectedPost) return <PostDetailScreen post={selectedPost} onBack={handleBack} onCoverage={() => setScreen("coverage")} />;
    if (screen === "coverage" && selectedPost) return <CoverageScreen post={selectedPost} onBack={() => setScreen("detail")} />;
    if (screen === "feed") return <FeedScreen onSelectPost={handleSelectPost} />;
    if (screen === "mosque") return <MosqueScreen />;
    if (screen === "mystuff") return <MyStuffScreen />;
    if (screen === "profile") return <ProfileScreen />;
    return null;
  };

  return (
    <LangCtx.Provider value={{ lang, t, isAr }}>
      <div style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #C5D5D2 0%, #B8CAC7 100%)",
        padding: "60px 16px 40px",
        fontFamily: "var(--font-body)",
      }}>
        {/* Phone frame */}
        <div style={{
          width: 390, height: 844,
          background: "var(--background)",
          borderRadius: 44,
          overflow: "hidden",
          position: "relative",
          boxShadow: "0 50px 100px rgba(0,0,0,0.3), 0 0 0 10px #0D1F1C, 0 0 0 12px #1A3532",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Status bar */}
          <div style={{
            height: 44,
            background: headerBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            flexShrink: 0,
            position: "relative",
          }}>
            <span style={{ fontFamily: "var(--font-mono-face)", fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
              {new Date().toLocaleTimeString(isAr ? "ar" : "fr-CA", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {/* Dynamic island */}
            <div style={{
              width: 110, height: 32, background: "#000",
              borderRadius: 18, position: "absolute",
              top: 6, left: "50%", transform: "translateX(-50%)",
            }} />
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>●●●</span>
            </div>
          </div>

          {/* Screen content */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {renderScreen()}
          </div>

          {/* Bottom nav */}
          {showNav && (
            <div style={{
              height: 80, background: "var(--card)",
              borderTop: "1px solid var(--border)",
              display: "flex", alignItems: "flex-start",
              paddingTop: 10, flexShrink: 0,
            }}>
              {NAV_ITEMS.map(item => (
                <button
                  key={item.key}
                  onClick={() => handleTabChange(item.key)}
                  style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 3,
                    background: "none", border: "none", cursor: "pointer",
                    padding: "4px 0",
                  }}
                >
                  <span style={{
                    fontSize: 19,
                    filter: tab === item.key ? "none" : "grayscale(1) opacity(0.35)",
                    transition: "filter 0.15s",
                  }}>
                    {item.icon}
                  </span>
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: tab === item.key ? 700 : 400,
                    color: tab === item.key ? "var(--primary)" : "var(--muted-foreground)",
                    fontFamily: isAr ? "var(--font-arabic)" : "var(--font-body)",
                    transition: "color 0.15s",
                  }}>
                    {t[item.labelKey]}
                  </span>
                  {tab === item.key && (
                    <div style={{ width: 18, height: 2.5, background: "var(--primary)", borderRadius: 2, marginTop: 1 }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lang switcher above phone */}
        <div style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)" }}>
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>

        {/* Footer label */}
        <div style={{
          position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
          background: "rgba(6,30,27,0.75)", backdropFilter: "blur(10px)",
          borderRadius: 20, padding: "6px 18px",
          display: "flex", gap: 12, alignItems: "center",
        }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "var(--font-body)", fontWeight: 500 }}>
            M'Ensemble
          </span>
          <span style={{ width: 1, height: 10, background: "rgba(255,255,255,0.2)" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {t.interactiveProto}
          </span>
        </div>
      </div>
    </LangCtx.Provider>
  );
}
