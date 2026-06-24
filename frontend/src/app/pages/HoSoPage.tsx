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
import {
  addMyAchievement,
  deleteMyAchievement,
  getAwardsCatalog,
  getMyAchievements,
  getMyCertificates,
  getMyProfile,
  getMySubjectProfile,
  updateMyProfile,
  updateMySubjectProfile,
  type ProfileUpdatePayload,
} from "../services/api";
import type { ApiAchievement, ApiAward, ApiSchoolSubject, ApiSubjectResult } from "../types/api";
import { B, CenterNote, SketchHeading, cardStyle } from "../components/bunik";
import { NumberField } from "../components/NumberField";

type SpecialSubject = "toan" | "ly" | "hoa" | "sinh" | "tin" | "ngoai_ngu" | "van" | "su" | "dia";
type SubjectResultDraft = {
  numeric_score: number | null;
  assessment_status: 'PASSED' | 'FAILED' | null;
};
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

const CORE_SUBJECT_CODES = ['math', 'literature', 'english', 'history'];
const TIER_RANGES = [
  { tier: "S", min: 150, max: Number.POSITIVE_INFINITY, range: "150+" },
  { tier: "A", min: 100, max: 149, range: "100-149" },
  { tier: "B", min: 90, max: 99, range: "90-99" },
  { tier: "C", min: 75, max: 89, range: "75-89" },
  { tier: "D", min: 60, max: 74, range: "60-74" },
  { tier: "E", min: 45, max: 59, range: "45-59" },
  { tier: "F", min: 0, max: 44, range: "0-44" },
] as const;
const TIER_COLORS: Record<string, string> = {
  S: B.terracotta,
  A: B.plum,
  B: B.indigo,
  C: B.olive,
  D: B.honey,
  E: B.rust,
  F: B.brown,
};

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

function getAwardBaseBonus(level?: string | null, prize?: PrizeType): number {
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

function buildAwardBonuses(items: Array<{ clientId: string; prize: PrizeType; award: ApiAward }>): Array<{ clientId: string; bonus: number }> {
  const repeatedCounts = new Map<string, number>();

  return items.map((item) => {
    const normalizedLevel = normalizeText(item.award.level || "");
    const key = `${normalizedLevel}::${item.prize}`;
    const baseBonus = getAwardBaseBonus(item.award.level, item.prize);
    const repeatIndex = repeatedCounts.get(key) ?? 0;
    if (item.prize === "Khuyen Khich") {
      repeatedCounts.set(key, repeatIndex + 1);
    }
    return {
      clientId: item.clientId,
      bonus: item.prize === "Khuyen Khich"
        ? Math.round((baseBonus / (2 ** repeatIndex)) * 100) / 100
        : baseBonus,
    };
  });
}

function formatSpecialLabel(subject: SpecialSubject): string {
  const item = SPECIAL_SUBJECTS.find((value) => value.key === subject);
  return item ? `Chuyên ${item.label}` : "Môn chuyên";
}

function createClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampScore(value: number, max: number) {
  return Math.min(Math.max(value, 0), max);
}

function getTierMeta(score: number | null) {
  if (score === null) return null;
  return TIER_RANGES.find((item) => score >= item.min && score <= item.max) ?? TIER_RANGES[TIER_RANGES.length - 1];
}

export default function HoSoPage() {
  const [subjectCatalog, setSubjectCatalog] = useState<ApiSchoolSubject[]>([]);
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);
  const [subjectResults, setSubjectResults] = useState<Record<string, SubjectResultDraft>>({});
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
        const [profileResponse, subjectResponse, awardResponse, achievementResponse, certificateResponse] = await Promise.all([
          getMyProfile(token),
          getMySubjectProfile(token),
          getAwardsCatalog(token),
          getMyAchievements(token),
          getMyCertificates(token),
        ]);
        const user = profileResponse.user;
        setSubjectCatalog(subjectResponse.subjects);
        setSelectedElectives(subjectResponse.selected_elective_codes);
        setSubjectResults(Object.fromEntries(subjectResponse.results.map((result) => [
          result.subject_code,
          {
            numeric_score: result.numeric_score,
            assessment_status: result.assessment_status,
          },
        ])));
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

  const awardBonuses = useMemo(() => buildAwardBonuses(selectedAwards), [selectedAwards]);
  const awardBonus = useMemo(
    () => awardBonuses.reduce((sum, item) => sum + item.bonus, 0),
    [awardBonuses],
  );
  const awardBonusByClientId = useMemo(
    () => new Map(awardBonuses.map((item) => [item.clientId, item.bonus])),
    [awardBonuses],
  );

  const certBonus = ieltScore * 2 + satScore / 100;
  const coreSubjects = useMemo(
    () => subjectCatalog.filter((subject) => subject.counts_as_core),
    [subjectCatalog],
  );
  const electiveSubjects = useMemo(
    () => subjectCatalog.filter((subject) => subject.curriculum_group === 'ELECTIVE'),
    [subjectCatalog],
  );
  const selectedSubjects = useMemo(
    () => [
      ...coreSubjects,
      ...electiveSubjects.filter((subject) => selectedElectives.includes(subject.code)),
    ],
    [coreSubjects, electiveSubjects, selectedElectives],
  );
  const scorePreview = useMemo(() => {
    const results = selectedSubjects.map((subject) => subjectResults[subject.code]);
    const numericValues = results
      .map((result) => result?.numeric_score)
      .filter((value): value is number => value !== null && value !== undefined);
    const numericSum = numericValues.reduce((sum, value) => sum + value, 0);
    const numericAverage = numericValues.length > 0 ? numericSum / numericValues.length : null;
    const passedCount = results.filter((result) => result?.assessment_status === 'PASSED').length;
    const failedCount = results.filter((result) => result?.assessment_status === 'FAILED').length;
    const isComplete = selectedElectives.length === 4
      && selectedSubjects.length === 8
      && results.every((result) => (
        result?.numeric_score !== null && result?.numeric_score !== undefined
      ) || result?.assessment_status === 'PASSED' || result?.assessment_status === 'FAILED');
    return {
      isComplete,
      numericAverage,
      passedCount,
      failedCount,
      score80: isComplete && numericAverage !== null
        ? Math.round((numericSum + numericAverage * passedCount) * 100) / 100
        : null,
    };
  }, [selectedElectives.length, selectedSubjects, subjectResults]);

  const incompleteInfo = useMemo(() => {
    const electivesRemaining = Math.max(0, 4 - selectedElectives.length);
    const missingResultNames = selectedSubjects
      .filter((subject) => {
        const result = subjectResults[subject.code];
        return !result || (result.numeric_score === null && result.assessment_status === null);
      })
      .map((subject) => subject.name);
    return { electivesRemaining, missingResultNames };
  }, [selectedElectives.length, selectedSubjects, subjectResults]);

  const radarData = selectedSubjects.map((subject) => {
    const result = subjectResults[subject.code];
    const raw = result?.numeric_score
      ?? (result?.assessment_status === 'PASSED' ? scorePreview.numericAverage : 0)
      ?? 0;
    // The map emphasises the 7–10 band; anything below 7 collapses to the centre.
    const score = raw >= 7 ? raw : 0;
    return { subject: subject.name, score, fullMark: 10 };
  });
  const score80Value = scorePreview.score80 === null ? null : clampScore(scorePreview.score80, 80);
  const specialBonusValue = clampScore(isChuyenClass ? specialScore : 0, 10);
  const awardBonusValue = clampScore(awardBonus, 180);
  const certBonusValue = clampScore(certBonus, 30);
  const totalScore300 = score80Value === null
    ? null
    : Math.round((score80Value + specialBonusValue + awardBonusValue + certBonusValue) * 100) / 100;
  const ratingScore = totalScore300 === null ? null : Math.round((totalScore300 / 100) * 100) / 100;
  const tierMeta = getTierMeta(totalScore300);

  const blocks = useMemo(() => {
    const availableCodes = new Set(selectedSubjects.map((subject) => subject.code));
    const definitions = [
      { block: 'A00', name: 'Toán - Vật lí - Hóa học', codes: ['math', 'physics', 'chemistry'] },
      { block: 'A01', name: 'Toán - Vật lí - Tiếng Anh', codes: ['math', 'physics', 'english'] },
      { block: 'B00', name: 'Toán - Hóa học - Sinh học', codes: ['math', 'chemistry', 'biology'] },
      { block: 'C00', name: 'Ngữ văn - Lịch sử - Địa lí', codes: ['literature', 'history', 'geography'] },
      { block: 'D01', name: 'Toán - Ngữ văn - Tiếng Anh', codes: ['math', 'literature', 'english'] },
    ];
    return definitions
      .filter((definition) => definition.codes.every((code) => availableCodes.has(code)))
      .map((definition) => {
        const values = definition.codes
          .map((code) => subjectResults[code]?.numeric_score)
          .filter((value): value is number => value !== null && value !== undefined);
        const match = values.length === definition.codes.length
          ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10)
          : 0;
        return { block: definition.block, name: definition.name, match };
      })
      .sort((a, b) => b.match - a.match);
  }, [selectedSubjects, subjectResults]);

  const addAward = (awardId: number) => {
    setSelectedAchievements((prev) => [
      ...prev,
      { clientId: createClientId(), award_id: awardId, prize: "Khuyen Khich" },
    ]);
    setShowAwardsDropdown(false);
  };

  const removeSelectedAward = (clientId: string) => {
    setSelectedAchievements((prev) => prev.filter((item) => item.clientId !== clientId));
  };

  const changeAchievementPrize = (clientId: string, prize: PrizeType) => {
    setSelectedAchievements((prev) => prev.map((item) => (
      item.clientId === clientId ? { ...item, prize } : item
    )));
  };

  const toggleElective = (code: string) => {
    setSelectedElectives((current) => {
      if (current.includes(code)) return current.filter((item) => item !== code);
      if (current.length >= 4) return current; // limit enforced by disabling in the UI
      return [...current, code];
    });
  };

  const setNumericResult = (code: string, value: number) => {
    setSubjectResults((current) => ({
      ...current,
      [code]: { numeric_score: value, assessment_status: null },
    }));
  };

  const setAssessmentResult = (code: string, value: 'PASSED' | 'FAILED') => {
    setSubjectResults((current) => ({
      ...current,
      [code]: { numeric_score: null, assessment_status: value },
    }));
  };

  const clearSubjectResult = (code: string) => {
    setSubjectResults((current) => {
      const next = { ...current };
      delete next[code];
      return next;
    });
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

    // The subject profile requires exactly four electives; the rest of the
    // profile (name, lớp chuyên, thành tích) can always be saved. Keep them
    // decoupled so a partial profile never blocks saving identity + achievements.
    const canSaveSubjects = selectedElectives.length === 4;

    try {
      const profilePayload: ProfileUpdatePayload = {
        full_name: userName.trim() || "Học sinh của tôi",
        is_special: isChuyenClass,
        special_subject: specialSubject,
        special_score: isChuyenClass ? specialScore : 0,
      };

      // Independent writes run in parallel.
      const [, subjectResponse] = await Promise.all([
        updateMyProfile(token, profilePayload),
        canSaveSubjects
          ? updateMySubjectProfile(token, {
              elective_codes: selectedElectives,
              results: selectedSubjects.flatMap((subject) => {
                const result = subjectResults[subject.code];
                if (!result || (result.numeric_score === null && result.assessment_status === null)) return [];
                return [{
                  subject_code: subject.code,
                  numeric_score: result.numeric_score,
                  assessment_status: result.assessment_status,
                }];
              }),
            })
          : Promise.resolve(null),
      ]);

      if (subjectResponse) {
        setSelectedElectives(subjectResponse.selected_elective_codes);
        setSubjectResults(Object.fromEntries(subjectResponse.results.map((result: ApiSubjectResult) => [
          result.subject_code,
          { numeric_score: result.numeric_score, assessment_status: result.assessment_status },
        ])));
      }

      // Re-sync achievements: drop the saved set, recreate the current one.
      // Each phase fans out in parallel instead of awaiting one at a time.
      await Promise.all(savedAchievements.map((achievement) => deleteMyAchievement(token, achievement.id)));
      await Promise.all(selectedAchievements.map((item) => addMyAchievement(token, { award_id: item.award_id, prize: item.prize })));
      const refreshed = await getMyAchievements(token);
      setSavedAchievements(refreshed.results || []);
      setSelectedAchievements(
        (refreshed.results || []).map((item, index) => ({
          clientId: `saved-${item.id}-${index}`,
          award_id: item.award_id,
          prize: normalizePrize(item.prize),
        })),
      );
      setSaveMessage(
        canSaveSubjects
          ? "Đã lưu hồ sơ"
          : "Đã lưu hồ sơ — chọn đủ 4 môn lựa chọn để lưu điểm học lực.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu hồ sơ");
    } finally {
      setSaving(false);
    }
  };

  const renderSubjectResult = (subject: ApiSchoolSubject) => {
    const result = subjectResults[subject.code];
    return (
      <div key={subject.code} className="p-3 rounded-2xl" style={{ background: B.paper, border: `1.5px solid ${B.ink}` }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <label style={{ color: B.ink, fontSize: 13, fontWeight: 800 }}>{subject.name}</label>
          {result && (
            <button type="button" onClick={() => clearSubjectResult(subject.code)} style={{ color: B.muted, fontSize: 11, fontWeight: 700 }}>
              Xóa kết quả
            </button>
          )}
        </div>
        {subject.assessment_type === 'NUMERIC' ? (
          <NumberField
            min={0}
            max={10}
            step={0.1}
            decimals={2}
            placeholder="Nhập điểm 0–10"
            ariaLabel={`Điểm môn ${subject.name}`}
            value={result?.numeric_score ?? 0}
            onChange={(value) => setNumericResult(subject.code, value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ border: `2px solid ${B.ink}`, color: B.ink, fontWeight: 700, background: B.paperLight }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {([
              ['PASSED', 'Đạt'],
              ['FAILED', 'Chưa đạt'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAssessmentResult(subject.code, value)}
                className="px-3 py-2 rounded-xl text-sm"
                style={{
                  border: `2px solid ${B.ink}`,
                  background: result?.assessment_status === value ? B.olive : B.paperLight,
                  color: result?.assessment_status === value ? B.paperLight : B.ink,
                  fontWeight: 800,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
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
                    className="w-16 h-16 flex items-center justify-center flex-shrink-0"
                    style={{
                      background: B.terracotta,
                      color: B.paperLight,
                      border: `2.5px solid ${B.ink}`,
                      borderRadius: "20px 24px 18px 22px/22px 18px 24px 20px",
                      fontFamily: "'Shantell Sans', cursive",
                      fontWeight: 800,
                      boxShadow: `4px 4px 0 rgba(43,39,34,0.2)`,
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
                        className="bunik-press inline-flex items-center gap-2 flex-shrink-0"
                        style={{
                          background: B.terracotta,
                          color: B.paperLight,
                          border: `2px solid ${B.ink}`,
                          borderRadius: "13px 10px 12px 11px/11px 12px 10px 13px",
                          padding: "8px 15px",
                          fontWeight: 700,
                          fontSize: 14,
                          whiteSpace: "nowrap",
                          opacity: saving ? 0.75 : 1,
                          ["--sh" as string]: B.ink,
                        }}
                        title={saving ? "Đang lưu" : "Lưu thông tin hồ sơ"}
                      >
                        <Save size={15} />
                        {saving ? "Đang lưu…" : "Lưu hồ sơ"}
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
                                Chuyên {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: B.body, fontWeight: 700 }}>Điểm trung bình môn chuyên</label>
                      <NumberField
                        min={0}
                        max={10}
                        step={0.1}
                        decimals={2}
                        ariaLabel="Điểm trung bình môn chuyên"
                        value={specialScore}
                        onChange={setSpecialScore}
                        className="mt-1 w-full px-3 py-2 rounded-xl text-sm outline-none"
                        style={{ border: `2px solid ${B.ink}`, color: B.ink, fontWeight: 700, background: B.paper }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={handCard} className="p-6">
                <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: 17, marginBottom: 16 }}>
                  Hồ sơ môn học
                </h3>
                <p style={{ color: B.body, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
                  Bốn môn cốt lõi được tính cố định. Chọn thêm đúng bốn môn lựa chọn đang học.
                </p>

                <p style={{ color: B.ink, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>4 môn cốt lõi</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coreSubjects.map(renderSubjectResult)}
                </div>

                <div className="flex items-center justify-between mt-6 mb-3">
                  <p style={{ color: B.ink, fontSize: 13, fontWeight: 800 }}>Chọn 4 môn lựa chọn</p>
                  <span
                    className="px-2.5 py-1 rounded-xl text-xs"
                    style={{
                      background: selectedElectives.length === 4 ? B.olive : B.honey,
                      color: selectedElectives.length === 4 ? B.paperLight : B.ink,
                      border: `1.5px solid ${B.ink}`,
                      fontWeight: 800,
                    }}
                  >
                    {selectedElectives.length}/4 môn
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {electiveSubjects.map((subject) => {
                    const selected = selectedElectives.includes(subject.code);
                    const disabled = !selected && selectedElectives.length >= 4;
                    return (
                      <button
                        key={subject.code}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleElective(subject.code)}
                        className="px-3 py-2 rounded-xl text-sm"
                        title={disabled ? "Đã đủ 4 môn — bỏ chọn một môn khác để đổi" : undefined}
                        style={{
                          background: selected ? B.terracotta : B.paper,
                          color: selected ? B.paperLight : B.ink,
                          border: `2px solid ${B.ink}`,
                          fontWeight: 700,
                          opacity: disabled ? 0.4 : 1,
                        }}
                      >
                        {selected ? '✓ ' : ''}{subject.name}
                      </button>
                    );
                  })}
                </div>

                {selectedElectives.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {electiveSubjects
                      .filter((subject) => selectedElectives.includes(subject.code))
                      .map(renderSubjectResult)}
                  </div>
                )}

                <div className="mt-5 p-4 rounded-2xl" style={{ background: "rgba(206,155,78,.09)", border: `2px dashed ${B.muted}` }}>
                  <p style={{ color: B.ink, fontSize: 12, fontWeight: 800 }}>Cách quy đổi môn Đạt/Chưa đạt</p>
                  <p style={{ color: B.body, fontSize: 12, lineHeight: 1.6, marginTop: 4 }}>
                    Môn Đạt nhận điểm trung bình của các môn có điểm; môn Chưa đạt nhận 0. Tổng cuối luôn quy về thang 80.
                  </p>
                </div>
              </div>

              <div style={handCard} className="p-6">
                <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: 17, marginBottom: 16 }}>
                  Chứng chỉ quốc tế
                </h3>
                <div className="space-y-4">
                  <div>
                    <label style={{ fontSize: 13, color: B.body, fontWeight: 700 }}>IELTS: +{(ieltScore * 2).toFixed(1)}</label>
                    <NumberField
                      min={0}
                      max={9}
                      step={0.5}
                      decimals={1}
                      ariaLabel="Điểm IELTS"
                      value={ieltScore}
                      onChange={setIeltScore}
                      className="mt-2 w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ border: `2px solid ${B.ink}`, color: B.ink, fontWeight: 700, background: B.paper }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: B.body, fontWeight: 700 }}>SAT: +{(satScore / 100).toFixed(2)}</label>
                    <NumberField
                      min={0}
                      max={1600}
                      step={10}
                      decimals={0}
                      ariaLabel="Điểm SAT"
                      value={satScore}
                      onChange={setSatScore}
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
                style={{ ...handCard, border: `2.5px solid ${B.terracotta}`, boxShadow: `6px 6px 0px rgba(194,96,63,.18)` }}
              >
                <div
                  className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"
                  style={{ textAlign: "left" }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ color: B.muted, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Rating học lực</p>
                    <div style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, fontSize: 68, color: B.terracotta, lineHeight: 1 }}>
                      {ratingScore?.toFixed(2) ?? '—'}
                      <span style={{ fontSize: 20, color: B.muted }}>/3.0</span>
                    </div>
                    <p style={{ color: B.body, fontSize: 13, fontWeight: 700, margin: "10px 0 0" }}>
                      {totalScore300 === null ? 'Cần đủ điểm học bạ để quy đổi thang 300' : ``}
                    </p>
                    <div className="mt-4">
                      <span
                        className="inline-flex px-4 py-2 rounded-2xl"
                        style={{
                          fontWeight: 800,
                          background: scorePreview.isComplete ? B.olive : B.honey,
                          color: scorePreview.isComplete ? B.paperLight : B.ink,
                          border: `1.5px solid ${B.ink}`,
                        }}
                      >
                        {scorePreview.isComplete ? 'Hồ sơ đã hoàn tất' : 'Hồ sơ môn học chưa hoàn tất'}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:gap-2"
                    style={{ minWidth: 112, textAlign: "center", alignSelf: "center" }}
                  >
                    <p style={{ color: B.muted, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", margin: 0 }}>Tier</p>
                    <span
                      style={{
                        width: 62,
                        height: 54,
                        display: "grid",
                        placeItems: "center",
                        border: `1.5px solid ${B.ink}`,
                        borderRadius: "14px 11px 13px 15px/15px 13px 11px 14px",
                        background: tierMeta ? TIER_COLORS[tierMeta.tier] : B.paper,
                        color: tierMeta ? B.paperLight : B.muted,
                        fontFamily: "'Shantell Sans', cursive",
                        fontWeight: 700,
                        fontSize: 28,
                      }}
                    >
                      {tierMeta?.tier ?? "—"}
                    </span>
                    <p style={{ color: B.body, fontSize: 12, lineHeight: 1.4, margin: 0 }}>
                      {tierMeta ? `${tierMeta.range} điểm` : 'Chưa có điểm'}
                    </p>
                  </div>
                </div>
                {!scorePreview.isComplete && (incompleteInfo.electivesRemaining > 0 || incompleteInfo.missingResultNames.length > 0) && (
                  <div className="mt-4 px-4 py-3 rounded-2xl text-left" style={{ background: "rgba(206,155,78,.12)", border: `1.5px dashed ${B.honey}` }}>
                    <p style={{ color: B.ink, fontSize: 12.5, fontWeight: 800, marginBottom: 4 }}>Để hoàn tất điểm học lực:</p>
                    <ul style={{ margin: 0, paddingLeft: 18, color: B.body, fontSize: 12.5, lineHeight: 1.6 }}>
                      {incompleteInfo.electivesRemaining > 0 && (
                        <li>Chọn thêm {incompleteInfo.electivesRemaining} môn lựa chọn.</li>
                      )}
                      {incompleteInfo.missingResultNames.length > 0 && (
                        <li>Nhập kết quả cho: {incompleteInfo.missingResultNames.join(", ")}.</li>
                      )}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-3 mt-6">
                  {[
                    { label: "Điểm học bạ", value: score80Value === null ? '—' : `${score80Value.toFixed(2)}` },
                    { label: "Điểm môn chuyên", value: `${specialBonusValue.toFixed(2)}` },
                    { label: "Điểm thành tích", value: `${awardBonusValue.toFixed(2)}` },
                    { label: "Điểm chứng chỉ", value: `${certBonusValue.toFixed(2)}` },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-2xl text-center" style={{ background: "rgba(206,155,78,.09)", border: `1px dashed ${B.muted}` }}>
                      <p style={{ fontSize: 10, color: B.muted, fontWeight: 700 }}>{item.label}</p>
                      <p style={{ fontWeight: 900, color: B.terracotta, fontSize: 16 }}>{item.value}</p>
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
                    <PolarRadiusAxis domain={[7, 10]} tick={{ fontSize: 9 }} />
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

              <div style={handCard} className="p-6">
                <h3 style={{ fontFamily: "'Shantell Sans', cursive", fontWeight: 700, color: B.ink, fontSize: 17, marginBottom: 12 }}>Thành tích</h3>
                <div style={{ position: "relative" }}>
                  <button
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between"
                    style={{ border: `2px solid ${B.ink}`, color: B.ink, fontWeight: 700, background: B.paper }}
                    onClick={() => setShowAwardsDropdown((value) => !value)}
                  >
                    <span>Chọn thành tích hợp lệ</span>
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
                  {selectedAwards.length === 0 ? (
                    <p className="bunik-note-text" style={{ fontSize: 15, margin: 0 }}>
                      Chưa có thành tích nào — chọn từ danh sách phía trên nhé.
                    </p>
                  ) : (
                    <div className="bunik-scroll flex gap-3 overflow-x-auto items-start" style={{ paddingBottom: 10 }}>
                      {selectedAwards.map((item) => (
                        <div
                          key={item.clientId}
                          className="w-56 flex-shrink-0"
                          style={{
                            background: B.paperLight,
                            border: `2px solid ${B.ink}`,
                            borderRadius: "16px 12px 15px 11px/11px 15px 12px 16px",
                            boxShadow: "3px 4px 0 rgba(43,39,34,0.13)",
                            padding: "12px 14px",
                            position: "relative",
                            animation: "achievementDraw .42s ease both",
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span style={{ color: B.ink, fontSize: 13.5, fontWeight: 800, lineHeight: 1.25 }}>
                              {item.award.name}
                            </span>
                            <button
                              onClick={() => removeSelectedAward(item.clientId)}
                              className="flex-shrink-0"
                              style={{ color: B.muted, lineHeight: 0 }}
                              title="Xóa thành tích"
                            >
                              <X size={15} />
                            </button>
                          </div>
                          <span
                            className="inline-block mt-2"
                            style={{
                              background: "rgba(206,155,78,.16)",
                              color: B.body,
                              border: `1.5px solid ${B.honey}`,
                              borderRadius: "9px 7px 8px 6px/6px 8px 7px 9px",
                              padding: "1px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {item.award.level}
                          </span>
                          <div className="mt-2.5" style={{ position: "relative" }}>
                            <button
                              type="button"
                              onClick={() => setActivePrizeDropdownId((prev) => prev === item.clientId ? null : item.clientId)}
                              className="w-full px-3 py-2 text-xs flex items-center justify-between"
                              style={{
                                border: `2px solid ${B.ink}`,
                                color: B.ink,
                                background: B.paper,
                                fontWeight: 700,
                                borderRadius: "11px 8px 10px 9px/9px 10px 8px 11px",
                              }}
                            >
                              <span>{PRIZE_OPTIONS.find((option) => option.value === item.prize)?.label ?? "Chọn giải"}</span>
                              <ChevronDown size={14} />
                            </button>
                            {activePrizeDropdownId === item.clientId && (
                              <div
                                className="p-1 mt-1.5"
                                style={{
                                  background: B.paperLight,
                                  border: `2px solid ${B.ink}`,
                                  borderRadius: "11px 9px 12px 10px/10px 12px 9px 11px",
                                }}
                              >
                                {PRIZE_OPTIONS.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      changeAchievementPrize(item.clientId, option.value);
                                      setActivePrizeDropdownId(null);
                                    }}
                                    className="w-full px-3 py-2 rounded-lg text-left text-xs"
                                    style={{
                                      color: B.ink,
                                      background: option.value === item.prize ? "rgba(194,96,63,.14)" : "transparent",
                                      fontWeight: option.value === item.prize ? 800 : 600,
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <span
                            className="inline-block mt-2.5"
                            style={{
                              background: B.honey,
                              color: B.ink,
                              border: `1.5px solid ${B.ink}`,
                              borderRadius: 999,
                              padding: "1px 11px",
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            +{(awardBonusByClientId.get(item.clientId) ?? 0).toFixed(2)} điểm
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                          <div className="px-2.5 py-1 rounded-xl text-sm" style={{ background: "rgba(46,106,98,.14)", color: B.teal, fontWeight: 800 }}>
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
