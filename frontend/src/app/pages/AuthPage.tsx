import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { B, SketchHeading, cardStyle } from "../components/bunik";
import { login, register } from "../services/api";

type Mode = "login" | "register";

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialMode: Mode = location.pathname.includes("dang-ky") ? "register" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);
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
            title: "Chào mừng tới bunik",
            subtitle: "đăng nhập để lưu ngành và theo dõi điểm chuẩn",
            submit: "Đăng nhập",
          }
        : {
            title: "Tạo tài khoản bunik",
            subtitle: "đăng ký để bắt đầu vẽ con đường của riêng bạn",
            submit: "Đăng ký",
          },
    [mode],
  );

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setMessage("");
    navigate(next === "login" ? "/dang-nhap" : "/dang-ky", { replace: true });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response =
        mode === "login"
          ? await login({ gmail: form.gmail.trim(), password: form.password })
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bunik-page" style={{ padding: "clamp(34px,7vw,76px) 16px 56px" }}>
      <div style={{ width: "min(100%, 570px)", margin: "0 auto", position: "relative" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: -34, top: 80, zIndex: 2, color: B.honey, fontFamily: "'Shantell Sans', cursive", fontSize: 38, rotate: "-12deg", animation: "twinkle 3s ease-in-out infinite" }}>✦</span>
        <span aria-hidden="true" style={{ position: "absolute", right: -28, top: 210, zIndex: 2, color: B.teal, fontFamily: "'Shantell Sans', cursive", fontSize: 30, rotate: "9deg", animation: "floaty2 5s ease-in-out infinite" }}>⌁</span>

        <section style={{ ...cardStyle({ radius: "22px 17px 24px 19px/19px 24px 17px 22px", shadow: `8px 8px 0 ${B.terracotta}` }), position: "relative", overflow: "hidden", padding: "clamp(24px,5vw,42px)" }}>
          <svg aria-hidden="true" viewBox="0 0 570 105" preserveAspectRatio="none" style={{ position: "absolute", inset: "0 0 auto", width: "100%", height: 90, opacity: .25 }}>
            <path d="M-10 74 C 85 20, 160 96, 250 48 C 340 0, 430 92, 590 28 L590 -10 L-10 -10 Z" fill={B.honey} filter="url(#inkrough)" />
            <path d="M-10 88 C 100 38, 180 105, 305 63 C 405 30, 480 76, 590 50" fill="none" stroke={B.ink} strokeWidth="2" filter="url(#inkrough2)" />
          </svg>

          <div style={{ position: "relative", textAlign: "center", marginBottom: 26 }}>
            <SketchHeading color={mode === "login" ? B.terracotta : B.teal} width="82%" size="clamp(1.75rem,5vw,2.25rem)">
              {copy.title}
            </SketchHeading>
            <p className="bunik-note-text" style={{ fontSize: 18, lineHeight: 1.45, margin: "20px auto 0", maxWidth: 390 }}>{copy.subtitle}</p>
          </div>

          <div role="tablist" aria-label="Chọn chế độ tài khoản" style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 5, marginBottom: 24, border: `2px solid ${B.ink}`, borderRadius: "16px 12px 15px 13px/13px 15px 12px 16px", background: B.paper }}>
            {(["login", "register"] as const).map((tab) => (
              <button key={tab} type="button" role="tab" aria-selected={mode === tab} onClick={() => switchMode(tab)} style={{ minHeight: 42, border: 0, borderRadius: "11px 8px 12px 9px/9px 12px 8px 11px", background: mode === tab ? B.ink : "transparent", color: mode === tab ? B.paperLight : B.body, fontWeight: 750 }}>
                {tab === "login" ? "Đăng nhập" : "Đăng ký"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ position: "relative", display: "grid", gap: 16 }}>
            {mode === "register" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
                  <Field label="Tên đăng nhập" icon={<UserRound size={17} />}>
                    <input className="bunik-field" style={{ paddingLeft: 42 }} value={form.user_name} onChange={(event) => update("user_name", event.target.value)} placeholder="bunik_2026" required />
                  </Field>
                  <Field label="Họ và tên" icon={<UserRound size={17} />}>
                    <input className="bunik-field" style={{ paddingLeft: 42 }} value={form.full_name} onChange={(event) => update("full_name", event.target.value)} placeholder="Nguyễn Văn A" required />
                  </Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(100px,.65fr) minmax(180px,1.35fr)", gap: 14 }}>
                  <label>
                    <span style={labelStyle}>Lớp</span>
                    <select className="bunik-field" value={form.grade} onChange={(event) => update("grade", event.target.value)}>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                    </select>
                  </label>
                  <label>
                    <span style={labelStyle}>Ngày sinh</span>
                    <input className="bunik-field" type="date" value={form.dob} onChange={(event) => update("dob", event.target.value)} required />
                  </label>
                </div>

                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={labelStyle}>Giới tính</legend>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[{ value: "MALE", label: "Nam" }, { value: "FEMALE", label: "Nữ" }].map((option) => (
                      <button key={option.value} type="button" className="bunik-chip" data-active={form.gender === option.value} onClick={() => update("gender", option.value)}>{option.label}</button>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : null}

            <Field label="Email" icon={<Mail size={17} />}>
              <input className="bunik-field" style={{ paddingLeft: 42 }} type="email" value={form.gmail} onChange={(event) => update("gmail", event.target.value)} placeholder="ban@email.com" autoComplete="email" required />
            </Field>

            <Field label="Mật khẩu" icon={<LockKeyhole size={17} />}>
              <input className="bunik-field" style={{ paddingLeft: 42, paddingRight: 46 }} type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="Tối thiểu 8 ký tự" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} required />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} style={{ position: "absolute", right: 12, bottom: 11, width: 30, height: 30, display: "grid", placeItems: "center", border: 0, background: "transparent", color: B.muted }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </Field>

            {error ? <p role="alert" style={{ margin: 0, padding: "11px 13px", border: `1.5px solid ${B.rust}`, borderRadius: "12px 9px 13px 10px/10px 13px 9px 12px", background: "rgba(168,75,48,.08)", color: B.rust, fontSize: 13, fontWeight: 700 }}>{error}</p> : null}
            {message ? <p role="status" style={{ margin: 0, padding: "11px 13px", border: `1.5px solid ${B.olive}`, borderRadius: "12px 9px 13px 10px/10px 13px 9px 12px", background: "rgba(126,143,94,.1)", color: B.olive, fontSize: 13, fontWeight: 700 }}>{message}</p> : null}

            <button type="submit" className="bunik-button" disabled={loading} style={{ width: "100%", minHeight: 50, marginTop: 2, fontSize: 15.5 }}>
              {loading ? "Đang xử lý…" : copy.submit}
            </button>
          </form>

          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, margin: "22px 0 16px" }}>
            <span style={{ flex: 1, height: 1, background: `repeating-linear-gradient(90deg,${B.muted} 0 6px,transparent 6px 11px)` }} />
            <span className="bunik-note-text" style={{ fontSize: 16 }}>hoặc</span>
            <span style={{ flex: 1, height: 1, background: `repeating-linear-gradient(90deg,${B.muted} 0 6px,transparent 6px 11px)` }} />
          </div>

          <Link to="/" className="bunik-button bunik-button-secondary" style={{ width: "100%", boxSizing: "border-box" }}>Dạo quanh mà không cần đăng nhập</Link>
          <p className="bunik-note-text" style={{ position: "relative", textAlign: "center", fontSize: 17, margin: "19px 0 0" }}>
            {mode === "login" ? "chưa có tài khoản?" : "đã có tài khoản?"}{" "}
            <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")} style={{ border: 0, padding: 0, background: "none", color: B.terracotta, fontFamily: "inherit", fontSize: "inherit", fontWeight: 700 }}>
              {mode === "login" ? "đăng ký ngay ✦" : "đăng nhập ✦"}
            </button>
          </p>
        </section>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  color: B.body,
  fontSize: 13,
  fontWeight: 750,
  marginBottom: 6,
} as const;

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <label style={{ position: "relative", display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <span aria-hidden="true" style={{ position: "absolute", left: 14, bottom: 14, color: B.muted, zIndex: 1 }}>{icon}</span>
      {children}
    </label>
  );
}
