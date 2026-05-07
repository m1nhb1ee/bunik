import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { MapPin, Globe, Star, ChevronRight, TrendingUp, TrendingDown, Minus, MessageSquare, Send } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from "recharts";
import {
  getUniversities,
  getAdmissionScores,
  toUiUniversity,
  codeToColor,
} from "../services/api";
import type { UiUniversity, ApiAdmissionScore } from "../types/api";

const handCard = {
  background: "#fff",
  borderRadius: 20,
  border: "2px solid rgba(91,79,207,0.12)",
  boxShadow: "4px 4px 0px rgba(91,79,207,0.09)",
};

const dotBg = {
  backgroundImage: "radial-gradient(circle, #d0cef0 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  backgroundColor: "#FAFAF8",
  animation: "dotDrift 24s linear infinite",
};

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={20}
          fill={i <= value ? "#FFB347" : "none"}
          color={i <= value ? "#FFB347" : "#D0D0D0"}
          className="cursor-pointer"
          onClick={() => onChange && onChange(i)}
        />
      ))}
    </div>
  );
}

type MajorRow = {
  programId: number;
  majorCode: string;
  majorName: string;
  scores: { [year: string]: { [method: string]: number } };
};

function buildMajorRows(scores: ApiAdmissionScore[]): MajorRow[] {
  const map = new Map<string, MajorRow>();
  for (const s of scores) {
    const prog = s.university_programs;
    if (!prog) continue;
    const code = prog.major_code;
    if (!map.has(code)) {
      map.set(code, {
        programId: prog.id,
        majorCode: code,
        majorName: prog.major_catalog?.name ?? code,
        scores: {},
      });
    }
    const row = map.get(code)!;
    const yr = String(s.year);
    if (!row.scores[yr]) row.scores[yr] = {};
    if (s.score !== null) {
      const method = s.admission_methods?.name ?? s.admission_method_code;
      row.scores[yr][method] = s.score;
    }
  }
  return Array.from(map.values());
}

function getLatestScore(row: MajorRow): number | null {
  const years = Object.keys(row.scores).sort().reverse();
  for (const yr of years) {
    const methods = row.scores[yr];
    const vals = Object.values(methods);
    if (vals.length > 0) return Math.max(...vals);
  }
  return null;
}

const MOCK_REVIEWS = [
  { author: "Nguyễn Hoàng Long", rating: 4, content: "Trường có chương trình đào tạo tốt, nhiều câu lạc bộ kỹ thuật. Thư viện hiện đại, phòng lab đầy đủ thiết bị.", date: "2024-09-12" },
  { author: "Lê Thị Bích Ngọc", rating: 5, content: "Tôi rất hài lòng với chất lượng đào tạo. Giảng viên nhiệt tình, luôn sẵn sàng hỗ trợ sinh viên. Ra trường dễ xin việc!", date: "2024-08-25" },
];

export default function TruongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const code = id ?? "";

  const [university, setUniversity] = useState<UiUniversity | null>(null);
  const [majorRows, setMajorRows] = useState<MajorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    Promise.all([
      getUniversities({ search: code, page_size: 1 }),
      getAdmissionScores({ university_code: code, page_size: 200 }),
    ])
      .then(([uniRes, scoreRes]) => {
        if (uniRes.results.length > 0) {
          setUniversity(toUiUniversity(uniRes.results[0], 0));
        }
        setMajorRows(buildMajorRows(scoreRes.results));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [code]);

  const tabs = ["Ngành & Điểm chuẩn", "Biểu đồ đánh giá", "Đánh giá"];

  if (loading) {
    return (
      <div style={dotBg} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">â³</div>
          <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!university) {
    return (
      <div style={dotBg} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">ðŸ”</div>
          <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Không tìm thấy trường này</p>
          <Link to="/truong" style={{ color: "#5B4FCF", fontWeight: 600 }}>← Quay lại danh sách</Link>
        </div>
      </div>
    );
  }

  const radarData = university.radarScores.map((s) => ({
    subject: s.criteria,
    A: s.score,
    fullMark: 100,
  }));

  return (
    <div style={dotBg} className="min-h-screen">
      {/* Hero banner */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${university.color}22 0%, ${university.color}11 50%, rgba(91,79,207,0.08) 100%)`,
          borderBottom: "2px solid rgba(91,79,207,0.1)",
        }}
      >
        <div
          className="absolute -right-20 -top-20 w-80 h-80 rounded-full opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${university.color} 0%, transparent 70%)` }}
        />

        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-8" style={{ color: "#9090AA" }}>
            <Link to="/" style={{ color: "#5B4FCF", fontWeight: 600, textDecoration: "none" }}>Trang chủ</Link>
            <ChevronRight size={14} />
            <Link to="/truong" style={{ color: "#5B4FCF", fontWeight: 600, textDecoration: "none" }}>Trường ĐH</Link>
            <ChevronRight size={14} />
            <span style={{ color: "#4A4A6A" }}>{university.abbr}</span>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Logo */}
            <div
              className="w-24 h-24 rounded-[28px] flex items-center justify-center text-white flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${university.color} 0%, ${university.color}88 100%)`,
                fontFamily: "'Baloo 2', cursive",
                fontWeight: 800,
                fontSize: 24,
                boxShadow: `6px 6px 0px ${university.color}30`,
              }}
            >
              {university.abbr.slice(0, 3)}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span
                  className="px-3 py-1 rounded-xl text-sm"
                  style={{
                    background: university.ranking <= 3 ? "linear-gradient(135deg,#FFB347,#FF6B6B)" : "rgba(91,79,207,0.1)",
                    color: university.ranking <= 3 ? "#fff" : "#5B4FCF",
                    fontWeight: 800,
                  }}
                >
                  ★ Hạng #{university.ranking}
                </span>
                {university.region && (
                  <span className="px-3 py-1 rounded-xl text-sm" style={{ background: "rgba(67,217,163,0.15)", color: "#16A34A", fontWeight: 700 }}>
                    {university.region}
                  </span>
                )}
              </div>
              <h1
                className="mb-2"
                style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.5rem,3vw,2.2rem)" }}
              >
                {university.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: "#4A4A6A" }}>
                {university.address && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} /> {university.address}
                  </span>
                )}
                {university.website && (
                  <a
                    href={university.website.startsWith('http') ? university.website : `https://${university.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                    style={{ color: "#5B4FCF", fontWeight: 600 }}
                  >
                    <Globe size={14} /> {university.website}
                  </a>
                )}
              </div>
            </div>

            {/* Score card */}
            {university.overallScore > 0 && (
              <div
                className="px-6 py-5 text-center flex-shrink-0"
                style={{
                  ...handCard,
                  minWidth: 140,
                  borderColor: `${university.color}30`,
                  boxShadow: `4px 4px 0px ${university.color}20`,
                }}
              >
                <p style={{ fontSize: 12, color: "#9090AA", fontWeight: 600, marginBottom: 4 }}>Điểm tổng hợp</p>
                <p
                  style={{
                    fontFamily: "'Baloo 2', cursive",
                    fontWeight: 900,
                    fontSize: 42,
                    color: university.color,
                    lineHeight: 1,
                  }}
                >
                  {university.overallScore}
                </p>
                {university.userRating > 0 && (
                  <>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <StarRating value={Math.round(university.userRating)} />
                    </div>
                    <p style={{ fontSize: 11, color: "#9090AA", marginTop: 4 }}>{university.ratingCount.toLocaleString()} đánh giá</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div
        className="sticky top-16 z-40"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "2px solid rgba(91,79,207,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto py-3" style={{ scrollbarWidth: "none" }}>
            {tabs.map((tab, i) => (
              <button
                key={i}
                className="px-5 py-2.5 rounded-2xl text-sm flex-shrink-0 transition-all"
                style={{
                  background: activeTab === i ? "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)" : "transparent",
                  color: activeTab === i ? "#fff" : "#4A4A6A",
                  fontWeight: activeTab === i ? 800 : 600,
                  boxShadow: activeTab === i ? "2px 2px 0px rgba(91,79,207,0.25)" : "none",
                }}
                onClick={() => setActiveTab(i)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Tab 0: Majors & Scores */}
        {activeTab === 0 && (
          <div>
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.4rem", marginBottom: 20 }}>
              Ngành đào tạo & Điểm chuẩn
            </h2>

            {majorRows.length === 0 ? (
              <div className="p-6 rounded-2xl text-center" style={handCard}>
                <p style={{ color: "#4A4A6A" }}>Chưa có dữ liệu ngành cho trường này</p>
                <p style={{ color: "#9090AA", fontSize: 13, marginTop: 6 }}>Đang cập nhật dữ liệu từ Bộ GD&ĐT...</p>
              </div>
            ) : (
              <div style={{ ...handCard, overflow: "hidden" }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "rgba(91,79,207,0.05)", borderBottom: "2px solid rgba(91,79,207,0.1)" }}>
                        {["Tên ngành", "Mã ngành", "2023", "2024", "2025", "Xu hướng"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-sm"
                            style={{ color: "#4A4A6A", fontWeight: 800 }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {majorRows.map((m, i) => {
                        const score2024 = getLatestScoreByYear(m, "2024");
                        const score2025 = getLatestScoreByYear(m, "2025");
                        const diff = score2025 !== null && score2024 !== null ? score2025 - score2024 : null;
                        return (
                          <tr
                            key={m.majorCode}
                            style={{ borderBottom: i < majorRows.length - 1 ? "1px solid rgba(91,79,207,0.06)" : "none" }}
                          >
                            <td className="px-4 py-3.5">
                              <Link
                                to={`/nganh/${m.majorCode}`}
                                style={{ fontWeight: 700, color: "#5B4FCF", fontSize: 14, textDecoration: "none" }}
                              >
                                {m.majorName}
                              </Link>
                            </td>
                            <td className="px-4 py-3.5">
                              <p style={{ fontSize: 11, color: "#9090AA" }}>{m.majorCode}</p>
                            </td>
                            {["2023", "2024", "2025"].map((y) => {
                              const s = getLatestScoreByYear(m, y);
                              return (
                                <td key={y} className="px-4 py-3.5" style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 15 }}>
                                  {s !== null ? s : "â€”"}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3.5">
                              {diff === null ? (
                                <span className="flex items-center gap-1 text-sm" style={{ color: "#9090AA" }}>
                                  <Minus size={14} /> â€”
                                </span>
                              ) : diff > 0 ? (
                                <span className="flex items-center gap-1 text-sm" style={{ color: "#16A34A", fontWeight: 700 }}>
                                  <TrendingUp size={14} /> +{diff.toFixed(1)}
                                </span>
                              ) : diff < 0 ? (
                                <span className="flex items-center gap-1 text-sm" style={{ color: "#DC2626", fontWeight: 700 }}>
                                  <TrendingDown size={14} /> {diff.toFixed(1)}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-sm" style={{ color: "#9090AA", fontWeight: 700 }}>
                                  <Minus size={14} /> 0
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Radar Chart */}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div style={handCard} className="p-6">
              <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.2rem", marginBottom: 20 }}>
                Biểu đồ đánh giá 6 tiêu chí
              </h2>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(91,79,207,0.15)" strokeDasharray="4 4" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: "#4A4A6A", fontWeight: 600 }}
                  />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9090AA" }} />
                  <Radar
                    name={university.abbr}
                    dataKey="A"
                    stroke={university.color}
                    fill={university.color}
                    fillOpacity={0.25}
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: university.color, strokeWidth: 0 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "2px solid rgba(91,79,207,0.15)",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={handCard} className="p-6">
              <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: "1rem", marginBottom: 16 }}>
                Điểm số từng tiêu chí
              </h3>
              <div className="space-y-4">
                {university.radarScores.map((s) => (
                  <div key={s.criteria}>
                    <div className="flex justify-between mb-1.5">
                      <span style={{ fontSize: 13, color: "#4A4A6A", fontWeight: 600 }}>{s.criteria}</span>
                      <span style={{ fontSize: 14, color: university.color, fontWeight: 800 }}>{s.score}/100</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#F0EEF8" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${s.score}%`, background: `linear-gradient(90deg, ${university.color}aa, ${university.color})` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mt-6 p-4 rounded-2xl"
                style={{
                  background: "rgba(91,79,207,0.05)",
                  border: "2px dashed rgba(91,79,207,0.2)",
                  transform: "rotate(-0.5deg)",
                }}
              >
                <p style={{ fontSize: 12, color: "#4A4A6A", fontWeight: 700 }}>Ghi chú phương pháp</p>
                <p style={{ fontSize: 11, color: "#9090AA", marginTop: 4, lineHeight: 1.6 }}>
                  Điểm đánh giá tổng hợp từ: khảo sát người dùng, dữ liệu tuyển sinh Bộ GD&ĐT và chỉ số mạng xã hội.
                  Cập nhật định kỳ mỗi học kỳ.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Reviews */}
        {activeTab === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Summary */}
            <div className="lg:col-span-1">
              <div style={handCard} className="p-6 mb-6">
                <div className="text-center mb-6">
                  <p style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 56, color: "#FFB347", lineHeight: 1 }}>
                    {university.userRating > 0 ? university.userRating : "â€”"}
                  </p>
                  {university.userRating > 0 && (
                    <div className="flex justify-center gap-1 my-2">
                      <StarRating value={Math.round(university.userRating)} />
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: "#9090AA" }}>
                    {university.ratingCount > 0 ? `${university.ratingCount.toLocaleString()} đánh giá` : "Chưa có đánh giá"}
                  </p>
                </div>

                {[5, 4, 3, 2, 1].map((star) => {
                  const pct = star === 5 ? 58 : star === 4 ? 25 : star === 3 ? 10 : star === 2 ? 5 : 2;
                  return (
                    <div key={star} className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-1 flex-shrink-0 w-12">
                        <Star size={12} fill="#FFB347" color="#FFB347" />
                        <span style={{ fontSize: 12, color: "#4A4A6A", fontWeight: 700 }}>{star}</span>
                      </div>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#F0EEF8" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#FFB347" }} />
                      </div>
                      <span style={{ fontSize: 12, color: "#9090AA", width: 30, textAlign: "right" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Write review */}
              <div style={handCard} className="p-5">
                <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 15, marginBottom: 14 }}>
                  <MessageSquare size={14} className="inline mr-1" />
                  Gửi đánh giá
                </h3>
                <p style={{ fontSize: 13, color: "#4A4A6A", marginBottom: 10 }}>Đánh giá của bạn:</p>
                <div className="mb-3">
                  <StarRating value={reviewRating} onChange={setReviewRating} />
                </div>
                <textarea
                  className="w-full p-3 rounded-xl text-sm outline-none resize-none"
                  rows={4}
                  placeholder="Chia sẻ trải nghiệm của bạn về trường này..."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  style={{
                    border: "2px solid rgba(91,79,207,0.15)",
                    color: "#1A1A2E",
                    fontFamily: "'Nunito', sans-serif",
                  }}
                />
                <button
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm"
                  style={{
                    background: "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)",
                    color: "#fff",
                    fontWeight: 700,
                    boxShadow: "2px 2px 0px rgba(91,79,207,0.25)",
                  }}
                >
                  <Send size={14} />
                  Gửi đánh giá
                </button>
              </div>
            </div>

            {/* Right: Review list */}
            <div className="lg:col-span-2 space-y-4">
              {MOCK_REVIEWS.map((r, i) => (
                <div key={i} style={handCard} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm"
                        style={{ background: `linear-gradient(135deg, ${i % 2 === 0 ? "#43D9A3" : "#FFB347"}, ${i % 2 === 0 ? "#5B4FCF" : "#FF6B6B"})`, fontWeight: 700 }}
                      >
                        {r.author.slice(0, 2)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 14 }}>{r.author}</p>
                        <p style={{ fontSize: 11, color: "#9090AA" }}>{r.date}</p>
                      </div>
                    </div>
                    <StarRating value={r.rating} />
                  </div>
                  <p style={{ color: "#4A4A6A", fontSize: 14, lineHeight: 1.7 }}>{r.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getLatestScoreByYear(row: MajorRow, year: string): number | null {
  const methods = row.scores[year];
  if (!methods) return null;
  const vals = Object.values(methods);
  return vals.length > 0 ? Math.max(...vals) : null;
}
