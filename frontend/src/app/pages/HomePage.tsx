import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { getUniversities, toUiUniversity } from "../services/api";
import type { UiUniversity } from "../types/api";

const ink = "#2B2722";
const paper = "#F4EEE1";
const paperLight = "#FBF7EE";
const terracotta = "#C2603F";
const honey = "#CE9B4E";
const teal = "#2E6A62";
const muted = "#94806A";

/** Hand-drawn sparkline: turn a series into an SVG path + dots (matches the mock grid). */
function spark(values: number[]) {
  const W = 128, H = 46, p = 6, n = values.length;
  const mn = Math.min(...values), mx = Math.max(...values), rng = mx - mn || 1;
  const pts = values.map((v, i) => ({
    x: +(p + (i * (W - 2 * p)) / (n - 1)).toFixed(1),
    y: +(H - p - ((v - mn) / rng) * (H - 2 * p)).toFixed(1),
  }));
  const path = pts.map((pt, i) => (i ? "L" : "M") + pt.x + " " + pt.y).join(" ");
  return { path, dots: pts, last: values[values.length - 1].toFixed(1) };
}

const trends = [
  { name: "CNTT", vals: [24.5, 25.5, 26.2, 27.5, 28.5], color: terracotta },
  { name: "Y đa khoa", vals: [27.5, 27.8, 28.0, 28.5, 29.0], color: "#9B6A78" },
  { name: "Kinh tế QT", vals: [25.5, 25.8, 26.2, 27.0, 27.5], color: teal },
  { name: "Dược học", vals: [26.5, 27.0, 27.5, 27.8, 28.0], color: honey },
  { name: "Ngoại thương", vals: [25.0, 25.5, 26.5, 27.0, 27.3], color: "#7E8F5E" },
];

const quickStart = [
  { label: "Tìm trường", desc: "Khám phá hơn 200 trường đại học", href: "/truong", shadow: terracotta, rot: "-1.2deg" },
  { label: "Tìm ngành", desc: "Hơn 500 ngành đào tạo", href: "/nganh", shadow: teal, rot: "1deg" },
  { label: "Xếp hạng", desc: "Bảng vàng trường ĐH 2025", href: "/xep-hang", shadow: honey, rot: "-0.6deg" },
  { label: "Hồ sơ tôi", desc: "Tính điểm học lực cá nhân", href: "/ho-so", shadow: "#9B6A78", rot: "1.4deg" },
];

const quickTags = ["CNTT", "Y khoa", "Kinh tế", "Ngoại thương", "AI"];

function QuickStartIcon({ i }: { i: number }) {
  if (i === 0)
    return (
      <svg width="54" height="54" viewBox="0 0 54 54" style={{ overflow: "visible", marginBottom: 12 }}>
        <path d="M27 14 C 19 9, 9 10, 7 12 L7 42 C 11 39, 21 39, 27 44 C 33 39, 43 39, 47 42 L47 12 C 45 10, 35 9, 27 14 Z" fill={terracotta} fillOpacity="0.18" stroke={ink} strokeWidth="2.2" strokeLinejoin="round" filter="url(#inkrough)" />
        <path d="M27 14 L27 44" stroke={ink} strokeWidth="2.2" />
        <path d="M12 20 L22 19 M12 26 L21 25 M32 19 L42 20 M33 25 L42 26" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  if (i === 1)
    return (
      <svg width="54" height="54" viewBox="0 0 54 54" style={{ overflow: "visible", marginBottom: 12 }}>
        <circle cx="23" cy="23" r="13" fill={teal} fillOpacity="0.16" stroke={ink} strokeWidth="2.2" filter="url(#inkrough)" />
        <path d="M33 33 L45 45" stroke={ink} strokeWidth="2.6" strokeLinecap="round" filter="url(#inkrough2)" />
        <path d="M18 21 C 20 17, 26 17, 28 21" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  if (i === 2)
    return (
      <svg width="54" height="54" viewBox="0 0 54 54" style={{ overflow: "visible", marginBottom: 12 }}>
        <path d="M17 12 L37 12 L37 20 C 37 28, 31 32, 27 32 C 23 32, 17 28, 17 20 Z" fill={honey} fillOpacity="0.2" stroke={ink} strokeWidth="2.2" strokeLinejoin="round" filter="url(#inkrough)" />
        <path d="M17 15 C 10 15, 10 24, 18 25 M37 15 C 44 15, 44 24, 36 25" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" filter="url(#inkrough2)" />
        <path d="M27 32 L27 39 M21 42 L33 42" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" style={{ overflow: "visible", marginBottom: 12 }}>
      <circle cx="27" cy="19" r="9" fill="#9B6A78" fillOpacity="0.2" stroke={ink} strokeWidth="2.2" filter="url(#inkrough)" />
      <path d="M12 44 C 12 33, 20 30, 27 30 C 34 30, 42 33, 42 44" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" filter="url(#inkrough2)" />
    </svg>
  );
}

function FeatureIcon({ i }: { i: number }) {
  if (i === 0)
    return (
      <svg width="76" height="76" viewBox="0 0 76 76" style={{ overflow: "visible", marginBottom: 6 }}>
        <path d="M38 12 C 26 12, 18 22, 20 34 C 21 42, 30 46, 30 52 L46 52 C 46 46, 55 42, 56 34 C 58 22, 50 12, 38 12 Z" fill={honey} fillOpacity="0.2" stroke={ink} strokeWidth="2.4" strokeLinejoin="round" filter="url(#inkrough)" />
        <path d="M31 58 L45 58 M33 63 L43 63" stroke={ink} strokeWidth="2.4" strokeLinecap="round" filter="url(#inkrough2)" />
        <g stroke={honey} strokeWidth="2.4" strokeLinecap="round" filter="url(#inkrough2)">
          <path d="M16 16 L11 11" /><path d="M60 16 L65 11" /><path d="M38 6 L38 0" />
        </g>
      </svg>
    );
  if (i === 1)
    return (
      <svg width="76" height="76" viewBox="0 0 76 76" style={{ overflow: "visible", marginBottom: 6 }}>
        <rect x="16" y="14" width="44" height="50" rx="6" fill={terracotta} fillOpacity="0.16" stroke={ink} strokeWidth="2.4" filter="url(#inkrough)" />
        <path d="M27 10 L49 10 C 51 10, 51 18, 49 18 L27 18 C 25 18, 25 10, 27 10 Z" fill={paperLight} stroke={ink} strokeWidth="2.2" filter="url(#inkrough2)" />
        <path d="M24 30 L40 30 M24 38 L48 38 M24 46 L44 46 M24 54 L36 54" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" style={{ overflow: "visible", marginBottom: 6 }}>
      <path d="M26 40 L26 60 L18 60 L18 40 Z" fill="#7E8F5E" fillOpacity="0.3" stroke={ink} strokeWidth="2.2" filter="url(#inkrough2)" />
      <path d="M42 28 L42 60 L34 60 L34 28 Z" fill={teal} fillOpacity="0.3" stroke={ink} strokeWidth="2.2" filter="url(#inkrough2)" />
      <path d="M58 18 L58 60 L50 60 L50 18 Z" fill={terracotta} fillOpacity="0.3" stroke={ink} strokeWidth="2.2" filter="url(#inkrough2)" />
      <path d="M14 60 L64 60" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 30 C 30 22, 44 26, 60 12" stroke={honey} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeDasharray="1 7" filter="url(#inkrough)" />
    </svg>
  );
}

const features = [
  { title: "Tìm ngành hợp gu", desc: "Trả lời vài câu hỏi vui, bunik gợi ý ngành học hợp tính cách & sở thích của bạn." },
  { title: "Tính điểm học lực", desc: "Nhập điểm các môn, xem ngay khả năng đỗ vào những ngành bạn mơ ước." },
  { title: "So sánh & xếp hạng", desc: "Đặt 2-3 ngành cạnh nhau, soi điểm chuẩn, học phí, cơ hội việc làm." },
];

export default function HomePage() {
  const [searchValue, setSearchValue] = useState("");
  const [universities, setUniversities] = useState<UiUniversity[]>([]);
  const [universitiesLoading, setUniversitiesLoading] = useState(true);
  const [universitiesError, setUniversitiesError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getUniversities({ page_size: 10, ordering: "name" })
      .then((res) => setUniversities(res.results.map(toUiUniversity)))
      .catch(() => setUniversitiesError(true))
      .finally(() => setUniversitiesLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) navigate(`/truong?search=${encodeURIComponent(searchValue)}`);
  };

  return (
    <div>
      {/* ===== HERO ===== */}
      <section
        style={{ maxWidth: 1200, margin: "0 auto", padding: "46px 24px 30px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 36 }}
      >
        <div style={{ flex: "1 1 440px", minWidth: 300 }}>
          <div
            style={{
              animation: "riseIn .7s both",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: paperLight,
              border: `2px solid ${ink}`,
              borderRadius: "20px 13px 18px 14px/14px 18px 13px 20px",
              padding: "6px 14px 6px 11px",
              boxShadow: `3px 3px 0 ${honey}`,
              rotate: "-1.4deg",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" style={{ overflow: "visible", flex: "none" }}>
              <path d="M9 2 L11 7 L16 8 L11 9.5 L9 15 L7 9.5 L2 8 L7 7 Z" fill={honey} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" filter="url(#inkrough2)" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 13, color: ink }}>Mùa tuyển sinh 2025 đã mở cổng</span>
          </div>

          <h1
            style={{
              animation: "riseIn .7s both .05s",
              fontFamily: "'Shantell Sans', cursive",
              fontWeight: 700,
              fontSize: "clamp(2.5rem,5.4vw,4.2rem)",
              lineHeight: 1.04,
              color: ink,
              margin: "18px 0 0",
              letterSpacing: "-0.6px",
            }}
          >
            Khám phá{" "}
            <span style={{ position: "relative", display: "inline-block", color: terracotta, whiteSpace: "nowrap" }}>
              con đường
              <svg viewBox="0 0 280 96" style={{ position: "absolute", left: -14, top: -12, width: "calc(100% + 28px)", height: "calc(100% + 24px)", overflow: "visible", pointerEvents: "none" }}>
                <path
                  style={{ animation: "drawIn 1.3s both .4s" }}
                  d="M40 64 C 8 52, 14 20, 92 14 C 196 6, 274 18, 268 50 C 264 80, 150 92, 70 84 C 30 80, 24 70, 40 58"
                  pathLength={1}
                  strokeDasharray="1"
                  stroke={terracotta}
                  strokeWidth="3.4"
                  fill="none"
                  strokeLinecap="round"
                  filter="url(#inkrough)"
                />
              </svg>
            </span>
            <br />
            của riêng bạn{" "}
            <svg width="42" height="42" viewBox="0 0 42 42" style={{ display: "inline-block", verticalAlign: "0.3em", marginLeft: 2, overflow: "visible", animation: "twinkle 3.4s ease-in-out infinite" }}>
              <path d="M21 4 L24 17 L37 21 L24 25 L21 38 L18 25 L5 21 L18 17 Z" fill={honey} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" filter="url(#inkrough2)" />
            </svg>
          </h1>

          <p style={{ animation: "riseIn .7s both .1s", maxWidth: 480, color: "#5A5046", fontSize: 17, lineHeight: 1.7, margin: "20px 0 26px" }}>
            Tra cứu điểm chuẩn, xếp hạng trường và tìm ngành hợp với mình — gói gọn trong một cuốn sổ tay hướng nghiệp cho học sinh THPT.
          </p>

          <form onSubmit={handleSearch} style={{ animation: "riseIn .7s both .15s" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: paperLight,
                border: `2.5px solid ${ink}`,
                borderRadius: "22px 16px 20px 17px/17px 20px 16px 22px",
                boxShadow: `6px 6px 0 ${terracotta}`,
                padding: "7px 7px 7px 16px",
                maxWidth: 530,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" style={{ flex: "none", overflow: "visible" }}>
                <circle cx="10.5" cy="10.5" r="7" fill="none" stroke={ink} strokeWidth="2.1" filter="url(#inkrough2)" />
                <path d="M15.6 15.6 L21 21" stroke={ink} strokeWidth="2.4" strokeLinecap="round" filter="url(#inkrough2)" />
              </svg>
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Tìm trường, ngành, điểm chuẩn…"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "'Be Vietnam Pro'", fontSize: 15.5, color: ink, padding: "6px 0" }}
              />
              <button
                type="submit"
                className="bunik-press"
                style={{
                  flex: "none",
                  background: terracotta,
                  border: `2px solid ${ink}`,
                  borderRadius: "15px 11px 14px 12px/12px 14px 11px 15px",
                  color: paperLight,
                  fontFamily: "'Be Vietnam Pro'",
                  fontWeight: 700,
                  fontSize: 14.5,
                  padding: "10px 20px",
                  ["--sh" as string]: ink,
                }}
              >
                Tìm
              </button>
            </div>
          </form>

          <div style={{ animation: "riseIn .7s both .2s", display: "flex", flexWrap: "wrap", gap: 9, marginTop: 18, alignItems: "center" }}>
            <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 19, color: muted, marginRight: 2 }}>gợi ý:</span>
            {quickTags.map((t) => (
              <Link
                key={t}
                to={`/nganh?search=${encodeURIComponent(t)}`}
                style={{
                  background: paper,
                  border: `2px solid ${ink}`,
                  borderRadius: "16px 11px 15px 12px/12px 15px 11px 16px",
                  padding: "5px 13px",
                  fontWeight: 600,
                  fontSize: 13,
                  color: ink,
                  textDecoration: "none",
                }}
              >
                {t}
              </Link>
            ))}
          </div>
        </div>

        {/* Hero art */}
        <div style={{ animation: "riseIn .85s both .1s", flex: "1 1 360px", minWidth: 300, display: "flex", justifyContent: "center" }}>
          <svg viewBox="0 0 400 380" style={{ width: "100%", maxWidth: 420, height: "auto", overflow: "visible" }}>
            <ellipse cx="200" cy="350" rx="170" ry="20" fill={muted} opacity="0.16" />
            <path d="M0 332 C 90 296, 150 318, 230 308 C 300 300, 360 318, 400 304 L400 380 L0 380 Z" fill="#7E8F5E" fillOpacity="0.22" stroke={ink} strokeWidth="2" filter="url(#inkrough)" />
            <path d="M150 318 C 220 300, 300 300, 400 286 L400 332 C 320 318, 250 322, 180 332 Z" fill={honey} fillOpacity="0.26" stroke={ink} strokeWidth="1.6" filter="url(#inkrough2)" />
            <g style={{ transformOrigin: "330px 78px", animation: "spinslow 80s linear infinite" }}>
              <circle cx="330" cy="78" r="26" fill={honey} stroke={ink} strokeWidth="2" filter="url(#inkrough)" />
              <g stroke={honey} strokeWidth="3" strokeLinecap="round" filter="url(#inkrough2)">
                <path d="M330 38 L330 26" /><path d="M330 118 L330 130" /><path d="M290 78 L278 78" /><path d="M370 78 L382 78" />
                <path d="M302 50 L294 42" /><path d="M358 50 L366 42" /><path d="M302 106 L294 114" /><path d="M358 106 L366 114" />
              </g>
            </g>
            <path style={{ animation: "drawIn 1.3s both .4s" }} d="M70 352 C 120 330, 90 296, 150 284 C 210 272, 200 236, 256 224 C 300 214, 296 196, 308 176" pathLength={1} stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="1" filter="url(#inkrough)" />
            <g stroke={terracotta} strokeWidth="3.4" strokeLinecap="round" strokeDasharray="0.5 9" filter="url(#inkrough2)">
              <path d="M70 352 C 120 330, 90 296, 150 284 C 210 272, 200 236, 256 224 C 300 214, 296 196, 308 176" pathLength={60} fill="none" />
            </g>
            <g style={{ transformOrigin: "308px 176px" }}>
              <path d="M308 178 L308 120" stroke={ink} strokeWidth="3" strokeLinecap="round" filter="url(#inkrough)" />
              <g style={{ transformOrigin: "308px 124px", animation: "waveflag 2.6s ease-in-out infinite" }}>
                <path d="M308 122 L344 130 L308 146 Z" fill={terracotta} stroke={ink} strokeWidth="2" strokeLinejoin="round" filter="url(#inkrough2)" />
              </g>
              <circle cx="308" cy="178" r="3.4" fill={ink} />
            </g>
            <g style={{ transformOrigin: "74px 318px", animation: "floaty2 5s ease-in-out infinite" }}>
              <path d="M52 318 L52 296 C 52 293, 74 290, 74 296 L74 318 Z" fill={paperLight} stroke={ink} strokeWidth="2" filter="url(#inkrough2)" />
              <path d="M74 296 C 74 290, 96 293, 96 296 L96 318 L74 318 Z" fill={teal} fillOpacity="0.3" stroke={ink} strokeWidth="2" filter="url(#inkrough2)" />
              <path d="M74 296 L74 318" stroke={ink} strokeWidth="2" />
              <path d="M58 302 L68 301 M58 307 L67 306" stroke={ink} strokeWidth="1.4" strokeLinecap="round" />
            </g>
            <g stroke={ink} strokeWidth="2.2" strokeLinecap="round" fill="none" filter="url(#inkrough2)" style={{ transformOrigin: "90px 90px", animation: "floaty 6s ease-in-out infinite" }}>
              <path d="M64 92 C 70 84, 76 84, 80 92" /><path d="M80 92 C 84 84, 90 84, 96 92" />
            </g>
            <g style={{ transformOrigin: "250px 110px", animation: "twinkle 2.8s ease-in-out infinite" }}>
              <path d="M250 96 L253 107 L264 110 L253 113 L250 124 L247 113 L236 110 L247 107 Z" fill={honey} stroke={ink} strokeWidth="1.3" strokeLinejoin="round" filter="url(#inkrough2)" />
            </g>
            <g style={{ transformOrigin: "368px 200px", animation: "twinkle 3s ease-in-out infinite .3s" }}>
              <path d="M368 192 L370 199 L377 201 L370 203 L368 210 L366 203 L359 201 L366 199 Z" fill={terracotta} stroke={ink} strokeWidth="1.1" strokeLinejoin="round" filter="url(#inkrough2)" />
            </g>
          </svg>
        </div>
      </section>

      {/* ===== BẮT ĐẦU NHANH ===== */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 24px" }}>
        <div style={{ marginBottom: 30 }}>
          <h2 style={{ position: "relative", display: "inline-block", fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: "clamp(1.7rem,3.4vw,2.4rem)", color: ink, margin: 0 }}>
            Bắt đầu từ đâu cũng được
            <svg viewBox="0 0 300 14" style={{ position: "absolute", left: 0, bottom: -12, width: "64%", height: 12, overflow: "visible" }}>
              <path style={{ animation: "drawIn 1.3s both .4s" }} pathLength={1} strokeDasharray="1" d="M3 7 C 70 2, 150 12, 230 5 C 260 2, 280 6, 297 5" stroke={honey} strokeWidth="4" fill="none" strokeLinecap="round" filter="url(#inkrough)" />
            </svg>
          </h2>
          <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 21, color: muted, margin: "18px 0 0" }}>— chọn một lối, rồi cứ đi thôi</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 22 }}>
          {quickStart.map((s, i) => (
            <Link
              key={s.label}
              to={s.href}
              className="bunik-card"
              style={{
                position: "relative",
                background: paperLight,
                border: `2px solid ${ink}`,
                borderRadius: i % 2 === 0 ? "18px 24px 19px 22px/22px 19px 24px 18px" : "24px 18px 22px 19px/19px 22px 18px 24px",
                boxShadow: `6px 7px 0 ${s.shadow}`,
                padding: 22,
                textDecoration: "none",
                color: ink,
                ["--rot" as string]: s.rot,
              }}
            >
              <QuickStartIcon i={i} />
              <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 19, color: ink, margin: 0 }}>{s.label}</p>
              <p style={{ color: "#5A5046", fontSize: 13.5, margin: "6px 0 0", lineHeight: 1.5 }}>{s.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== TOP 10 TRƯỜNG ===== */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "50px 24px 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 14, marginBottom: 26 }}>
          <div>
            <h2 style={{ position: "relative", display: "inline-block", fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: "clamp(1.7rem,3.4vw,2.4rem)", color: ink, margin: 0 }}>
              Bảng vàng trường ĐH
              <svg viewBox="0 0 320 14" style={{ position: "absolute", left: 0, bottom: -11, width: "78%", height: 12, overflow: "visible" }}>
                <path style={{ animation: "drawIn 1.2s both" }} pathLength={1} strokeDasharray="1" d="M3 8 C 80 2, 170 13, 250 5 C 285 2, 305 7, 317 5" stroke={terracotta} strokeWidth="4" fill="none" strokeLinecap="round" filter="url(#inkrough)" />
              </svg>
            </h2>
            <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 21, color: muted, margin: "18px 0 0" }}>— top 10 mùa tuyển sinh 2025</p>
          </div>
          <Link to="/truong" style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14.5, color: terracotta, padding: "6px 2px", textDecoration: "none" }}>
            Xem tất cả 200+ trường
            <svg width="26" height="12" viewBox="0 0 26 12" style={{ overflow: "visible" }}>
              <path d="M1 6 L22 6 M16 1 L23 6 L16 11" stroke={terracotta} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#inkrough2)" />
            </svg>
          </Link>
        </div>

        <div className="hide-scrollbar" style={{ display: "flex", gap: 20, overflowX: "auto", padding: "10px 4px 22px", scrollSnapType: "x mandatory" }}>
          {universitiesLoading ? (
            <div style={{ flex: "1 0 100%", minHeight: 174, display: "grid", placeItems: "center", border: `2px dashed ${muted}`, borderRadius: "18px 14px 20px 16px/16px 20px 14px 18px", background: "rgba(251,247,238,.55)" }}>
              <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 19, color: muted, margin: 0 }}>đang mở bảng vàng…</p>
            </div>
          ) : null}
          {!universitiesLoading && universitiesError ? (
            <div style={{ flex: "1 0 100%", minHeight: 174, display: "grid", placeItems: "center", padding: 20, border: `2px dashed ${muted}`, borderRadius: "18px 14px 20px 16px/16px 20px 14px 18px", background: "rgba(251,247,238,.55)", textAlign: "center" }}>
              <div><p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 17, color: ink, margin: 0 }}>Bảng vàng đang được cập nhật</p><p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 17, color: muted, margin: "5px 0 0" }}>Bạn vẫn có thể mở danh sách trường để tra cứu.</p></div>
            </div>
          ) : null}
          {universities.map((u) => (
            <Link
              key={u.id}
              to={`/truong/${u.id}`}
              className="bunik-lift"
              style={{
                scrollSnapAlign: "start",
                flex: "none",
                width: 248,
                position: "relative",
                background: paperLight,
                border: `2px solid ${ink}`,
                borderRadius: "20px 24px 19px 23px/23px 19px 24px 20px",
                boxShadow: "6px 7px 0 rgba(43,39,34,0.14)",
                padding: "20px 18px 18px",
                textDecoration: "none",
                color: ink,
              }}
            >
              <span style={{ position: "absolute", top: -15, left: -12, width: 46, height: 46, display: "grid", placeItems: "center" }}>
                <svg viewBox="0 0 46 46" style={{ position: "absolute", inset: 0, width: 46, height: 46, overflow: "visible" }}>
                  <path d="M23 4 C 12 3, 4 11, 5 23 C 4 35, 13 43, 23 42 C 34 43, 42 34, 41 23 C 42 12, 33 3, 23 4 Z" fill={u.color} stroke={ink} strokeWidth="2" filter="url(#inkrough)" />
                </svg>
                <span style={{ position: "relative", fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 19, color: paperLight }}>{u.ranking}</span>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "6px 0 14px", paddingLeft: 26 }}>
                <span style={{ width: 46, height: 46, flex: "none", borderRadius: "13px 16px 12px 15px/15px 12px 16px 13px", border: `2px solid ${ink}`, background: paper, display: "grid", placeItems: "center", fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 15, color: u.color }}>
                  {u.abbr.slice(0, 4)}
                </span>
              </div>
              <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 18.5, lineHeight: 1.18, color: ink, margin: 0, minHeight: 44 }}>{u.name}</p>
              <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 18, color: muted, margin: "6px 0 14px" }}>{u.city}</p>
              <div style={{ height: 1, background: "repeating-linear-gradient(90deg,#94806A 0 7px,transparent 7px 13px)", opacity: 0.5, marginBottom: 13 }} />
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 16, color: muted, margin: 0, lineHeight: 1 }}>Điểm xếp hạng</p>
                  <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 25, color: u.color, margin: "3px 0 0", lineHeight: 1 }}>{u.overallScore}</p>
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <svg key={i} width="15" height="15" viewBox="0 0 18 18" style={{ overflow: "visible" }}>
                      <path d="M9 2 L11 7 L16 8 L11 9.5 L9 15 L7 9.5 L2 8 L7 7 Z" fill={i <= Math.round(u.userRating) ? honey : "none"} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" filter="url(#inkrough2)" />
                    </svg>
                  ))}
                </div>
              </div>
            </Link>
          ))}
          <div style={{ flex: "none", width: 8 }} />
        </div>
      </section>

      {/* ===== XU HƯỚNG ĐIỂM CHUẨN ===== */}
      <section style={{ position: "relative", marginTop: 30 }}>
        <svg viewBox="0 0 1200 30" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 28 }}>
          <path d="M0 20 C 160 6, 340 26, 560 14 C 760 4, 940 26, 1120 14 C 1160 11, 1180 15, 1200 13 L1200 30 L0 30 Z" fill={teal} fillOpacity="0.1" filter="url(#inkrough)" />
        </svg>
        <div style={{ background: "linear-gradient(180deg,rgba(46,106,98,0.09),rgba(46,106,98,0.04))" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "30px 24px 50px" }}>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ position: "relative", display: "inline-block", fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: "clamp(1.7rem,3.4vw,2.4rem)", color: ink, margin: 0 }}>
                Điểm chuẩn đang trôi về đâu?
                <svg viewBox="0 0 360 14" style={{ position: "absolute", left: 0, bottom: -11, width: "62%", height: 12, overflow: "visible" }}>
                  <path style={{ animation: "drawIn 1.2s both" }} pathLength={1} strokeDasharray="1" d="M3 8 C 90 2, 200 13, 290 5 C 325 2, 345 7, 357 5" stroke={teal} strokeWidth="4" fill="none" strokeLinecap="round" filter="url(#inkrough)" />
                </svg>
              </h2>
              <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 21, color: "#5A7570", margin: "18px 0 0" }}>— vẽ tay từ dữ liệu 5 năm gần nhất (2021 – 2025)</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(232px,1fr))", gap: 20 }}>
              {trends.map((tr) => {
                const s = spark(tr.vals);
                return (
                  <Link
                    key={tr.name}
                    to="/nganh"
                    className="bunik-lift"
                    style={{
                      background: paperLight,
                      border: `2px solid ${ink}`,
                      borderRadius: "18px 22px 17px 21px/21px 17px 22px 18px",
                      boxShadow: "5px 6px 0 rgba(43,39,34,0.12)",
                      padding: 18,
                      textDecoration: "none",
                      color: ink,
                      display: "block",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                      <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 17, color: ink, margin: 0 }}>{tr.name}</p>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12.5, color: tr.color, background: paper, border: `1.5px solid ${tr.color}`, borderRadius: "11px 8px 10px 7px/7px 10px 8px 11px", padding: "2px 9px" }}>
                        <svg width="11" height="9" viewBox="0 0 11 9" style={{ overflow: "visible" }}>
                          <path d="M1 8 L5 2 L11 0" stroke={tr.color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        tăng
                      </span>
                    </div>
                    <svg viewBox="0 0 128 46" preserveAspectRatio="none" style={{ width: "100%", height: 54, overflow: "visible", display: "block" }}>
                      <path d="M6 40 L122 40" stroke={muted} strokeWidth="1" strokeDasharray="3 4" opacity=".5" />
                      <path d={s.path} pathLength={1} strokeDasharray="1" style={{ animation: "drawIn 1.4s both" }} stroke={tr.color} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#inkrough2)" />
                      {s.dots.map((d, i) => (
                        <circle key={i} cx={d.x} cy={d.y} r="2.6" fill={paperLight} stroke={tr.color} strokeWidth="1.8" />
                      ))}
                    </svg>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
                      <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 16, color: muted }}>Điểm chuẩn 2025</span>
                      <span style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 23, color: tr.color, lineHeight: 1 }}>{s.last}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <svg viewBox="0 0 1200 30" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 28, transform: "scaleY(-1)" }}>
          <path d="M0 20 C 160 6, 340 26, 560 14 C 760 4, 940 26, 1120 14 C 1160 11, 1180 15, 1200 13 L1200 30 L0 30 Z" fill={teal} fillOpacity="0.1" filter="url(#inkrough)" />
        </svg>
      </section>

      {/* ===== TÍNH NĂNG ===== */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "46px 24px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 38 }}>
          <h2 style={{ position: "relative", display: "inline-block", fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: "clamp(1.7rem,3.4vw,2.4rem)", color: ink, margin: 0 }}>
            Cả hộp bút trong một chỗ
            <svg viewBox="0 0 340 14" style={{ position: "absolute", left: "8%", bottom: -11, width: "84%", height: 12, overflow: "visible" }}>
              <path style={{ animation: "drawIn 1.2s both" }} pathLength={1} strokeDasharray="1" d="M3 8 C 90 2, 200 13, 290 5 C 320 2, 332 7, 337 6" stroke={honey} strokeWidth="4" fill="none" strokeLinecap="round" filter="url(#inkrough)" />
            </svg>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 26 }}>
          {features.map((f, i) => (
            <div key={f.title} style={{ textAlign: "center", padding: "0 8px" }}>
              <FeatureIcon i={i} />
              <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 19, color: ink, margin: "4px 0 0" }}>{f.title}</p>
              <p style={{ color: "#5A5046", fontSize: 14, lineHeight: 1.6, margin: "8px 0 0" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 16px" }}>
        <div
          style={{
            position: "relative",
            background: terracotta,
            border: `2.5px solid ${ink}`,
            borderRadius: "30px 38px 28px 36px/36px 28px 38px 30px",
            boxShadow: `9px 11px 0 ${ink}`,
            padding: "clamp(30px,5vw,52px)",
            overflow: "hidden",
          }}
        >
          <svg viewBox="0 0 200 200" style={{ position: "absolute", right: -30, top: -30, width: 230, height: 230, opacity: 0.16, overflow: "visible" }}>
            <path d="M100 20 L116 78 L176 80 L128 116 L146 174 L100 138 L54 174 L72 116 L24 80 L84 78 Z" fill="none" stroke={paperLight} strokeWidth="3" />
          </svg>
          <svg viewBox="0 0 100 100" style={{ position: "absolute", left: -20, bottom: -26, width: 140, height: 140, opacity: 0.14, overflow: "visible", animation: "spinslow 60s linear infinite" }}>
            <circle cx="50" cy="50" r="34" fill="none" stroke={paperLight} strokeWidth="3" strokeDasharray="2 12" />
          </svg>
          <div style={{ position: "relative", maxWidth: 620 }}>
            <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 22, color: "#F6D9C9", margin: "0 0 6px" }}>ê, còn chần chừ gì nữa —</p>
            <h2 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: "clamp(2rem,4.4vw,3.1rem)", lineHeight: 1.08, color: paperLight, margin: 0, letterSpacing: "-0.4px" }}>
              Bắt đầu vẽ con đường<br />vào đại học của bạn
            </h2>
            <p style={{ color: "#FBE9DF", fontSize: 16, lineHeight: 1.7, margin: "18px 0 26px", maxWidth: 500 }}>
              Miễn phí, không cần tài khoản để tra cứu. Tạo hồ sơ để lưu ngành yêu thích và theo dõi điểm chuẩn theo thời gian thực.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <Link
                to="/ho-so"
                className="bunik-press"
                style={{
                  background: paperLight,
                  border: `2.5px solid ${ink}`,
                  borderRadius: "18px 13px 16px 14px/14px 16px 13px 18px",
                  color: ink,
                  fontWeight: 800,
                  fontSize: 15.5,
                  padding: "13px 26px",
                  textDecoration: "none",
                  ["--sh" as string]: ink,
                }}
              >
                Tạo hồ sơ miễn phí
              </Link>
              <Link
                to="/truong"
                style={{
                  background: "transparent",
                  border: `2.5px solid ${paperLight}`,
                  borderRadius: "13px 18px 14px 16px/16px 14px 18px 13px",
                  color: paperLight,
                  fontWeight: 700,
                  fontSize: 15.5,
                  padding: "13px 26px",
                  textDecoration: "none",
                }}
              >
                Dạo quanh trường ĐH
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
