import { FormEvent, ReactNode, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ArrowRight,
  AtSign,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Map,
  PencilLine,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { login, register } from "../services/api";

const paperBg = {
  backgroundColor: "#FAFAF8",
  backgroundImage:
    "linear-gradient(rgba(2,82,89,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(2,82,89,0.06) 1px, transparent 1px), radial-gradient(circle at 16px 16px, rgba(255,148,122,0.22) 1.3px, transparent 1.4px)",
  backgroundSize: "34px 34px, 34px 34px, 24px 24px",
  animation: "dotDrift 24s linear infinite",
};

const sketchCard = {
  background: "#fff",
  border: "2.5px solid rgba(26,26,46,0.12)",
  borderRadius: 28,
  boxShadow: "7px 7px 0 rgba(2,82,89,0.14)",
};

const fieldStyle =
  "h-12 w-full rounded-2xl border-2 bg-white px-11 text-[15px] font-semibold outline-none transition placeholder:text-[#9090AA] focus:border-[#ff947a] focus:shadow-[0_0_0_4px_rgba(255,148,122,0.28)]";

function DoodleBadge({ children, color = "#025259" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-xs font-extrabold"
      style={{
        color,
        background: `${color}14`,
        border: `2px dashed ${color}55`,
      }}
    >
      {children}
    </span>
  );
}

function AuthIllustration() {
  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[32px] p-7" style={sketchCard}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,148,122,0.22),transparent_27%),radial-gradient(circle_at_85%_28%,rgba(2,82,89,0.14),transparent_25%)]" />
      <div className="relative z-10">
        <DoodleBadge color="#ff947a">
          <Sparkles size={14} />
          GR1 Career Passport
        </DoodleBadge>

        <h1
          className="mt-6 max-w-md text-[2.45rem] font-black leading-[1.05] text-[#1A1A2E] md:text-[3.2rem]"
          style={{ fontFamily: "'Baloo 2', cursive", letterSpacing: 0 }}
        >
          Vao GR1 va mo ban do tuyen sinh cua ban
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-7 text-[#4A4A6A]">
          Dang nhap de luu ho so hoc luc, theo doi nganh yeu thich va nhan goi y truong phu hop theo tung moc diem.
        </p>

        <div className="mt-8 grid max-w-md gap-3 sm:grid-cols-2">
          {[
            { icon: Map, text: "Ban do nganh nghe", color: "#025259" },
            { icon: ShieldCheck, text: "Ho so bao mat", color: "#2f8a89" },
            { icon: BookOpen, text: "Diem chuan ca nhan", color: "#ff947a" },
            { icon: PencilLine, text: "Ghi chu xet tuyen", color: "#e17358" },
          ].map((item, index) => (
            <div
              key={item.text}
              className="flex items-center gap-3 rounded-3xl bg-white/85 p-3 text-sm font-extrabold text-[#1A1A2E]"
              style={{
                border: `2px solid ${item.color}33`,
                boxShadow: `3px 3px 0 ${item.color}20`,
                transform: `rotate(${index % 2 === 0 ? "-1deg" : "1deg"})`,
              }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl" style={{ background: `${item.color}1f` }}>
                <item.icon size={18} color={item.color} />
              </span>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      <svg className="absolute bottom-3 right-2 z-0 h-52 w-52 opacity-95" viewBox="0 0 220 220" aria-hidden="true">
        <path d="M52 132c28-21 63-28 107-13" fill="none" stroke="#025259" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 8" />
        <rect x="54" y="58" width="112" height="86" rx="16" fill="#FFF8EE" stroke="#1A1A2E" strokeWidth="3" />
        <path d="M72 84h76M72 102h54M72 120h66" stroke="#ff947a" strokeWidth="5" strokeLinecap="round" />
        <circle cx="151" cy="132" r="18" fill="#2f8a89" stroke="#1A1A2E" strokeWidth="3" />
        <path d="m143 132 6 6 12-15" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M41 61c10-13 22-14 35-3M155 42c14 2 23 9 28 22" fill="none" stroke="#ff947a" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialMode = location.pathname.includes("dang-ky") ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    user_name: "",
    full_name: "",
    grade: "11",
    dob: "",
    gender: "MALE",
    gmail: "",
    password: "",
  });

  const copy = useMemo(
    () =>
      mode === "login"
        ? {
            title: "Dang nhap tai khoan",
            subtitle: "Tiep tuc hanh trinh chon nganh, chon truong cua ban.",
            button: "Dang nhap",
          }
        : {
            title: "Tao tai khoan GR1",
            subtitle: "Luu ho so hoc luc va nhan goi y tuyen sinh phu hop.",
            button: "Dang ky",
          },
    [mode],
  );

  const update = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
    setMessage("");
    navigate(next === "login" ? "/dang-nhap" : "/dang-ky", { replace: true });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response =
        mode === "login"
          ? await login({ gmail: form.gmail, password: form.password })
          : await register({
              user_name: form.user_name.trim(),
              full_name: form.full_name.trim(),
              grade: Number(form.grade),
              dob: form.dob,
              gender: form.gender as "MALE" | "FEMALE",
              gmail: form.gmail.trim(),
              password: form.password,
            });

      localStorage.setItem("gr1_access_token", response.access_token);
      if (response.refresh_token) localStorage.setItem("gr1_refresh_token", response.refresh_token);
      localStorage.setItem("gr1_user", JSON.stringify(response.user));
      setMessage(response.message);
      navigate("/ho-so");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the xu ly yeu cau. Vui long thu lai.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:py-14" style={paperBg}>
      <div className="mx-auto grid max-w-6xl items-center gap-7 lg:grid-cols-[1fr_440px]">
        <AuthIllustration />

        <section className="relative p-5 sm:p-7" style={sketchCard}>
          <div className="absolute -right-4 -top-4 hidden rotate-6 rounded-3xl bg-[#ff947a] px-4 py-2 text-sm font-black text-[#1A1A2E] shadow-[3px_3px_0_rgba(255,148,122,0.35)] sm:block">
            Lop 10-12
          </div>

          <div className="mb-6 flex rounded-[22px] bg-[#fff5f2] p-1.5" style={{ border: "2px solid rgba(255,148,122,0.26)" }}>
            {[
              { key: "login", label: "Dang nhap" },
              { key: "register", label: "Dang ky" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchMode(tab.key as "login" | "register")}
                className="h-11 flex-1 rounded-2xl text-sm font-black transition"
                style={{
                  background: mode === tab.key ? "#ff947a" : "transparent",
                  color: mode === tab.key ? "#fff" : "#4A4A6A",
                  boxShadow: mode === tab.key ? "3px 3px 0 rgba(255,148,122,0.28)" : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <DoodleBadge color={mode === "login" ? "#2f8a89" : "#ff947a"}>
              <CheckCircle2 size={14} />
              {mode === "login" ? "Tro lai GR1" : "Thanh vien moi"}
            </DoodleBadge>
            <h2 className="mt-4 text-3xl font-black leading-tight text-[#1A1A2E]" style={{ fontFamily: "'Baloo 2', cursive" }}>
              {copy.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#4A4A6A]">{copy.subtitle}</p>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === "register" && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-extrabold text-[#1A1A2E]">Ten dang nhap</span>
                  <div className="relative">
                    <UserRound className="absolute left-4 top-3.5 text-[#9090AA]" size={18} />
                    <input className={fieldStyle} value={form.user_name} onChange={(e) => update("user_name", e.target.value)} placeholder="m1nhb1e" required />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-extrabold text-[#1A1A2E]">Ho va ten</span>
                  <div className="relative">
                    <PencilLine className="absolute left-4 top-3.5 text-[#9090AA]" size={18} />
                    <input className={fieldStyle} value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Nguyen Trong Minh" required />
                  </div>
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-extrabold text-[#1A1A2E]">Lop</span>
                    <select className="h-12 w-full rounded-2xl border-2 bg-white px-4 text-sm font-extrabold outline-none focus:border-[#ff947a]" value={form.grade} onChange={(e) => update("grade", e.target.value)}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-extrabold text-[#1A1A2E]">Ngay sinh</span>
                    <div className="relative">
                      <CalendarDays className="absolute left-4 top-3.5 text-[#9090AA]" size={18} />
                      <input className={fieldStyle} type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} required />
                    </div>
                  </label>
                </div>

                <div>
                  <span className="mb-1.5 block text-sm font-extrabold text-[#1A1A2E]">Gioi tinh</span>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: "MALE", label: "Nam", color: "#ff947a" },
                      { value: "FEMALE", label: "Nu", color: "#ff947a" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => update("gender", option.value)}
                        className="h-12 rounded-2xl border-2 text-sm font-black transition"
                        style={{
                          borderColor: form.gender === option.value ? option.color : "rgba(26,26,46,0.12)",
                          color: form.gender === option.value ? option.color : "#4A4A6A",
                          background: form.gender === option.value ? `${option.color}12` : "#fff",
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-extrabold text-[#1A1A2E]">Gmail</span>
              <div className="relative">
                <AtSign className="absolute left-4 top-3.5 text-[#9090AA]" size={18} />
                <input className={fieldStyle} type="email" value={form.gmail} onChange={(e) => update("gmail", e.target.value)} placeholder="minh@example.com" required />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-extrabold text-[#1A1A2E]">Mat khau</span>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-3.5 text-[#9090AA]" size={18} />
                <input
                  className={`${fieldStyle} pr-12`}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Toi thieu 8 ky tu"
                  minLength={mode === "register" ? 8 : undefined}
                  required
                />
                <button type="button" className="absolute right-4 top-3.5 text-[#9090AA]" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && <div className="rounded-2xl border-2 border-[#ff947a]/40 bg-[#fff3ef] px-4 py-3 text-sm font-bold text-[#b44f37]">{error}</div>}
            {message && <div className="rounded-2xl border-2 border-[#2f8a89]/35 bg-[#ebf9f8] px-4 py-3 text-sm font-bold text-[#1c6a69]">{message}</div>}

            <button
              type="submit"
              disabled={loading}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-[22px] text-base font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background: "#ff947a",
                boxShadow: "4px 4px 0 rgba(255,148,122,0.32)",
              }}
            >
              {loading ? "Dang xu ly..." : copy.button}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="mt-5 text-center text-sm font-bold text-[#4A4A6A]">
            {mode === "login" ? "Chua co tai khoan?" : "Da co tai khoan?"}{" "}
            <button className="font-black text-[#ff947a]" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Dang ky ngay" : "Dang nhap"}
            </button>
          </p>

          <div className="mt-6 rounded-3xl bg-[#FAFAF8] p-4" style={{ border: "2px dashed rgba(255,148,122,0.4)" }}>
            <p className="text-center text-xs font-bold leading-5 text-[#9090AA]">
              Bang cach tiep tuc, ban dong y de GR1 luu token dang nhap tren trinh duyet nay va su dung ho so cho cac tinh nang ca nhan hoa.
            </p>
          </div>

          <Link to="/" className="mt-5 block text-center text-sm font-extrabold text-[#ff947a]">
            Quay ve trang chu
          </Link>
        </section>
      </div>
    </div>
  );
}
