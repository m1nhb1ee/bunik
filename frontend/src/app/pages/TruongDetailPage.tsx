import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { MapPin, Globe, Star, ChevronRight, TrendingUp, TrendingDown, Minus, MessageSquare, Send } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from "recharts";
import {
  getUniversityDetailByCode,
  toUiUniversity,
  codeToColor,
} from "../services/api";
import type { UiUniversity, ApiAdmissionScore } from "../types/api";
import { B, CenterNote, cardStyle } from "../components/bunik";

const handCard = cardStyle();

const dotBg = {
  backgroundColor: B.paper,
};

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={20}
          fill={i <= value ? B.honey : "none"}
          color={B.ink}
          data-clk
          onClick={() => onChange && onChange(i)}
        />
      ))}
    </div>
  );
}

type ScoreCell = {
  value: number;
  scale: number | null;
};

type VariantRow = {
  key: string;
  programId: string;
  majorCode: string;
  majorName: string;
  variant: string;
  scores: Record<string, ScoreCell>;
};

type MethodTable = {
  code: string;
  name: string;
  years: string[];
  rows: VariantRow[];
};

function getSubjectGroupCodes(score: ApiAdmissionScore): string[] {
  const fromJunction = (score.admission_score_subject_groups ?? [])
    .map((item) => item.subject_group_code)
    .filter(Boolean);
  const codes = fromJunction.length
    ? fromJunction
    : score.subject_group_code
      ? [score.subject_group_code]
      : [];
  return Array.from(new Set(codes)).sort();
}

function getVariantIdentity(score: ApiAdmissionScore): string {
  const sourceIndependentKey = score.variant_key?.startsWith("source:") ? "" : score.variant_key ?? "";
  return [
    score.university_program_id,
    sourceIndependentKey,
    score.variant_label ?? "",
    getSubjectGroupCodes(score).join(","),
    score.gender ?? "",
    score.region_code ?? "",
  ].join("|");
}

function getVariantLabel(score: ApiAdmissionScore): string {
  const codes = getSubjectGroupCodes(score);
  const details = [
    score.variant_label,
    codes.length ? `Tổ hợp ${codes.join(", ")}` : null,
    score.gender ? `Giới tính ${score.gender}` : null,
    score.region_code ? `Khu vực ${score.region_code}` : null,
  ].filter(Boolean);
  return details.join(" · ") || "Điểm chung";
}

export function buildMethodTables(scores: ApiAdmissionScore[]): MethodTable[] {
  const methods = new Map<string, { name: string; rows: Map<string, VariantRow> }>();

  for (const s of scores) {
    const prog = s.university_programs;
    if (!prog || s.score === null) continue;

    const methodCode = s.admission_method_code;
    if (!methods.has(methodCode)) {
      methods.set(methodCode, {
        name: s.admission_methods?.name ?? methodCode,
        rows: new Map(),
      });
    }

    const method = methods.get(methodCode)!;
    const rowKey = getVariantIdentity(s);
    if (!method.rows.has(rowKey)) {
      method.rows.set(rowKey, {
        key: rowKey,
        programId: prog.id,
        majorCode: prog.major_code,
        majorName: prog.major_catalog?.name ?? prog.major_code,
        variant: getVariantLabel(s),
        scores: {},
      });
    }

    const row = method.rows.get(rowKey)!;
    const yr = String(s.year);
    const cell = {
      value: s.normalized_score ?? s.score,
      scale: s.normalized_score !== null ? s.normalized_scale : null,
    };
    const current = row.scores[yr];
    if (!current || (current.scale === cell.scale && cell.value > current.value)) {
      row.scores[yr] = cell;
    }
  }

  return Array.from(methods, ([code, method]) => {
    const rows = Array.from(method.rows.values()).sort((a, b) =>
      a.majorName.localeCompare(b.majorName, "vi") || a.variant.localeCompare(b.variant, "vi")
    );
    const years = Array.from(new Set(rows.flatMap((row) => Object.keys(row.scores))))
      .sort((a, b) => Number(a) - Number(b))
      .slice(-3);
    return { code, name: method.name, years, rows };
  }).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

const MOCK_REVIEWS = [
  { author: "Nguyễn Hoàng Long", rating: 4, content: "Trường có chương trình đào tạo tốt, nhiều câu lạc bộ kỹ thuật. Thư viện hiện đại, phòng lab đầy đủ thiết bị.", date: "2024-09-12" },
  { author: "Lê Thị Bích Ngọc", rating: 5, content: "Tôi rất hài lòng với chất lượng đào tạo. Giảng viên nhiệt tình, luôn sẵn sàng hỗ trợ sinh viên. Ra trường dễ xin việc!", date: "2024-08-25" },
];

export default function TruongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const code = id ?? "";

  const [university, setUniversity] = useState<UiUniversity | null>(null);
  const [methodTables, setMethodTables] = useState<MethodTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    getUniversityDetailByCode(code)
      .then((response) => {
        setUniversity(toUiUniversity(response.university));
        setMethodTables(buildMethodTables(response.scores));
      })
      .catch((error) => {
        console.error(error);
        setUniversity(null);
        setMethodTables([]);
      })
      .finally(() => setLoading(false));
  }, [code]);

  const tabs = ["Ngành & Điểm chuẩn", "Biểu đồ đánh giá", "Đánh giá"];

  if (loading) {
    return <div style={dotBg} className="bunik-page"><CenterNote title="Đang mở thông tin trường…" /></div>;
  }

  if (!university) {
    return <div style={dotBg} className="bunik-page"><CenterNote title="Không tìm thấy trường này" sub="Có thể dữ liệu đã được cập nhật hoặc đường dẫn không còn đúng" /><div style={{ display: "flex", justifyContent: "center" }}><Link className="bunik-button" to="/truong">Quay lại danh sách</Link></div></div>;
  }

  const radarData = university.radarScores.map((s) => ({
    subject: s.criteria,
    A: s.score,
    fullMark: 100,
  }));

  return (
    <div style={dotBg} className="bunik-page">
      {/* Hero banner */}
      <div
        className="relative"
        style={{
          background: `${university.color}14`,
          borderBottom: `2px dashed ${B.muted}`,
        }}
      >
        <div className="bunik-container py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-8" style={{ color: B.muted }}>
            <Link to="/" style={{ color: B.terracotta, fontWeight: 600, textDecoration: "none" }}>Trang chủ</Link>
            <ChevronRight size={14} />
            <Link to="/truong" style={{ color: B.terracotta, fontWeight: 600, textDecoration: "none" }}>Trường ĐH</Link>
            <ChevronRight size={14} />
            <span style={{ color: B.body }}>{university.abbr}</span>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-8">
            {/* Logo */}
            <div
              className="w-24 h-24 flex items-center justify-center flex-shrink-0"
              style={{
                background: university.color,
                color: B.paperLight,
                border: `2.5px solid ${B.ink}`,
                borderRadius: "24px 28px 20px 26px/26px 20px 28px 24px",
                fontFamily: "'Shantell Sans', cursive",
                fontWeight: 800,
                fontSize: 24,
                boxShadow: `4px 4px 0 rgba(43,39,34,0.2)`,
              }}
            >
              {university.abbr.slice(0, 3)}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-sm"
                  style={{
                    background: university.ranking <= 3 ? B.honey : B.paper,
                    color: B.ink,
                    border: `2px solid ${B.ink}`,
                    borderRadius: "13px 10px 12px 11px/11px 12px 10px 13px",
                    fontWeight: 800,
                  }}
                >
                  <Star size={13} fill={B.honey} color={B.ink} strokeWidth={1.5} /> Hạng #{university.ranking}
                </span>
                {university.region && (
                  <span
                    className="px-3 py-1 text-sm"
                    style={{
                      background: B.paper,
                      color: B.teal,
                      border: `2px solid ${B.teal}`,
                      borderRadius: "11px 13px 10px 12px/12px 10px 13px 11px",
                      fontWeight: 700,
                    }}
                  >
                    {university.region}
                  </span>
                )}
              </div>
              <h1
                className="mb-2"
                style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: "clamp(1.6rem,4vw,2.35rem)" }}
              >
                {university.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: B.body }}>
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
                    style={{ color: B.terracotta, fontWeight: 600 }}
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
                <p style={{ fontSize: 12, color: B.muted, fontWeight: 600, marginBottom: 4 }}>Điểm tổng hợp</p>
                <p
                  style={{
                    fontFamily: "'Shantell Sans', cursive",
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
                    <p style={{ fontSize: 11, color: B.muted, marginTop: 4 }}>{university.ratingCount.toLocaleString()} đánh giá</p>
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
          borderBottom: `2px dashed ${B.muted}`,
        }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto py-3" style={{ scrollbarWidth: "none" }}>
            {tabs.map((tab, i) => (
              <button
                key={i}
                className="px-5 py-2.5 rounded-2xl text-sm flex-shrink-0 transition-all"
                style={{
                  background: activeTab === i ? B.ink : "transparent",
                  color: activeTab === i ? B.paperLight : B.body,
                  border: `2px solid ${activeTab === i ? B.ink : "transparent"}`,
                  fontWeight: activeTab === i ? 800 : 600,
                  boxShadow: activeTab === i ? `3px 3px 0 ${B.terracotta}` : "none",
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
            <h2 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: "1.4rem", marginBottom: 20 }}>
              Ngành đào tạo & Điểm chuẩn
            </h2>

            {methodTables.length === 0 ? (
              <div className="p-6 rounded-2xl text-center" style={handCard}>
                <p style={{ color: B.body }}>Chưa có dữ liệu ngành cho trường này</p>
                <p className="bunik-note-text" style={{ fontSize: 16, marginTop: 6 }}>Đang cập nhật dữ liệu từ Bộ GD&ĐT…</p>
              </div>
            ) : (
              <div className="space-y-8">
                {methodTables.map((method) => (
                  <section key={method.code} style={{ ...handCard, overflow: "hidden" }}>
                    <div className="px-5 py-4" style={{ borderBottom: `2px dashed ${B.muted}` }}>
                      <h3 style={{ color: B.ink, fontWeight: 800, fontSize: 17 }}>
                        {method.name}
                      </h3>
                      <p style={{ color: B.muted, fontSize: 12, marginTop: 3 }}>
                        Mã phương thức: {method.code} · {method.rows.length} dòng dữ liệu
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ background: "rgba(206,155,78,.09)", borderBottom: `2px dashed ${B.muted}` }}>
                            {["Tên ngành", "Mã ngành", "Note", ...method.years, "Xu hướng"].map((heading) => (
                              <th key={heading} className="px-4 py-3 text-left text-sm" style={{ color: B.body, fontWeight: 800 }}>
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {groupRowsByMajor(method.rows).map((group, gIndex, groups) =>
                            group.variants.map((row, vIndex) => {
                              const diff = getTrend(row, method.years);
                              const isLastVariant = vIndex === group.variants.length - 1;
                              const isLastGroup = gIndex === groups.length - 1;
                              const borderBottom = isLastGroup && isLastVariant
                                ? "none"
                                : isLastVariant
                                  ? "2px dashed rgba(43,39,34,.28)"
                                  : "1px dashed rgba(43,39,34,.12)";
                              return (
                                <tr key={row.key} style={{ borderBottom }}>
                                  {vIndex === 0 && (
                                    <>
                                      <td className="px-4 py-3.5" rowSpan={group.variants.length} style={{ verticalAlign: "top" }}>
                                        <Link
                                          to={`/nganh/${group.programId}`}
                                          style={{ fontWeight: 700, color: B.terracotta, fontSize: 14, textDecoration: "none" }}
                                        >
                                          {group.majorName}
                                        </Link>
                                      </td>
                                      <td className="px-4 py-3.5" rowSpan={group.variants.length} style={{ color: B.muted, fontSize: 11, verticalAlign: "top" }}>{group.majorCode}</td>
                                    </>
                                  )}
                                  <td className="px-4 py-3.5" style={{ color: B.body, fontSize: 12 }}>{row.variant}</td>
                                  {method.years.map((year) => (
                                    <td key={year} className="px-4 py-3.5" style={{ fontWeight: 700, color: B.ink, fontSize: 15 }}>
                                      {row.scores[year]?.value ?? "—"}
                                    </td>
                                  ))}
                                  <td className="px-4 py-3.5">{renderTrend(diff)}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Radar Chart */}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div style={handCard} className="p-6">
              <h2 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: "1.2rem", marginBottom: 20 }}>
                Biểu đồ đánh giá 6 tiêu chí
              </h2>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={B.muted} strokeDasharray="4 4" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: B.body, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: B.muted }} />
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
                      border: `2px solid ${B.ink}`,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={handCard} className="p-6">
              <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: "1rem", marginBottom: 16 }}>
                Điểm số từng tiêu chí
              </h3>
              <div className="space-y-4">
                {university.radarScores.map((s) => (
                  <div key={s.criteria}>
                    <div className="flex justify-between mb-1.5">
                      <span style={{ fontSize: 13, color: B.body, fontWeight: 600 }}>{s.criteria}</span>
                      <span style={{ fontSize: 14, color: university.color, fontWeight: 800 }}>{s.score}/100</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: B.paper, border: `1px solid ${B.ink}22` }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${s.score}%`, background: university.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mt-6 p-4 rounded-2xl"
                style={{
                  background: "rgba(206,155,78,.09)",
                  border: `2px dashed ${B.muted}`,
                  transform: "rotate(-0.5deg)",
                }}
              >
                <p style={{ fontSize: 12, color: B.body, fontWeight: 700 }}>Ghi chú phương pháp</p>
                <p style={{ fontSize: 11, color: B.muted, marginTop: 4, lineHeight: 1.6 }}>
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
                  <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 52, color: B.honey, lineHeight: 1 }}>
                    {university.userRating > 0 ? university.userRating : "—"}
                  </p>
                  {university.userRating > 0 && (
                    <div className="flex justify-center gap-1 my-2">
                      <StarRating value={Math.round(university.userRating)} />
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: B.muted }}>
                    {university.ratingCount > 0 ? `${university.ratingCount.toLocaleString()} đánh giá` : "Chưa có đánh giá"}
                  </p>
                </div>

                {[5, 4, 3, 2, 1].map((star) => {
                  const pct = star === 5 ? 58 : star === 4 ? 25 : star === 3 ? 10 : star === 2 ? 5 : 2;
                  return (
                    <div key={star} className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-1 flex-shrink-0 w-12">
                        <Star size={12} fill="#FFB347" color="#FFB347" />
                        <span style={{ fontSize: 12, color: B.body, fontWeight: 700 }}>{star}</span>
                      </div>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: B.paper }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#FFB347" }} />
                      </div>
                      <span style={{ fontSize: 12, color: B.muted, width: 30, textAlign: "right" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Write review */}
              <div style={handCard} className="p-5">
                <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: 15, marginBottom: 14 }}>
                  <MessageSquare size={14} className="inline mr-1" />
                  Gửi đánh giá
                </h3>
                <p style={{ fontSize: 13, color: B.body, marginBottom: 10 }}>Đánh giá của bạn:</p>
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
                    border: `2px solid ${B.ink}`,
                    color: B.ink,
                    background: B.paper,
                    fontFamily: "'Be Vietnam Pro', sans-serif",
                  }}
                />
                <button
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm"
                  style={{
                    background: B.terracotta,
                    color: B.paperLight,
                    border: `2px solid ${B.ink}`,
                    fontWeight: 700,
                    boxShadow: `3px 3px 0 ${B.ink}`,
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
                        style={{ background: i % 2 === 0 ? B.teal : B.plum, border: `1.5px solid ${B.ink}`, fontWeight: 700 }}
                      >
                        {r.author.slice(0, 2)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, color: B.ink, fontSize: 14 }}>{r.author}</p>
                        <p style={{ fontSize: 11, color: B.muted }}>{r.date}</p>
                      </div>
                    </div>
                    <StarRating value={r.rating} />
                  </div>
                  <p style={{ color: B.body, fontSize: 14, lineHeight: 1.7 }}>{r.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type MajorGroup = {
  programId: string;
  majorCode: string;
  majorName: string;
  variants: VariantRow[];
};

function groupRowsByMajor(rows: VariantRow[]): MajorGroup[] {
  const groups = new Map<string, MajorGroup>();
  for (const row of rows) {
    let group = groups.get(row.programId);
    if (!group) {
      group = { programId: row.programId, majorCode: row.majorCode, majorName: row.majorName, variants: [] };
      groups.set(row.programId, group);
    }
    group.variants.push(row);
  }
  return Array.from(groups.values());
}

function getTrend(row: VariantRow, years: string[]): number | null {
  if (years.length < 2) return null;
  const previous = row.scores[years[years.length - 2]];
  const latest = row.scores[years[years.length - 1]];
  if (!previous || !latest || previous.scale !== latest.scale) return null;
  return latest.value - previous.value;
}

function renderTrend(diff: number | null) {
  if (diff === null) {
    return <span className="flex items-center gap-1 text-sm" style={{ color: B.muted }}><Minus size={14} /> —</span>;
  }
  if (diff > 0) {
    return <span className="flex items-center gap-1 text-sm" style={{ color: "#16A34A", fontWeight: 700 }}><TrendingUp size={14} /> +{diff.toFixed(1)}</span>;
  }
  if (diff < 0) {
    return <span className="flex items-center gap-1 text-sm" style={{ color: "#DC2626", fontWeight: 700 }}><TrendingDown size={14} /> {diff.toFixed(1)}</span>;
  }
  return <span className="flex items-center gap-1 text-sm" style={{ color: B.muted, fontWeight: 700 }}><Minus size={14} /> 0</span>;
}
