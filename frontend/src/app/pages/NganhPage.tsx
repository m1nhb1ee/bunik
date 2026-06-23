import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { B, CenterNote, SketchHeading, accentFor, cardStyle, spark } from "../components/bunik";
import { getAllMajors } from "../services/api";
import type { UiMajor } from "../types/api";

const PAGE_SIZE = 9;
const MIN_SCORE = 14;
const MAX_SCORE = 30;

export default function NganhPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [blocksDropdownOpen, setBlocksDropdownOpen] = useState(false);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [majors, setMajors] = useState<UiMajor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [scoreSort, setScoreSort] = useState<"desc" | "asc">("desc");
  const [scoreMin, setScoreMin] = useState(MIN_SCORE);
  const [scoreMax, setScoreMax] = useState(MAX_SCORE);

  useEffect(() => {
    let active = true;
    getAllMajors()
      .then((data) => {
        if (active) setMajors(data);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Không thể tải danh sách ngành.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const majorGroups = useMemo(() => Array.from(new Set(majors.map((major) => major.group).filter(Boolean))), [majors]);
  const examBlocks = useMemo(() => Array.from(new Set(majors.flatMap((major) => major.blocks?.length ? major.blocks : [major.block]).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [majors]);
  const groupedExamBlocks = useMemo(() => {
    const groups = new Map<string, string[]>();

    for (const block of examBlocks) {
      const groupKey = block === "-" ? "-" : block[0].toUpperCase();
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(block);
    }

    return Array.from(groups.entries())
      .map(([label, blocks]) => ({ label, blocks: blocks.sort((left, right) => left.localeCompare(right)) }))
      .sort((left, right) => {
        if (left.label === "-") return -1;
        if (right.label === "-") return 1;
        return left.label.localeCompare(right.label);
      });
  }, [examBlocks]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("vi");
    return majors
      .filter((major) => !normalizedSearch || major.name.toLocaleLowerCase("vi").includes(normalizedSearch) || major.code.toLocaleLowerCase("vi").includes(normalizedSearch))
      .filter((major) => selectedGroups.length === 0 || selectedGroups.includes(major.group))
      .filter((major) => selectedBlocks.length === 0 || (major.blocks?.length ? major.blocks : [major.block]).some((block) => selectedBlocks.includes(block)))
      .filter((major) => typeof major.score30 === "number" && major.score30 >= scoreMin && major.score30 <= scoreMax)
      .sort((a, b) => {
        const left = a.score30 ?? (scoreSort === "desc" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
        const right = b.score30 ?? (scoreSort === "desc" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
        return scoreSort === "desc" ? right - left : left - right;
      });
  }, [majors, scoreMax, scoreMin, scoreSort, search, selectedBlocks, selectedGroups]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [scoreMax, scoreMin, search, selectedBlocks, selectedGroups]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const toggle = (value: string, setValues: Dispatch<SetStateAction<string[]>>) => {
    setValues((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const toggleCompare = (id: string) => {
    setCompareList((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 5 ? [...current, id] : current);
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedGroups([]);
    setSelectedBlocks([]);
    setScoreMin(MIN_SCORE);
    setScoreMax(MAX_SCORE);
  };

  return (
    <div className="bunik-page">
      <header className="bunik-container bunik-page-intro">
        <SketchHeading kicker="tra cứu ngành —" color={B.teal} width="70%">Danh sách ngành học</SketchHeading>
        <p className="bunik-note-text" style={{ fontSize: 19, margin: "21px 0 0", maxWidth: 620 }}>Tìm ngành theo nhóm, khối xét tuyển và vùng điểm chuẩn phù hợp với bạn.</p>
      </header>

      <main className="bunik-container" style={{ paddingBottom: compareList.length > 0 ? 122 : 56 }}>
        <section className="bunik-panel" style={{ padding: "clamp(16px,3vw,24px)", marginBottom: 28 }} aria-label="Bộ lọc ngành học">
          <label style={{ position: "relative", display: "block" }}>
            <span className="bunik-sr-only">Tìm ngành học</span>
            <Search size={19} style={{ position: "absolute", left: 15, top: 14, color: B.muted }} />
            <input className="bunik-field" style={{ paddingLeft: 44 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên hoặc mã ngành…" />
          </label>

          <div style={{ marginTop: 20 }}>
            <p className="bunik-note-text" style={{ fontSize: 17, margin: "0 0 9px" }}>nhóm ngành</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {majorGroups.map((group) => <button key={group} type="button" className="bunik-chip" data-active={selectedGroups.includes(group)} onClick={() => toggle(group, setSelectedGroups)}>{group}</button>)}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(220px,.6fr)", gap: 22, marginTop: 20 }} className="nganh-filter-grid">
            <div>
              <p className="bunik-note-text" style={{ fontSize: 17, margin: "0 0 9px" }}>khối xét tuyển</p>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="bunik-field"
                  onClick={() => setBlocksDropdownOpen((current) => !current)}
                  aria-expanded={blocksDropdownOpen}
                  aria-controls="exam-block-dropdown"
                  style={{
                    width: "100%",
                    minHeight: 46,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, textAlign: "left" }}>
                    <strong style={{ color: B.ink, fontSize: 13 }}>Chọn khối xét tuyển</strong>
                    <span style={{ color: B.muted, fontSize: 12 }}>{selectedBlocks.length > 0 ? `${selectedBlocks.length} khối đã chọn` : "Nhấn để mở danh sách khối theo chữ cái"}</span>
                  </span>
                  <span aria-hidden="true" style={{ color: B.muted, fontSize: 18, lineHeight: 1 }}>{blocksDropdownOpen ? "▴" : "▾"}</span>
                </button>

                {blocksDropdownOpen ? (
                  <div
                    id="exam-block-dropdown"
                    className="hide-scrollbar"
                    style={{
                      position: "absolute",
                      zIndex: 20,
                      top: "calc(100% + 8px)",
                      left: 0,
                      right: 0,
                      maxHeight: 320,
                      overflowY: "auto",
                      padding: 12,
                      border: `2px solid ${B.ink}`,
                      borderRadius: 18,
                      background: B.paperLight,
                      boxShadow: `6px 8px 0 ${B.ink}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                      <strong style={{ color: B.ink, fontSize: 13 }}>Chọn khối theo nhóm chữ cái</strong>
                      <button type="button" className="bunik-chip" onClick={() => setSelectedBlocks([])} style={{ minHeight: 28, padding: "3px 8px" }}>
                        Bỏ chọn
                      </button>
                    </div>

                    <div style={{ display: "grid", gap: 14 }}>
                      {groupedExamBlocks.map((group) => (
                        <section key={group.label}>
                          <p className="bunik-note-text" style={{ fontSize: 12, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.8 }}>
                            {group.label === "-" ? "Khác" : `Nhóm ${group.label}`}
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {group.blocks.map((block) => (
                              <button
                                key={block}
                                type="button"
                                className="bunik-chip"
                                data-active={selectedBlocks.includes(block)}
                                onClick={() => toggle(block, setSelectedBlocks)}
                              >
                                {block}
                              </button>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div>
              <p className="bunik-note-text" style={{ fontSize: 17, margin: "0 0 9px" }}>vùng điểm chuẩn</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                <label style={{ color: B.body, fontSize: 11, fontWeight: 700 }}>Từ<input className="bunik-field" style={{ minHeight: 40, marginTop: 4, padding: "7px 9px" }} type="number" min={MIN_SCORE} max={scoreMax} value={scoreMin} onChange={(event) => setScoreMin(Math.min(scoreMax, Math.max(MIN_SCORE, Number(event.target.value))))} /></label>
                <label style={{ color: B.body, fontSize: 11, fontWeight: 700 }}>Đến<input className="bunik-field" style={{ minHeight: 40, marginTop: 4, padding: "7px 9px" }} type="number" min={scoreMin} max={MAX_SCORE} value={scoreMax} onChange={(event) => setScoreMax(Math.max(scoreMin, Math.min(MAX_SCORE, Number(event.target.value))))} /></label>
              </div>
            </div>
          </div>
        </section>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          <p className="bunik-note-text" style={{ fontSize: 18, margin: 0 }}>{loading ? "đang tìm…" : `${filtered.length} ngành phù hợp`}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button className="bunik-chip" type="button" data-active={scoreSort === "desc"} onClick={() => setScoreSort("desc")}>Điểm cao → thấp</button>
            <button className="bunik-chip" type="button" data-active={scoreSort === "asc"} onClick={() => setScoreSort("asc")}>Điểm thấp → cao</button>
            {(search || selectedGroups.length || selectedBlocks.length || scoreMin !== MIN_SCORE || scoreMax !== MAX_SCORE) ? <button className="bunik-chip" type="button" onClick={clearFilters}><X size={14} /> Xóa lọc</button> : null}
          </div>
        </div>

        {loading ? <CenterNote title="Đang vẽ danh sách ngành…" /> : null}
        {!loading && error ? <CenterNote title="Chưa tải được danh sách ngành" sub={error} /> : null}
        {!loading && !error && pageItems.length === 0 ? <CenterNote title="Không tìm thấy ngành phù hợp" sub="Thử nới vùng điểm hoặc bỏ bớt bộ lọc" /> : null}

        {!loading && !error && pageItems.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 20 }}>
            {pageItems.map((major, index) => {
              const accent = accentFor(major.group || major.id);
              const values = Object.entries(major.scores).sort(([left], [right]) => Number(left) - Number(right)).map(([, value]) => value);
              const chart = spark(values);
              const selected = compareList.includes(major.id);
              return (
                <article key={major.id} className="bunik-lift" style={{ ...cardStyle({ shadow: `5px 6px 0 ${accent}`, rot: `${index % 2 === 0 ? "-.25" : ".25"}deg` }), position: "relative", padding: 20 }}>
                  <button type="button" aria-pressed={selected} onClick={() => toggleCompare(major.id)} style={{ position: "absolute", right: 14, top: 14, minWidth: 34, height: 34, padding: "0 8px", border: `1.5px solid ${B.ink}`, borderRadius: "10px 8px 9px 11px/11px 9px 8px 10px", background: selected ? B.ink : B.paper, color: selected ? B.paperLight : B.ink, fontSize: 12, fontWeight: 800 }}>{selected ? "✓" : "+"}</button>
                  <div style={{ paddingRight: 48 }}>
                    <span style={{ color: accent, fontSize: 11, fontWeight: 800 }}>{major.group || "Nhóm ngành đang cập nhật"}</span>
                    <h2 style={{ color: B.ink, fontSize: 16, lineHeight: 1.4, margin: "5px 0 2px" }}><Link to={`/nganh/${major.id}`} style={{ color: "inherit", textDecoration: "none" }}>{major.name}</Link></h2>
                    <p className="bunik-note-text" style={{ fontSize: 15, margin: 0 }}>{major.universityName || major.universityShortName || "Nhiều trường đào tạo"}</p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 132px", gap: 14, alignItems: "end", marginTop: 17 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {(major.blocks?.length ? major.blocks : [major.block]).slice(0, 3).filter(Boolean).map((block) => <span key={block} className="bunik-chip" style={{ minHeight: 27, padding: "2px 8px" }}>{block}</span>)}
                      {major.method ? <span className="bunik-chip" style={{ minHeight: 27, padding: "2px 8px", borderStyle: "dashed" }}>{major.method}</span> : null}
                    </div>
                    <svg viewBox="0 0 128 46" style={{ width: 128, height: 46, overflow: "visible" }} aria-label="Xu hướng điểm chuẩn">
                      <path d={chart.path} fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" filter="url(#inkrough2)" />
                      {chart.dots.map((dot, dotIndex) => <circle key={dotIndex} cx={dot.x} cy={dot.y} r="2.5" fill={B.paperLight} stroke={accent} strokeWidth="1.7" />)}
                    </svg>
                  </div>

                  <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 14, marginTop: 16, paddingTop: 13, borderTop: `1px dashed ${B.muted}` }}>
                    <div><span className="bunik-note-text" style={{ display: "block", fontSize: 14 }}>điểm gần nhất</span><strong style={{ fontFamily: "'Shantell Sans', cursive", color: accent, fontSize: 24 }}>{major.score30?.toFixed(2) ?? "—"}</strong></div>
                    <Link to={`/nganh/${major.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: B.terracotta, fontSize: 13, fontWeight: 750, textDecoration: "none" }}>Xem chi tiết <ChevronRight size={15} /></Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {!loading && !error && totalPages > 1 ? (
          <nav aria-label="Phân trang ngành học" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 30 }}>
            <button className="bunik-button bunik-button-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}><ChevronLeft size={17} /></button>
            <span className="bunik-note-text" style={{ fontSize: 18 }}>trang {page} / {totalPages}</span>
            <button className="bunik-button bunik-button-secondary" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}><ChevronRight size={17} /></button>
          </nav>
        ) : null}
      </main>

      {compareList.length > 0 ? (
        <aside style={{ position: "fixed", left: "50%", bottom: 18, zIndex: 60, width: "min(calc(100% - 24px),720px)", transform: "translateX(-50%)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 14px", ...cardStyle({ shadow: `5px 5px 0 ${B.teal}` }) }}>
          <div><strong style={{ display: "block", color: B.ink, fontSize: 13 }}>{compareList.length}/5 ngành đã chọn</strong><span className="bunik-note-text" style={{ fontSize: 14 }}>chọn thêm hoặc mở bảng so sánh</span></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="bunik-chip" type="button" onClick={() => setCompareList([])}>Xóa</button>
            <Link className="bunik-button" to={`/so-sanh?type=nganh&ids=${compareList.join(",")}`}>So sánh</Link>
          </div>
        </aside>
      ) : null}

      <style>{`@media (max-width:760px){.nganh-filter-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
