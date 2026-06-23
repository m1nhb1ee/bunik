import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Save, ToggleLeft, ToggleRight, X } from "lucide-react";
import { Link } from "react-router";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { getTierColor, getTierThreshold } from "../data/mockData";
import {
  addMyAchievement,
  deleteMyAchievement,
  getAwardsCatalog,
  getMyAchievements,
  getMyCertificates,
  getMyProfile,
  updateMyProfile,
  type ProfileUpdatePayload,
} from "../services/api";
import type { ApiAchievement, ApiAward } from "../types/api";
import { B, CenterNote, SketchHeading, cardStyle } from "../components/bunik";

type SubjectKey = "toan" | "van" | "anh" | "ly" | "hoa" | "sinh" | "su" | "dia";
type SpecialSubject = "toan" | "ly" | "hoa" | "sinh" | "tin" | "ngoai_ngu" | "van" | "su" | "dia";
type SubjectScores = Record<SubjectKey, number>;
type PrizeType = "Khuyen Khich" | "Ba" | "Nhi" | "Nhat";
type SelectedAchievement = {
  clientId: string;
  award_id: number;
  prize: PrizeType;
};

const dotBg = {
  backgroundColor: B.paper,
};

const handCard = cardStyle();

const SUBJECTS: Array<{ key: SubjectKey; label: string }> = [
  { key: "toan", label: "Toán" },
  { key: "van", label: "Văn" },
  { key: "anh", label: "Anh" },
  { key: "ly", label: "Lý" },
  { key: "hoa", label: "Hóa" },
  { key: "sinh", label: "Sinh" },
  { key: "su", label: "Sử" },
  { key: "dia", label: "Địa" },
];

const SPECIAL_SUBJECTS: Array<{ key: SpecialSubject; label: string }> = [
  { key: "toan", label: "Toán" },
  { key: "ly", label: "Lý" },
  { key: "hoa", label: "Hóa" },
  { key: "sinh", label: "Sinh" },
  { key: "tin", label: "Tin" },
  { key: "ngoai_ngu", label: "Ngoại ngữ" },
  { key: "van", label: "Văn" },
  { key: "su", label: "Sử" },
  { key: "dia", label: "Địa" },
];

const PRIZE_OPTIONS: Array<{ value: PrizeType; label: string }> = [
  { value: "Khuyen Khich", label: "Khuyến khích" },
  { value: "Ba", label: "Giải Ba" },
  { value: "Nhi", label: "Giải Nhì" },
  { value: "Nhat", label: "Giải Nhất" },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function normalizePrize(prize?: string | null): PrizeType {
  const value = normalizeText(prize || "");
  if (value === "nhat") return "Nhat";
  if (value === "nhi") return "Nhi";
  if (value === "ba") return "Ba";
  return "Khuyen Khich";
}

function getAwardBonus(level?: string | null, prize?: PrizeType): number {
  const normalizedLevel = normalizeText(level || "");
  if (normalizedLevel.includes("quoc te")) {
    if (prize === "Nhat") return 100;
    if (prize === "Nhi") return 80;
    if (prize === "Ba") return 70;
    return 60;
  }
  if (normalizedLevel.includes("quoc gia")) {
    if (prize === "Nhat") return 50;
    if (prize === "Nhi") return 40;
    if (prize === "Ba") return 35;
    return 30;
  }
  if (normalizedLevel.includes("tinh")) {
    if (prize === "Nhat") return 20;
    if (prize === "Nhi") return 15;
    if (prize === "Ba") return 12;
    return 10;
  }
  return 0;
}

function formatSpecialLabel(subject: SpecialSubject): string {
  const item = SPECIAL_SUBJECTS.find((value) => value.key === subject);
  return item ? `Chuyên ${item.label}` : "Môn chuyên";
}

function createClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function HoSoPage() {
  const [scores, setScores] = useState<SubjectScores>({
    toan: 0, van: 0, anh: 0, ly: 0, hoa: 0, sinh: 0, su: 0, dia: 0,
  });
  const [isChuyenClass, setIsChuyenClass] = useState(false);
  const [specialSubject, setSpecialSubject] = useState<SpecialSubject>("toan");
  const [specialScore, setSpecialScore] = useState(0);
  const [ieltScore, setIeltScore] = useState(0);
  const [satScore, setSatScore] = useState(0);
  const [awardsCatalog, setAwardsCatalog] = useState<ApiAward[]>([]);
  const [savedAchievements, setSavedAchievements] = useState<ApiAchievement[]>([]);
  const [selectedAchievements, setSelectedAchievements] = useState<SelectedAchievement[]>([]);
  const [showSpecialDropdown, setShowSpecialDropdown] = useState(false);
  const [showAwardsDropdown, setShowAwardsDropdown] = useState(false);
  const [activePrizeDropdownId, setActivePrizeDropdownId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("Học sinh của tôi");

  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem("gr1_access_token");
      if (!token) {
        setError("Vui lòng đăng nhập để xem hồ sơ của bạn");
        setLoading(false);
        return;
      }
      try {
        const [profileResponse, awardResponse, achievementResponse, certificateResponse] = await Promise.all([
          getMyProfile(token),
          getAwardsCatalog(token),
          getMyAchievements(token),
          getMyCertificates(token),
        ]);
        const user = profileResponse.user;
        setScores({
          toan: user.math || 0,
          van: user.literature || 0,
          anh: user.english || 0,
          ly: user.physics || 0,
          hoa: user.chemistry || 0,
          sinh: user.biology || 0,
          su: user.history || 0,
          dia: user.geography || 0,
        });
        setIsChuyenClass(Boolean(user.is_special));
        setSpecialSubject((user.special_subject as SpecialSubject) || "toan");
        setSpecialScore(user.special_score || 0);
        setUserName(user.full_name || "Học sinh của tôi");
        setAwardsCatalog(awardResponse.results || []);
        setSavedAchievements(achievementResponse.results || []);
        setSelectedAchievements(
          (achievementResponse.results || []).map((item, index) => ({
            clientId: `saved-${item.id}-${index}`,
            award_id: item.award_id,
            prize: normalizePrize(item.prize),
          })),
        );
        const certs = certificateResponse.results || [];
        const ielts = certs.find((item) => item.name.toLowerCase().includes("ielts"))?.score || 0;
        const sat = certs.find((item) => item.name.toLowerCase().includes("sat"))?.score || 0;
        setIeltScore(ielts);
        setSatScore(sat);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Không thể tải dữ liệu hồ sơ";
        if (errorMsg.includes("401")) {
          localStorage.removeItem("gr1_access_token");
          localStorage.removeItem("gr1_refresh_token");
          localStorage.removeItem("gr1_user");
          setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại");
        } else {
          setError(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const selectedAwards = useMemo(() => (
    selectedAchievements
      .map((achievement) => {
        const award = awardsCatalog.find((item) => item.id === achievement.award_id);
        return award ? { clientId: achievement.clientId, prize: achievement.prize, award } : null;
      })
      .filter((item): item is { clientId: string; prize: PrizeType; award: ApiAward } => Boolean(item))
  ), [selectedAchievements, awardsCatalog]);

  const awardBonus = useMemo(
    () => selectedAwards.reduce((sum, item) => sum + getAwardBonus(item.award.level, item.prize), 0),
    [selectedAwards],
  );

  const certBonus = ieltScore * 2 + satScore / 100;
  const baseScore = useMemo(() => Object.values(scores).reduce((a, b) => a + b, 0), [scores]);

  const totalScore = useMemo(() => {
    const specialPart = isChuyenClass ? specialScore : 0;
    return Math.round((baseScore + specialPart + awardBonus + certBonus) * 10) / 10;
  }, [awardBonus, baseScore, certBonus, isChuyenClass, specialScore]);

  const tier = getTierThreshold(totalScore);
  const tierColor = getTierColor(tier);

  const radarData = SUBJECTS.map((subject) => ({
    subject: subject.label,
    score: scores[subject.key] || 0,
    fullMark: 10,
  }));

  const achievementColumns = useMemo(() => {
    const columns: Array<{
      top: { clientId: string; prize: PrizeType; award: ApiAward };
      bottom?: { clientId: string; prize: PrizeType; award: ApiAward };
    }> = [];
    for (let i = 0; i < selectedAwards.length; i += 2) {
      columns.push({ top: selectedAwards[i], bottom: selectedAwards[i + 1] });
    }
    return columns;
  }, [selectedAwards]);

  const blocks = useMemo(() => {
    const sorted = [...SUBJECTS].sort((a, b) => (scores[b.key] || 0) - (scores[a.key] || 0));
    const top3 = sorted.slice(0, 3).map((item) => item.label);
    const recs = [];
    if (top3.includes("Toán") && top3.includes("Lý")) recs.push({ block: "A00", name: "Toán - Lý - Hóa", match: 95 });
    if (top3.includes("Toán") && top3.includes("Anh")) recs.push({ block: "A01", name: "Toán - Lý - Anh", match: 88 });
    if (top3.includes("Văn") && top3.includes("Sử")) recs.push({ block: "C00", name: "Văn - Sử - Địa", match: 82 });
    if (top3.includes("Anh")) recs.push({ block: "D01", name: "Toán - Văn - Anh", match: 79 });
    if (top3.includes("Sinh") || top3.includes("Hóa")) recs.push({ block: "B00", name: "Toán - Hóa - Sinh", match: 77 });
    return recs.slice(0, 3);
  }, [scores]);

  const addAward = (awardId: number) => {
    setSelectedAchievements((prev) => [
      ...prev,
      { clientId: createClientId(), award_id: awardId, prize: "Khuyen Khich" },
    ]);
  };

  const removeSelectedAward = (clientId: string) => {
    setSelectedAchievements((prev) => prev.filter((item) => item.clientId !== clientId));
  };

  const changeAchievementPrize = (clientId: string, prize: PrizeType) => {
    setSelectedAchievements((prev) => prev.map((item) => (
      item.clientId === clientId ? { ...item, prize } : item
    )));
  };

  const handleSave = async () => {
    const token = localStorage.getItem("gr1_access_token");
    if (!token) {
      setError("Vui lòng đăng nhập để lưu hồ sơ");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const payload: ProfileUpdatePayload = {
        full_name: userName.trim() || "Học sinh của tôi",
        math: scores.toan,
        literature: scores.van,
        english: scores.anh,
        physics: scores.ly,
        chemistry: scores.hoa,
        biology: scores.sinh,
        history: scores.su,
        geography: scores.dia,
        is_special: isChuyenClass,
        special_subject: specialSubject,
        special_score: isChuyenClass ? specialScore : 0,
        base_score: baseScore,
      };
      await updateMyProfile(token, payload);

      for (const achievement of savedAchievements) {
        await deleteMyAchievement(token, achievement.id);
      }
      for (const item of selectedAchievements) {
        await addMyAchievement(token, { award_id: item.award_id, prize: item.prize });
      }
      const refreshed = await getMyAchievements(token);
      setSavedAchievements(refreshed.results || []);
      setSelectedAchievements(
        (refreshed.results || []).map((item, index) => ({
          clientId: `saved-${item.id}-${index}`,
          award_id: item.award_id,
          prize: normalizePrize(item.prize),
        })),
      );
      setSaveMessage("Đã lưu thông tin hồ sơ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu hồ sơ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={dotBg} className="bunik-page">
      <header className="bunik-container bunik-page-intro" style={{ textAlign: "center" }}>
        <SketchHeading kicker="góc của bạn —" color={B.plum} width="82%">
          Hồ sơ & tính điểm học lực
        </SketchHeading>
        <p className="bunik-note-text" style={{ fontSize: 19, margin: "22px auto 0", maxWidth: 620 }}>Nhập điểm, lưu thành tích và xem bức tranh học lực của riêng bạn.</p>
      </header>

      {loading && <CenterNote title="Đang mở hồ sơ của bạn…" />}

      {!loading && (
        <div className="bunik-container" style={{ paddingBottom: 54 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div style={handCard} className="p-6">
                <div className="flex items-center gap-4 mb-3">
                  <div
                    className="w-16 h-16 rounded-[20px] flex items-center justify-center text-white flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${B.terracotta} 0%, ${B.honey} 100%)`,
                      boxShadow: `4px 4px 0 ${B.ink}`,
                    }}
                  >
                    HS
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="outline-none bg-transparent w-full"
                        style={{ fontWeight: 800, color: B.ink, fontSize: 18, border: "none", borderBottom: `2px dashed ${B.muted}` }}
                      />
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: B.terracotta, color: B.paperLight, border: `1.5px solid ${B.ink}`, fontWeight: 700, opacity: saving ? 0.7 : 1 }}
                        title={saving ? "Đang lưu" : "Lưu thông tin"}
                      >
                        <Save size={14} />
                      </button>
                    </div>
                    <p style={{ color: B.muted, fontSize: 13, marginTop: 4 }}>Nhấn để đổi tên</p>
                  </div>
                </div>
                {saveMessage && <p role="status" style={{ color: B.olive, fontSize: 13, fontWeight: 700 }}>{saveMessage}</p>}
                {error && <p role="alert" style={{ color: B.rust, fontSize: 13, fontWeight: 700 }}>{error}</p>}

                <div
                  className="flex items-center justify-between p-4 rounded-2xl mt-4"
                  style={{ background: "rgba(206,155,78,.08)", border: `2px dashed ${B.muted}` }}
                >
                  <div>
                    <p style={{ fontWeight: 700, color: B.ink, fontSize: 14 }}>Trường chuyên?</p>
                    <p style={{ fontSize: 12, color: B.muted }}>Dùng môn chuyên và điểm trung bình môn chuyên riêng</p>
                  </div>
                  <button onClick={() => setIsChuyenClass(!isChuyenClass)}>
                    {isChuyenClass ? <ToggleRight size={36} color={B.terracotta} /> : <ToggleLeft size={36} color={B.muted} />}
                  </button>
                </div>

                {isChuyenClass && (
                  <div className="mt-4 space-y-3">
                    <div style={{ position: "relative" }}>
                      <button
                        className="w-full px-3 py-2 rounded-xl flex items-center justify-between"
                        style={{ border: `2px solid ${B.ink}`, color: B.ink, fontWeight: 700, background: B.paper }}
                        onClick={() => setShowSpecialDropdown((value) => !value)}
                      >
                        <span>{formatSpecialLabel(specialSubject)}</span>
                        <ChevronDown size={16} />
                      </button>
                      {showSpecialDropdown && (
                        <div
                          className="p-2 rounded-xl"
                          style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            left: 0,
                            right: 0,
                            zIndex: 20,
                            border: `2px solid ${B.ink}`,
                            background: B.paperLight,
                            boxShadow: "0 12px 30px rgba(26,26,46,0.12)",
                          }}
                        >
                          <div className="grid grid-cols-2 gap-2">
                            {SPECIAL_SUBJECTS.map((item) => (
                              <button
                                key={item.key}
                                className="px-2 py-1.5 rounded-lg text-sm text-left"
                                style={{
                                  background: item.key === specialSubject ? "rgba(194,96,63,.14)" : "transparent",
                                  color: B.ink,
                                  fontWeight: item.key === specialSubject ? 800 : 600,
                                }}
                                onClick={() => {
                                  setSpecialSubject(item.key);
                                  setShowSpecialDropdown(false);
                                }}
                              >
                                Chuyen {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: B.body, fontWeight: 700 }}>Điểm trung bình môn chuyên</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={specialScore}
                        onChange={(e) => setSpecialScore(Math.min(10, Math.max(0, Number(e.target.value))))}
                        className="mt-1 w-full px-3 py-2 rounded-xl text-sm outline-none"
                        style={{ border: `2px solid ${B.ink}`, color: B.ink, fontWeight: 700, background: B.paper }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={handCard} className="p-6">
                <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: 17, marginBottom: 16 }}>
                  Điểm trung bình 8 môn (0–10)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {SUBJECTS.map((subject) => (
                    <div key={subject.key}>
                      <label className="flex items-center gap-2 mb-1.5" style={{ fontSize: 13, color: B.body, fontWeight: 700 }}>
                        {subject.label}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={scores[subject.key]}
                        onChange={(e) => setScores((prev) => ({ ...prev, [subject.key]: Math.min(10, Math.max(0, Number(e.target.value))) }))}
                        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                        style={{ border: `2px solid ${B.ink}`, color: B.ink, fontWeight: 700, background: B.paper }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={handCard} className="p-6">
                <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: 17, marginBottom: 12 }}>Thành tích</h3>
                <div style={{ position: "relative" }}>
                  <button
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between"
                    style={{ border: `2px solid ${B.ink}`, color: B.ink, fontWeight: 700, background: B.paper }}
                    onClick={() => setShowAwardsDropdown((value) => !value)}
                  >
                    <span>Chon thanh tich hop le</span>
                    <ChevronDown size={16} />
                  </button>
                  {showAwardsDropdown && (
                    <div
                      className="p-2 rounded-xl max-h-72 overflow-y-auto hide-scrollbar"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 0,
                        right: 0,
                        zIndex: 30,
                        border: `2px solid ${B.ink}`,
                        background: B.paperLight,
                        boxShadow: "0 14px 35px rgba(26,26,46,0.16)",
                      }}
                    >
                      <div className="space-y-1">
                        {awardsCatalog.map((award) => (
                          <button
                            key={award.id}
                            className="w-full px-3 py-2 rounded-lg text-left"
                            style={{ background: "transparent", color: B.ink, fontWeight: 700 }}
                            onClick={() => addAward(award.id)}
                          >
                            {award.name} ({award.level})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="flex flex-wrap gap-3">
                    {achievementColumns.map((column, index) => (
                      <div key={`${column.top.clientId}-${index}`} className="w-56 space-y-2">
                        {[column.top, column.bottom].filter(Boolean).map((item) => (
                          <div
                            key={item!.clientId}
                            className="px-3 py-2 rounded-xl"
                            style={{ background: "rgba(255,179,71,0.15)", border: "1px solid rgba(255,179,71,0.35)", position: "relative" }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span style={{ color: "#92400E", fontSize: 13, fontWeight: 700 }}>
                                {item!.award.name}
                              </span>
                              <button onClick={() => removeSelectedAward(item!.clientId)} style={{ color: "#92400E" }}>
                                <X size={14} />
                              </button>
                            </div>
                            <p style={{ color: "#B45309", fontSize: 11, marginTop: 4 }}>{item!.award.level}</p>
                            <div className="mt-2" style={{ position: "relative" }}>
                              <button
                                type="button"
                                onClick={() => setActivePrizeDropdownId((prev) => prev === item!.clientId ? null : item!.clientId)}
                                className="w-full px-3 py-2 rounded-lg text-xs flex items-center justify-between"
                                style={{
                                  border: "1px solid rgba(146,64,14,0.25)",
                                  color: "#92400E",
                                  background: `linear-gradient(180deg, ${B.paper} 0%, ${B.paperLight} 100%)`,
                                  fontWeight: 700,
                                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
                                }}
                              >
                                <span>{PRIZE_OPTIONS.find((option) => option.value === item!.prize)?.label ?? "Chon giai"}</span>
                                <ChevronDown size={14} />
                              </button>
                              {activePrizeDropdownId === item!.clientId && (
                                <div
                                  className="rounded-xl p-1"
                                  style={{
                                    position: "absolute",
                                    top: "calc(100% + 6px)",
                                    left: 0,
                                    right: 0,
                                    zIndex: 40,
                                    background: B.paperLight,
                                    border: "1px solid rgba(146,64,14,0.2)",
                                    boxShadow: "0 10px 24px rgba(146,64,14,0.14)",
                                  }}
                                >
                                  {PRIZE_OPTIONS.map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => {
                                        changeAchievementPrize(item!.clientId, option.value);
                                        setActivePrizeDropdownId(null);
                                      }}
                                      className="w-full px-3 py-2 rounded-lg text-left text-xs"
                                      style={{
                                        color: option.value === item!.prize ? "#7C2D12" : "#92400E",
                                        background: option.value === item!.prize ? "rgba(251,191,36,0.18)" : "transparent",
                                        fontWeight: option.value === item!.prize ? 800 : 600,
                                      }}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p style={{ color: "#92400E", fontSize: 11, fontWeight: 700, marginTop: 6 }}>
                              +{getAwardBonus(item!.award.level, item!.prize)} diem
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={handCard} className="p-6">
                <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: 17, marginBottom: 16 }}>
                  Chứng chỉ quốc tế
                </h3>
                <div className="space-y-4">
                  <div>
                    <label style={{ fontSize: 13, color: B.body, fontWeight: 700 }}>IELTS (×2): +{(ieltScore * 2).toFixed(1)}</label>
                    <input
                      type="number"
                      min={0}
                      max={9}
                      step={0.5}
                      value={ieltScore}
                      onChange={(e) => setIeltScore(Math.min(9, Math.max(0, Number(e.target.value))))}
                      className="mt-2 w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ border: `2px solid ${B.ink}`, color: B.ink, fontWeight: 700, background: B.paper }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: B.body, fontWeight: 700 }}>SAT (÷100): +{(satScore / 100).toFixed(2)}</label>
                    <input
                      type="number"
                      min={0}
                      max={1600}
                      step={10}
                      value={satScore}
                      onChange={(e) => setSatScore(Math.min(1600, Math.max(0, Number(e.target.value))))}
                      className="mt-2 w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ border: `2px solid ${B.ink}`, color: B.ink, fontWeight: 700, background: B.paper }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div
                className="p-8 text-center"
                style={{ ...handCard, border: `2.5px solid ${tierColor}40`, boxShadow: `6px 6px 0px ${tierColor}25` }}
              >
                <p style={{ color: B.muted, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Tổng điểm học lực</p>
                <div style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 68, color: tierColor, lineHeight: 1 }}>
                  {totalScore}
                </div>
                <div className="flex items-center justify-center mt-4">
                  <span
                    className="px-6 py-2 rounded-2xl text-xl"
                    style={{ fontWeight: 700, fontFamily: "'Shantell Sans', cursive", fontSize: 24, background: `${tierColor}20`, color: tierColor, border: `1.5px solid ${B.ink}` }}
                  >
                    Tier {tier}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-6">
                  {[
                    { label: "Điểm cơ sở", value: baseScore.toFixed(1) },
                    { label: "Môn chuyên", value: `+${(isChuyenClass ? specialScore : 0).toFixed(1)}` },
                    { label: "Thành tích", value: `+${awardBonus.toFixed(0)}` },
                    { label: "Chứng chỉ", value: `+${certBonus.toFixed(1)}` },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-2xl text-center" style={{ background: "rgba(206,155,78,.09)", border: `1px dashed ${B.muted}` }}>
                      <p style={{ fontSize: 10, color: B.muted, fontWeight: 700 }}>{item.label}</p>
                      <p style={{ fontWeight: 900, color: B.terracotta, fontSize: 16 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={handCard} className="p-5">
                <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: 16, marginBottom: 12 }}>Bảng tier</h3>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { tier: "F", label: "< 45", color: "#3F3F46" },
                    { tier: "E", label: ">= 45", color: "#F97316" },
                    { tier: "D", label: ">= 60", color: "#EAB308" },
                    { tier: "C", label: ">= 75", color: "#4CAF50" },
                    { tier: "B", label: ">= 90", color: "#2196F3" },
                    { tier: "A", label: ">= 100", color: "#9C27B0" },
                    { tier: "S", label: ">= 150", color: "#E11D48" },
                  ].map((item) => (
                    <div
                      key={item.tier}
                      className="p-2 rounded-xl text-center"
                      style={{ background: tier === item.tier ? `${item.color}20` : B.paper, border: `2px solid ${tier === item.tier ? item.color : "transparent"}` }}
                    >
                      <p style={{ fontWeight: 900, color: item.color, fontSize: 14 }}>{item.tier}</p>
                      <p style={{ fontSize: 10, color: B.muted }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={handCard} className="p-6">
                <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: 16, marginBottom: 16 }}>Bản đồ học lực</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={B.muted} strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: B.body, fontWeight: 700 }} />
                    <PolarRadiusAxis domain={[5, 10]} tick={{ fontSize: 9 }} />
                    <Radar
                      name="Điểm"
                      dataKey="score"
                      stroke={B.terracotta}
                      fill={B.terracotta}
                      fillOpacity={0.2}
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: B.terracotta, strokeWidth: 0 }}
                    />
                    <Tooltip contentStyle={{ borderRadius: 12, border: `2px solid ${B.ink}`, background: B.paperLight, fontSize: 13 }} formatter={(value: number) => [`${value}/10`, "Điểm"]} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {blocks.length > 0 && (
                <div style={handCard} className="p-6">
                  <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: 16, marginBottom: 16 }}>Khối học phù hợp</h3>
                  <div className="space-y-3">
                    {blocks.map((block, index) => (
                      <Link
                        key={block.block}
                        to={`/nganh?block=${block.block}`}
                        className="flex items-center justify-between p-4 rounded-2xl"
                        style={{
                          background: index === 0 ? "rgba(206,155,78,.14)" : B.paper,
                          border: `2px solid ${index === 0 ? B.honey : "rgba(43,39,34,.12)"}`,
                          textDecoration: "none",
                        }}
                      >
                        <div>
                          <span className="px-2.5 py-1 rounded-xl text-sm mr-3" style={{ background: B.terracotta, color: B.paperLight, border: `1.5px solid ${B.ink}`, fontWeight: 800 }}>
                            {block.block}
                          </span>
                          <span style={{ fontWeight: 700, color: B.ink, fontSize: 14 }}>{block.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 rounded-xl text-sm" style={{ background: "rgba(67,217,163,0.15)", color: "#16A34A", fontWeight: 800 }}>
                            {block.match}%
                          </div>
                          <ChevronRight size={14} color={B.muted} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
