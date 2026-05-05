import { useState, useMemo } from "react";
import { ToggleLeft, ToggleRight, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from "recharts";
import { getTierThreshold, getTierBg, getTierColor } from "../data/mockData";

const dotBg = {
  backgroundImage: "radial-gradient(circle, #d0cef0 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  backgroundColor: "#FAFAF8",
};

const handCard = {
  background: "#fff",
  borderRadius: 20,
  border: "2px solid rgba(91,79,207,0.12)",
  boxShadow: "4px 4px 0px rgba(91,79,207,0.09)",
};

const SUBJECTS = [
  { key: "toan", label: "Toán", icon: "📐" },
  { key: "van", label: "Văn", icon: "📖" },
  { key: "anh", label: "Anh", icon: "🌍" },
  { key: "ly", label: "Lý", icon: "⚡" },
  { key: "hoa", label: "Hóa", icon: "🧪" },
  { key: "sinh", label: "Sinh", icon: "🌱" },
  { key: "su", label: "Sử", icon: "📜" },
  { key: "dia", label: "Địa", icon: "🗺️" },
];

const AWARD_LEVELS = [
  { value: "tinh", label: "Cấp tỉnh", bonus: 15 },
  { value: "quocgia", label: "Quốc gia", bonus: 40 },
  { value: "quocte", label: "Quốc tế", bonus: 80 },
];

const CERTS = [
  { key: "ielts", label: "IELTS (× 2)", multiplier: 2, maxDisplay: "9.0" },
  { key: "sat", label: "SAT (÷ 100)", multiplier: 0.01, maxDisplay: "1600" },
];

type SubjectScores = { [k: string]: number };

export default function HoSoPage() {
  const [scores, setScores] = useState<SubjectScores>({
    toan: 8, van: 7.5, anh: 8, ly: 7, hoa: 7.5, sinh: 6.5, su: 6, dia: 7,
  });
  const [isChuyenClass, setIsChuyenClass] = useState(false);
  const [chuyenMon, setChuyenMon] = useState("toan");
  const [awardLevel, setAwardLevel] = useState("tinh");
  const [awardCount, setAwardCount] = useState(0);
  const [ieltScore, setIeltScore] = useState(0);
  const [satScore, setSatScore] = useState(0);

  const totalScore = useMemo(() => {
    // Base score = sum of all subjects
    let base = Object.values(scores).reduce((a, b) => a + b, 0);

    // Chuyen bonus: double the specialized subject
    if (isChuyenClass) {
      base += scores[chuyenMon] || 0;
    }

    // Award bonus
    const awardBonus = awardCount * (AWARD_LEVELS.find((a) => a.value === awardLevel)?.bonus || 0);
    base += awardBonus;

    // Cert bonus
    base += ieltScore * 2;
    base += satScore / 100;

    return Math.round(base * 10) / 10;
  }, [scores, isChuyenClass, chuyenMon, awardLevel, awardCount, ieltScore, satScore]);

  const tier = getTierThreshold(totalScore);
  const tierColor = getTierColor(tier);
  const tierBg = getTierBg(tier);

  const radarData = SUBJECTS.map((s) => ({
    subject: s.label,
    score: scores[s.key] || 0,
    fullMark: 10,
  }));

  // Top 3 recommended blocks based on strong subjects
  const blocks = useMemo(() => {
    const sorted = [...SUBJECTS].sort((a, b) => (scores[b.key] || 0) - (scores[a.key] || 0));
    const top3 = sorted.slice(0, 3).map((s) => s.label);

    const recs = [];
    if (top3.includes("Toán") && top3.includes("Lý")) recs.push({ block: "A00", name: "Toán – Lý – Hóa", match: 95 });
    if (top3.includes("Toán") && top3.includes("Anh")) recs.push({ block: "A01", name: "Toán – Lý – Anh", match: 88 });
    if (top3.includes("Văn") && top3.includes("Sử")) recs.push({ block: "C00", name: "Văn – Sử – Địa", match: 82 });
    if (top3.includes("Anh")) recs.push({ block: "D01", name: "Toán – Văn – Anh", match: 79 });
    if (top3.includes("Sinh") || top3.includes("Hóa")) recs.push({ block: "B00", name: "Toán – Hóa – Sinh", match: 77 });

    return recs.slice(0, 3);
  }, [scores]);

  return (
    <div style={dotBg} className="min-h-screen">
      {/* Header */}
      <div
        className="py-10 px-6 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(91,79,207,0.08) 0%, rgba(255,179,71,0.06) 100%)",
          borderBottom: "2px solid rgba(91,79,207,0.08)",
        }}
      >
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.8rem,4vw,2.5rem)" }}>
          👤 Hồ Sơ & Tính Điểm Học Lực
        </h1>
        <p style={{ color: "#4A4A6A", marginTop: 6 }}>Nhập điểm để tính tổng điểm học lực và xếp tier của bạn</p>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* INPUT SECTION */}
          <div className="space-y-6">
            {/* Avatar + Name */}
            <div style={handCard} className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-16 h-16 rounded-[20px] flex items-center justify-center text-white flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #5B4FCF 0%, #FF6B6B 100%)",
                    boxShadow: "4px 4px 0px rgba(91,79,207,0.2)",
                  }}
                >
                  <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
                    <circle cx="30" cy="18" r="12" fill="rgba(255,255,255,0.9)" />
                    <path d="M10,55 Q10,38 30,38 Q50,38 50,55" fill="rgba(255,255,255,0.7)" />
                    <circle cx="25" cy="17" r="2.5" fill="#1A1A2E" />
                    <circle cx="35" cy="17" r="2.5" fill="#1A1A2E" />
                    <path d="M25,24 Q30,28 35,24" fill="none" stroke="#1A1A2E" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <input
                    type="text"
                    defaultValue="Học sinh của tôi"
                    className="outline-none bg-transparent w-full"
                    style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 18, border: "none", borderBottom: "2px dashed rgba(91,79,207,0.2)" }}
                  />
                  <p style={{ color: "#9090AA", fontSize: 13, marginTop: 4 }}>Nhấp để đổi tên</p>
                </div>
              </div>

              {/* Toggle chuyên */}
              <div
                className="flex items-center justify-between p-4 rounded-2xl"
                style={{ background: "rgba(91,79,207,0.05)", border: "2px dashed rgba(91,79,207,0.15)" }}
              >
                <div>
                  <p style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 14 }}>🏫 Trường chuyên?</p>
                  <p style={{ fontSize: 12, color: "#9090AA" }}>Môn chuyên được nhân đôi</p>
                </div>
                <button onClick={() => setIsChuyenClass(!isChuyenClass)}>
                  {isChuyenClass ? (
                    <ToggleRight size={36} color="#5B4FCF" />
                  ) : (
                    <ToggleLeft size={36} color="#9090AA" />
                  )}
                </button>
              </div>

              {isChuyenClass && (
                <div className="mt-3">
                  <p style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700, marginBottom: 8 }}>Môn chuyên:</p>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map((s) => (
                      <button
                        key={s.key}
                        className="px-3 py-1.5 rounded-xl text-sm"
                        style={{
                          background: chuyenMon === s.key ? "#5B4FCF" : "rgba(91,79,207,0.06)",
                          color: chuyenMon === s.key ? "#fff" : "#5B4FCF",
                          fontWeight: 700,
                          border: `2px solid ${chuyenMon === s.key ? "#5B4FCF" : "rgba(91,79,207,0.15)"}`,
                        }}
                        onClick={() => setChuyenMon(s.key)}
                      >
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Subject scores */}
            <div style={handCard} className="p-6">
              <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 16, marginBottom: 16 }}>
                📝 Điểm TB 8 môn (0–10)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {SUBJECTS.map((s) => (
                  <div key={s.key}>
                    <label className="flex items-center gap-2 mb-1.5" style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700 }}>
                      {s.icon} {s.label}
                      {isChuyenClass && chuyenMon === s.key && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: "#5B4FCF", color: "#fff" }}>×2</span>
                      )}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={scores[s.key]}
                        onChange={(e) => setScores((p) => ({ ...p, [s.key]: Math.min(10, Math.max(0, Number(e.target.value))) }))}
                        className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                        style={{
                          border: "2px solid rgba(91,79,207,0.2)",
                          color: "#1A1A2E",
                          fontWeight: 700,
                          background: "#fff",
                        }}
                      />
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs flex-shrink-0"
                        style={{
                          background: `hsl(${((scores[s.key] || 0) / 10) * 120}, 60%, 45%)`,
                          fontWeight: 800,
                        }}
                      >
                        {scores[s.key]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Awards */}
            <div style={handCard} className="p-6">
              <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 16, marginBottom: 16 }}>
                🏅 Giải thưởng
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {AWARD_LEVELS.map((a) => (
                  <button
                    key={a.value}
                    className="px-3 py-2 rounded-xl text-sm"
                    style={{
                      background: awardLevel === a.value ? "#FFB347" : "rgba(255,179,71,0.1)",
                      color: awardLevel === a.value ? "#fff" : "#B45309",
                      fontWeight: 700,
                      border: `2px solid ${awardLevel === a.value ? "#FFB347" : "rgba(255,179,71,0.3)"}`,
                    }}
                    onClick={() => setAwardLevel(a.value)}
                  >
                    {a.label} (+{a.bonus}đ/giải)
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700 }}>Số giải:</span>
                <button
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(91,79,207,0.1)", color: "#5B4FCF", fontWeight: 800 }}
                  onClick={() => setAwardCount(Math.max(0, awardCount - 1))}
                >–</button>
                <span style={{ fontWeight: 900, color: "#1A1A2E", fontSize: 18, minWidth: 24, textAlign: "center" }}>{awardCount}</span>
                <button
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(91,79,207,0.1)", color: "#5B4FCF", fontWeight: 800 }}
                  onClick={() => setAwardCount(awardCount + 1)}
                >+</button>
              </div>
            </div>

            {/* Certs */}
            <div style={handCard} className="p-6">
              <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 16, marginBottom: 16 }}>
                📜 Chứng chỉ quốc tế
              </h3>
              <div className="space-y-4">
                <div>
                  <label style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700 }}>IELTS (×2): {ieltScore > 0 ? `+${(ieltScore * 2).toFixed(1)}đ` : "Chưa có"}</label>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    step={0.5}
                    value={ieltScore}
                    onChange={(e) => setIeltScore(Math.min(9, Math.max(0, Number(e.target.value))))}
                    className="mt-2 w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#1A1A2E", fontWeight: 700 }}
                    placeholder="Nhập điểm IELTS (0–9)"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 700 }}>SAT (÷100): {satScore > 0 ? `+${(satScore / 100).toFixed(2)}đ` : "Chưa có"}</label>
                  <input
                    type="number"
                    min={0}
                    max={1600}
                    step={10}
                    value={satScore}
                    onChange={(e) => setSatScore(Math.min(1600, Math.max(0, Number(e.target.value))))}
                    className="mt-2 w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#1A1A2E", fontWeight: 700 }}
                    placeholder="Nhập điểm SAT (0–1600)"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RESULT SECTION */}
          <div className="space-y-6">
            {/* Score card */}
            <div
              className="p-8 text-center"
              style={{
                ...handCard,
                border: `2.5px solid ${tierColor}40`,
                boxShadow: `6px 6px 0px ${tierColor}25`,
              }}
            >
              <p style={{ color: "#9090AA", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Tổng điểm học lực</p>
              <div
                style={{
                  fontFamily: "'Baloo 2', cursive",
                  fontWeight: 900,
                  fontSize: 72,
                  color: tierColor,
                  lineHeight: 1,
                  textShadow: `3px 3px 0px ${tierColor}20`,
                }}
              >
                {totalScore}
              </div>
              <div className="flex items-center justify-center mt-4">
                <span
                  className={`px-6 py-2 rounded-2xl text-xl ${tier === "SSS" ? "" : ""}`}
                  style={{
                    fontWeight: 900,
                    fontFamily: "'Baloo 2', cursive",
                    fontSize: 24,
                    boxShadow: `3px 3px 0px ${tierColor}30`,
                    ...(tier === "SSS"
                      ? {
                          background: "linear-gradient(135deg, #FF6B6B, #FFB347, #43D9A3, #5B4FCF)",
                          color: "#fff",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }
                      : {
                          background: `${tierColor}20`,
                          color: tierColor,
                        }),
                  }}
                >
                  Tier {tier} {tier === "SSS" ? "✨" : tier === "SS" ? "🔥" : tier === "S" ? "⭐" : ""}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[
                  { label: "Điểm cơ sở", value: Object.values(scores).reduce((a, b) => a + b, 0).toFixed(1) },
                  { label: "Giải thưởng", value: `+${(awardCount * (AWARD_LEVELS.find((a) => a.value === awardLevel)?.bonus || 0)).toFixed(0)}` },
                  { label: "Chứng chỉ", value: `+${(ieltScore * 2 + satScore / 100).toFixed(1)}` },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-3 rounded-2xl text-center"
                    style={{ background: "rgba(91,79,207,0.05)" }}
                  >
                    <p style={{ fontSize: 10, color: "#9090AA", fontWeight: 700 }}>{item.label}</p>
                    <p style={{ fontWeight: 900, color: "#5B4FCF", fontSize: 16 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier reference */}
            <div style={handCard} className="p-5">
              <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 14, marginBottom: 12 }}>📊 Bảng Tier</h3>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { tier: "D", label: "< 45", color: "#B0B0B0" },
                  { tier: "C", label: "≥ 45", color: "#4CAF50" },
                  { tier: "B", label: "≥ 60", color: "#2196F3" },
                  { tier: "A", label: "≥ 75", color: "#9C27B0" },
                  { tier: "S", label: "≥ 90", color: "#FF9800" },
                  { tier: "SS", label: "≥ 100", color: "#F44336" },
                  { tier: "SSS", label: "≥ 150", color: "#5B4FCF" },
                ].map((t) => (
                  <div
                    key={t.tier}
                    className="p-2 rounded-xl text-center"
                    style={{
                      background: tier === t.tier ? `${t.color}20` : "rgba(91,79,207,0.04)",
                      border: `2px solid ${tier === t.tier ? t.color : "transparent"}`,
                    }}
                  >
                    <p style={{ fontWeight: 900, color: t.color, fontSize: 14 }}>{t.tier}</p>
                    <p style={{ fontSize: 10, color: "#9090AA" }}>{t.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Radar chart */}
            <div style={handCard} className="p-6">
              <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 15, marginBottom: 16 }}>
                📡 Biểu đồ điểm mạnh/yếu
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(91,79,207,0.12)" strokeDasharray="3 3" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#4A4A6A", fontWeight: 700 }} />
                  <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
                  <Radar
                    name="Điểm"
                    dataKey="score"
                    stroke="#5B4FCF"
                    fill="#5B4FCF"
                    fillOpacity={0.2}
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: "#5B4FCF", strokeWidth: 0 }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "2px solid rgba(91,79,207,0.15)", fontSize: 13 }}
                    formatter={(v: number) => [`${v}/10`, "Điểm"]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Recommended blocks */}
            {blocks.length > 0 && (
              <div style={handCard} className="p-6">
                <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 15, marginBottom: 16 }}>
                  🎯 Khối học phù hợp
                </h3>
                <div className="space-y-3">
                  {blocks.map((b, i) => (
                    <Link
                      key={b.block}
                      to={`/nganh?block=${b.block}`}
                      className="flex items-center justify-between p-4 rounded-2xl"
                      style={{
                        background: i === 0 ? "rgba(91,79,207,0.08)" : "rgba(91,79,207,0.04)",
                        border: `2px solid ${i === 0 ? "rgba(91,79,207,0.2)" : "rgba(91,79,207,0.08)"}`,
                        textDecoration: "none",
                      }}
                    >
                      <div>
                        <span className="px-2.5 py-1 rounded-xl text-sm mr-3" style={{ background: "#5B4FCF", color: "#fff", fontWeight: 800 }}>
                          {b.block}
                        </span>
                        <span style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 14 }}>{b.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="px-2.5 py-1 rounded-xl text-sm"
                          style={{ background: "rgba(67,217,163,0.15)", color: "#16A34A", fontWeight: 800 }}
                        >
                          {b.match}%
                        </div>
                        <ChevronRight size={14} color="#9090AA" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
