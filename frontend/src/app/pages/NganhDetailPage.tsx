import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router";
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  getAllAdmissionScoresByProgramIds,
  getAllUniversityPrograms,
  getMajorDetail,
  getProgramDetail,
  normalizeAdmissionScore,
} from "../services/api";
import type { ApiMajorDetail, ApiAdmissionScore, ApiUniversityProgram } from "../types/api";
import { B, CenterNote, accentFor, cardStyle } from "../components/bunik";

const dotBg = {
  backgroundColor: B.paper,
};

const handCard = cardStyle();

const groupColors: { [k: string]: string } = {
  "Kỹ thuật - Công nghệ": B.terracotta,
  "Kinh tế - Quản trị": B.teal,
  "Sức khỏe": B.rust,
  "Ngôn ngữ - Văn hóa": B.honey,
  "Luật - Chính trị": B.plum,
  "Kiến trúc - Xây dựng": B.olive,
};

type YearRange = "1" | "3" | "5";

type MethodSeries = {
  method: string;
  data: Array<{ year: string; score: number }>;
};

function getProgramLabel(program: ApiUniversityProgram): string {
  return program.universities?.name || program.university_short_name;
}

function getProgramVariantLabel(program: ApiUniversityProgram, majorName: string): string {
  const school = getProgramLabel(program);
  const programName = (program.program_name || majorName || "").trim();
  return programName ? `${school} - ${programName}` : school;
}

function buildMethodSeries(scores: ApiAdmissionScore[], yearRange: YearRange): MethodSeries[] {
  const byMethodYear = new Map<string, Map<string, number[]>>();

  for (const score of scores) {
    if (score.score === null) continue;
    const method = score.admission_methods?.name ?? score.admission_method_code;
    const year = String(score.year);

    if (!byMethodYear.has(method)) byMethodYear.set(method, new Map());
    const byYear = byMethodYear.get(method)!;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(score.score);
  }

  const allYears = Array.from(new Set(scores.map((s) => String(s.year)))).sort();
  const filteredYears = yearRange === "1" ? allYears.slice(-1) : yearRange === "3" ? allYears.slice(-3) : allYears;

  return Array.from(byMethodYear.entries())
    .map(([method, byYear]) => {
      const data = filteredYears
        .map((year) => {
          const values = byYear.get(year);
          if (!values || values.length === 0) return null;
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          return { year, score: +avg.toFixed(2) };
        })
        .filter((item): item is { year: string; score: number } => item !== null);

      return { method, data };
    })
    .filter((series) => series.data.length > 0)
    .sort((a, b) => {
      const aIsThpt = a.method.toLowerCase().includes("thpt");
      const bIsThpt = b.method.toLowerCase().includes("thpt");
      if (aIsThpt && !bIsThpt) return -1;
      if (!aIsThpt && bIsThpt) return 1;
      return a.method.localeCompare(b.method);
    });
}

const METHOD_COLORS = [B.terracotta, B.teal, B.honey, B.plum, B.indigo, B.olive, B.rust];

function ScorePointLabel(props: any) {
  const { x, y, value } = props;
  if (x === undefined || y === undefined || value === undefined) return null;
  return (
    <g>
      <rect
        x={x - 22}
        y={y - 22}
        width={44}
        height={16}
        rx={6}
        fill={B.paperLight}
        stroke={B.ink}
        strokeWidth={1}
      />
      <text x={x} y={y - 10} textAnchor="middle" fill={B.teal} fontSize={10} fontWeight={800}>
        {value}
      </text>
    </g>
  );
}

export default function NganhDetailPage() {
  const { id } = useParams<{ id: string }>();
  const routeProgramId = id ?? "";

  const [major, setMajor] = useState<ApiMajorDetail | null>(null);
  const [programs, setPrograms] = useState<ApiUniversityProgram[]>([]);
  const [scoresByProgram, setScoresByProgram] = useState<Record<string, ApiAdmissionScore[]>>({});
  const [selectedProgramId, setSelectedProgramId] = useState(routeProgramId);
  const [loading, setLoading] = useState(true);
  const [yearRange, setYearRange] = useState<YearRange>("5");

  useEffect(() => {
    setSelectedProgramId(routeProgramId);
  }, [routeProgramId]);

  useEffect(() => {
    if (!routeProgramId) return;

    let active = true;

    async function load() {
      setLoading(true);
      try {
        const currentProgram = await getProgramDetail(routeProgramId);
        const majorCode = currentProgram.major_code;

        const [majorData, programsByCode] = await Promise.all([
          getMajorDetail(majorCode),
          getAllUniversityPrograms({ major_code: majorCode }),
        ]);

        const mergedProgramsMap = new Map<string, ApiUniversityProgram>();
        for (const program of programsByCode) {
          mergedProgramsMap.set(program.id, program);
        }
        const sameMajorPrograms = Array.from(mergedProgramsMap.values());
        const allScores = await getAllAdmissionScoresByProgramIds(sameMajorPrograms.map((program) => program.id));
        const scoresMap = new Map<string, ApiAdmissionScore[]>();
        for (const score of allScores) {
          const programId = score.university_program_id;
          if (!scoresMap.has(programId)) scoresMap.set(programId, []);
          scoresMap.get(programId)!.push(score);
        }

        if (!active) return;

        setMajor(majorData);
        setPrograms(sameMajorPrograms);
        setScoresByProgram(Object.fromEntries(Array.from(scoresMap.entries())));
        setSelectedProgramId((prev) => (prev && sameMajorPrograms.some((p) => p.id === prev) ? prev : routeProgramId));
      } catch (error) {
        console.error(error);
        if (!active) return;
        setMajor(null);
        setPrograms([]);
        setScoresByProgram({});
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [routeProgramId]);

  const visiblePrograms = useMemo(
    () => programs.filter((program) => (scoresByProgram[program.id]?.length ?? 0) > 0 || program.id === selectedProgramId),
    [programs, scoresByProgram, selectedProgramId],
  );

  const selectedProgram = useMemo(() => programs.find((program) => program.id === selectedProgramId) ?? null, [programs, selectedProgramId]);

  const selectedScores = selectedProgramId ? (scoresByProgram[selectedProgramId] ?? []) : [];
  const normalizedSelectedScores = useMemo(
    () =>
      selectedScores.map((item) => ({
        ...item,
        score: item.score === null ? null : normalizeAdmissionScore(item),
      })),
    [selectedScores],
  );

  const methodSeries = useMemo(() => buildMethodSeries(normalizedSelectedScores, yearRange), [normalizedSelectedScores, yearRange]);

  const latestYear = normalizedSelectedScores.length > 0 ? Math.max(...normalizedSelectedScores.map((item) => item.year)) : null;

  const latestScores =
    latestYear === null
      ? []
      : normalizedSelectedScores.filter((item) => item.year === latestYear && item.score !== null).map((item) => item.score as number);

  const previousYear = latestYear === null ? null : latestYear - 1;
  const previousScores =
    previousYear === null
      ? []
      : normalizedSelectedScores.filter((item) => item.year === previousYear && item.score !== null).map((item) => item.score as number);

  const latestScore = latestScores.length > 0 ? +(latestScores.reduce((a, b) => a + b, 0) / latestScores.length).toFixed(2) : null;

  const previousScore = previousScores.length > 0 ? +(previousScores.reduce((a, b) => a + b, 0) / previousScores.length).toFixed(2) : null;

  const trend =
    latestScore !== null && previousScore !== null ? (latestScore > previousScore ? "up" : latestScore < previousScore ? "down" : "stable") : "stable";

  if (loading) {
    return <div style={dotBg} className="bunik-page"><CenterNote title="Đang mở dữ liệu ngành…" /></div>;
  }

  if (!major || !selectedProgram) {
    return <div style={dotBg} className="bunik-page"><CenterNote title="Không tìm thấy chương trình ngành này" sub="Hãy quay lại danh sách và chọn một ngành khác" /><div style={{ display: "flex", justifyContent: "center" }}><Link className="bunik-button" to="/nganh">Quay lại danh sách</Link></div></div>;
  }

  const groupName = major.fields?.description ?? major.field_code;
  const color = groupColors[groupName] || accentFor(groupName || major.code);
  const subjectBlocks = (major.major_subject_groups ?? []).map((group) => group.subject_group_code).join(", ") || "-";

  return (
    <div style={dotBg} className="bunik-page">
      <div
        className="py-10 px-6 relative"
        style={{
          background: `${color}14`,
          borderBottom: `2px dashed ${B.muted}`,
        }}
      >
        <div className="bunik-container">
          <div className="flex flex-wrap items-center gap-2 text-sm mb-6" style={{ color: B.muted }}>
            <Link to="/" style={{ color: B.terracotta, fontWeight: 600, textDecoration: "none" }}>
              Trang chủ
            </Link>
            <ChevronRight size={14} />
            <Link to="/nganh" style={{ color: B.terracotta, fontWeight: 600, textDecoration: "none" }}>
              Ngành học
            </Link>
            <ChevronRight size={14} />
            <span style={{ color: B.body }}>{major.name}</span>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="bunik-chip" style={{ minHeight: 28, padding: "3px 9px", background: `${color}20`, color, fontWeight: 800 }}>
                  {groupName}
                </span>
                <span className="bunik-chip" style={{ minHeight: 28, padding: "3px 9px" }}>
                  Mã ngành: {major.code}
                </span>
                {selectedProgram.universities?.code ? (
                  <Link
                    to={`/truong/${selectedProgram.universities.code}`}
                    className="bunik-chip"
                    style={{ minHeight: 28, padding: "3px 9px", background: "rgba(46,106,98,.13)", color: B.teal, textDecoration: "none" }}
                    title={`Xem trường ${getProgramLabel(selectedProgram)}`}
                  >
                    Trường: {getProgramLabel(selectedProgram)}
                    <ChevronRight size={13} />
                  </Link>
                ) : (
                  <span className="bunik-chip" style={{ minHeight: 28, padding: "3px 9px", background: "rgba(46,106,98,.13)", color: B.teal }}>
                    Trường: {getProgramLabel(selectedProgram)}
                  </span>
                )}
                {subjectBlocks !== "-" && (
                  <span className="bunik-chip" style={{ minHeight: 28, padding: "3px 9px" }}>
                    Khối: {subjectBlocks}
                  </span>
                )}
              </div>
              <h1 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: "clamp(1.7rem,4vw,2.55rem)", lineHeight: 1.2 }}>
                {(selectedProgram.program_name || major.name || "").trim() || major.name}
              </h1>
            </div>

            <div style={{ ...handCard, padding: "20px 28px", textAlign: "center", flexShrink: 0 }}>
              <p style={{ fontSize: 12, color: B.muted, fontWeight: 600 }}>Điểm TB {latestYear ?? "-"}</p>
              <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 48, color, lineHeight: 1.1 }}>{latestScore ?? "-"}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                {trend === "up" ? (
                  <span className="flex items-center gap-1 text-sm" style={{ color: B.olive, fontWeight: 700 }}>
                    <TrendingUp size={14} /> Tăng
                  </span>
                ) : trend === "down" ? (
                  <span className="flex items-center gap-1 text-sm" style={{ color: B.rust, fontWeight: 700 }}>
                    <TrendingDown size={14} /> Giảm
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: B.muted, fontWeight: 600 }}>Ổn định</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bunik-container py-10 space-y-8">
        <div style={handCard} className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: "1.1rem" }}>Chọn trường để xem chi tiết điểm</h2>
            <div className="flex gap-2">
              {(["1", "3", "5"] as YearRange[]).map((value) => (
                <button
                  key={value}
                  className="px-4 py-1.5 rounded-xl text-sm"
                  style={{
                    background: yearRange === value ? B.ink : B.paper,
                    color: yearRange === value ? B.paperLight : B.ink,
                    border: `2px solid ${B.ink}`,
                    fontWeight: 700,
                  }}
                  onClick={() => setYearRange(value)}
                >
                  {value} năm
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 max-h-56 overflow-y-auto hide-scrollbar pr-1">
            <div className="flex flex-wrap gap-2">
              {visiblePrograms.map((program) => {
                const active = program.id === selectedProgramId;
                return (
                  <button
                    key={program.id}
                    className="px-3 py-1.5 rounded-xl text-sm"
                    style={{
                      background: active ? B.terracotta : B.paper,
                      color: active ? B.paperLight : B.ink,
                      border: `2px solid ${B.ink}`,
                      fontWeight: 700,
                    }}
                    onClick={() => setSelectedProgramId(program.id)}
                  >
                    {getProgramVariantLabel(program, major.name)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {methodSeries.length > 0 ? (
          methodSeries.map((series, index) => (
            <div key={series.method} style={handCard} className="p-6">
              <h2 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: "1.15rem", marginBottom: 16 }}>{series.method}</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={series.data} margin={{ top: 46, right: 24, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(43,39,34,.14)" />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: B.muted }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12, fill: B.muted }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `2px solid ${B.ink}`, background: B.paperLight, fontSize: 13 }} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={METHOD_COLORS[index % METHOD_COLORS.length]}
                    strokeWidth={2.5}
                    isAnimationActive={false}
                    dot={{ r: 4, fill: METHOD_COLORS[index % METHOD_COLORS.length] }}
                    name="Điểm"
                  >
                    <LabelList dataKey="score" content={<ScorePointLabel />} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))
        ) : (
          <div style={handCard} className="p-6 text-center">
            <p style={{ color: B.body, fontWeight: 700 }}>Hiện chương trình này không còn hoạt động</p>
            <p className="bunik-note-text" style={{ fontSize: 16, marginTop: 6 }}>Hãy chọn trường khác để xem thêm dữ liệu</p>
          </div>
        )}
      </div>
    </div>
  );
}
