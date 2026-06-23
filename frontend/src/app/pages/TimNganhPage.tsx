import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, RotateCcw, TrendingUp } from "lucide-react";
import { Link } from "react-router";
import { B, CenterNote, SketchHeading, accentFor, cardStyle } from "../components/bunik";
import { getMajorOverview, getMajorRecommendations } from "../services/api";
import type { ApiMajorRecommendation } from "../types/api";

const interests = [
  { key: "math", label: "Toán học", color: B.terracotta },
  { key: "science", label: "Khoa học", color: B.teal },
  { key: "art", label: "Nghệ thuật", color: B.plum },
  { key: "communication", label: "Giao tiếp", color: B.honey },
  { key: "tech", label: "Công nghệ", color: B.indigo },
  { key: "business", label: "Kinh doanh", color: B.olive },
  { key: "health", label: "Y tế", color: B.rust },
  { key: "education", label: "Giáo dục", color: B.teal },
  { key: "law", label: "Luật pháp", color: B.plum },
  { key: "language", label: "Ngôn ngữ", color: B.honey },
  { key: "architecture", label: "Kiến trúc", color: B.brown },
  { key: "music", label: "Âm nhạc", color: B.terracotta },
];

const steps = [
  { title: "Sở thích & năng lực", note: "chọn những điều khiến bạn hứng thú" },
  { title: "Khối xét tuyển", note: "thêm một chút bối cảnh học tập" },
  { title: "Khoảng điểm", note: "ước lượng vùng điểm phù hợp" },
] as const;

export default function TimNganhPage() {
  const [step, setStep] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedBlock, setSelectedBlock] = useState("");
  const [isChuyenClass, setIsChuyenClass] = useState<boolean | null>(null);
  const [scoreRange, setScoreRange] = useState<[number, number]>([20, 25]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState("");
  const [examBlocks, setExamBlocks] = useState<string[]>([]);
  const [recommendedMajors, setRecommendedMajors] = useState<ApiMajorRecommendation[]>([]);

  useEffect(() => {
    let active = true;
    getMajorOverview()
      .then((response) => {
        if (!active) return;
        const blocks = Array.from(new Set(response.results.flatMap((major) => major.blocks ?? []).filter(Boolean)));
        setExamBlocks(blocks);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu ngành.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  const toggleInterest = (key: string) => {
    setSelectedInterests((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const runRecommendation = async () => {
    setShowResults(true);
    setLoadingResults(true);
    setError("");
    try {
      const data = await getMajorRecommendations({
        interests: selectedInterests.join(","),
        block: selectedBlock || undefined,
        score_min: scoreRange[0],
        score_max: scoreRange[1],
        is_chuyen_class: isChuyenClass ?? undefined,
        limit: 9,
      });
      setRecommendedMajors(data);
    } catch (reason) {
      setRecommendedMajors([]);
      setError(reason instanceof Error ? reason.message : "Không thể tạo gợi ý ngành lúc này.");
    } finally {
      setLoadingResults(false);
    }
  };

  const reset = () => {
    setStep(0);
    setShowResults(false);
    setRecommendedMajors([]);
    setError("");
  };

  return (
    <div className="bunik-page">
      <header className="bunik-container bunik-page-intro" style={{ textAlign: "center" }}>
        <SketchHeading kicker="trắc nghiệm vui —" color={B.terracotta} width="92%">
          Ngành nào hợp với bạn?
        </SketchHeading>
        <p className="bunik-note-text" style={{ fontSize: 19, margin: "22px auto 0", maxWidth: 650 }}>
          Ba bước ngắn để bunik tìm các ngành phù hợp với sở thích, khối xét tuyển và khoảng điểm của bạn.
        </p>
      </header>

      <main className="bunik-container" style={{ width: "min(100% - 24px, 830px)", paddingBottom: 56 }}>
        {loading ? <CenterNote title="Đang chuẩn bị câu hỏi…" /> : null}

        {!loading && !showResults ? (
          <>
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span className="bunik-note-text" style={{ fontSize: 18 }}>câu {step + 1} / {steps.length}</span>
                <span style={{ color: B.body, fontSize: 12, fontWeight: 750 }}>{steps[step].title}</span>
              </div>
              <div style={{ height: 10, border: `2px solid ${B.ink}`, borderRadius: 999, background: B.paperLight, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: B.terracotta, transition: "width .28s ease" }} />
              </div>
            </div>

            <section style={{ ...cardStyle({ shadow: `6px 7px 0 ${B.honey}` }), padding: "clamp(22px,5vw,36px)" }}>
              <h2 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: "clamp(1.35rem,4vw,1.75rem)", color: B.ink, margin: 0 }}>{steps[step].title}</h2>
              <p className="bunik-note-text" style={{ fontSize: 17, margin: "4px 0 22px" }}>{steps[step].note}</p>

              {step === 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))", gap: 11 }}>
                  {interests.map((interest) => {
                    const selected = selectedInterests.includes(interest.key);
                    return (
                      <button key={interest.key} type="button" aria-pressed={selected} onClick={() => toggleInterest(interest.key)} style={{ minHeight: 104, position: "relative", display: "grid", placeItems: "center", alignContent: "center", gap: 5, padding: 12, border: `2px solid ${B.ink}`, borderRadius: "15px 12px 16px 11px/11px 16px 12px 15px", background: selected ? `${interest.color}22` : B.paper, color: selected ? interest.color : B.body, boxShadow: selected ? `3px 3px 0 ${interest.color}` : "none", fontWeight: 750, transition: "transform .14s ease,box-shadow .14s ease" }}>
                        {selected ? <Check size={16} style={{ position: "absolute", right: 8, top: 8, color: B.ink }} /> : null}
                        <span style={{ fontSize: 12 }}>{interest.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {step === 1 ? (
                <div style={{ display: "grid", gap: 24 }}>
                  <div>
                    <p style={{ color: B.body, fontSize: 13, fontWeight: 750, margin: "0 0 10px" }}>Khối xét tuyển</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                      {examBlocks.map((block) => <button key={block} type="button" className="bunik-chip" data-active={selectedBlock === block} onClick={() => setSelectedBlock(selectedBlock === block ? "" : block)}>{block}</button>)}
                    </div>
                  </div>
                  <div>
                    <p style={{ color: B.body, fontSize: 13, fontWeight: 750, margin: "0 0 10px" }}>Môi trường học hiện tại</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                      {[{ value: true, label: "Trường chuyên", icon: "🏆" }, { value: false, label: "Không chuyên", icon: "🏫" }].map((option) => {
                        const selected = isChuyenClass === option.value;
                        return <button key={String(option.value)} type="button" aria-pressed={selected} onClick={() => setIsChuyenClass(selected ? null : option.value)} style={{ minHeight: 92, border: `2px solid ${B.ink}`, borderRadius: "15px 12px 16px 11px/11px 16px 12px 15px", background: selected ? "rgba(46,106,98,.15)" : B.paper, color: selected ? B.teal : B.body, boxShadow: selected ? `3px 3px 0 ${B.teal}` : "none", fontWeight: 750 }}><span style={{ display: "block", fontSize: 23, marginBottom: 4 }}>{option.icon}</span>{option.label}</button>;
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div>
                  <div style={{ padding: 22, marginBottom: 24, textAlign: "center", border: `2px dashed ${B.ink}`, borderRadius: "16px 12px 18px 14px/14px 18px 12px 16px", background: "rgba(206,155,78,.12)" }}>
                    <p style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: "clamp(2.3rem,8vw,3.5rem)", color: B.terracotta, lineHeight: 1, margin: 0 }}>{scoreRange[0]} – {scoreRange[1]}</p>
                    <p className="bunik-note-text" style={{ fontSize: 17, margin: "5px 0 0" }}>điểm trên thang 30</p>
                  </div>
                  <div className="score-slider-zone" style={{ display: "grid", gap: 18 }}>
                    <label style={{ color: B.body, fontSize: 13, fontWeight: 750 }}>
                      Điểm tối thiểu: {scoreRange[0]}
                      <input className="score-range" type="range" min={15} max={30} value={scoreRange[0]} onChange={(event) => { const value = Number(event.target.value); if (value < scoreRange[1]) setScoreRange([value, scoreRange[1]]); }} style={{ width: "100%", marginTop: 8, accentColor: B.teal }} />
                    </label>
                    <label style={{ color: B.body, fontSize: 13, fontWeight: 750 }}>
                      Điểm tối đa: {scoreRange[1]}
                      <input className="score-range" type="range" min={15} max={30} value={scoreRange[1]} onChange={(event) => { const value = Number(event.target.value); if (value > scoreRange[0]) setScoreRange([scoreRange[0], value]); }} style={{ width: "100%", marginTop: 8, accentColor: B.terracotta }} />
                    </label>
                  </div>
                </div>
              ) : null}
            </section>

            {error ? <p role="alert" style={{ color: B.rust, fontSize: 13, fontWeight: 700, textAlign: "center", marginTop: 18 }}>{error}</p> : null}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 22 }}>
              <button type="button" className="bunik-button bunik-button-secondary" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><ChevronLeft size={17} /> Quay lại</button>
              {step < steps.length - 1 ? (
                <button type="button" className="bunik-button" onClick={() => setStep((current) => current + 1)}>Tiếp theo <ChevronRight size={17} /></button>
              ) : (
                <button type="button" className="bunik-button" onClick={runRecommendation}>Xem kết quả ✦</button>
              )}
            </div>
          </>
        ) : null}

        {!loading && showResults ? (
          <section>
            <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
              <div>
                <p className="bunik-note-text" style={{ fontSize: 18, margin: 0 }}>bunik gợi ý —</p>
                <h2 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: "clamp(1.5rem,5vw,2rem)", color: B.ink, margin: "2px 0 0" }}>Ngành phù hợp với bạn</h2>
              </div>
              <button type="button" className="bunik-button bunik-button-secondary" onClick={reset}><RotateCcw size={16} /> Làm lại</button>
            </div>

            {loadingResults ? <div className="bunik-panel"><CenterNote title="Đang tìm con đường phù hợp…" /></div> : null}
            {!loadingResults && error ? <div className="bunik-panel"><CenterNote title="Chưa thể tạo gợi ý" sub={error} /></div> : null}
            {!loadingResults && !error && recommendedMajors.length === 0 ? <div className="bunik-panel"><CenterNote title="Chưa tìm thấy ngành phù hợp" sub="Hãy thử nới khoảng điểm hoặc chọn thêm sở thích" /></div> : null}

            {!loadingResults && !error && recommendedMajors.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 18 }}>
                {recommendedMajors.map((major) => {
                  const accent = accentFor(major.id);
                  return (
                    <Link key={major.id} to={`/nganh/${major.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      <article className="bunik-lift" style={{ ...cardStyle({ shadow: `5px 6px 0 ${accent}` }), height: "100%", boxSizing: "border-box", padding: 19 }}>
                        <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ color: accent, fontSize: 11, fontWeight: 800 }}>{major.group}</span>
                          <span style={{ flex: "none", padding: "4px 8px", border: `1.5px solid ${B.ink}`, borderRadius: 9, background: major.match_score >= 90 ? "rgba(126,143,94,.18)" : "rgba(206,155,78,.18)", color: major.match_score >= 90 ? B.olive : B.brown, fontSize: 12, fontWeight: 800 }}>{major.match_score}%</span>
                        </div>
                        <h3 style={{ color: B.ink, fontSize: 15, lineHeight: 1.45, margin: "12px 0 3px" }}>{major.name}</h3>
                        <p className="bunik-note-text" style={{ fontSize: 15, margin: 0 }}>{major.university_name || "Nhiều trường đào tạo"}</p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
                          <span className="bunik-chip" style={{ minHeight: 28, padding: "3px 9px" }}>{major.block || "—"}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: B.teal, fontSize: 12, fontWeight: 750 }}><TrendingUp size={13} /> {major.score_2025 ?? "—"} điểm</span>
                        </div>
                        <div style={{ height: 8, marginTop: 13, border: `1.5px solid ${B.ink}`, borderRadius: 999, background: B.paper, overflow: "hidden" }}><div style={{ width: `${major.match_score}%`, height: "100%", background: accent }} /></div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
