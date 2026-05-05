import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Search, ArrowRight, TrendingUp, Star, Zap, BarChart3, BookOpen, Award, ChevronRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { getUniversities, toUiUniversity } from "../services/api";
import type { UiUniversity } from "../types/api";

const topMajorTrends = [
  { name: "CNTT", scores: [24.5, 25.5, 26.2, 27.5, 28.5], color: "#5B4FCF" },
  { name: "Y đa khoa", scores: [27.5, 27.8, 28.0, 28.5, 29.0], color: "#FF6B6B" },
  { name: "Kinh tế QT", scores: [25.5, 25.8, 26.2, 27.0, 27.5], color: "#43D9A3" },
  { name: "Dược học", scores: [26.5, 27.0, 27.5, 27.8, 28.0], color: "#FFB347" },
  { name: "Ngoại thương", scores: [25.0, 25.5, 26.5, 27.0, 27.3], color: "#FC8181" },
];

const dotBg = {
  backgroundImage: "radial-gradient(circle, #d0cef0 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  backgroundColor: "#FAFAF8",
};

const handCard = {
  background: "#fff",
  borderRadius: 20,
  border: "2px solid rgba(91,79,207,0.13)",
  boxShadow: "5px 5px 0px rgba(91,79,207,0.10)",
};

function WavyDivider({ color = "#5B4FCF", opacity = 0.06 }: { color?: string; opacity?: number }) {
  return (
    <svg viewBox="0 0 1440 40" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", width: "100%" }}>
      <path
        d="M0,20 C240,40 480,0 720,20 C960,40 1200,5 1440,20 L1440,40 L0,40 Z"
        fill={color}
        fillOpacity={opacity}
      />
    </svg>
  );
}

function SparklineChart({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ year: 2021 + i, score: v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="score"
          stroke={color}
          strokeWidth={2.5}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
          formatter={(v: number) => [`${v}đ`, ""]}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const shortcuts = [
  { icon: BookOpen, label: "Tìm trường", desc: "Khám phá hơn 200 trường ĐH", href: "/truong", color: "#5B4FCF", bg: "#EEF0FF", rotate: "-1deg" },
  { icon: Search, label: "Tìm ngành", desc: "Hơn 500 ngành đào tạo", href: "/nganh", color: "#FF6B6B", bg: "#FFF0F0", rotate: "1.5deg" },
  { icon: Award, label: "Xếp hạng", desc: "Bảng vàng trường ĐH 2025", href: "/xep-hang", color: "#43D9A3", bg: "#EDFFF7", rotate: "-0.5deg" },
  { icon: BarChart3, label: "Hồ sơ tôi", desc: "Tính điểm học lực cá nhân", href: "/ho-so", color: "#FFB347", bg: "#FFF8EE", rotate: "1deg" },
];

const features = [
  {
    icon: "🗺️",
    title: "Hướng nghiệp cá nhân hóa",
    desc: "AI phân tích điểm mạnh và đề xuất ngành nghề phù hợp nhất với bạn",
    color: "#5B4FCF",
  },
  {
    icon: "📊",
    title: "Dữ liệu điểm chuẩn chuẩn xác",
    desc: "Tổng hợp điểm chuẩn 5 năm từ tất cả các trường và phương thức xét tuyển",
    color: "#FF6B6B",
  },
  {
    icon: "🏆",
    title: "Xếp hạng toàn diện",
    desc: "Hệ thống ranking kết hợp điểm chuẩn, mạng xã hội và đánh giá người dùng",
    color: "#43D9A3",
  },
];

export default function HomePage() {
  const [searchValue, setSearchValue] = useState("");
  const [universities, setUniversities] = useState<UiUniversity[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getUniversities({ page_size: 10, ordering: 'name' })
      .then((res) => setUniversities(res.results.map(toUiUniversity)))
      .catch(console.error);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/truong?search=${encodeURIComponent(searchValue)}`);
    }
  };

  return (
    <div style={dotBg}>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(91,79,207,0.08) 0%, rgba(255,107,107,0.05) 50%, rgba(67,217,163,0.05) 100%)",
          }}
        />
        {/* Decorative blobs */}
        <div
          className="absolute top-10 right-10 w-64 h-64 rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, #5B4FCF 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-20 left-10 w-48 h-48 rounded-full opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle, #FF6B6B 0%, transparent 70%)" }}
        />

        <div className="max-w-7xl mx-auto px-6 pt-16 pb-20">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left content */}
            <div className="flex-1 text-center lg:text-left">
              {/* Tag */}
              <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full" style={{ background: "rgba(91,79,207,0.1)", border: "1.5px solid rgba(91,79,207,0.2)" }}>
                <Zap size={14} color="#5B4FCF" />
                <span style={{ color: "#5B4FCF", fontSize: 13, fontWeight: 700 }}>Mùa tuyển sinh 2025 đã bắt đầu!</span>
              </div>

              <h1
                className="mb-4"
                style={{
                  fontFamily: "'Baloo 2', cursive",
                  fontWeight: 800,
                  fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
                  color: "#1A1A2E",
                  lineHeight: 1.15,
                }}
              >
                Khám phá{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, #5B4FCF 0%, #FF6B6B 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  con đường
                </span>
                <br />
                của bạn ✨
              </h1>

              <p
                className="mb-8 max-w-xl mx-auto lg:mx-0"
                style={{ color: "#4A4A6A", fontSize: 17, lineHeight: 1.7 }}
              >
                Tra cứu điểm chuẩn, xếp hạng trường & tìm ngành phù hợp — tất cả trong một nền tảng dành riêng cho học sinh THPT.
              </p>

              {/* Search bar */}
              <form onSubmit={handleSearch}>
                <div
                  className="flex items-center gap-2 p-2"
                  style={{
                    background: "#fff",
                    borderRadius: 24,
                    border: "2.5px solid rgba(91,79,207,0.25)",
                    boxShadow: "5px 5px 0px rgba(91,79,207,0.12)",
                    maxWidth: 520,
                  }}
                >
                  <Search size={20} color="#9090AA" className="ml-3 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Tìm trường, ngành, điểm chuẩn..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="flex-1 outline-none bg-transparent"
                    style={{ color: "#1A1A2E", fontSize: 15, border: "none" }}
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-2xl text-white text-sm flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)",
                      fontWeight: 700,
                      boxShadow: "2px 2px 0px rgba(91,79,207,0.3)",
                    }}
                  >
                    Tìm kiếm
                  </button>
                </div>
              </form>

              {/* Quick tags */}
              <div className="flex flex-wrap gap-2 mt-4 justify-center lg:justify-start">
                {["CNTT", "Y khoa", "Kinh tế", "Ngoại thương", "AI"].map((t) => (
                  <Link
                    key={t}
                    to={`/nganh?search=${t}`}
                    className="px-3 py-1 rounded-full text-xs"
                    style={{
                      background: "rgba(91,79,207,0.08)",
                      color: "#5B4FCF",
                      fontWeight: 600,
                      border: "1.5px solid rgba(91,79,207,0.15)",
                    }}
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right: Illustration */}
            <div className="flex-shrink-0 relative">
              <div
                className="w-72 h-72 lg:w-96 lg:h-96 rounded-[40px] flex items-center justify-center relative"
                style={{
                  background: "linear-gradient(135deg, rgba(91,79,207,0.12) 0%, rgba(255,107,107,0.1) 100%)",
                  border: "3px solid rgba(91,79,207,0.15)",
                }}
              >
                {/* Student doodle illustration */}
                <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" className="w-64 h-64">
                  {/* Map/scroll */}
                  <rect x="80" y="120" width="140" height="100" rx="8" fill="#FFB347" fillOpacity="0.3" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="100" y1="140" x2="180" y2="140" stroke="#FFB347" strokeWidth="2" strokeDasharray="4,3"/>
                  <line x1="100" y1="155" x2="170" y2="155" stroke="#FFB347" strokeWidth="2" strokeDasharray="4,3"/>
                  <line x1="100" y1="170" x2="155" y2="170" stroke="#FFB347" strokeWidth="2" strokeDasharray="4,3"/>
                  <circle cx="165" cy="170" r="8" fill="#FF6B6B" fillOpacity="0.6" stroke="#FF6B6B" strokeWidth="2"/>
                  {/* Student body */}
                  <circle cx="150" cy="65" r="32" fill="#FFD4A3" stroke="#E8A87C" strokeWidth="2.5"/>
                  {/* Hair */}
                  <path d="M118,52 Q130,30 150,28 Q170,30 182,52" fill="#4A3728" stroke="#4A3728" strokeWidth="1.5"/>
                  {/* Face features */}
                  <circle cx="140" cy="65" r="3" fill="#4A3728"/>
                  <circle cx="160" cy="65" r="3" fill="#4A3728"/>
                  <path d="M142,78 Q150,85 158,78" fill="none" stroke="#4A3728" strokeWidth="2" strokeLinecap="round"/>
                  {/* Body */}
                  <path d="M120,97 Q150,90 180,97 L188,140 Q150,148 112,140 Z" fill="#5B4FCF" fillOpacity="0.7" stroke="#5B4FCF" strokeWidth="2"/>
                  {/* Arms holding map */}
                  <path d="M120,105 L88,125 L80,135" fill="none" stroke="#FFD4A3" strokeWidth="8" strokeLinecap="round"/>
                  <path d="M180,105 L212,125 L220,135" fill="none" stroke="#FFD4A3" strokeWidth="8" strokeLinecap="round"/>
                  {/* Stars */}
                  <text x="50" y="80" fontSize="22" style={{ userSelect: "none" }}>⭐</text>
                  <text x="220" y="90" fontSize="18" style={{ userSelect: "none" }}>✨</text>
                  <text x="240" y="180" fontSize="16" style={{ userSelect: "none" }}>🎯</text>
                  <text x="30" y="200" fontSize="16" style={{ userSelect: "none" }}>📚</text>
                </svg>

                {/* Floating badges */}
                <div
                  className="absolute -top-4 -right-4 px-3 py-1.5 rounded-2xl text-sm"
                  style={{ background: "#5B4FCF", color: "#fff", fontWeight: 700, boxShadow: "3px 3px 0px rgba(91,79,207,0.3)" }}
                >
                  2025 🚀
                </div>
                <div
                  className="absolute -bottom-4 -left-4 px-3 py-1.5 rounded-2xl text-sm"
                  style={{ background: "#FF6B6B", color: "#fff", fontWeight: 700, boxShadow: "3px 3px 0px rgba(255,107,107,0.3)" }}
                >
                  Top 200 trường 🏛️
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <WavyDivider color="#5B4FCF" opacity={0.05} />

      {/* ===== BẮT ĐẦU NHANH ===== */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>
            🚀 Bắt đầu nhanh
          </h2>
          <p style={{ color: "#4A4A6A", marginTop: 8 }}>Chọn điểm xuất phát phù hợp với bạn</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {shortcuts.map((s) => (
            <Link key={s.label} to={s.href} className="group">
              <div
                className="p-5 h-full transition-all duration-200 group-hover:-translate-y-1"
                style={{
                  ...handCard,
                  background: s.bg,
                  border: `2px solid ${s.color}25`,
                  boxShadow: `4px 4px 0px ${s.color}20`,
                  transform: `rotate(${s.rotate})`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: `${s.color}20` }}
                >
                  <s.icon size={22} color={s.color} />
                </div>
                <p style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 15 }}>{s.label}</p>
                <p style={{ color: "#4A4A6A", fontSize: 12, marginTop: 4 }}>{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <WavyDivider color="#FF6B6B" opacity={0.04} />

      {/* ===== TOP 10 TRƯỜNG ===== */}
      <section className="py-16" style={{ background: "rgba(91,79,207,0.03)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-8">
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.5rem,3vw,2rem)" }}>
              🏛️ Top 10 Trường Nổi Bật
            </h2>
            <Link
              to="/truong"
              className="flex items-center gap-1 text-sm"
              style={{ color: "#5B4FCF", fontWeight: 700 }}
            >
              Xem tất cả <ChevronRight size={16} />
            </Link>
          </div>

          {/* Horizontal scroll */}
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: "none" }}>
            {universities.map((u) => (
              <Link key={u.id} to={`/truong/${u.id}`} className="flex-shrink-0 group">
                <div
                  className="w-52 p-4 transition-all duration-200 group-hover:-translate-y-1.5"
                  style={handCard}
                >
                  {/* Logo */}
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-sm"
                      style={{
                        background: `linear-gradient(135deg, ${u.color} 0%, ${u.color}99 100%)`,
                        fontFamily: "'Baloo 2', cursive",
                        fontWeight: 800,
                        boxShadow: `2px 2px 0px ${u.color}40`,
                      }}
                    >
                      {u.abbr.slice(0, 2)}
                    </div>
                    {/* Rank badge */}
                    <div
                      className="px-2.5 py-1 rounded-xl text-xs"
                      style={{
                        background: u.ranking <= 3 ? "linear-gradient(135deg, #FFB347 0%, #FF6B6B 100%)" : "rgba(91,79,207,0.1)",
                        color: u.ranking <= 3 ? "#fff" : "#5B4FCF",
                        fontWeight: 800,
                        boxShadow: u.ranking <= 3 ? "2px 2px 0px rgba(255,107,107,0.3)" : "none",
                      }}
                    >
                      #{u.ranking}
                    </div>
                  </div>

                  <p style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 13, lineHeight: 1.4 }}>{u.name}</p>
                  <p style={{ color: "#9090AA", fontSize: 11, marginTop: 2 }}>{u.city}</p>

                  {/* Stars */}
                  <div className="flex items-center gap-1 mt-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={12}
                        fill={i <= Math.round(u.userRating) ? "#FFB347" : "none"}
                        color={i <= Math.round(u.userRating) ? "#FFB347" : "#D0D0D0"}
                      />
                    ))}
                    <span style={{ fontSize: 11, color: "#4A4A6A", marginLeft: 3, fontWeight: 700 }}>{u.userRating}</span>
                  </div>

                  {/* Score */}
                  <div
                    className="mt-3 px-3 py-1.5 rounded-xl text-center text-sm"
                    style={{ background: "rgba(91,79,207,0.07)", color: "#5B4FCF", fontWeight: 800 }}
                  >
                    {u.overallScore} điểm
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <WavyDivider color="#43D9A3" opacity={0.05} />

      {/* ===== XU HƯỚNG ĐIỂM CHUẨN ===== */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.5rem,3vw,2rem)" }}>
              📈 Xu Hướng Điểm Chuẩn
            </h2>
            <p style={{ color: "#4A4A6A", fontSize: 14, marginTop: 4 }}>Top 5 ngành hot nhất 2021–2025</p>
          </div>
          <Link
            to="/nganh"
            className="flex items-center gap-1 text-sm"
            style={{ color: "#5B4FCF", fontWeight: 700 }}
          >
            Xem thêm <ChevronRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {topMajorTrends.map((m, i) => (
            <div
              key={m.name}
              className="p-4 transition-all hover:-translate-y-1 duration-200"
              style={{
                ...handCard,
                border: `2px solid ${m.color}25`,
                boxShadow: `4px 4px 0px ${m.color}18`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 14 }}>{m.name}</span>
                <TrendingUp size={14} color={m.color} />
              </div>
              <SparklineChart data={m.scores} color={m.color} />
              <div className="flex items-center justify-between mt-2">
                <span style={{ fontSize: 11, color: "#9090AA" }}>2021→2025</span>
                <span style={{ fontWeight: 800, color: m.color, fontSize: 14 }}>
                  {m.scores[m.scores.length - 1]}đ
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <WavyDivider color="#FFB347" opacity={0.05} />

      {/* ===== TÍNH NĂNG NỔI BẬT ===== */}
      <section className="py-20" style={{ background: "rgba(91,79,207,0.03)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>
              ✨ Tính Năng Nổi Bật
            </h2>
            <p style={{ color: "#4A4A6A", marginTop: 8, fontSize: 15 }}>
              GR1 cung cấp đầy đủ công cụ để bạn đưa ra quyết định đúng đắn
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-7 transition-all hover:-translate-y-1 duration-200"
                style={handCard}
              >
                <div className="text-5xl mb-5">{f.icon}</div>
                <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 17, marginBottom: 10 }}>{f.title}</h3>
                <p style={{ color: "#4A4A6A", fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
                <div
                  className="mt-5 inline-flex items-center gap-2 text-sm"
                  style={{ color: f.color, fontWeight: 700, cursor: "pointer" }}
                >
                  Khám phá <ArrowRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div
          className="rounded-[32px] p-10 text-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 60%, #FF6B6B 100%)",
            boxShadow: "8px 8px 0px rgba(91,79,207,0.25)",
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10 pointer-events-none">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <circle cx="150" cy="50" r="80" fill="white" />
            </svg>
          </div>

          <h2 className="mb-4" style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#fff", fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>
            🎯 Tìm ngành phù hợp ngay hôm nay!
          </h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, marginBottom: 24 }}>
            Chỉ 3 bước đơn giản để GR1 gợi ý ngành học phù hợp nhất với bạn
          </p>
          <Link
            to="/tim-nganh"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl"
            style={{
              background: "#fff",
              color: "#5B4FCF",
              fontWeight: 800,
              fontSize: 15,
              boxShadow: "3px 3px 0px rgba(0,0,0,0.15)",
              textDecoration: "none",
            }}
          >
            Bắt đầu tìm ngành <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
