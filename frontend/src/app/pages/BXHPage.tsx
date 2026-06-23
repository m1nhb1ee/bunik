import { useEffect, useMemo, useState } from "react";
import { B, CenterNote, SketchHeading, cardStyle } from "../components/bunik";
import { getRankings } from "../services/api";
import type { ApiUserRanking } from "../types/api";

const tierColors: Record<string, string> = {
  S: B.terracotta,
  A: B.plum,
  B: B.indigo,
  C: B.olive,
  D: B.honey,
  E: B.rust,
  F: B.brown,
};

const tierRanges = [
  { tier: "S", range: "150+" },
  { tier: "A", range: "100–149" },
  { tier: "B", range: "90–99" },
  { tier: "C", range: "75–89" },
  { tier: "D", range: "60–74" },
  { tier: "E", range: "45–59" },
  { tier: "F", range: "0–44" },
];

const podiumMeta = [
  { index: 1, rank: 2, height: 140 },
  { index: 0, rank: 1, height: 180 },
  { index: 2, rank: 3, height: 118 },
] as const;

function getStoredUserId(): string | null {
  try {
    const user = JSON.parse(localStorage.getItem("gr1_user") ?? "null") as { id?: string | number } | null;
    return user?.id === undefined ? null : String(user.id);
  } catch {
    return null;
  }
}

export default function BXHPage() {
  const [rankings, setRankings] = useState<ApiUserRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getRankings({ page_size: 100 })
      .then((response) => {
        if (!active) return;
        const results = Array.isArray(response.results) ? response.results : [];
        setRankings(results);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu xếp hạng.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const sorted = useMemo(() => [...rankings].sort((a, b) => a.rank - b.rank), [rankings]);
  const currentUserId = getStoredUserId();
  const currentUser = currentUserId ? sorted.find((user) => String(user.id) === currentUserId) : undefined;

  return (
    <div className="bunik-page">
      <header className="bunik-container bunik-page-intro" style={{ textAlign: "center", position: "relative" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: "6%", top: 52, fontSize: 28, color: B.honey, animation: "twinkle 3s ease-in-out infinite" }}>✦</span>
        <span aria-hidden="true" style={{ position: "absolute", right: "7%", top: 88, fontSize: 24, color: B.teal, animation: "floaty2 5s ease-in-out infinite" }}>⌁</span>
        <SketchHeading kicker="cộng đồng bunik —" color={B.teal} width="90%">
          Bảng xếp hạng người dùng
        </SketchHeading>
        <p className="bunik-note-text" style={{ fontSize: 19, margin: "22px auto 0", maxWidth: 640 }}>
          Một góc nhỏ để ghi nhận nỗ lực học tập — thứ hạng chỉ là cột mốc, không phải đích đến.
        </p>
      </header>

      <main className="bunik-container" style={{ width: "min(100% - 24px, 980px)", paddingBottom: 56 }}>
        <section aria-label="Chú thích tier" style={{ display: "flex", justifyContent: "center", gap: 9, flexWrap: "wrap", marginBottom: 34 }}>
          {tierRanges.map((item) => (
            <div key={item.tier} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: `1.5px solid ${B.ink}`, borderRadius: "9px 7px 8px 10px/10px 8px 7px 9px", background: tierColors[item.tier], color: B.paperLight, fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 13 }}>{item.tier}</span>
              <span className="bunik-note-text" style={{ fontSize: 15 }}>{item.range}</span>
            </div>
          ))}
        </section>

        {loading ? <CenterNote title="Đang cập nhật bảng xếp hạng…" /> : null}
        {!loading && error ? <CenterNote title="Chưa tải được bảng xếp hạng" sub={error} /> : null}
        {!loading && !error && sorted.length === 0 ? <CenterNote title="Chưa có dữ liệu xếp hạng" /> : null}

        {!loading && !error && sorted.length >= 3 ? (
          <section aria-label="Ba người dẫn đầu" style={{ marginBottom: 34 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "clamp(8px,2vw,18px)", overflowX: "auto", padding: "8px 2px 6px" }}>
              {podiumMeta.map((meta) => {
                const user = sorted[meta.index];
                const color = tierColors[user.tier] ?? B.brown;
                return (
                  <article key={user.id} style={{ flex: "0 1 225px", minWidth: 128, maxWidth: 225, display: "grid", justifyItems: "center" }}>
                    <span style={{ width: meta.rank === 1 ? 68 : 58, height: meta.rank === 1 ? 68 : 58, display: "grid", placeItems: "center", border: `2.5px solid ${B.ink}`, borderRadius: "50% 47% 53% 50%/50% 53% 47% 50%", background: color, color: B.paperLight, fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: meta.rank === 1 ? 18 : 15, boxShadow: `3px 3px 0 rgba(43,39,34,.2)`, zIndex: 1 }}>{user.avatar || "··"}</span>
                    <p style={{ minHeight: 38, color: B.ink, fontWeight: 750, fontSize: 13, textAlign: "center", margin: "9px 0 5px" }}>{user.anonymous ? "Bạn ẩn danh" : user.name}</p>
                    <span className="bunik-note-text" style={{ fontSize: 14, marginBottom: 8 }}>giỏi nhất: {user.topSubject || "—"}</span>
                    <div style={{ width: "100%", height: meta.height, display: "grid", placeItems: "center", alignContent: "center", gap: 3, border: `2px solid ${B.ink}`, borderRadius: "15px 12px 3px 3px/12px 15px 3px 3px", background: color, color: B.paperLight, boxShadow: `5px 5px 0 rgba(43,39,34,.14)` }}>
                      <span style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: meta.rank === 1 ? 32 : 27 }}>#{meta.rank}</span>
                      <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 17 }}>{user.score} điểm</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {!loading && !error && sorted.length > 0 ? (
          <section style={{ ...cardStyle(), overflow: "hidden" }} aria-label="Danh sách xếp hạng">
            <div style={{ display: "grid", gridTemplateColumns: "52px minmax(190px,1fr) 70px 95px", gap: 10, padding: "13px 18px", borderBottom: `2px dashed rgba(43,39,34,.25)`, color: B.muted, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em" }}>
              <span>Hạng</span><span>Người dùng</span><span style={{ textAlign: "center" }}>Tier</span><span style={{ textAlign: "right" }}>Điểm</span>
            </div>
            {sorted.slice(sorted.length >= 3 ? 3 : 0).map((user) => {
              const color = tierColors[user.tier] ?? B.brown;
              const isCurrent = currentUserId !== null && String(user.id) === currentUserId;
              return (
                <article key={user.id} style={{ display: "grid", gridTemplateColumns: "52px minmax(190px,1fr) 70px 95px", alignItems: "center", gap: 10, padding: "13px 18px", borderBottom: `1px dashed rgba(43,39,34,.2)`, background: isCurrent ? "rgba(194,96,63,.12)" : "transparent" }}>
                  <span style={{ color: B.muted, fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 17 }}>#{user.rank}</span>
                  <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ width: 38, height: 38, flex: "none", display: "grid", placeItems: "center", border: `1.5px solid ${B.ink}`, borderRadius: "50% 47% 53% 50%/50% 53% 47% 50%", background: color, color: B.paperLight, fontFamily: "'Shantell Sans', cursive", fontSize: 11 }}>{user.avatar || "··"}</span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: B.ink, fontSize: 13.5 }}>{user.anonymous ? "Bạn ẩn danh" : user.name}{isCurrent ? " (bạn)" : ""}</strong>
                      <small className="bunik-note-text" style={{ display: "block", fontSize: 14 }}>giỏi nhất: {user.topSubject || "—"}</small>
                    </span>
                  </div>
                  <span style={{ justifySelf: "center", width: 34, height: 30, display: "grid", placeItems: "center", border: `1.5px solid ${B.ink}`, borderRadius: "9px 7px 8px 10px/10px 8px 7px 9px", background: color, color: B.paperLight, fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 13 }}>{user.tier}</span>
                  <strong style={{ color, textAlign: "right", fontSize: 14 }}>{user.score} đ</strong>
                </article>
              );
            })}
          </section>
        ) : null}

        {currentUser && currentUser.rank > 3 ? (
          <p className="bunik-note-text" style={{ textAlign: "center", fontSize: 17, margin: "18px 0 0" }}>Bạn đang ở hạng #{currentUser.rank} — cứ đi tiếp nhé ✦</p>
        ) : null}
      </main>
    </div>
  );
}
