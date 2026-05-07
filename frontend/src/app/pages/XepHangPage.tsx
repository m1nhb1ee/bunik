import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Star, Trophy, Medal, Award } from "lucide-react";
import { getAllUniversities } from "../services/api";
import type { UiUniversity } from "../types/api";

const dotBg = {
  backgroundImage: "radial-gradient(circle, #d0cef0 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  backgroundColor: "#FAFAF8",
  animation: "dotDrift 24s linear infinite",
};

const handCard = {
  background: "#fff",
  borderRadius: 20,
  border: "2px solid rgba(91,79,207,0.12)",
  boxShadow: "4px 4px 0px rgba(91,79,207,0.09)",
};

function MiniProgress({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 rounded-full flex-1 overflow-hidden" style={{ background: "#F0EEF8", minWidth: 60 }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span style={{ fontSize: 12, color: "#4A4A6A", fontWeight: 700, minWidth: 32 }}>{value}</span>
    </div>
  );
}

export default function XepHangPage() {
  const [universities, setUniversities] = useState<UiUniversity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllUniversities()
      .then(setUniversities)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const top3 = universities.slice(0, 3);
  const rest = universities.slice(3);

  return (
    <div style={dotBg} className="min-h-screen">
      {/* Hero */}
      <div
        className="py-14 px-6 text-center relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,179,71,0.12) 0%, rgba(91,79,207,0.08) 50%, rgba(255,107,107,0.08) 100%)",
          borderBottom: "2px solid rgba(91,79,207,0.08)",
        }}
      >
        {["🎊", "✨", "⭐", "🎉", "💫"].map((emoji, i) => (
          <span
            key={i}
            className="absolute text-3xl pointer-events-none"
            style={{
              top: `${10 + i * 15}%`,
              left: `${5 + i * 18}%`,
              opacity: 0.4,
              transform: `rotate(${i * 25 - 30}deg)`,
            }}
          >
            {emoji}
          </span>
        ))}

        <div className="flex justify-center mb-6">
          <div
            className="w-24 h-24 rounded-[32px] flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #FFB347 0%, #FF6B6B 100%)",
              boxShadow: "6px 6px 0px rgba(255,179,71,0.3)",
            }}
          >
            <Trophy size={48} color="#fff" />
          </div>
        </div>

        <h1
          style={{
            fontFamily: "'Baloo 2', cursive",
            fontWeight: 800,
            color: "#1A1A2E",
            fontSize: "clamp(1.8rem,4vw,2.8rem)",
            marginBottom: 8,
          }}
        >
          🏆 Bảng Vàng Các Trường ĐH
        </h1>
        <p style={{ color: "#4A4A6A", fontSize: 15 }}>
          Xếp hạng tổng hợp năm 2025 • Cập nhật mỗi học kỳ
        </p>

        <div
          className="inline-block mt-6 px-5 py-3 rounded-2xl text-sm"
          style={{
            background: "#fff",
            border: "2px dashed rgba(91,79,207,0.2)",
            boxShadow: "3px 3px 0px rgba(91,79,207,0.08)",
            transform: "rotate(-0.5deg)",
          }}
        >
          <p style={{ color: "#4A4A6A", fontWeight: 700 }}>
            📝 Công thức: Điểm chuẩn × 0.6 + Mạng xã hội × 0.3 + Đánh giá × 0.1
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {loading ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">⏳</div>
            <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Đang tải dữ liệu...</p>
          </div>
        ) : (
          <>
            {/* ===== PODIUM TOP 3 ===== */}
            {top3.length >= 3 && (
              <div className="mb-14">
                <h2
                  style={{
                    fontFamily: "'Baloo 2', cursive",
                    fontWeight: 800,
                    color: "#1A1A2E",
                    fontSize: "1.4rem",
                    textAlign: "center",
                    marginBottom: 32,
                  }}
                >
                  🎖️ Bục Vinh Danh
                </h2>

                <div className="flex items-end justify-center gap-4 flex-wrap">
                  {/* Hạng 2 */}
                  <div className="flex flex-col items-center">
                    <Link to={`/truong/${top3[1].id}`} className="group">
                      <div
                        className="p-5 text-center w-52 transition-all group-hover:-translate-y-1 duration-200"
                        style={{
                          ...handCard,
                          border: "2px solid #C0C0C0",
                          boxShadow: "4px 4px 0px #C0C0C060",
                        }}
                      >
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mx-auto mb-3"
                          style={{
                            background: `linear-gradient(135deg, ${top3[1].color} 0%, ${top3[1].color}99 100%)`,
                            fontFamily: "'Baloo 2', cursive",
                            fontWeight: 800,
                            fontSize: 18,
                          }}
                        >
                          {top3[1].abbr.slice(0, 3)}
                        </div>
                        <p style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 13 }}>{top3[1].name}</p>
                        <p style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 28, color: "#C0C0C0", lineHeight: 1.1, marginTop: 6 }}>
                          {top3[1].overallScore > 0 ? top3[1].overallScore : "🥈"}
                        </p>
                        <Medal size={20} color="#C0C0C0" className="mx-auto mt-1" />
                      </div>
                    </Link>
                    <div
                      className="w-52 flex items-center justify-center"
                      style={{
                        height: 80,
                        background: "linear-gradient(180deg, #E8E8E8 0%, #BEBEBE 100%)",
                        borderRadius: "0 0 12px 12px",
                        boxShadow: "4px 4px 0px #C0C0C060",
                      }}
                    >
                      <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 32, color: "#fff" }}>2</span>
                    </div>
                  </div>

                  {/* Hạng 1 */}
                  <div className="flex flex-col items-center">
                    <Link to={`/truong/${top3[0].id}`} className="group">
                      <div
                        className="p-5 text-center w-60 transition-all group-hover:-translate-y-1 duration-200"
                        style={{
                          ...handCard,
                          border: "2.5px solid #FFB347",
                          boxShadow: "5px 5px 0px rgba(255,179,71,0.35)",
                        }}
                      >
                        <div className="text-2xl mb-1">👑</div>
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-3"
                          style={{
                            background: `linear-gradient(135deg, ${top3[0].color} 0%, ${top3[0].color}99 100%)`,
                            fontFamily: "'Baloo 2', cursive",
                            fontWeight: 800,
                            fontSize: 20,
                            boxShadow: `4px 4px 0px ${top3[0].color}40`,
                          }}
                        >
                          {top3[0].abbr.slice(0, 3)}
                        </div>
                        <p style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 14 }}>{top3[0].name}</p>
                        <p
                          style={{
                            fontFamily: "'Baloo 2', cursive",
                            fontWeight: 900,
                            fontSize: 36,
                            color: "#FFB347",
                            lineHeight: 1.1,
                            marginTop: 6,
                          }}
                        >
                          {top3[0].overallScore > 0 ? top3[0].overallScore : "🥇"}
                        </p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} size={12} fill="#FFB347" color="#FFB347" />
                          ))}
                        </div>
                      </div>
                    </Link>
                    <div
                      className="w-60 flex items-center justify-center"
                      style={{
                        height: 110,
                        background: "linear-gradient(180deg, #FFE08A 0%, #FFB347 100%)",
                        borderRadius: "0 0 12px 12px",
                        boxShadow: "5px 5px 0px rgba(255,179,71,0.3)",
                      }}
                    >
                      <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 44, color: "#fff" }}>1</span>
                    </div>
                  </div>

                  {/* Hạng 3 */}
                  <div className="flex flex-col items-center">
                    <Link to={`/truong/${top3[2].id}`} className="group">
                      <div
                        className="p-5 text-center w-52 transition-all group-hover:-translate-y-1 duration-200"
                        style={{
                          ...handCard,
                          border: "2px solid #CD7F32",
                          boxShadow: "4px 4px 0px #CD7F3260",
                        }}
                      >
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mx-auto mb-3"
                          style={{
                            background: `linear-gradient(135deg, ${top3[2].color} 0%, ${top3[2].color}99 100%)`,
                            fontFamily: "'Baloo 2', cursive",
                            fontWeight: 800,
                            fontSize: 18,
                          }}
                        >
                          {top3[2].abbr.slice(0, 3)}
                        </div>
                        <p style={{ fontWeight: 800, color: "#1A1A2E", fontSize: 13 }}>{top3[2].name}</p>
                        <p style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 28, color: "#CD7F32", lineHeight: 1.1, marginTop: 6 }}>
                          {top3[2].overallScore > 0 ? top3[2].overallScore : "🥉"}
                        </p>
                        <Award size={20} color="#CD7F32" className="mx-auto mt-1" />
                      </div>
                    </Link>
                    <div
                      className="w-52 flex items-center justify-center"
                      style={{
                        height: 60,
                        background: "linear-gradient(180deg, #E8C08A 0%, #CD7F32 100%)",
                        borderRadius: "0 0 12px 12px",
                        boxShadow: "4px 4px 0px #CD7F3260",
                      }}
                    >
                      <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 28, color: "#fff" }}>3</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== REST TABLE ===== */}
            {rest.length > 0 && (
              <div style={{ ...handCard, overflow: "hidden" }}>
                <div className="p-5" style={{ borderBottom: "2px solid rgba(91,79,207,0.08)" }}>
                  <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, color: "#1A1A2E", fontSize: "1.2rem" }}>
                    Bảng xếp hạng từ hạng {top3.length + 1}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "rgba(91,79,207,0.05)" }}>
                        {["Hạng", "Trường", "Điểm chuẩn TB (60%)", "MXH (30%)", "Đánh giá (10%)", "Tổng điểm"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-sm" style={{ color: "#4A4A6A", fontWeight: 800 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rest.map((u) => (
                        <tr
                          key={u.id}
                          className="transition-colors hover:bg-indigo-50/30"
                          style={{ borderTop: "1px solid rgba(91,79,207,0.06)" }}
                        >
                          <td className="px-4 py-4">
                            <span
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
                              style={{
                                background: "rgba(91,79,207,0.08)",
                                color: "#5B4FCF",
                                fontWeight: 900,
                                fontFamily: "'Baloo 2', cursive",
                              }}
                            >
                              {u.ranking}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <Link to={`/truong/${u.id}`} className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm flex-shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, ${u.color} 0%, ${u.color}99 100%)`,
                                  fontFamily: "'Baloo 2', cursive",
                                  fontWeight: 700,
                                }}
                              >
                                {u.abbr.slice(0, 2)}
                              </div>
                              <div>
                                <p style={{ fontWeight: 700, color: "#1A1A2E", fontSize: 14 }}>{u.name}</p>
                                <p style={{ fontSize: 11, color: "#9090AA" }}>{u.city}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-4 min-w-36">
                            {u.avgAdmScore > 0
                              ? <><MiniProgress value={(u.avgAdmScore / 30) * 100} color="#5B4FCF" /><span style={{ fontSize: 11, color: "#9090AA" }}>{u.avgAdmScore}/30</span></>
                              : <span style={{ fontSize: 12, color: "#9090AA" }}>Chưa có</span>
                            }
                          </td>
                          <td className="px-4 py-4 min-w-28">
                            {u.socialScore > 0
                              ? <MiniProgress value={u.socialScore} color="#43D9A3" />
                              : <span style={{ fontSize: 12, color: "#9090AA" }}>Chưa có</span>
                            }
                          </td>
                          <td className="px-4 py-4 min-w-28">
                            {u.userRating > 0
                              ? <MiniProgress value={u.userRating * 20} color="#FFB347" />
                              : <span style={{ fontSize: 12, color: "#9090AA" }}>Chưa có</span>
                            }
                          </td>
                          <td className="px-4 py-4">
                            {u.overallScore > 0 ? (
                              <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 20, color: "#5B4FCF" }}>
                                {u.overallScore}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: "#9090AA" }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {universities.length === 0 && (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">🏆</div>
                <p style={{ color: "#4A4A6A", fontWeight: 700 }}>Chưa có dữ liệu xếp hạng</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
