const state = {
  coaches: [],
  capacityRows: [],
  lastLoadedAt: null,
  source: "未取得",
  studentTags: {
    course: "",
    goal: "副業",
    primaryStyle: "伴走型",
    secondaryStyle: "共感支援型",
    anxietyLevel: 4,
    selfEfficacy: 3,
    risks: [],
  },
};

const COACH_SHEET_URL = "https://docs.google.com/spreadsheets/d/1VklSVI8hT8Q_ry6fE6zb8X9owLBU8RIXL2zhrahvbiY/edit?usp=sharing";
const STYLE_TYPES = ["牽引型", "伴走型", "コンサル型", "共感支援型", "ティーチング型", "実務レビュー型"];

document.getElementById("loadSheetsBtn").addEventListener("click", loadSheets);
document.getElementById("matchBtn").addEventListener("click", runMatching);
window.addEventListener("DOMContentLoaded", loadSheets);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    const next = src[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headerIndex = rows.findIndex((row) => row.filter(Boolean).length >= 2);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map((h) => normalizeHeader(h));
  return rows.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => {
      const obj = {};
      headers.forEach((header, idx) => {
        if (header) obj[header] = String(row[idx] || "").trim();
      });
      return obj;
    });
}

function normalizeHeader(header) {
  const h = String(header || "").replace(/\s+/g, "").replace(/\n/g, "");
  const lower = h.toLowerCase();
  if (/^(cs|担当|担当者|担当cs|cs名)$/i.test(h)) return "name";
  if (h.includes("コーチ") && h.includes("名")) return "name";
  if (h.includes("ランク") || lower === "rank") return "coach_rank";
  if (h.includes("顧客成功") || h.includes("成功率") || h.includes("成果率") || h.includes("完了率") || h.includes("卒業率") || h.includes("継続率")) return "customer_success_rate";
  if (h.includes("オンタイム") || h.includes("期限遵守") || h.includes("期日遵守") || h.includes("期限内") || h.includes("遅延なし") || h.includes("返信遵守")) return "on_time_rate";
  if ((h.includes("受入") || h.includes("受け入れ") || h.includes("空き") || h.includes("キャパ")) && (h.includes("数") || h.includes("人数") || h.includes("枠") || h.includes("残"))) return "current_capacity";
  if ((h.includes("今月") || h.includes("当月")) && h.includes("卒業")) return "graduations_this_month";
  if ((h.includes("来月") || h.includes("翌月")) && h.includes("卒業")) return "graduations_next_month";
  if (h.includes("受入") && (h.includes("可否") || h.includes("状態"))) return "accept_status";
  if (h.includes("タイプ") || h.includes("型")) return "primary_style";
  if (h.includes("コース") || lower.includes("course")) return "course_tags";
  if (h.includes("スキル") || h.includes("経験") || h.includes("資格") || h.includes("強み") || h.includes("得意") || h.includes("経歴") || h.includes("プロフィール") || h.includes("実績")) return `profile_${h}`;
  const map = [
    [/^(coach_id|コーチID|ID)$/i, "coach_id"],
    [/^(name|コーチ名|CS|CS名|担当CS|担当者|担当コーチ|氏名|名前|氏名（漢字）|フルネーム)$/i, "name"],
    [/^(team|チーム)$/i, "team"],
    [/^(manager_name|マネージャー|担当マネージャー)$/i, "manager_name"],
    [/^(status|稼働状態)$/i, "status"],
    [/^(accept_status|受入可否|受け入れ可否|受入状態)$/i, "accept_status"],
    [/^(course_tags|コース|担当コース|対応コース)$/i, "course_tags"],
    [/^(primary_style|タイプ|メインタイプ|コーチタイプ)$/i, "primary_style"],
    [/^(secondary_style|サブタイプ)$/i, "secondary_style"],
    [/^(current_students|現在担当数|担当人数|受講生数)$/i, "current_students"],
    [/^(max_students|最大担当数|上限人数)$/i, "max_students"],
    [/^(current_capacity|残り受入キャパ|残りの受け入れキャパ数|受入可能数|受入人数|受け入れ人数|受入可能人数|残り受け入れ人数|残キャパ|空き枠|空き人数)$/i, "current_capacity"],
    [/^(graduations_this_month|当月卒業予定|当月卒業予定数|今月卒業予定|今月卒業|当月卒業)$/i, "graduations_this_month"],
    [/^(graduations_next_month|翌月卒業予定|翌月卒業予定数|来月卒業予定|来月卒業|翌月卒業)$/i, "graduations_next_month"],
    [/^(energy_level|余力|エネルギー)$/i, "energy_level"],
    [/^(coach_rank|rank|ランク|評価ランク|CSランク|コーチランク)$/i, "coach_rank"],
    [/^(customer_success_rate|顧客成功率|成功率|CS率|成果率|卒業率|完了率|継続率|顧客成功|成功スコア)$/i, "customer_success_rate"],
    [/^(on_time_rate|オンタイム率|期限遵守率|対応期限遵守率|期日遵守率|遅延なし率|返信遵守率|オンタイム|期限内対応率)$/i, "on_time_rate"],
    [/^(performance_sample_size|実績集計対象数|対象件数|母数|サンプル数|担当実績数|実績件数)$/i, "performance_sample_size"],
    [/^(manager_notes|マネージャーコメント|マネージャー所感|備考|特徴)$/i, "manager_notes"],
    [/^(recent_risk_notes|直近リスク|リスクメモ)$/i, "recent_risk_notes"],
    [/^(last_updated|最終更新日|更新日)$/i, "last_updated"],
  ];
  const found = map.find(([pattern]) => pattern.test(h));
  return found ? found[1] : h;
}

async function loadSheets() {
  setStatus("スプレッドシートを取得中...");
  try {
    const coachUrl = toCsvExportUrl(COACH_SHEET_URL);
    if (!coachUrl) throw new Error("コーチ情報スプレッドシートURLを確認してください。");
    const coachText = await fetchSheetCsv(coachUrl);
    hydrateData(coachText, "", "Google Sheets");
  } catch (error) {
    setStatus(`スプレッドシートを取得できませんでした。\n共有設定が「リンクを知っている全員が閲覧可」になっているか確認してください。\n\nエラー: ${error.message}`);
  }
}

async function fetchSheetCsv(url) {
  const response = await fetch(`${apiBase()}/api/fetch-csv?url=${encodeURIComponent(url)}`);
  const text = await response.text();
  if (!response.ok) {
    try {
      const data = JSON.parse(text);
      throw new Error(data.error || `${response.status} ${response.statusText}`);
    } catch (error) {
      if (!/^Unexpected token|Unexpected end/.test(error.message || "")) throw error;
      throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
    }
  }
  return text;
}

function toCsvExportUrl(input) {
  if (!input) return "";
  if (/\/gviz\/tq\?/.test(input)) return input;
  const id = input.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
  if (!id) {
    if (/\/export\?/.test(input)) return input;
    return input;
  }
  const gid = input.match(/[?#&]gid=(\d+)/)?.[1] || "0";
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

function applyExtraction(data) {
  state.studentTags = {
    course: data.course || "",
    goal: data.goal || "副業",
    primaryStyle: data.primaryStyle || "伴走型",
    secondaryStyle: data.secondaryStyle || "共感支援型",
    anxietyLevel: data.anxietyLevel || 4,
    selfEfficacy: data.selfEfficacy || 3,
    risks: Array.isArray(data.risks) ? data.risks : [],
  };
}

function autoTagStudentText() {
  const notes = document.getElementById("studentNotes").value;
  const course = document.getElementById("studentCourse").value;

  const goal = /副業|収入|月収|稼ぎ|案件/.test(notes) ? "副業"
    : /転職/.test(notes) ? "転職"
    : /独立|フリーランス/.test(notes) ? "独立"
    : /現職|昇進/.test(notes) ? "現職成果"
    : "学習";

  const anxiety = /不安|怖い|心配|焦り|自信|お金ない|金欠/.test(notes) ? 5 : 3;
  const selfEfficacy = /自分にでき|何もない|自信/.test(notes) ? 2 : 3;
  const risks = [];
  if (/忙し|時間|夜勤|シフト|残業|深夜|生活リズム/.test(notes)) risks.push("忙しさ");
  if (/自信|怖い|不安|できるか/.test(notes)) risks.push("自信喪失");
  if (/一人|孤独|相談/.test(notes)) risks.push("孤独感");
  if (/成果|実感|稼げ|収入|案件/.test(notes)) risks.push("成長実感不足");
  if (/目標|何から|わからない|分からない/.test(notes)) risks.push("目標不明確");

  let primaryStyle = "伴走型";
  let secondaryStyle = "共感支援型";
  if (anxiety >= 4 || selfEfficacy <= 2) {
    primaryStyle = "伴走型";
    secondaryStyle = "共感支援型";
  } else if (/基礎|初心者|未経験|使ったこと/.test(notes)) {
    primaryStyle = "ティーチング型";
    secondaryStyle = "伴走型";
  } else if (/早く|すぐ|案件|稼ぎたい/.test(notes)) {
    primaryStyle = "コンサル型";
    secondaryStyle = "実務レビュー型";
  }

  applyExtraction({
    course,
    goal,
    primaryStyle,
    secondaryStyle,
    anxietyLevel: anxiety,
    selfEfficacy,
    risks,
    notes,
    additionalQuestions: buildAutoQuestions(notes, risks),
  });
}

function buildAutoQuestions(notes, risks) {
  const questions = [];
  if (risks.includes("忙しさ")) questions.push("現実的に学習できる曜日・時間帯はいつか");
  if (risks.includes("自信喪失")) questions.push("学習が止まりそうなとき、共感と強めの声かけのどちらが戻りやすいか");
  if (/副業|収入|稼ぎ/.test(notes)) questions.push("いつまでに初案件・初収益を目指したいか");
  if (!/sns|インスタ|instagram|canva|投稿|分析/i.test(notes)) questions.push("SNS運用や投稿作成の経験値はどの程度か");
  return questions;
}

function apiBase() {
  if (location.protocol === "file:") return "http://127.0.0.1:8765";
  return "";
}

function hydrateData(coachText, capacityText, source) {
  const coaches = rowsToObjects(parseCsv(coachText));
  const capacityRows = rowsToObjects(parseCsv(capacityText || ""));
  const merged = mergeCapacity(coaches, capacityRows).map(normalizeCoach);
  state.coaches = merged;
  state.capacityRows = capacityRows;
  state.source = source;
  state.lastLoadedAt = new Date();
  const exclusionSummary = summarizeExclusions(merged.map((coach) => ({ coach, reason: exclusionReason(coach) })));
  const eligible = merged.length - exclusionSummary.totalExcluded;
  const metricSummary = summarizeMetrics(merged);
  setStatus(`${source}を読み込みました。\n読み込み件数：${merged.length}名\n推薦対象：${eligible}名\n除外：${exclusionSummary.totalExcluded}名\n最終取得日時：${formatDateTime(state.lastLoadedAt)}\n\n成績データ：\n${metricSummary}\n\n除外理由：\n${exclusionSummary.text}`);
}

function mergeCapacity(coaches, capacityRows) {
  const byName = new Map();
  capacityRows.forEach((row) => {
    const name = cleanName(resolveCoachName(row));
    if (name) byName.set(name, row);
  });
  return coaches.map((coach) => {
    const cap = byName.get(cleanName(coach.name)) || {};
    return { ...coach, ...emptyOverride(coach, cap) };
  });
}

function emptyOverride(base, add) {
  const merged = { ...base };
  Object.keys(add).forEach((key) => {
    if (add[key] !== "") merged[key] = add[key];
  });
  return merged;
}

function normalizeCoach(raw) {
  const profileText = collectProfileText(raw);
  const traits = analyzeCoachTraits(`${raw.manager_notes || ""}\n${profileText}`);
  const explicitPrimaryStyle = normalizeCoachStyle(raw.primary_style);
  const explicitSecondaryStyle = normalizeCoachStyle(raw.secondary_style);
  const inferredStyle = explicitPrimaryStyle || inferStyleFromTraits(traits);
  const hasCurrentStudents = hasValue(raw.current_students);
  const hasMaxStudents = hasValue(raw.max_students);
  const hasCurrentCapacity = hasValue(raw.current_capacity);
  const hasGraduationsThisMonth = hasValue(raw.graduations_this_month);
  const hasGraduationsNextMonth = hasValue(raw.graduations_next_month);
  const hasCapacityData = hasCurrentCapacity || (hasCurrentStudents && hasMaxStudents) || hasGraduationsThisMonth || hasGraduationsNextMonth;
  const maxStudents = toNumber(raw.max_students, 0);
  const currentStudents = toNumber(raw.current_students, 0);
  const currentCapacity = hasCurrentCapacity
    ? toNumber(raw.current_capacity, 0)
    : Math.max(maxStudents - currentStudents, 0);
  return {
    ...raw,
    name: resolveCoachName(raw),
    status: normalizeStatus(raw.status),
    accept_status: normalizeAccept(raw.accept_status),
    course_tags: raw.course_tags || "",
    primary_style: inferredStyle,
    secondary_style: explicitSecondaryStyle || inferSecondaryStyleFromTraits(traits, inferredStyle),
    mbti_text: extractMbtiText(raw),
    current_students: currentStudents,
    max_students: maxStudents,
    current_capacity: currentCapacity,
    graduations_this_month: toNumber(raw.graduations_this_month, 0),
    graduations_next_month: toNumber(raw.graduations_next_month, 0),
    capacity_unknown: !hasCapacityData,
    energy_level: toNumber(raw.energy_level, 4),
    coach_rank: normalizeRankLabel(raw.coach_rank),
    rank_score: hasValue(raw.coach_rank) ? normalizeRankScore(raw.coach_rank) : normalizeRankScore("B"),
    rank_unknown: !hasValue(raw.coach_rank),
    customer_success_rate: normalizeRate(raw.customer_success_rate),
    customer_success_unknown: !hasValue(raw.customer_success_rate),
    on_time_rate: normalizeRate(raw.on_time_rate),
    on_time_unknown: !hasValue(raw.on_time_rate),
    performance_sample_size: toNumber(raw.performance_sample_size, 10),
    profile_text: profileText,
    coach_traits: traits,
  };
}

function normalizeCoachStyle(value) {
  const text = String(value || "");
  return STYLE_TYPES.find((type) => text.includes(type)) || "";
}

function extractMbtiText(raw) {
  const values = Object.values(raw).map((value) => String(value || ""));
  return values.find((value) => /\b[EI][NS][FT][JP]\b/.test(value)) || "";
}

function analyzeCoachTraits(text) {
  const source = String(text || "");
  const count = (pattern) => (source.match(pattern) || []).length;
  return {
    sns: count(/SNS|Instagram|インスタ|TikTok|X運用|投稿|リール|マーケ|広告|分析|運用代行|コンテンツ|制作/gi),
    monetization: count(/副業|案件|収益|売上|フリーランス|独立|起業|営業|提案|受注|コンサル/gi),
    empathy: count(/共感|寄り添|不安|安心|心理|カウンセラー|傾聴|伴走|継続|メンタル/gi),
    teaching: count(/初心者|未経験|基礎|教育|育成|教え|講師|研修|学習|サポート/gi),
    consulting: count(/戦略|設計|分析|リサーチ|改善|企画|コンサル|マーケ|課題解決/gi),
    review: count(/レビュー|添削|制作|改善|フィードバック|実務|成果物|投稿作成|運用改善/gi),
    drive: count(/牽引|引っ張|営業|行動量|目標達成|管理|進捗|コミット|リーダー/gi),
    certification: count(/資格|認定|キャリアコンサルタント|心理|ICF|NLP|ウェブ解析士|Google広告|社労士|公認心理師/gi),
    relevantIndustry: count(/飲食|美容|医療|介護|人材|営業|ブライダル|アパレル|教育|不動産|店舗|サロン/gi),
  };
}

function inferStyleFromTraits(traits) {
  const scores = [
    ["伴走型", traits.empathy + traits.teaching + traits.drive * 0.4],
    ["共感支援型", traits.empathy + traits.certification * 0.5],
    ["ティーチング型", traits.teaching + traits.certification * 0.3],
    ["コンサル型", traits.consulting + traits.monetization * 0.5],
    ["実務レビュー型", traits.review + traits.sns * 0.4],
    ["牽引型", traits.drive + traits.monetization * 0.3],
  ].sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : "";
}

function inferSecondaryStyleFromTraits(traits, primary) {
  const style = inferStyleFromTraits({ ...traits, [traitKeyForStyle(primary)]: 0 });
  return style && style !== primary ? style : "";
}

function traitKeyForStyle(style) {
  return {
    "伴走型": "empathy",
    "共感支援型": "empathy",
    "ティーチング型": "teaching",
    "コンサル型": "consulting",
    "実務レビュー型": "review",
    "牽引型": "drive",
  }[style] || "";
}

function collectProfileText(raw) {
  const ignoredKeys = new Set([
    "coach_id", "name", "team", "manager_name", "status", "accept_status", "course_tags",
    "primary_style", "secondary_style", "current_students", "max_students", "current_capacity",
    "graduations_this_month", "graduations_next_month", "energy_level", "customer_success_rate",
    "on_time_rate", "performance_sample_size", "recent_risk_notes", "last_updated",
  ]);
  return Object.entries(raw)
    .filter(([key, value]) => {
      if (!hasValue(value) || ignoredKeys.has(key)) return false;
      const text = String(value).trim();
      return key.startsWith("profile_")
        || /スキル|経験|資格|強み|得意|経歴|プロフィール|実績|職歴|勝ちパターン|特徴|備考|コメント|所感/.test(key)
        || text.length >= 18;
    })
    .map(([key, value]) => `${key.replace(/^profile_/, "")}: ${value}`)
    .join("\n");
}

function resolveCoachName(raw) {
  const direct = raw.name || raw.coach_id;
  if (isPersonLikeName(direct)) return direct;

  const ignoredKeys = new Set([
    "team", "manager_name", "status", "accept_status", "course_tags", "primary_style", "secondary_style",
    "current_students", "max_students", "current_capacity", "graduations_this_month", "graduations_next_month",
    "energy_level", "customer_success_rate", "on_time_rate", "performance_sample_size", "manager_notes",
    "recent_risk_notes", "last_updated",
  ]);
  const candidate = Object.entries(raw)
    .filter(([key, value]) => !ignoredKeys.has(key) && isPersonLikeName(value))
    .map(([, value]) => String(value).trim())[0];
  return candidate || direct || "コーチ名未取得";
}

function isPersonLikeName(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/CS|チーム|コース|SNS|デザイン|ライティング|マーケ|型|active|available|limited|full|不可|可/.test(text)) return false;
  if (/^\d+(\.\d+)?$/.test(text)) return false;
  return text.length <= 30;
}

function normalizeStatus(value) {
  const v = String(value || "").toLowerCase();
  if (/inactive|pause|停止|休止|退任|不可|ng|×|✕/.test(v)) return "inactive";
  return "active";
}

function normalizeAccept(value) {
  const v = String(value || "").toLowerCase();
  if (/full|満|不可|unavailable|ng|×|✕|受入停止|停止/.test(v)) return "full";
  if (/limited|限定|少/.test(v)) return "limited";
  return "available";
}

function normalizeRate(value) {
  if (value === "" || value == null) return 60;
  const n = toNumber(String(value).replace("%", ""), 60);
  return n <= 1 ? n * 100 : Math.max(0, Math.min(n, 100));
}

function displayRate(value, unknown) {
  return unknown ? "未入力" : `${round(value)}%`;
}

function normalizeRankLabel(value) {
  return String(value || "").trim();
}

function normalizeRankScore(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  const numeric = Number(compact.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(numeric) && compact.match(/[0-9]/)) {
    if (numeric <= 5) return numeric / 5 * 25;
    if (numeric <= 10) return numeric / 10 * 25;
    return Math.max(0, Math.min(25, numeric / 100 * 25));
  }
  if (/^(SS|S\+|S)$/i.test(compact)) return 25;
  if (/^(A\+|A)$/i.test(compact)) return 22;
  if (/^(B\+|B)$/i.test(compact)) return 18;
  if (/^(C\+|C)$/i.test(compact)) return 13;
  if (/^(D\+|D)$/i.test(compact)) return 8;
  if (/^(E|F)$/i.test(compact)) return 3;
  if (/優秀|高|上位|トップ/.test(raw)) return 22;
  if (/標準|通常|中/.test(raw)) return 15;
  if (/低|注意|要改善/.test(raw)) return 8;
  return 12;
}

function displayRank(coach) {
  return coach.rank_unknown ? "未入力（B相当）" : coach.coach_rank;
}

function cleanName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[🗼🌈🏃‍♀️]/g, "")
    .replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{L}\p{N}]/gu, "");
}

function toNumber(value, fallback) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function getStudent() {
  const tags = state.studentTags;
  return {
    course: tags.course,
    goal: tags.goal,
    primaryStyle: tags.primaryStyle,
    secondaryStyle: tags.secondaryStyle,
    anxiety: Number(tags.anxietyLevel),
    selfEfficacy: Number(tags.selfEfficacy),
    risks: tags.risks,
    notes: document.getElementById("studentNotes").value,
  };
}

function runMatching() {
  if (!state.coaches.length) {
    setStatus("先にスプレッドシートからコーチ情報を取得してください。");
    return;
  }
  autoTagStudentText();
  const student = getStudent();
  if (!student.course) {
    document.getElementById("results").innerHTML = `<div class="status">受講コースを選択してください。</div>`;
    return;
  }
  const allScored = state.coaches.map((coach) => scoreCoach(student, coach));
  const scored = allScored
    .filter((item) => !item.excluded)
    .sort(compareScores);
  renderSummary(allScored);
  renderStudentInference(student);
  renderResults(scored, allScored);
}

function compareScores(a, b) {
  if (b.total !== a.total) return b.total - a.total;
  if (b.breakdown.ontime !== a.breakdown.ontime) return b.breakdown.ontime - a.breakdown.ontime;
  if (b.breakdown.rank !== a.breakdown.rank) return b.breakdown.rank - a.breakdown.rank;
  return String(a.coach.name).localeCompare(String(b.coach.name), "ja");
}

function exclusionReason(coach) {
  if (coach.status === "inactive") return "稼働停止";
  if (coach.accept_status === "full" || coach.accept_status === "unavailable") return "受入不可";
  if (coach.capacity_unknown) return "";
  if (coach.current_capacity <= 0) return "残りキャパなし";
  if (/重大|停止|トラブル/.test(coach.recent_risk_notes || "")) return "直近リスク";
  return "";
}

function summarizeExclusions(items) {
  const excluded = items.filter((item) => item.reason);
  const counts = excluded.reduce((acc, item) => {
    acc[item.reason] = (acc[item.reason] || 0) + 1;
    return acc;
  }, {});
  const text = Object.entries(counts)
    .map(([reason, count]) => `- ${reason}: ${count}名`)
    .join("\n") || "- なし";
  return { totalExcluded: excluded.length, text };
}

function summarizeMetrics(coaches) {
  const rank = coaches.filter((coach) => !coach.rank_unknown).length;
  const ontime = coaches.filter((coach) => !coach.on_time_unknown).length;
  const capacity = coaches.filter((coach) => !coach.capacity_unknown).length;
  return [
    `- ランクあり: ${rank}名`,
    `- オンタイム率あり: ${ontime}名`,
    `- キャパ情報あり: ${capacity}名`,
  ].join("\n");
}

function scoreCoach(student, coach) {
  const reason = exclusionReason(coach);
  if (reason) return { coach, excluded: true, reason, total: 0 };
  const courseOk = courseMatches(student.course, coach.course_tags);
  if (!courseOk) return { coach, excluded: true, reason: "コース不一致", total: 0 };

  const style = scoreStyle(student, coach);
  const dropout = scoreDropout(student, coach);
  const goal = scoreGoal(student, coach);
  const context = scoreContext(student, coach);
  const rank = scoreRank(coach);
  const ontime = scoreOnTime(coach);
  const total = style + dropout + goal + context + rank + ontime;
  return {
    coach,
    excluded: false,
    total: round(total),
    breakdown: { style, dropout, goal, context, rank, ontime },
    reasons: buildReasons(student, coach, { style, dropout, goal, context, rank, ontime }),
  };
}

function courseMatches(course, tags) {
  const text = String(tags || "").normalize("NFKC").toLowerCase();
  if (!course) return true;
  if (!text) return false;
  const aliases = {
    SNS: ["sns", "📱sns", "instagram", "インスタ"],
    Design: ["design", "デザイン", "webデザイン", "web design", "webdesign", "バナー", "lp", "canva", "figma", "🎨"],
    WebDesign: ["webデザイン", "web design", "webdesign", "デザイン", "バナー", "lp", "canva", "figma"],
    Writing: ["writing", "ライティング", "🖋"],
    Movie: ["movie", "映像", "動画", "🎥"],
    Web: ["web", "サイト", "pc", "ホームページ", "wordpress", "html", "css"],
  };
  return (aliases[course] || [course]).some((key) => text.includes(String(key).normalize("NFKC").toLowerCase()));
}

function scoreStyle(student, coach) {
  const styles = `${coach.primary_style || ""};${coach.secondary_style || ""}`;
  const traits = coach.coach_traits || {};
  let score = 0;
  if (styles.includes(student.primaryStyle)) score += 6;
  if (styles.includes(student.secondaryStyle)) score += 3;
  if (student.anxiety >= 4) score += Math.min((traits.empathy || 0) * 1.7, 4.5);
  if (student.selfEfficacy <= 2) score += Math.min(((traits.empathy || 0) + (traits.teaching || 0)) * 1.1, 3.5);
  if (student.course === "SNS") score += Math.min((traits.sns || 0) * 1.1, 3);
  if (student.goal === "副業") score += Math.min((traits.monetization || 0) * 1.0, 3);
  return cap(score, 15);
}

function scoreDropout(student, coach) {
  const styles = `${coach.primary_style || ""};${coach.secondary_style || ""}`;
  const traits = coach.coach_traits || {};
  let score = 2;
  if (student.risks.includes("忙しさ")) score += Math.min(((traits.drive || 0) + (traits.empathy || 0)) * 1.0, 3);
  if (student.risks.includes("自信喪失")) score += Math.min((traits.empathy || 0) * 1.4, 3);
  if (student.risks.includes("孤独感")) score += Math.min((traits.empathy || 0) * 1.1, 2);
  if (student.risks.includes("成長実感不足")) score += Math.min(((traits.teaching || 0) + (traits.review || 0)) * 0.9, 3);
  if (/伴走型|共感支援型/.test(styles) && (student.risks.includes("自信喪失") || student.risks.includes("孤独感"))) score += 2;
  return cap(score, 10);
}

function scoreGoal(student, coach) {
  const haystack = `${coach.manager_notes || ""} ${coach.profile_text || ""} ${coach.course_tags || ""} ${coach.primary_style || ""}`;
  const traits = coach.coach_traits || {};
  let score = 1;
  if (student.goal === "副業") score += Math.min(((traits.monetization || 0) + (traits.sns || 0)) * 1.2, 6);
  if (student.goal === "副業" && /副業|収益|案件|運用代行|コンサル|実務レビュー/.test(haystack)) score += 2;
  if (student.goal === "転職" && /転職|キャリア/.test(haystack)) score += 4;
  if (student.goal === "学習" && /ティーチング|初心者|基礎/.test(haystack)) score += 4;
  if (student.notes.includes("不安") && /共感|伴走|安心/.test(haystack)) score += 2;
  return cap(score, 10);
}

function scoreContext(student, coach) {
  const text = `${coach.manager_notes || ""} ${coach.profile_text || ""} ${coach.team || ""}`;
  const traits = coach.coach_traits || {};
  let score = 2;
  if (/夜勤|医療|介護|看護/.test(student.notes) && /医療|介護|看護|夜勤/.test(text)) score += 3;
  if (/副業|収入/.test(student.notes) && /副業|案件|収益/.test(text)) score += 3;
  if (/飲食|フード|シフト|接客|店舗/.test(student.notes) && /飲食|フード|シフト|接客|店舗/.test(text)) score += 2;
  if (traits.relevantIndustry) score += Math.min(traits.relevantIndustry * 1.2, 3);
  return cap(score, 10);
}

function scoreRank(coach) {
  return round(coach.rank_score);
}

function scoreOnTime(coach) {
  if (coach.on_time_unknown) return 12;
  return round(coach.on_time_rate / 100 * 30);
}

function buildReasons(student, coach, scores) {
  const styles = `${coach.primary_style || ""}${coach.secondary_style ? ` / ${coach.secondary_style}` : ""}`;
  const profile = `${coach.profile_text || ""} ${coach.manager_notes || ""}`;
  const positives = [];
  const highlights = getProfileHighlights(profile, student);
  if (highlights.length) {
    positives.push(...highlights.slice(0, 3));
  } else {
    positives.push("経歴・強み情報が少ないため、主にタイプ相性と成績指標で暫定評価");
  }
  if (styles) positives.push(`${styles}として、受講生の推奨タイプと近い`);
  if (coach.rank_unknown) positives.push("ランクが未入力のため、Bランク相当で評価");
  else if (scores.rank >= 20) positives.push(`DBランクが高い（${displayRank(coach)}）`);
  if (coach.on_time_unknown) positives.push("オンタイム率が未入力のため、期限遵守評価は暫定");
  else if (scores.ontime >= 24) positives.push(`オンタイム率が安定している（${displayRate(coach.on_time_rate, false)}）`);
  if (student.risks.includes("自信喪失") && /共感支援型|伴走型/.test(styles)) positives.push("自信喪失リスクに対して初期の安心感を作りやすい");
  return unique(positives).slice(0, 7);
}

function getProfileHighlights(profile, student) {
  const text = String(profile || "");
  const highlights = [];
  const snsSnippet = findSnippet(text, /(SNS|Instagram|インスタ|TikTok|X運用|投稿|リール|マーケ|広告|分析|運用代行)[^。\n、,]{0,28}/i);
  const businessSnippet = findSnippet(text, /(副業|案件|収益|フリーランス|独立|起業|運用代行|コンサル)[^。\n、,]{0,28}/);
  const beginnerSnippet = findSnippet(text, /(初心者|未経験|基礎|伴走|継続|習慣|不安|寄り添|共感)[^。\n、,]{0,28}/);
  const certSnippet = findSnippet(text, /(資格|認定|キャリアコンサルタント|心理|カウンセラー|コーチング|ICF|NLP|ウェブ解析士)[^。\n、,]{0,34}/);
  const industrySnippet = findSnippet(text, /(飲食|美容|医療|介護|人材|営業|ブライダル|アパレル|教育|不動産)[^。\n、,]{0,28}/);

  if (student.course === "SNS" && snsSnippet && /初心者|未経験|不安|基礎|何から|使ったこと/.test(student.notes)) {
    highlights.push(`SNSを仕事に変える初期段階の受講生に対して、基礎から実務化までの道筋を示しやすい（根拠：${snsSnippet}）`);
  }
  if (student.goal === "副業" && businessSnippet) {
    highlights.push(`副業収益化を目指す受講生に対して、目標を「次にやる行動」まで落とし込みやすい（根拠：${businessSnippet}）`);
  }
  if ((student.anxiety >= 4 || student.selfEfficacy <= 2) && beginnerSnippet) {
    highlights.push(`自信が揺らぎやすい受講生に対して、安心感を作りながら継続に戻す支援が期待できる（根拠：${beginnerSnippet}）`);
  }
  if (student.risks.includes("忙しさ") && /伴走|継続|習慣|進捗|管理|サポート/.test(text)) {
    highlights.push("忙しさで止まりやすい受講生に対して、学習を小さく区切って再開させる関わりが期待できる");
  }
  if (student.risks.includes("成長実感不足") && /レビュー|添削|改善|分析|フィードバック|制作/.test(text)) {
    highlights.push("成果が見えないと不安になる受講生に対して、成果物や投稿改善を通じて成長実感を作りやすい");
  }
  if (certSnippet) highlights.push(`不安やキャリア面の相談が出たときに、専門性を背景にした整理が期待できる（根拠：${certSnippet}）`);
  if (industrySnippet && /飲食|フード|シフト|夜勤|接客|店舗/.test(student.notes)) {
    highlights.push(`飲食・シフト勤務の受講生の生活制約を理解した支援がしやすい（根拠：${industrySnippet}）`);
  }

  const rawLine = text.split(/\n/).map((line) => line.trim()).find((line) =>
    line && /強み|得意|経験|資格|実績|経歴|スキル/.test(line)
  );
  if (rawLine) highlights.push(`プロフィール上の強みを、この受講生の初期不安や行動設計に活かせる（${shorten(rawLine.replace(/^profile_?/, ""), 70)}）`);
  return unique(highlights);
}

function findSnippet(text, pattern) {
  const match = String(text || "").match(pattern);
  return match ? shorten(match[0].trim(), 44) : "";
}

function summarizeProfilePoints(profileText) {
  const text = String(profileText || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/プロフィール写真のアップロード:[^\n]*/g, "")
    .replace(/最終学歴（学校名・学科名）:[^\n]*/g, "")
    .replace(/プロフィール写真[^\n]*/g, "");
  const patterns = [
    /(副業|案件|収益|フリーランス|独立|起業|運用代行|コンサル)[^。\n、,]{0,24}/,
    /(伴走|継続|習慣|不安|寄り添|共感|進捗管理|サポート)[^。\n、,]{0,24}/,
    /(初心者|未経験|基礎|教育|育成|講師|研修)[^。\n、,]{0,24}/,
    /(レビュー|添削|改善|分析|フィードバック|制作)[^。\n、,]{0,24}/,
    /(資格|認定|キャリアコンサルタント|心理|カウンセラー|ICF|NLP|ウェブ解析士)[^。\n、,]{0,28}/,
    /(飲食|美容|医療|介護|人材|営業|ブライダル|アパレル|教育|不動産)[^。\n、,]{0,24}/,
  ];
  const points = patterns
    .map((pattern) => findSnippet(text, pattern))
    .filter(Boolean);
  if (points.length) return unique(points).slice(0, 3);

  return text.split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/写真|学歴|学校|http|アップロード/.test(line))
    .map((line) => shorten(line.replace(/^.*?:/, ""), 36))
    .filter(Boolean)
    .slice(0, 3);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function cap(value, max) {
  return Math.max(0, Math.min(round(value), max));
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function renderSummary(allScored) {
  const total = state.coaches.length;
  const eligible = allScored.filter((item) => !item.excluded).length;
  const reasonCounts = allScored
    .filter((item) => item.excluded)
    .reduce((acc, item) => {
      acc[item.reason] = (acc[item.reason] || 0) + 1;
      return acc;
    }, {});
  const reasonText = Object.entries(reasonCounts)
    .map(([reason, count]) => `- ${reason}: ${count}名`)
    .join("\n") || "- なし";
  document.getElementById("summary").textContent =
    `参照元：${state.source}\n最終取得日時：${state.lastLoadedAt ? formatDateTime(state.lastLoadedAt) : "未取得"}\n読み込み件数：${total}名\n推薦対象：${eligible}名\n除外：${total - eligible}名\n除外理由：\n${reasonText}`;
}

function renderStudentInference(student) {
  const summary = document.getElementById("summary");
  const current = summary.textContent;
  const risks = student.risks.length ? student.risks.join("、") : "特になし";
  summary.textContent = `${current}\n\n内部判定：\n- 受講コース：${displayCourse(student.course)}\n- 主目的：${student.goal}\n- 推定タイプ：${student.primaryStyle} / ${student.secondaryStyle}\n- 主な離脱リスク：${risks}`;
}

function displayCourse(course) {
  const labels = {
    SNS: "SNS",
    WebDesign: "WEBデザイン",
    Web: "Web制作",
    Writing: "ライティング",
    Movie: "動画",
    Design: "デザイン",
  };
  return labels[course] || course || "未判定";
}

function renderResults(items, allScored = []) {
  const results = document.getElementById("results");
  if (!items.length) {
    const excluded = allScored.filter((item) => item.excluded).slice(0, 10);
    results.innerHTML = `<div class="status">推薦対象がありません。コース、受入可否、キャパを確認してください。\n\n主な除外例：\n${excluded.map((item) => `${item.coach.name}: ${item.reason}`).join("\n")}</div>`;
    return;
  }
  const topItems = items.slice(0, 3);
  const remainingItems = items.slice(3);
  results.innerHTML = [
    topItems.map((item, index) => renderCard(item, index + 1)).join(""),
    renderOtherCandidates(remainingItems),
  ].join("");
}

function renderOtherCandidates(items) {
  if (!items.length) return "";
  return `
    <section class="other-candidates">
      <h3>4位以降の候補</h3>
      <ol>
        ${items.map((item, index) => `
          <li tabindex="0">
            <span>${index + 4}. ${escapeHtml(item.coach.name)}</span>
            <strong>${item.total}点</strong>
            ${renderOtherBreakdown(item)}
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function renderOtherBreakdown(item) {
  const b = item.breakdown;
  const coach = item.coach;
  const matchScore = round(b.style + b.dropout + b.goal + b.context);
  return `
    <div class="other-breakdown">
      <div>相性：${matchScore} / 45</div>
      <div>オンタイム率：${round(b.ontime)} / 30（${displayRate(coach.on_time_rate, coach.on_time_unknown)}）</div>
      <div>ランク：${round(b.rank)} / 25（${escapeHtml(displayRank(coach))}）</div>
    </div>
  `;
}

function renderCard(item, rank) {
  const b = item.breakdown;
  const coach = item.coach;
  return `
    <article class="card">
      <span class="rank">${rank}</span>
      <h3 class="coach-name">担当候補${rank}：${escapeHtml(coach.name)}</h3>
      <div class="meta">${escapeHtml(coach.primary_style || "タイプ未設定")} ${coach.secondary_style ? `/ ${escapeHtml(coach.secondary_style)}` : ""}${coach.mbti_text ? ` ・MBTI参考：${escapeHtml(coach.mbti_text)}` : ""}</div>
      <div class="score">${item.total}点</div>
      <div class="breakdown">
        ${bar("相性", b.style + b.dropout + b.goal + b.context, 45)}
        ${bar(`オンタイム率 ${displayRate(coach.on_time_rate, coach.on_time_unknown)}`, b.ontime, 30)}
        ${bar(`ランク ${displayRank(coach)}`, b.rank, 25)}
      </div>
      <div class="meta">${coach.capacity_unknown ? "キャパ情報：未入力（暫定評価）" : `現在キャパ：${coach.current_capacity} / 当月卒業：${coach.graduations_this_month} / 翌月卒業：${coach.graduations_next_month}`}</div>
      ${coach.profile_text ? `<div class="meta">強み要約：${escapeHtml(summarizeProfilePoints(coach.profile_text).join(" / ") || "特記事項なし")}</div>` : ""}
      <h4>推薦理由</h4>
      <ul>${item.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
    </article>
  `;
}

function bar(label, value, max) {
  const pct = Math.min(100, value / max * 100);
  return `
    <div>
      <div class="meta">${label}: ${round(value)} / ${max}</div>
      <div class="bar"><span style="width:${pct}%"></span></div>
    </div>
  `;
}

function buildCaution(coach) {
  if (coach.capacity_unknown) return "キャパ情報が未入力です。受け入れ可能人数と卒業予定を確認してください。";
  if (coach.rank_unknown || coach.on_time_unknown) return "成績指標が一部未入力です。ランクとオンタイム率を確認してください。";
  if (coach.current_capacity <= 0) return "現在キャパは0です。当月卒業予定後に受け入れ可能か確認してください。";
  if (coach.on_time_rate < 75) return "オンタイム率が低めです。不安が強い受講生の場合は返信・レビュー体制を確認してください。";
  if (!coach.rank_unknown && coach.rank_score < 13) return "ランクが低めです。直近の担当状況とマネージャー所感を確認してください。";
  return "大きな懸念はありません。受講開始時期と現在キャパを最終確認してください。";
}

function setStatus(text) {
  document.getElementById("loadStatus").textContent = text;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function shorten(value, length) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}
