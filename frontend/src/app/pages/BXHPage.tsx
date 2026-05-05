import { useState, useEffect } from "react";
import { getTierColor } from "../data/mockData";
import { Crown, Flame, Star, Zap, Shield } from "lucide-react";
import { getRankings } from "../services/api";
import type { ApiUserRanking } from "../types/api";

const handCard = {
  background: "rgba(255,255,255,0.08)",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "4px 4px 0px rgba(0,0,0,0.3)",
};

const tierIcons: { [k: string]: React.ReactNode } = {
  SSS: <Crown size={18} color="#FFD700" />,
  SS: <Flame size={18} color="#F44336" />,
  S: <Star size={18} color="#FF9800" />,
  A: <Zap size={18} color="#9C27B0" />,
  B: <Shield size={18} color="#2196F3" />,
  C: <Star size={18} color="#4CAF50" />,
  D: <Shield size={18} color="#9E9E9E" />,
};

function TierBadge({ tier }: { tier: string }) {
  const color = getTierColor(tier);
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
      style={{
        background:
          tier === "SSS"
            ? "linear-gradient(135deg, #FF6B6B, #FFB347, #43D9A3, #5B4FCF)"
            : `${color}25`,
        border: `1.5px solid ${color}50`,
      }}
    >
      {tierIcons[tier]}
      <span
        style={{
          fontWeight: 900,
          fontFamily: "'Baloo 2', cursive",
          fontSize: 14,
          color: tier === "SSS" ? "#fff" : color,
        }}
      >
        {tier}
      </span>
    </div>
  );
}

const top3Colors = ["#FFD700", "#C0C0C0", "#CD7F32"];
const top3Glows = ["rgba(255,215,0,0.4)", "rgba(192,192,192,0.3)", "rgba(205,127,50,0.3)"];

export default function BXHPage() {
  const [rankings, setRankings] = useState<ApiUserRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRankings({ page_size: 100 })
      .then((response) => {
        setRankings(response.results);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to fetch rankings:', err);
        setError('Không thể tải dữ liệu xếp hạng');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #0F0E2E 0%, #1A1A3E 40%, #0E1A2E 100%)",
        }}
      >
        <p style={{ color: "#fff", fontSize: 18 }}>Đang tải...</p>
      </div>
    );
  }

  if (error || rankings.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #0F0E2E 0%, #1A1A3E 40%, #0E1A2E 100%)",
        }}
      >
        <p style={{ color: "#fff", fontSize: 18 }}>{error || 'Không có dữ liệu xếp hạng'}</p>
      </div>
    );
  }

  // My rank for demo (using first user in API response or default)
  const myRank = rankings[7] || rankings[0];

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #0F0E2E 0%, #1A1A3E 40%, #0E1A2E 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      {/* Particle decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              background: ["#5B4FCF", "#FF6B6B", "#43D9A3", "#FFB347", "#fff"][i % 5],
              opacity: 0.3 + Math.random() * 0.4,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `pulse ${2 + Math.random() * 3}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 text-center py-14 px-6">
        <div className="flex justify-center mb-6">
          <div
            className="w-20 h-20 rounded-[24px] flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #FFD700 0%, #FFB347 100%)",
              boxShadow: "0 0 40px rgba(255,215,0,0.4), 4px 4px 0px rgba(0,0,0,0.3)",
            }}
          >
            <Crown size={42} color="#fff" />
          </div>
        </div>
        <h1
          style={{
            fontFamily: "'Baloo 2', cursive",
            fontWeight: 900,
            fontSize: "clamp(2rem,5vw,3rem)",
            color: "#fff",
            textShadow: "2px 2px 20px rgba(91,79,207,0.5)",
            marginBottom: 8,
          }}
        >
          🏅 Bảng Xếp Hạng Người Dùng
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>
          Cạnh tranh lành mạnh • Tinh thần học tập là số 1
        </p>
      </div>

      {/* Top 3 Podium */}
      <div className="max-w-4xl mx-auto px-6 mb-12 relative z-10">
        <div className="flex items-end justify-center gap-4 flex-wrap">
          {/* Rank 2 */}
          <div className="flex flex-col items-center">
            <div
              className="p-5 text-center w-48 mb-0"
              style={{
                ...handCard,
                border: `2px solid ${top3Colors[1]}50`,
                boxShadow: `0 0 30px ${top3Glows[1]}, 4px 4px 0px rgba(0,0,0,0.3)`,
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mx-auto mb-3"
                style={{
                  background: "linear-gradient(135deg, #5B4FCF, #9C27B0)",
                  fontWeight: 800,
                  fontSize: 18,
                  boxShadow: "0 0 20px rgba(91,79,207,0.4)",
                }}
              >
                {rankings[1]?.avatar || '?'}
              </div>
              <p style={{ fontWeight: 800, color: "#fff", fontSize: 13 }}>{rankings[1]?.name || '-'}</p>
              <TierBadge tier={rankings[1]?.tier || 'D'} />
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 6 }}>
                💪 {rankings[1]?.topSubject || '-'}
              </p>
              <p
                style={{
                  fontFamily: "'Baloo 2', cursive",
                  fontWeight: 900,
                  fontSize: 24,
                  color: top3Colors[1],
                  marginTop: 4,
                }}
              >
                {rankings[1]?.score || 0}đ
              </p>
            </div>
            <div
              className="w-48 h-16 flex items-center justify-center rounded-b-2xl"
              style={{
                background: `linear-gradient(180deg, #808080 0%, #555 100%)`,
                boxShadow: `0 0 20px ${top3Glows[1]}`,
              }}
            >
              <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 32, color: "#fff" }}>2</span>
            </div>
          </div>

          {/* Rank 1 */}
          <div className="flex flex-col items-center">
            <div className="text-3xl text-center mb-2">👑</div>
            <div
              className="p-6 text-center w-56 mb-0"
              style={{
                ...handCard,
                border: `2px solid ${top3Colors[0]}70`,
                boxShadow: `0 0 50px ${top3Glows[0]}, 6px 6px 0px rgba(0,0,0,0.4)`,
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-3"
                style={{
                  background: "linear-gradient(135deg, #FF6B6B, #FFB347)",
                  fontWeight: 800,
                  fontSize: 20,
                  boxShadow: "0 0 30px rgba(255,107,107,0.5)",
                }}
              >
                {rankings[0]?.avatar || '?'}
              </div>
              <p style={{ fontWeight: 800, color: "#fff", fontSize: 14 }}>{rankings[0]?.name || '-'}</p>
              <div className="flex justify-center mt-2">
                <TierBadge tier={rankings[0]?.tier || 'D'} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 6 }}>
                💪 {rankings[0]?.topSubject || '-'}
              </p>
              <p
                style={{
                  fontFamily: "'Baloo 2', cursive",
                  fontWeight: 900,
                  fontSize: 30,
                  color: top3Colors[0],
                  textShadow: `0 0 15px ${top3Colors[0]}`,
                  marginTop: 4,
                }}
              >
                {rankings[0]?.score || 0}đ
              </p>
            </div>
            <div
              className="w-56 h-24 flex items-center justify-center rounded-b-2xl"
              style={{
                background: "linear-gradient(180deg, #FFE08A 0%, #FFD700 100%)",
                boxShadow: `0 0 40px ${top3Glows[0]}`,
              }}
            >
              <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 48, color: "#fff", textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}>
                1
              </span>
            </div>
          </div>

          {/* Rank 3 */}
          <div className="flex flex-col items-center">
            <div
              className="p-5 text-center w-48 mb-0"
              style={{
                ...handCard,
                border: `2px solid ${top3Colors[2]}50`,
                boxShadow: `0 0 25px ${top3Glows[2]}, 4px 4px 0px rgba(0,0,0,0.3)`,
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mx-auto mb-3"
                style={{
                  background: "linear-gradient(135deg, #FF6B6B, #5B4FCF)",
                  fontWeight: 800,
                  fontSize: 18,
                  boxShadow: "0 0 20px rgba(255,107,107,0.4)",
                }}
              >
                {rankings[2]?.avatar || '?'}
              </div>
              <p style={{ fontWeight: 800, color: "#fff", fontSize: 13 }}>{rankings[2]?.name || '-'}</p>
              <div className="flex justify-center mt-1">
                <TierBadge tier={rankings[2]?.tier || 'D'} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 6 }}>
                💪 {rankings[2]?.topSubject || '-'}
              </p>
              <p
                style={{
                  fontFamily: "'Baloo 2', cursive",
                  fontWeight: 900,
                  fontSize: 24,
                  color: top3Colors[2],
                  marginTop: 4,
                }}
              >
                {rankings[2]?.score || 0}đ
              </p>
            </div>
            <div
              className="w-48 h-12 flex items-center justify-center rounded-b-2xl"
              style={{
                background: `linear-gradient(180deg, #E8B880 0%, #CD7F32 100%)`,
                boxShadow: `0 0 20px ${top3Glows[2]}`,
              }}
            >
              <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 26, color: "#fff" }}>3</span>
            </div>
          </div>
        </div>
      </div>

      {/* My position */}
      <div className="max-w-5xl mx-auto px-6 pb-16 relative z-10">
        {/* My position highlight */}
        <div
          className="mb-6 p-4 rounded-2xl flex items-center gap-4"
          style={{
            background: "rgba(91,79,207,0.3)",
            border: "2px solid rgba(91,79,207,0.5)",
            boxShadow: "0 0 20px rgba(91,79,207,0.3)",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700 }}>📍 Vị trí của bạn:</span>
          <span style={{ color: "#fff", fontWeight: 800 }}>#{myRank.rank}</span>
          <TierBadge tier={myRank.tier} />
          <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 800, fontSize: 16 }}>{myRank.score}đ</span>
        </div>

        <div
          className="overflow-hidden"
          style={{
            ...handCard,
            background: "rgba(255,255,255,0.05)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {["Hạng", "Người dùng", "Tier", "Điểm học lực", "Điểm mạnh"].map((h) => (
                    <th key={h} className="px-5 py-4 text-left text-sm" style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankings.slice(3).map((user) => {
                  const isMe = user.id === myRank.id;
                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        background: isMe ? "rgba(91,79,207,0.25)" : "transparent",
                      }}
                    >
                      <td className="px-5 py-4">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
                          style={{
                            background: "rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.8)",
                            fontWeight: 900,
                            fontFamily: "'Baloo 2', cursive",
                          }}
                        >
                          {user.rank}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm flex-shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${getTierColor(user.tier)} 0%, ${getTierColor(user.tier)}88 100%)`,
                              fontWeight: 700,
                              boxShadow: `0 0 10px ${getTierColor(user.tier)}40`,
                            }}
                          >
                            {user.avatar}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, color: isMe ? "#FFD700" : "#fff", fontSize: 14 }}>
                              {user.name} {isMe && "← Bạn"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <TierBadge tier={user.tier} />
                      </td>
                      <td className="px-5 py-4">
                        <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 900, fontSize: 20, color: getTierColor(user.tier) }}>
                          {user.score}đ
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="px-2.5 py-1 rounded-xl text-xs"
                          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontWeight: 700 }}
                        >
                          💪 {user.topSubject}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
