const STORAGE_KEY = "jjdiary.calendar.posts";
const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const daysEl = document.querySelector("#days");
const monthLabel = document.querySelector("#month-label");
const dayLabel = document.querySelector("#day-label");
const postList = document.querySelector("#post-list");
const composer = document.querySelector("#composer");
const bodyInput = document.querySelector("#post-body");
const formError = document.querySelector("#form-error");
const flash = document.querySelector("#flash");
const dialog = document.querySelector("#delete-dialog");
const preview = document.querySelector("#delete-preview");

const today = new Date();
let visible = new Date(today.getFullYear(), today.getMonth(), 1);
let selected = startOfDay(today);
let pendingDeleteId = null;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDayLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}`;
}

function loadPosts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (post) =>
        post &&
        typeof post.id === "string" &&
        typeof post.date === "string" &&
        typeof post.body === "string",
    );
  } catch {
    return [];
  }
}

function savePosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

function postsOn(key) {
  return loadPosts()
    .filter((post) => post.date === key)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

function snippet(body) {
  const line = body.trim().split("\n")[0];
  return line.length > 14 ? `${line.slice(0, 14)}…` : line;
}

function renderCalendar() {
  monthLabel.textContent = `${visible.getFullYear()}년 ${visible.getMonth() + 1}월`;
  daysEl.replaceChildren();

  const year = visible.getFullYear();
  const month = visible.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const selectedKey = dateKey(selected);
  const todayKey = dateKey(today);

  for (let i = 0; i < firstWeekday; i += 1) {
    const spacer = document.createElement("div");
    daysEl.append(spacer);
  }

  for (let day = 1; day <= count; day += 1) {
    const date = new Date(year, month, day);
    const key = dateKey(date);
    const posts = postsOn(key);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day";
    if (date.getDay() === 0) button.classList.add("is-sunday");
    if (date.getDay() === 6) button.classList.add("is-saturday");
    if (key === todayKey) button.classList.add("is-today");
    if (key === selectedKey) button.classList.add("is-selected");
    button.setAttribute("aria-pressed", String(key === selectedKey));

    const number = document.createElement("span");
    number.className = "day-num";
    number.textContent = String(day);
    button.append(number);

    if (posts.length > 0) {
      const note = document.createElement("span");
      note.className = "day-snippet";
      note.textContent = posts.length > 1 ? `${snippet(posts[0].body)} 외 ${posts.length - 1}` : snippet(posts[0].body);
      button.append(note);
    }

    const label = posts.length > 0 ? `${formatDayLabel(date)}, 글 ${posts.length}개` : formatDayLabel(date);
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => {
      selected = date;
      flash.textContent = "";
      formError.hidden = true;
      render();
    });
    daysEl.append(button);
  }
}

function renderPosts() {
  dayLabel.textContent = formatDayLabel(selected);
  postList.replaceChildren();
  const posts = postsOn(dateKey(selected));

  if (posts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-day";
    empty.textContent = "이 날짜에 남긴 글이 없습니다.";
    postList.append(empty);
    return;
  }

  posts.forEach((post) => {
    const article = document.createElement("article");
    article.className = "post";

    const body = document.createElement("p");
    body.textContent = post.body;

    const meta = document.createElement("div");
    meta.className = "post-meta";

    const time = document.createElement("time");
    const created = new Date(post.createdAt);
    if (!Number.isNaN(created.getTime())) {
      time.dateTime = post.createdAt;
      time.textContent = created.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-post";
    remove.textContent = "삭제";
    remove.setAttribute("aria-label", `글 삭제: ${snippet(post.body)}`);
    remove.addEventListener("click", () => openDelete(post));

    meta.append(time, remove);
    article.append(body, meta);
    postList.append(article);
  });
}

function render() {
  renderCalendar();
  renderPosts();
}

function openDelete(post) {
  pendingDeleteId = post.id;
  preview.textContent = post.body;
  dialog.showModal();
}

function deletePost(id) {
  savePosts(loadPosts().filter((post) => post.id !== id));
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const body = bodyInput.value.trim();
  if (!body) {
    formError.hidden = false;
    formError.textContent = "글을 입력해 주세요.";
    return;
  }
  formError.hidden = true;
  const posts = loadPosts();
  posts.push({
    id: crypto.randomUUID(),
    date: dateKey(selected),
    body,
    createdAt: new Date().toISOString(),
  });
  savePosts(posts);
  bodyInput.value = "";
  flash.textContent = "글을 남겼습니다.";
  render();
});

dialog.addEventListener("close", () => {
  const id = pendingDeleteId;
  pendingDeleteId = null;
  if (dialog.returnValue !== "confirm" || !id) return;
  deletePost(id);
  flash.textContent = "글을 삭제했습니다.";
  render();
});

document.querySelector("#prev-month").addEventListener("click", () => {
  visible = new Date(visible.getFullYear(), visible.getMonth() - 1, 1);
  renderCalendar();
});

document.querySelector("#next-month").addEventListener("click", () => {
  visible = new Date(visible.getFullYear(), visible.getMonth() + 1, 1);
  renderCalendar();
});

render();
