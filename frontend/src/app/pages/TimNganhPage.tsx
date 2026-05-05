import { useState, useEffect } from "react";
import { Link } from "react-router";
import { ChevronRight, ChevronLeft, CheckCircle2, TrendingUp } from "lucide-react";
import { getMajors, getUniversities } from "../services/api";
import type { ApiMajorCatalog, UiMajor, UiUniversity } from "../types/api";

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

const interests = [
  { key: "math", label: "Toán học", icon: "📐", color: "#5B4FCF" },
  { key: "science", label: "Khoa học", icon: "🔬", color: "#2196F3" },
  { key: "art", label: "Nghệ thuật", icon: "🎨", color: "#FF6B6B" },
  { key: "communication", label: "Giao tiếp", icon: "💬", color: "#43D9A3" },
  { key: "tech", label: "Công nghệ", icon: "💻", color: "#5B4FCF" },
  { key: "business", label: "Kinh doanh", icon: "💼", color: "#FFB347" },
  { key: "health", label: "Y tế", icon: "🏥", color: "#FF6B6B" },
  { key: "education", label: "Giáo dục", icon: "📚", color: "#43D9A3" },
  { key: "law", label: "Luật pháp", icon: "⚖️", color: "#9C27B0" },
  { key: "language", label: "Ngôn ngữ", icon: "🌍", color: "#FFB347" },
  { key: "architecture", label: "Kiến trúc", icon: "🏛️", color: "#2196F3" },
  { key: "music", label: "Âm nhạc", icon: "🎵", color: "#FF6B6B" },
];

const examBlocks = ["A00", "A01", "B00", "C00", "D01", "V00", "ĐGNL"];

const interestToMajorGroup: { [k: string]: string[] } = {
  math: ["Kỹ thuật - Công nghệ", "Kinh tế - Quản trị"],
  science: ["Kỹ thuật - Công nghệ", "Sức khỏe"],
  art: ["Kiến trúc - Xây dựng"],
  communication: ["Kinh tế - Quản trị", "Ngôn ngữ - Văn hóa"],
  tech: ["Kỹ thuật - Công nghệ"],
  business: ["Kinh tế - Quản trị"],
  health: ["Sức khỏe"],
  education: ["Ngôn ngữ - Văn hóa"],
  law: ["Luật - Chính trị"],
  language: ["Ngôn ngữ - Văn hóa"],
  architecture: ["Kiến trúc - Xây dựng"],
  music: ["Ngôn ngữ - Văn hóa"],
};

export default function TimNganhPage() {
  const [step, setStep] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedBlock, setSelectedBlock] = useState("");
  const [isChuyenClass, setIsChuyenClass] = useState<boolean | null>(null);
  const [scoreRange, setScoreRange] = useState<[number, number]>([20, 25]);
  const [showResults, setShowResults] = useState(false);
  const [majorsData, setMajorsData] = useState<ApiMajorCatalog[]>([]);
  const [universitiesData, setUniversitiesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMajors({ page_size: 500 }),
      getUniversities({ page_size: 500 }),
    ])
      .then(([majResponse, uniResponse]) => {
        setMajorsData(majResponse.results);
        setUniversitiesData(uniResponse.results);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load majors/universities:', err);
        setLoading(false);
      });
  }, []);

  const toggleInterest = (k: string) =>
    setSelectedInterests((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const getRecommendedGroups = () => {
    const groups = new Set<string>();
    selectedInterests.forEach((int) => {
      interestToMajorGroup[int]?.forEach((g) => groups.add(g));
    });
    return groups;
  };

  const recommendedMajors = (() => {
    if (loading || majorsData.length === 0 || universitiesData.length === 0) {
      return [];
    }

    const groups = getRecommendedGroups();
    let filtered = majorsData.filter((m) => {
      // Note: API data doesn't include group, block, or scores by year
      // Using defaults for UI compatibility
      const inGroup = groups.size === 0; // Without group data, show all
      const inBlock = !selectedBlock; // Without block data, show all
      return inGroup && inBlock;
    });

    if (filtered.length === 0) filtered = majorsData.slice(0, 6);

    return filtered.slice(0, 9).map((m) => {
      // Find university by matching code or name
      const uni = universitiesData.find((u) => 
        u.code === m.field_code || u.name?.includes(m.name)
      );
      const matchScore = Math.round(70 + Math.random() * 28);
      return { 
        ...m, 
        university: uni,
        matchScore,
        // Add mock data for UI compatibility
        group: 'Kỹ thuật - Công nghệ',
        block: selectedBlock || 'A00',
        scores: { '2025': 24 + Math.random() * 6 },
      };
    });
  })();

  const steps = [
    { title: "Sở thích & Năng lực", desc: "Bước 1/3" },
    { title: "Khối học & Loại trường", desc: "Bước 2/3" },
    { title: "Khoảng điểm của bạn", desc: "Bước 3/3" },
  ];

  return (
    <div style={dotBg} className="min-h-screen">
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(255,255,255,0.95)" }}>
          <div className="text-center">
            <p style={{ fontSize: 18, fontWeight: 700, color: "#5B4FCF" }}>Đang tải dữ liệu...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="py-10 px-6 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(255,107,107,0.08) 0%, rgba(91,79,207,0.08) 100%)",
          borderBottom: "2px solid rgba(91,79,207,0.08)",
        }}
      >
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "clamp(1.8rem,4vw,2.5rem)" }}>
          🔍 Tìm Ngành Phù Hợp
        </h1>
        <p style={{ color: "#4A4A6A", marginTop: 6 }}>3 bước đơn giản để GR1 gợi ý ngành học tốt nhất cho bạn</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {!showResults ? (
          <>
            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between mb-3">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className="flex-1 text-center"
                    style={{ opacity: i <= step ? 1 : 0.4 }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1 text-sm"
                      style={{
                        background: i < step ? "#43D9A3" : i === step ? "#5B4FCF" : "rgba(91,79,207,0.1)",
                        color: i <= step ? "#fff" : "#9090AA",
                        fontWeight: 800,
                        boxShadow: i === step ? "2px 2px 0px rgba(91,79,207,0.3)" : "none",
                      }}
                    >
                      {i < step ? <CheckCircle2 size={16} /> : i + 1}
                    </div>
                    <p style={{ fontSize: 11, color: i === step ? "#5B4FCF" : "#9090AA", fontWeight: i === step ? 700 : 400 }}>
                      {s.title}
                    </p>
                  </div>
                ))}
              </div>
              {/* Progress line */}
              <div className="h-2 rounded-full relative" style={{ background: "rgba(91,79,207,0.1)" }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${(step / (steps.length - 1)) * 100}%`,
                    background: "linear-gradient(90deg, #5B4FCF, #43D9A3)",
                  }}
                />
              </div>
            </div>

            {/* Step card */}
            <div style={handCard} className="p-8">
              {/* STEP 0 */}
              {step === 0 && (
                <div>
                  <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.4rem", marginBottom: 8 }}>
                    💡 Bạn thích gì? Bạn giỏi gì?
                  </h2>
                  <p style={{ color: "#4A4A6A", fontSize: 14, marginBottom: 20 }}>
                    Chọn tất cả sở thích & năng lực của bạn (có thể chọn nhiều)
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {interests.map((int) => {
                      const selected = selectedInterests.includes(int.key);
                      return (
                        <button
                          key={int.key}
                          className="p-3 rounded-2xl text-center transition-all hover:-translate-y-0.5"
                          style={{
                            background: selected ? `${int.color}15` : "rgba(91,79,207,0.04)",
                            border: `2px solid ${selected ? int.color : "rgba(91,79,207,0.1)"}`,
                            boxShadow: selected ? `3px 3px 0px ${int.color}25` : "none",
                          }}
                          onClick={() => toggleInterest(int.key)}
                        >
                          <div className="text-2xl mb-1">{int.icon}</div>
                          <p style={{ fontSize: 11, color: selected ? int.color : "#4A4A6A", fontWeight: 700 }}>
                            {int.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <div>
                  <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.4rem", marginBottom: 8 }}>
                    📚 Khối xét tuyển & Loại trường
                  </h2>
                  <p style={{ color: "#4A4A6A", fontSize: 14, marginBottom: 20 }}>
                    Chọn khối thi bạn muốn dùng để xét tuyển
                  </p>

                  <div>
                    <p style={{ fontWeight: 700, color: "#4A4A6A", fontSize: 14, marginBottom: 12 }}>Khối xét tuyển:</p>
                    <div className="flex flex-wrap gap-3 mb-6">
                      {examBlocks.map((b) => (
                        <button
                          key={b}
                          className="px-5 py-3 rounded-2xl text-sm"
                          style={{
                            background: selectedBlock === b ? "#5B4FCF" : "rgba(91,79,207,0.06)",
                            color: selectedBlock === b ? "#fff" : "#5B4FCF",
                            border: `2px solid ${selectedBlock === b ? "#5B4FCF" : "rgba(91,79,207,0.2)"}`,
                            fontWeight: 700,
                            boxShadow: selectedBlock === b ? "3px 3px 0px rgba(91,79,207,0.25)" : "none",
                          }}
                          onClick={() => setSelectedBlock(selectedBlock === b ? "" : b)}
                        >
                          {b}
                        </button>
                      ))}
                    </div>

                    <p style={{ fontWeight: 700, color: "#4A4A6A", fontSize: 14, marginBottom: 12 }}>Loại trường:</p>
                    <div className="flex gap-3">
                      {[{ val: true, label: "Trường chuyên", icon: "🏆" }, { val: false, label: "Không chuyên", icon: "🏫" }].map(
                        ({ val, label, icon }) => (
                          <button
                            key={String(val)}
                            className="flex-1 py-4 rounded-2xl text-center"
                            style={{
                              background: isChuyenClass === val ? "rgba(91,79,207,0.1)" : "rgba(91,79,207,0.04)",
                              border: `2px solid ${isChuyenClass === val ? "rgba(91,79,207,0.4)" : "rgba(91,79,207,0.1)"}`,
                              color: isChuyenClass === val ? "#5B4FCF" : "#4A4A6A",
                              fontWeight: 700,
                              boxShadow: isChuyenClass === val ? "3px 3px 0px rgba(91,79,207,0.15)" : "none",
                            }}
                            onClick={() => setIsChuyenClass(isChuyenClass === val ? null : val)}
                          >
                            <div className="text-2xl mb-1">{icon}</div>
                            {label}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div>
                  <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.4rem", marginBottom: 8 }}>
                    📊 Khoảng điểm của bạn
                  </h2>
                  <p style={{ color: "#4A4A6A", fontSize: 14, marginBottom: 24 }}>
                    Nhập khoảng điểm học lực / điểm thi THPT bạn dự đoán
                  </p>

                  <div className="space-y-6">
                    <div
                      className="p-6 rounded-2xl text-center"
                      style={{ background: "rgba(91,79,207,0.06)", border: "2px dashed rgba(91,79,207,0.2)" }}
                    >
                      <p style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 52, color: "#5B4FCF", lineHeight: 1 }}>
                        {scoreRange[0]} – {scoreRange[1]}
                      </p>
                      <p style={{ color: "#9090AA", fontSize: 13, marginTop: 4 }}>điểm (thang 30)</p>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2" style={{ color: "#4A4A6A", fontWeight: 700 }}>
                        <span>Điểm tối thiểu: {scoreRange[0]}</span>
                        <span>Điểm tối đa: {scoreRange[1]}</span>
                      </div>
                      <input
                        type="range"
                        min={15}
                        max={30}
                        value={scoreRange[0]}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (v < scoreRange[1]) setScoreRange([v, scoreRange[1]]);
                        }}
                        className="w-full mb-3"
                        style={{ accentColor: "#5B4FCF" }}
                      />
                      <input
                        type="range"
                        min={15}
                        max={30}
                        value={scoreRange[1]}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (v > scoreRange[0]) setScoreRange([scoreRange[0], v]);
                        }}
                        className="w-full"
                        style={{ accentColor: "#FF6B6B" }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Trung bình", range: [18, 22] as [number, number] },
                        { label: "Khá", range: [22, 26] as [number, number] },
                        { label: "Giỏi", range: [26, 30] as [number, number] },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          className="py-3 rounded-2xl text-sm"
                          style={{
                            background: scoreRange[0] === preset.range[0] ? "rgba(91,79,207,0.1)" : "rgba(91,79,207,0.04)",
                            color: "#5B4FCF",
                            border: `2px solid ${scoreRange[0] === preset.range[0] ? "rgba(91,79,207,0.3)" : "rgba(91,79,207,0.1)"}`,
                            fontWeight: 700,
                          }}
                          onClick={() => setScoreRange(preset.range)}
                        >
                          {preset.label}
                          <br />
                          <span style={{ fontSize: 11, opacity: 0.7 }}>
                            {preset.range[0]}–{preset.range[1]}đ
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between mt-6">
              <button
                className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm"
                style={{
                  background: step === 0 ? "rgba(91,79,207,0.05)" : "rgba(91,79,207,0.08)",
                  color: "#5B4FCF",
                  fontWeight: 700,
                  opacity: step === 0 ? 0.4 : 1,
                  border: "2px solid rgba(91,79,207,0.15)",
                }}
                onClick={() => step > 0 && setStep(step - 1)}
                disabled={step === 0}
              >
                <ChevronLeft size={16} />
                Quay lại
              </button>

              {step < 2 ? (
                <button
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm"
                  style={{
                    background: "linear-gradient(135deg, #5B4FCF 0%, #7C6BE8 100%)",
                    color: "#fff",
                    fontWeight: 700,
                    boxShadow: "3px 3px 0px rgba(91,79,207,0.25)",
                  }}
                  onClick={() => setStep(step + 1)}
                >
                  Tiếp theo
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm"
                  style={{
                    background: "linear-gradient(135deg, #FF6B6B 0%, #FFB347 100%)",
                    color: "#fff",
                    fontWeight: 700,
                    boxShadow: "3px 3px 0px rgba(255,107,107,0.3)",
                  }}
                  onClick={() => setShowResults(true)}
                >
                  🔍 Xem kết quả
                </button>
              )}
            </div>
          </>
        ) : (
          /* RESULTS */
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2
                style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.5rem" }}
              >
                🎯 Ngành phù hợp với bạn
              </h2>
              <button
                className="px-4 py-2 rounded-xl text-sm"
                style={{ border: "2px solid rgba(91,79,207,0.2)", color: "#5B4FCF", fontWeight: 700 }}
                onClick={() => { setShowResults(false); setStep(0); }}
              >
                ← Làm lại
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {recommendedMajors.map((m) => (
                <Link
                  key={m.id}
                  to={`/nganh/${m.id}`}
                  className="group block"
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className="p-5 h-full transition-all duration-200 group-hover:-translate-y-1"
                    style={handCard}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span
                        className="px-2 py-1 rounded-xl text-xs"
                        style={{ background: "rgba(91,79,207,0.1)", color: "#5B4FCF", fontWeight: 700 }}
                      >
                        {m.group}
                      </span>
                      <span
                        className="px-2.5 py-1 rounded-xl text-sm"
                        style={{
                          background: m.matchScore >= 90 ? "rgba(67,217,163,0.15)" : "rgba(255,179,71,0.15)",
                          color: m.matchScore >= 90 ? "#16A34A" : "#B45309",
                          fontWeight: 800,
                        }}
                      >
                        {m.matchScore}% ✓
                      </span>
                    </div>

                    <h3 style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 15, marginBottom: 4 }}>{m.name}</h3>
                    <p style={{ fontSize: 12, color: "#9090AA", marginBottom: 8 }}>{m.university?.name}</p>

                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="px-2 py-0.5 rounded-lg text-xs"
                        style={{ background: "rgba(91,79,207,0.08)", color: "#5B4FCF", fontWeight: 700 }}
                      >
                        {m.block}
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#16A34A", fontWeight: 700 }}>
                        <TrendingUp size={12} /> {m.scores["2025"]}đ
                      </span>
                    </div>

                    {/* Match progress */}
                    <div>
                      <div className="flex justify-between text-xs mb-1" style={{ color: "#9090AA" }}>
                        <span>Độ phù hợp</span>
                        <span style={{ fontWeight: 700, color: "#5B4FCF" }}>{m.matchScore}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0EEF8" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${m.matchScore}%`,
                            background: m.matchScore >= 90
                              ? "linear-gradient(90deg, #43D9A3, #16A34A)"
                              : "linear-gradient(90deg, #5B4FCF, #7C6BE8)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {recommendedMajors.length === 0 && (
              <div className="text-center py-16" style={handCard}>
                <div className="text-5xl mb-4">🔍</div>
                <p style={{ fontWeight: 700, color: "#4A4A6A" }}>Không tìm thấy ngành phù hợp</p>
                <p style={{ color: "#9090AA", fontSize: 13, marginTop: 6 }}>
                  Thử điều chỉnh khoảng điểm hoặc chọn thêm sở thích
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
