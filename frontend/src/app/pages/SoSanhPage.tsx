import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, Plus, Search, X } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { RADAR_CRITERIA, getAllMajors, getAllUniversities } from "../services/api";
import type { UiMajor, UiUniversity } from "../types/api";
import { B, CenterNote, SketchHeading, accentFor, cardStyle } from "../components/bunik";

type Item = UiUniversity | UiMajor;
type Row = { label: string; key: string; best?: "max" | "min" };

const universityRows: Row[] = [
  { label: "Xếp hạng", key: "ranking", best: "min" },
  { label: "Điểm chuẩn TB", key: "avgAdmScore", best: "max" },
  { label: "Đánh giá", key: "userRating", best: "max" },
  { label: "Điểm tổng hợp", key: "overallScore", best: "max" },
  { label: "Thành phố", key: "city" },
];

const majorRows: Row[] = [
  { label: "Nhóm ngành", key: "group" },
  { label: "Khối thi", key: "block" },
  { label: "Điểm 2023", key: "score2023", best: "max" },
  { label: "Điểm 2024", key: "score2024", best: "max" },
  { label: "Điểm 2025", key: "score2025", best: "max" },
];

const radarCriteria = [...RADAR_CRITERIA];

function isUniversity(item: Item): item is UiUniversity {
  return "abbr" in item;
}

function getValue(item: Item, key: string): string | number {
  if (key === "score2023") return (item as UiMajor).scores?.["2023"] ?? "—";
  if (key === "score2024") return (item as UiMajor).scores?.["2024"] ?? "—";
  if (key === "score2025") return (item as UiMajor).scores?.["2025"] ?? "—";
  const value = (item as unknown as Record<string, unknown>)[key];
  return typeof value === "number" || typeof value === "string" ? value : "—";
}

export default function SoSanhPage() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") === "nganh" ? "nganh" : "truong";
  const initialIds = searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  const [compareIds, setCompareIds] = useState<string[]>(initialIds.slice(0, 5));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dataSource, setDataSource] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const request = type === "nganh" ? getAllMajors() : getAllUniversities();
    request
      .then((data) => {
        if (active) setDataSource(data as Item[]);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu so sánh.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type]);

  useEffect(() => {
    if (!searchOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [searchOpen]);

  const items = useMemo(
    () => compareIds.map((id) => dataSource.find((item) => item.id === id)).filter((item): item is Item => Boolean(item)),
    [compareIds, dataSource],
  );

  const searchResults = useMemo(() => {
    const normalized = searchQuery.trim().toLocaleLowerCase("vi");
    const source = normalized
      ? dataSource.filter((item) => item.name.toLocaleLowerCase("vi").includes(normalized))
      : dataSource;
    return source.slice(0, 10);
  }, [dataSource, searchQuery]);

  const radarData = useMemo(() => {
    if (type !== "truong") return [];
    return radarCriteria.map((criterion) => {
      const row: Record<string, string | number> = { subject: criterion };
      items.forEach((item, index) => {
        if (!isUniversity(item)) return;
        const match = item.radarScores?.find((score) => score.criteria === criterion);
        row[`series${index}`] = match?.score ?? 0;
      });
      return row;
    });
  }, [items, type]);

  const rows = type === "truong" ? universityRows : majorRows;

  const addItem = (id: string) => {
    setCompareIds((current) => (current.includes(id) || current.length >= 5 ? current : [...current, id]));
    setSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="bunik-page">
      <header className="bunik-container bunik-page-intro" style={{ textAlign: "center" }}>
        <SketchHeading kicker="đặt cạnh nhau —" color={B.teal} width="88%">
          So sánh {type === "truong" ? "trường đại học" : "ngành học"}
        </SketchHeading>
        <p className="bunik-note-text" style={{ fontSize: 19, margin: "22px auto 0", maxWidth: 620 }}>
          Chọn tối đa 5 {type === "truong" ? "trường" : "ngành"} để nhìn rõ điểm mạnh của từng lựa chọn.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          <Link to="/so-sanh?type=truong" className="bunik-chip" data-active={type === "truong"}>
            Trường đại học
          </Link>
          <Link to="/so-sanh?type=nganh" className="bunik-chip" data-active={type === "nganh"}>
            Ngành học
          </Link>
        </div>
      </header>

      <main className="bunik-container" style={{ paddingBottom: 52 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <p className="bunik-note-text" style={{ fontSize: 18, margin: 0 }}>
            {items.length}/5 lựa chọn đang được so sánh
          </p>
          {compareIds.length < 5 ? (
            <button className="bunik-button" type="button" onClick={() => setSearchOpen(true)}>
              <Plus size={17} /> Thêm {type === "truong" ? "trường" : "ngành"}
            </button>
          ) : null}
        </div>

        {loading ? <CenterNote title="Đang mở sổ dữ liệu…" sub="Chỉ mất một chút thôi" /> : null}
        {!loading && error ? <CenterNote title="Chưa tải được dữ liệu" sub={error} /> : null}

        {!loading && !error && items.length === 0 ? (
          <div className="bunik-panel">
            <CenterNote title="Chưa có lựa chọn nào" sub={`Nhấn “Thêm ${type === "truong" ? "trường" : "ngành"}” để bắt đầu so sánh`} />
            <div style={{ display: "flex", justifyContent: "center", padding: "0 20px 36px" }}>
              <button className="bunik-button" type="button" onClick={() => setSearchOpen(true)}>
                <Plus size={17} /> Bắt đầu so sánh
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <>
            <section className="bunik-panel" style={{ overflow: "hidden" }} aria-label="Bảng so sánh">
              <div className="bunik-table-wrap">
                <table className="bunik-table" style={{ minWidth: Math.max(660, 190 + items.length * 185) }}>
                  <thead>
                    <tr>
                      <th style={{ width: 170, position: "sticky", left: 0, zIndex: 2, background: B.paperLight }}>Tiêu chí</th>
                      {items.map((item, index) => {
                        const accent = accentFor(item.id);
                        return (
                          <th key={item.id} style={{ minWidth: 185, textAlign: "center" }}>
                            <div style={{ display: "grid", justifyItems: "center", gap: 7, position: "relative" }}>
                              <button
                                type="button"
                                onClick={() => setCompareIds((current) => current.filter((id) => id !== item.id))}
                                aria-label={`Bỏ ${item.name} khỏi so sánh`}
                                style={{ position: "absolute", right: 1, top: -2, width: 28, height: 28, border: `1.5px solid ${B.ink}`, borderRadius: "50%", background: B.paper, color: B.rust, display: "grid", placeItems: "center" }}
                              >
                                <X size={14} />
                              </button>
                              <span style={{ width: 50, height: 50, display: "grid", placeItems: "center", border: `2px solid ${B.ink}`, borderRadius: "15px 11px 14px 12px/12px 14px 11px 15px", background: accent, color: B.paperLight, fontFamily: "'Shantell Sans', cursive", fontSize: 13, boxShadow: `3px 3px 0 ${B.ink}` }}>
                                {isUniversity(item) ? item.abbr.slice(0, 4) : item.name.slice(0, 3)}
                              </span>
                              <span style={{ color: B.ink, fontSize: 12, lineHeight: 1.45, textTransform: "none", letterSpacing: 0 }}>{item.name}</span>
                              {index === 0 ? <span className="bunik-sr-only">Lựa chọn đầu tiên</span> : null}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const numeric = items.map((item) => Number(getValue(item, row.key)));
                      const validNumeric = row.best && numeric.every((value) => Number.isFinite(value));
                      const bestValue = validNumeric
                        ? row.best === "min"
                          ? Math.min(...numeric)
                          : Math.max(...numeric)
                        : null;
                      return (
                        <tr key={row.key}>
                          <td style={{ position: "sticky", left: 0, zIndex: 1, background: B.paperLight, color: B.body, fontWeight: 700 }}>{row.label}</td>
                          {items.map((item, index) => {
                            const value = getValue(item, row.key);
                            const best = bestValue !== null && numeric[index] === bestValue && items.length > 1;
                            return (
                              <td key={item.id} style={{ textAlign: "center", background: best ? "rgba(126,143,94,.15)" : "transparent" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: best ? B.olive : B.ink, fontFamily: typeof value === "number" ? "'Shantell Sans', cursive" : undefined, fontWeight: 750, fontSize: typeof value === "number" ? 18 : 14 }}>
                                  {best ? <Check size={15} strokeWidth={3} /> : null}
                                  {value || "—"}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {type === "truong" && items.length >= 2 ? (
              <section className="bunik-panel" style={{ marginTop: 28, padding: "24px clamp(12px,3vw,30px)" }}>
                <h2 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 20, color: B.ink, margin: "0 0 6px" }}>Bản đồ thế mạnh</h2>
                <p className="bunik-note-text" style={{ fontSize: 17, margin: "0 0 16px" }}>so sánh 6 tiêu chí trên cùng một nét vẽ</p>
                <div style={{ width: "100%", height: 360 }}>
                  <ResponsiveContainer>
                    <RadarChart data={radarData} outerRadius="72%">
                      <PolarGrid stroke={B.muted} strokeDasharray="4 5" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: B.body, fontSize: 11, fontWeight: 600 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      {items.map((item, index) => {
                        const accent = accentFor(item.id);
                        return <Radar key={item.id} name={item.name} dataKey={`series${index}`} stroke={accent} fill={accent} fillOpacity={0.11} strokeWidth={2.4} />;
                      })}
                      <Tooltip contentStyle={{ border: `2px solid ${B.ink}`, borderRadius: 14, background: B.paperLight, boxShadow: `3px 3px 0 ${B.honey}`, fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </main>

      {searchOpen ? (
        <div className="bunik-modal-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
          <section className="bunik-modal" style={{ ...cardStyle({ shadow: `6px 7px 0 ${B.terracotta}` }), padding: 22 }} role="dialog" aria-modal="true" aria-labelledby="compare-search-title" onMouseDown={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div>
                <h2 id="compare-search-title" style={{ fontFamily: "'Shantell Sans', cursive", fontSize: 20, color: B.ink, margin: 0 }}>Thêm {type === "truong" ? "trường" : "ngành"}</h2>
                <p className="bunik-note-text" style={{ fontSize: 16, margin: "2px 0 0" }}>tìm trong dữ liệu hiện có</p>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setSearchOpen(false)} style={{ width: 38, height: 38, display: "grid", placeItems: "center", border: `2px solid ${B.ink}`, borderRadius: "50%", background: B.paper }}>
                <X size={18} />
              </button>
            </div>
            <label style={{ position: "relative", display: "block" }}>
              <span className="bunik-sr-only">Tìm kiếm</span>
              <Search size={18} style={{ position: "absolute", left: 14, top: 14, color: B.muted }} />
              <input autoFocus className="bunik-field" style={{ paddingLeft: 42 }} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Nhập tên để tìm…" />
            </label>
            <div style={{ display: "grid", gap: 9, marginTop: 14 }}>
              {searchResults.map((item) => {
                const selected = compareIds.includes(item.id);
                return (
                  <button key={item.id} type="button" disabled={selected} onClick={() => addItem(item.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, minHeight: 48, textAlign: "left", padding: "10px 12px", border: `1.5px ${selected ? "dashed" : "solid"} ${B.ink}`, borderRadius: "13px 10px 14px 11px/11px 14px 10px 13px", background: selected ? "rgba(126,143,94,.12)" : B.paper, color: B.ink, opacity: selected ? .68 : 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flex: "none", color: selected ? B.olive : B.terracotta, fontSize: 12, fontWeight: 700 }}>
                      {selected ? <><Check size={14} /> Đã thêm</> : <><Plus size={14} /> Thêm</>}
                    </span>
                  </button>
                );
              })}
              {!loading && searchResults.length === 0 ? <p className="bunik-note-text" style={{ textAlign: "center", fontSize: 17 }}>Không tìm thấy lựa chọn phù hợp.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
