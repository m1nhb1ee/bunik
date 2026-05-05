import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar
} from "recharts";
import { getMajorDetail, getAdmissionScores } from "../services/api";
import type { ApiMajorDetail, ApiAdmissionScore } from "../types/api";

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

const groupColors: { [k: string]: string } = {
  "Kỹ thuật - Công nghệ": "#5B4FCF",
  "Kinh tế - Quản trị": "#43D9A3",
  "Sức khỏe": "#FF6B6B",
  "Ngôn ngữ - Văn hóa": "#FFB347",
  "Luật - Chính trị": "#9C27B0",
  "Kiến trúc - Xây dựng": "#2196F3",
};

type YearRange = "1" | "3" | "5";

const CustomDot = ({ cx, cy, stroke }: any) => (
  <circle cx={cx} cy={cy} r={5} fill={stroke} stroke="#fff" strokeWidth={2} />
);

type ScoreByMethodYear = {
  year: string;
  [method: string]: number | string;
};

type UniCompareItem = {
  name: string;
  university: string;
  score: number;
};

function buildChartData(scores: ApiAdmissionScore[]): {
  allYears: string[];
  chartData: ScoreByMethodYear[];
  methods: string[];
  compareData: UniCompareItem[];
} {
  const byYear: Map<string, Map<string, number[]>> = new Map();
  const byUni: Map<string, { name: string; scores: number[] }> = new Map();
  const methodSet = new Set<string>();

  for (const s of scores) {
    if (s.score === null) continue;
    const yr = String(s.year);
    const method = s.admission_methods?.name ?? s.admission_method_code;
    methodSet.add(method);

    if (!byYear.has(yr)) byYear.set(yr, new Map());
    const yearMap = byYear.get(yr)!;
    if (!yearMap.has(method)) yearMap.set(method, []);
    yearMap.get(method)!.push(s.score);

    const uniCode = s.university_programs?.universities?.code ?? s.university_programs?.university_short_name ?? '';
    const uniName = s.university_programs?.universities?.code ?? uniCode;
    if (uniCode && s.year >= 2024) {
      if (!byUni.has(uniCode)) byUni.set(uniCode, { name: uniName, scores: [] });
      byUni.get(uniCode)!.scores.push(s.score);
    }
  }

  const allYears = Array.from(byYear.keys()).sort();
  const methods = Array.from(methodSet);

  const chartData: ScoreByMethodYear[] = allYears.map((yr) => {
    const entry: ScoreByMethodYear = { year: yr };
    const yearMap = byYear.get(yr)!;
    for (const method of methods) {
      const vals = yearMap.get(method);
      if (vals && vals.length > 0) {
        entry[method] = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
      }
    }
    return entry;
  });

  const compareData: UniCompareItem[] = Array.from(byUni.entries()).map(([code, info]) => ({
    name: code,
    university: info.name,
    score: +(info.scores.reduce((a, b) => a + b, 0) / info.scores.length).toFixed(2),
  }));

  return { allYears, chartData, methods, compareData };
}

const METHOD_COLORS = ["#5B4FCF", "#43D9A3", "#FFB347", "#FF6B6B", "#9C27B0"];

export default function NganhDetailPage() {
  const { id } = useParams<{ id: string }>();
  const code = id ?? "";

  const [major, setMajor] = useState<ApiMajorDetail | null>(null);
  const [scores, setScores] = useState<ApiAdmissionScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearRange, setYearRange] = useState<YearRange>("5");

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    Promise.all([
      getMajorDetail(code),
      getAdmissionScores({ major_code: code, page_size: 200 }),
    ])
      .then(([majorData, scoreRes]) => {
        setMajor(majorData);
        setScores(scoreRes.results);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div style={dotBg} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!major) {
    return (
      <div style={dotBg} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">📚</div>
          <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Không tìm thấy ngành này</p>
          <Link to="/nganh" style={{ color: "#5B4FCF", fontWeight: 600 }}>← Quay lại danh sách</Link>
        </div>
      </div>
    );
  }

  const groupName = major.fields?.description ?? major.field_code;
  const color = groupColors[groupName] || "#5B4FCF";
  const subjectBlocks = (major.major_subject_groups ?? [])
    .map((g) => g.subject_group_code)
    .join(", ") || "—";

  const { allYears, chartData, methods, compareData } = buildChartData(scores);

  const filteredYears = yearRange === "1"
    ? allYears.slice(-1)
    : yearRange === "3"
    ? allYears.slice(-3)
    : allYears;

  const filteredChartData = chartData.filter((d) => filteredYears.includes(d.year));

  const latestYear = allYears[allYears.length - 1];
  const latestEntry = chartData.find((d) => d.year === latestYear);
  const prevEntry = chartData.find((d) => d.year === allYears[allYears.length - 2]);
  const latestScore = latestEntry
    ? Math.max(...methods.map((m) => Number(latestEntry[m] ?? 0)).filter(Boolean))
    : null;
  const prevScore = prevEntry
    ? Math.max(...methods.map((m) => Number(prevEntry[m] ?? 0)).filter(Boolean))
    : null;
  const trend = latestScore !== null && prevScore !== null
    ? latestScore > prevScore ? "up" : latestScore < prevScore ? "down" : "stable"
    : "stable";

  const tableData = filteredYears.map((yr) => {
    const entry = chartData.find((d) => d.year === yr) ?? { year: yr };
    return { year: yr, entry };
  });

  return (
    <div style={dotBg} className="min-h-screen">
      {/* Header */}
      <div
        className="py-10 px-6 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
          borderBottom: "2px solid rgba(91,79,207,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-2 text-sm mb-6" style={{ color: "#9090AA" }}>
            <Link to="/" style={{ color: "#5B4FCF", fontWeight: 600, textDecoration: "none" }}>Trang chủ</Link>
            <ChevronRight size={14} />
            <Link to="/nganh" style={{ color: "#5B4FCF", fontWeight: 600, textDecoration: "none" }}>Ngành học</Link>
            <ChevronRight size={14} />
            <span style={{ color: "#4A4A6A" }}>{major.name}</span>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-3 py-1 rounded-xl text-xs" style={{ background: `${color}20`, color, fontWeight: 800 }}>
                  {groupName}
                </span>
                <span className="px-3 py-1 rounded-xl text-xs" style={{ background: "rgba(91,79,207,0.1)", color: "#5B4FCF", fontWeight: 700 }}>
                  Mã: {major.code}
                </span>
                {subjectBlocks !== "—" && (
                  <span className="px-3 py-1 rounded-xl text-xs" style={{ background: "rgba(67,217,163,0.15)", color: "#16A34A", fontWeight: 700 }}>
                    Khối: {subjectBlocks}
                  </span>
                )}
              </div>
              <h1 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.6rem,3vw,2.3rem)" }}>
                {major.name}
              </h1>
            </div>

            <div style={{ ...handCard, padding: "20px 28px", textAlign: "center", flexShrink: 0 }}>
              <p style={{ fontSize: 12, color: "#9090AA", fontWeight: 600 }}>
                Điểm chuẩn {latestYear ?? "—"}
              </p>
              <p style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 52, color, lineHeight: 1.1 }}>
                {latestScore ?? "—"}
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                {trend === "up" ? (
                  <span className="flex items-center gap-1 text-sm" style={{ color: "#16A34A", fontWeight: 700 }}>
                    <TrendingUp size={14} /> Tăng
                  </span>
                ) : trend === "down" ? (
                  <span className="flex items-center gap-1 text-sm" style={{ color: "#DC2626", fontWeight: 700 }}>
                    <TrendingDown size={14} /> Giảm
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: "#9090AA", fontWeight: 600 }}>Ổn định</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Line chart */}
        {filteredChartData.length > 0 ? (
          <div style={handCard} className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.2rem" }}>
                📈 Lịch sử điểm chuẩn theo phương thức
              </h2>
              <div className="flex gap-2">
                {(["1", "3", "5"] as YearRange[]).map((y) => (
                  <button
                    key={y}
                    className="px-4 py-1.5 rounded-xl text-sm"
                    style={{
                      background: yearRange === y ? "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)" : "rgba(91,79,207,0.06)",
                      color: yearRange === y ? "#fff" : "#5B4FCF",
                      fontWeight: 700,
                      boxShadow: yearRange === y ? "2px 2px 0px rgba(91,79,207,0.25)" : "none",
                    }}
                    onClick={() => setYearRange(y)}
                  >
                    {y} năm
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={filteredChartData}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(91,79,207,0.08)" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#9090AA" }} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12, fill: "#9090AA" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "2px solid rgba(91,79,207,0.15)",
                    fontSize: 13,
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 700,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 13, fontWeight: 700 }} />
                {methods.map((method, idx) => (
                  <Line
                    key={method}
                    type="monotone"
                    dataKey={method}
                    stroke={METHOD_COLORS[idx % METHOD_COLORS.length]}
                    strokeWidth={2.5}
                    dot={<CustomDot stroke={METHOD_COLORS[idx % METHOD_COLORS.length]} />}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={handCard} className="p-6 text-center">
            <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Chưa có dữ liệu điểm chuẩn cho ngành này</p>
            <p style={{ color: "#9090AA", fontSize: 13, marginTop: 6 }}>Dữ liệu sẽ được cập nhật sau kỳ tuyển sinh</p>
          </div>
        )}

        {/* Detail table */}
        {tableData.length > 0 && methods.length > 0 && (
          <div style={{ ...handCard, overflow: "hidden" }}>
            <div className="p-5 border-b" style={{ borderColor: "rgba(91,79,207,0.08)" }}>
              <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.1rem" }}>
                📋 Bảng chi tiết điểm chuẩn
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "rgba(91,79,207,0.05)" }}>
                    <th className="px-5 py-3 text-left text-sm" style={{ color: "#4A4A6A", fontWeight: 800 }}>Năm</th>
                    {methods.map((m) => (
                      <th key={m} className="px-5 py-3 text-left text-sm" style={{ color: "#4A4A6A", fontWeight: 800 }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map(({ year, entry }, i) => (
                    <tr
                      key={year}
                      style={{ borderTop: "1px solid rgba(91,79,207,0.06)", background: i === tableData.length - 1 ? `${color}06` : "transparent" }}
                    >
                      <td className="px-5 py-3.5" style={{ fontWeight: 800, color: "#1A1A2E" }}>
                        {year}
                        {i === tableData.length - 1 && (
                          <span className="ml-2 px-1.5 py-0.5 rounded-md text-xs" style={{ background: color, color: "#fff", fontWeight: 700 }}>
                            Mới
                          </span>
                        )}
                      </td>
                      {methods.map((m, idx) => (
                        <td key={m} className="px-5 py-3.5" style={{ fontWeight: 700, color: METHOD_COLORS[idx % METHOD_COLORS.length], fontSize: 15 }}>
                          {entry[m] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Horizontal bar chart: universities offering this major */}
        {compareData.length > 1 && (
          <div style={handCard} className="p-6">
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.1rem", marginBottom: 20 }}>
              🏛️ So sánh nhanh các trường có ngành này
            </h2>
            <ResponsiveContainer width="100%" height={Math.max(220, compareData.length * 40)}>
              <BarChart data={compareData} layout="vertical">
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(91,79,207,0.08)" horizontal={false} />
                <XAxis type="number" domain={[18, 30]} tick={{ fontSize: 12, fill: "#9090AA" }} />
                <YAxis
                  type="category"
                  dataKey="university"
                  tick={{ fontSize: 12, fill: "#4A4A6A", fontWeight: 700 }}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "2px solid rgba(91,79,207,0.15)", fontSize: 13 }}
                  formatter={(v: number, _: string, props: any) => [
                    `${v}đ — ${props.payload.name}`,
                    "Điểm TB",
                  ]}
                />
                <Bar dataKey="score" fill={color} fillOpacity={0.8} radius={[0, 8, 8, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
