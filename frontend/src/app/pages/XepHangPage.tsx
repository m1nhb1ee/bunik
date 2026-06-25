import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Star } from "lucide-react";
import { B, CenterNote, SketchHeading, accentFor, cardStyle } from "../components/bunik";
import { getAllUniversities } from "../services/api";
import type { UiUniversity } from "../types/api";

const podiumMeta = [
  { rank: 2, color: B.plum, height: 154, label: "hạng nhì" },
  { rank: 1, color: B.terracotta, height: 194, label: "dẫn đầu" },
  { rank: 3, color: B.teal, height: 130, label: "hạng ba" },
] as const;

function MetricBar({ value, max, color, suffix = "" }: { value: number; max: number; color: string; suffix?: string }) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ minWidth: 116 }}>
      <div style={{ height: 8, border: `1.5px solid ${B.ink}`, borderRadius: 999, background: B.paper, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${width}%`, background: color }} />
      </div>
      <span style={{ display: "block", marginTop: 4, color: B.muted, fontSize: 11, fontWeight: 700 }}>{value || "—"}{value ? suffix : ""}</span>
    </div>
  );
}

export default function XepHangPage() {
  const [universities, setUniversities] = useState<UiUniversity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAllUniversities()
      .then((data) => {
        if (active) setUniversities(data);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Không thể tải bảng xếp hạng.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const ranked = useMemo(() => [...universities].sort((a, b) => a.ranking - b.ranking), [universities]);
  const topThree = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="bunik-page">
      <header className="bunik-container bunik-page-intro" style={{ textAlign: "center", position: "relative" }}>
        <span aria-hidden="true" style={{ position: "absolute", top: 32, left: "8%", color: B.honey, fontFamily: "'Shantell Sans', cursive", fontSize: 30, rotate: "-12deg", animation: "twinkle 3s ease-in-out infinite" }}>✦</span>
        <span aria-hidden="true" style={{ position: "absolute", top: 74, right: "9%", color: B.plum, fontFamily: "'Shantell Sans', cursive", fontSize: 24, rotate: "9deg", animation: "floaty2 5s ease-in-out infinite" }}>★</span>
        <SketchHeading kicker="bảng vàng 2025 —" color={B.honey} width="86%">
          Xếp hạng trường đại học
        </SketchHeading>
        <p className="bunik-note-text" style={{ fontSize: 19, margin: "23px auto 0", maxWidth: 660 }}>
          Tiêu chí VNUR × 0,5 · Điểm chuẩn × 0,5 — thang điểm 5.0
        </p>
      </header>

      <main className="bunik-container" style={{ paddingBottom: 56 }}>
        {loading ? <CenterNote title="Đang xếp lại bảng vàng…" /> : null}
        {!loading && error ? <CenterNote title="Chưa tải được bảng xếp hạng" sub={error} /> : null}
        {!loading && !error && ranked.length === 0 ? <CenterNote title="Chưa có dữ liệu xếp hạng" sub="Dữ liệu sẽ xuất hiện sau lần cập nhật tiếp theo" /> : null}

        {!loading && !error && topThree.length === 3 ? (
          <section aria-labelledby="podium-title" style={{ marginBottom: 42 }}>
            <h2 id="podium-title" className="bunik-sr-only">Ba trường dẫn đầu</h2>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "clamp(8px,2vw,20px)", overflowX: "auto", padding: "18px 4px 7px" }}>
              {podiumMeta.map((meta) => {
                const university = topThree.find((item) => item.ranking === meta.rank) ?? topThree[meta.rank - 1];
                return (
                  <Link key={meta.rank} to={`/truong/${university.id}`} style={{ color: "inherit", textDecoration: "none", flex: "0 1 250px", minWidth: 132, maxWidth: 250 }}>
                    <article className="bunik-lift" style={{ display: "grid", justifyItems: "center" }}>
                      <span className="bunik-note-text" style={{ fontSize: 17, color: meta.color, marginBottom: 6 }}>{meta.label}</span>
                      <span style={{ width: meta.rank === 1 ? 72 : 62, height: meta.rank === 1 ? 72 : 62, display: "grid", placeItems: "center", border: `2.5px solid ${B.ink}`, borderRadius: "50% 47% 53% 50%/50% 53% 47% 50%", background: university.color || accentFor(university.id), color: B.paperLight, fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: meta.rank === 1 ? 18 : 15, boxShadow: `4px 4px 0 ${B.ink}`, zIndex: 1 }}>
                        {university.abbr.slice(0, 4)}
                      </span>
                      <p style={{ minHeight: 42, margin: "11px 0 9px", color: B.ink, fontWeight: 750, fontSize: 13, lineHeight: 1.45, textAlign: "center" }}>{university.name}</p>
                      <div style={{ width: "100%", height: meta.height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: `2px solid ${B.ink}`, borderRadius: "15px 12px 3px 3px/12px 15px 3px 3px", background: meta.color, color: B.paperLight, boxShadow: `5px 5px 0 rgba(43,39,34,.14)` }}>
                        <span style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: meta.rank === 1 ? 34 : 28 }}>#{meta.rank}</span>
                        <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 17 }}>{university.overallScore || "—"} điểm</span>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {!loading && !error && ranked.length > 0 ? (
          <section style={{ ...cardStyle(), overflow: "hidden" }} aria-labelledby="ranking-table-title">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, padding: "22px 22px 16px", borderBottom: `2px dashed rgba(43,39,34,.25)` }}>
              <div>
                <h2 id="ranking-table-title" style={{ fontFamily: "'Shantell Sans', cursive", color: B.ink, fontSize: 20, margin: 0 }}>Bảng xếp hạng đầy đủ</h2>
                <p className="bunik-note-text" style={{ margin: "3px 0 0", fontSize: 16 }}>cập nhật theo dữ liệu tuyển sinh gần nhất</p>
              </div>
              <span className="bunik-chip" style={{ background: B.honey }}>{ranked.length} trường</span>
            </div>
            <div className="bunik-table-wrap">
              <table className="bunik-table">
                <thead>
                  <tr>
                    <th>Hạng</th>
                    <th>Trường</th>
                    <th>Điểm chuẩn</th>
                    <th>Đánh giá</th>
                    <th>Tổng hợp</th>
                  </tr>
                </thead>
                <tbody>
                  {(topThree.length < 3 ? ranked : rest).map((university) => {
                    const accent = accentFor(university.id);
                    return (
                      <tr key={university.id}>
                        <td>
                          <span style={{ width: 36, height: 36, display: "grid", placeItems: "center", border: `1.5px solid ${B.ink}`, borderRadius: "10px 8px 9px 11px/11px 9px 8px 10px", background: university.ranking <= 3 ? B.honey : B.paper, color: B.ink, fontFamily: "'Shantell Sans', cursive", fontWeight: 700 }}>{university.ranking}</span>
                        </td>
                        <td style={{ minWidth: 250 }}>
                          <Link to={`/truong/${university.id}`} style={{ display: "flex", alignItems: "center", gap: 12, color: "inherit", textDecoration: "none" }}>
                            <span style={{ width: 44, height: 44, flex: "none", display: "grid", placeItems: "center", border: `2px solid ${B.ink}`, borderRadius: "13px 10px 12px 11px/11px 12px 10px 13px", background: university.color || accent, color: B.paperLight, fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 12 }}>{university.abbr.slice(0, 4)}</span>
                            <span>
                              <strong style={{ display: "block", color: B.ink, fontSize: 13.5 }}>{university.name}</strong>
                              <small style={{ color: B.muted, fontSize: 11 }}>{university.city || "Chưa cập nhật"}</small>
                            </span>
                            <ArrowUpRight size={15} style={{ color: B.terracotta, flex: "none" }} />
                          </Link>
                        </td>
                        <td><MetricBar value={university.avgAdmScore} max={30} color={B.terracotta} suffix="/30" /></td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: B.body, fontWeight: 700 }}>
                            <Star size={15} fill={B.honey} color={B.ink} /> {university.userRating || "—"}
                          </span>
                        </td>
                        <td><span style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 21, color: accent }}>{university.overallScore || "—"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
