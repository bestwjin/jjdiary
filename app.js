const LEVELS = [
  { id: "elementary", label: "초등학교" },
  { id: "middle", label: "중학교" },
  { id: "high", label: "고등학교" },
];

const LEVEL_SHORT = {
  elementary: "초",
  middle: "중",
  high: "고",
};

let catalog = null;
let filter = "all";

function formatKm(meters) {
  return (Math.round(meters / 100) / 10).toFixed(1);
}

function formatMinutes(seconds) {
  return Math.max(1, Math.round(seconds / 60));
}

function directionsUrl(origin, school) {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${school.lat},${school.lng}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function visibleSchools() {
  return catalog.schools.filter((school) => {
    if (filter === "all") return true;
    if (filter === "assigned") return school.assigned;
    return school.level === filter;
  });
}

function renderOrigin() {
  const origin = catalog.origin;
  const root = document.querySelector("#origin");
  const items = [
    ["기준 단지", origin.name],
    ["주소", origin.address],
    ["경로", "자동차 · 최적경로"],
  ];
  items.forEach(([label, value]) => {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    wrap.append(dt, dd);
    root.append(wrap);
  });
}

function renderSummary() {
  const root = document.querySelector("#summary");
  const nearest = [...catalog.schools].sort((a, b) => a.distanceM - b.distanceM)[0];
  const assignedElementary = catalog.schools.find(
    (school) => school.assigned && school.level === "elementary",
  );
  const assignedMiddle = catalog.schools
    .filter((school) => school.assigned && school.level === "middle")
    .sort((a, b) => a.distanceM - b.distanceM);

  const cards = [
    {
      label: "가장 가까운 학교",
      title: nearest.name,
      figure: `${formatKm(nearest.distanceM)}km`,
    },
    {
      label: "배정 초등학교",
      title: assignedElementary.name,
      figure: `${formatKm(assignedElementary.distanceM)}km`,
    },
    {
      label: "배정 중학교",
      title: assignedMiddle.map((school) => school.name.replace("학교", "")).join(" · "),
      figure: assignedMiddle.map((school) => `${formatKm(school.distanceM)}km`).join(" · "),
    },
  ];

  cards.forEach((card) => {
    const article = document.createElement("article");
    const label = document.createElement("p");
    const title = document.createElement("strong");
    const figure = document.createElement("strong");
    label.textContent = card.label;
    title.textContent = card.title;
    figure.className = "figure";
    figure.textContent = card.figure;
    article.append(label, title, figure);
    root.append(article);
  });
}

function renderSchool(school) {
  const article = document.createElement("article");
  article.className = "school";

  const info = document.createElement("div");
  const nameRow = document.createElement("div");
  nameRow.className = "name-row";

  const level = document.createElement("span");
  level.className = "level";
  level.textContent = LEVEL_SHORT[school.level];

  const heading = document.createElement("h3");
  heading.textContent = school.name;

  nameRow.append(level, heading);

  if (school.assigned) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "배정";
    nameRow.append(badge);
  }

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = `${school.dong} · ${school.address.replace("경기도 ", "")} · ${school.phone}`;

  info.append(nameRow, meta);

  if (school.note) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = school.note;
    info.append(note);
  }

  const distance = document.createElement("div");
  distance.className = "distance";

  const km = document.createElement("p");
  km.className = "km";
  km.textContent = formatKm(school.distanceM);
  const unit = document.createElement("span");
  unit.textContent = "km";
  km.append(unit);

  const minutes = document.createElement("p");
  minutes.className = "minutes";
  minutes.textContent = `약 ${formatMinutes(school.durationS)}분 · 최적경로`;

  const link = document.createElement("a");
  link.className = "route";
  link.href = directionsUrl(catalog.origin, school);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "경로 보기";

  distance.append(km, minutes, link);
  article.append(info, distance);
  return article;
}

function renderList() {
  const root = document.querySelector("#list");
  const status = document.querySelector("#status");
  root.replaceChildren();

  const schools = visibleSchools();
  if (schools.length === 0) {
    status.hidden = false;
    status.textContent = "표시할 학교가 없습니다.";
    return;
  }
  status.hidden = true;

  LEVELS.forEach((level) => {
    const rows = schools
      .filter((school) => school.level === level.id)
      .sort((a, b) => a.distanceM - b.distanceM);
    if (rows.length === 0) return;

    const section = document.createElement("section");
    section.className = "group";
    const heading = document.createElement("h2");
    heading.textContent = `${level.label} · 가까운 순`;
    section.append(heading);
    rows.forEach((school) => section.append(renderSchool(school)));
    root.append(section);
  });
}

function bindFilters() {
  document.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      document.querySelectorAll(".chip").forEach((chip) => {
        const active = chip === button;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-selected", String(active));
      });
      renderList();
    });
  });
}

async function init() {
  const response = await fetch("./data/schools.json");
  if (!response.ok) {
    throw new Error("학교 정보를 불러오지 못했습니다.");
  }
  catalog = await response.json();
  document.querySelector("#method").textContent =
    `${catalog.method}. 계산일 ${catalog.calculatedOn}. 내비게이션 앱의 최적경로와 수백 m 정도 차이 날 수 있습니다.`;
  renderOrigin();
  renderSummary();
  bindFilters();
  renderList();
}

init().catch((error) => {
  const status = document.querySelector("#status");
  status.hidden = false;
  status.textContent = error.message;
});
