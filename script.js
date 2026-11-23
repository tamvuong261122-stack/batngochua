/* =========================
   CÀI ĐẶT CHUNG
========================= */
const DEFAULT_SETTINGS = {
  question: "Bạn có biết hôm nay có điều gì đặc biệt không?",
  answers: ["Có, mình biết!", "Không, mình chưa biết!"],
  correct: 0,
  birthdayMessage: "Chúc bạn tuổi mới thật nhiều niềm vui, sức khỏe, hạnh phúc và thành công! Mong mọi điều tốt đẹp nhất sẽ đến với bạn ❤️"
};

const birthdays = [
  { name: "Nguyễn Minh Mẫn", day: 20, month: 11 },
  { name: "Nguyễn Hoàng Hảo", day: 20, month: 8 },
  { name: "Nguyễn Trung Hiếu", day: 11, month: 5}
];

const DEFAULT_PASSWORD = "123456";
let settings = loadSettings();
let adminPassword = localStorage.getItem("adminPassword") || DEFAULT_PASSWORD;
let userName = "";
let convertedIndex = -1;
let currentStoryNodeId = "start";
let selectedStoryNext = null;
let editingNodeId = null;
let confettiIntervals = [];
let confettiElements = [];

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("websiteSettings"));
    if (saved && typeof saved.question === "string" &&
        Array.isArray(saved.answers) && saved.answers.length === 2 &&
        saved.answers.every(a => typeof a === "string") &&
        [0,1].includes(saved.correct) && typeof saved.birthdayMessage === "string") {
      return saved;
    }
  } catch (error) { console.error("Không đọc được cài đặt:", error); }
  return { ...DEFAULT_SETTINGS };
}

function defaultStory() {
  return [
    { id:"start", speaker:"Người kể chuyện", character:"🌸",
      text:"Một ngày đặc biệt đã đến. Bạn muốn bắt đầu chuyến phiêu lưu này như thế nào?",
      ending:false, choices:[
        { text:"Bước vào khu vườn kỳ diệu", next:"garden" },
        { text:"Đi theo con đường bí ẩn", next:"mystery" }
      ] },
    { id:"garden", speaker:"Người bạn nhỏ", character:"🧸",
      text:"Chào mừng bạn đến khu vườn! Những bông hoa đang chuẩn bị một món quà dành riêng cho bạn.",
      ending:false, choices:[
        { text:"Cùng chuẩn bị món quà", next:"happy" },
        { text:"Tìm xem món quà là gì", next:"surprise" }
      ] },
    { id:"mystery", speaker:"Người dẫn đường", character:"🦊",
      text:"Con đường bí ẩn dẫn bạn đến một căn phòng đầy ánh sáng. Bạn nghe thấy tiếng chúc mừng!",
      ending:false, choices:[
        { text:"Mở cánh cửa", next:"surprise" },
        { text:"Quay lại khu vườn", next:"garden" }
      ] },
    { id:"surprise", speaker:"Người kể chuyện", character:"🎁",
      text:"Bất ngờ! Một món quà thật lớn xuất hiện. Bạn đã tìm thấy điều đặc biệt của hôm nay.",
      ending:false, choices:[ { text:"Nhận món quà", next:"happy" } ] },
    { id:"happy", speaker:"Tất cả mọi người", character:"🎂",
      text:"Chúc mừng sinh nhật! Chúc bạn luôn vui vẻ, mạnh khỏe, gặp nhiều may mắn và đạt được những điều mình mong muốn. Hãy tận hưởng tuổi mới thật tuyệt vời nhé! ❤️",
      ending:true, choices:[] }
  ];
}

function loadStory() {
  try {
    const saved = JSON.parse(localStorage.getItem("birthdayStory"));
    if (Array.isArray(saved) && saved.length && saved.some(n => n.id === "start")) return saved;
  } catch (error) { console.error("Không đọc được cốt truyện:", error); }
  return defaultStory();
}
let storyNodes = loadStory();

/* =========================
   HỆ THỐNG ÂM THANH (KHÔNG CẦN TẢI FILE NHẠC)
   Nhạc và hiệu ứng được tạo trực tiếp bằng Web Audio API.
========================= */
let audioContext = null;
let musicTimer = null;
let musicStep = 0;
let birthdayMusicTimer = null;
let birthdayMusicStep = 0;
let audioEnabled = true;

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone(frequency, duration = 0.16, type = "sine", volume = 0.07, delay = 0) {
  if (!audioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const startAt = ctx.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), startAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
}

// Giai điệu nền nhẹ nhàng, tự tạo bằng các nốt nhạc tổng hợp.
const backgroundMelody = [
  523.25, 659.25, 783.99, 659.25,
  587.33, 698.46, 783.99, 698.46,
  523.25, 659.25, 880.00, 783.99,
  698.46, 659.25, 587.33, 523.25
];

function startBackgroundMusic() {
  if (!audioEnabled || musicTimer) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  musicStep = 0;
  const playNextNote = () => {
    if (!audioEnabled) return;
    const note = backgroundMelody[musicStep % backgroundMelody.length];
    playTone(note, 0.48, "sine", 0.022);
    // Nốt nền trầm tạo cảm giác êm dịu.
    if (musicStep % 4 === 0) playTone(note / 2, 0.65, "triangle", 0.012);
    musicStep++;
  };
  playNextNote();
  musicTimer = setInterval(playNextNote, 560);
}

function stopBackgroundMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

// Nhạc sinh nhật phát lặp liên tục trong lúc popup đang mở.
// Nhạc chỉ dừng khi người dùng nhấn nút Đóng hoặc tắt âm thanh.
const birthdayMelody = [
  523.25, 523.25, 587.33, 523.25, 698.46, 659.25,
  523.25, 523.25, 587.33, 523.25, 783.99, 698.46,
  523.25, 523.25, 1046.5, 880.00, 698.46, 659.25, 587.33
];

function startBirthdayMusic() {
  if (!audioEnabled || birthdayMusicTimer) return;
  stopBackgroundMusic();
  if (!getAudioContext()) return;

  birthdayMusicStep = 0;
  const playNextBirthdayNote = () => {
    if (!audioEnabled) return;
    const note = birthdayMelody[birthdayMusicStep % birthdayMelody.length];
    playTone(note, 0.34, "triangle", 0.045);
    if (birthdayMusicStep % 3 === 0) {
      playTone(note / 2, 0.48, "sine", 0.018);
    }
    birthdayMusicStep++;
  };

  playNextBirthdayNote();
  birthdayMusicTimer = setInterval(playNextBirthdayNote, 390);
}

function stopBirthdayMusic() {
  if (birthdayMusicTimer) clearInterval(birthdayMusicTimer);
  birthdayMusicTimer = null;
}

function isBirthdayPopupOpen() {
  const popup = document.getElementById("birthdayModal");
  return popup && !popup.classList.contains("hidden");
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  const button = document.getElementById("soundToggle");
  if (button) {
    button.textContent = audioEnabled ? "🔊 Âm thanh: Bật" : "🔇 Âm thanh: Tắt";
    button.setAttribute("aria-label", audioEnabled ? "Tắt âm thanh" : "Bật âm thanh");
  }
  if (audioEnabled) {
    getAudioContext();
    if (isBirthdayPopupOpen()) startBirthdayMusic();
    else startBackgroundMusic();
    playTone(659.25, 0.12, "sine", 0.045);
  } else {
    stopBackgroundMusic();
    stopBirthdayMusic();
  }
}

function playButtonSound() {
  playTone(740, 0.07, "sine", 0.025);
}

function playBirthdaySound() {
  [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => {
    playTone(note, 0.42, "sine", 0.065, index * 0.17);
  });
}

function playVictorySound() {
  [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => {
    playTone(note, 0.7, "triangle", 0.075, index * 0.12);
  });
}

// Trình duyệt thường chặn tự phát nhạc; thao tác nhập tên/xác nhận
// giúp mở AudioContext. Khi popup sinh nhật đang mở, không khởi động lại nhạc nền.
document.addEventListener("click", event => {
  if (!audioEnabled) return;
  if (event.target.closest(".sound-toggle")) return;
  if (!audioContext) getAudioContext();
  if (audioContext && !isBirthdayPopupOpen() && !musicTimer) {
    startBackgroundMusic();
  }
  if (event.target.closest("button")) playButtonSound();
}, true);

/* =========================
   NHẬP VÀ KIỂM TRA HỌ TÊN
========================= */
function submitName() {
  const input = document.getElementById("fullName");
  const error = document.getElementById("nameError");
  const name = input.value.trim().replace(/\s+/g, " ").normalize("NFC");
  const nameRegex = /^[\p{L}\p{M}]+(?:\s+[\p{L}\p{M}]+)+$/u;
  error.textContent = "";
  if (!name) { error.textContent = "Bạn chưa nhập họ và tên!"; return; }
  if (!nameRegex.test(name)) {
    error.textContent = "Tên phải có đầy đủ họ tên, không có số hoặc ký tự đặc biệt!";
    return;
  }
  userName = name;
  document.getElementById("nameModal").classList.add("hidden");
  checkBirthday();
}

function checkBirthday() {
  const today = new Date();
  const normalizedName = userName.trim().replace(/\s+/g," ").normalize("NFC").toLocaleLowerCase("vi");
  const birthday = birthdays.find(person =>
    person.name.normalize("NFC").toLocaleLowerCase("vi") === normalizedName &&
    person.day === today.getDate() && person.month === today.getMonth()+1
  );
  if (birthday) showBirthday(birthday);
  else showQuestion();
}

function showBirthday(person) {
  document.getElementById("birthdayName").textContent = person.name + " ❤️";
  document.getElementById("birthdayMessage").textContent = settings.birthdayMessage;
  document.getElementById("birthdayModal").classList.remove("hidden");
  createConfetti();
  // Thay nhạc nền bằng nhạc sinh nhật và phát liên tục.
  stopBackgroundMusic();
  startBirthdayMusic();
}
function closeBirthday() {
  document.getElementById("birthdayModal").classList.add("hidden");
  stopBirthdayMusic();
  stopBackgroundMusic();
  clearConfetti();
}

/* =========================
   CÂU HỎI THƯỜNG
========================= */
function showQuestion() {
  document.getElementById("helloName").textContent = "Xin chào, " + userName + " ❤️";
  document.getElementById("questionText").textContent = settings.question;
  document.getElementById("answerMessage").textContent = "";
  convertedIndex = -1;
  const answerList = document.getElementById("answerList");
  answerList.innerHTML = "";
  settings.answers.forEach((answer,index) => {
    const button = document.createElement("button");
    button.className = "answer-btn";
    button.textContent = answer;
    button.addEventListener("click", () => chooseAnswer(index,button));
    answerList.appendChild(button);
  });
  document.getElementById("questionModal").classList.remove("hidden");
}
function chooseAnswer(index,button) {
  if (index === convertedIndex || index === settings.correct) { answerCorrect(); return; }
  document.body.classList.remove("shake");
  void document.body.offsetWidth;
  document.body.classList.add("shake");
  convertedIndex = index;
  button.textContent = "ĐÚNG";
  document.getElementById("answerMessage").textContent = "Anh hiểu em mòa =))";
  setTimeout(() => {
    document.getElementById("noticeText").textContent = "Sao em lại dối lòng vậy cục dàng ❤️";
    document.getElementById("noticeModal").classList.remove("hidden");
  },450);
}
function closeNotice() { document.getElementById("noticeModal").classList.add("hidden"); }
function answerCorrect() {
  document.getElementById("questionModal").classList.add("hidden");
  convertedIndex = -1;
  document.getElementById("noticeText").textContent = "OMG !!! em đã sống thật với bản thân rồi sao cục dàng🎉";
  document.getElementById("noticeModal").classList.remove("hidden");
}

/* =========================
   ĐĂNG NHẬP VÀ QUẢN TRỊ
========================= */
function openAdminLogin() { document.getElementById("adminLoginModal").classList.remove("hidden"); }
function closeAdminLogin() { document.getElementById("adminLoginModal").classList.add("hidden"); }
function loginAdmin() {
  const password = document.getElementById("adminPassword").value;
  const error = document.getElementById("adminError");
  if (password !== adminPassword) { error.textContent = "Mật khẩu không chính xác!"; return; }
  error.textContent = "";
  document.getElementById("adminPassword").value = "";
  closeAdminLogin();
  openAdmin();
}
function openAdmin() {
  document.getElementById("adminQuestion").value = settings.question;
  document.getElementById("answer1").value = settings.answers[0];
  document.getElementById("answer2").value = settings.answers[1];
  document.getElementById("correctAnswer").value = String(settings.correct);
  document.getElementById("adminBirthday").value = settings.birthdayMessage;
  document.getElementById("newPassword").value = "";
  document.getElementById("adminModal").classList.remove("hidden");
  renderStoryAdmin();
}
function closeAdmin() { document.getElementById("adminModal").classList.add("hidden"); }

function saveAdminSettings() {
  const question = document.getElementById("adminQuestion").value.trim();
  const answer1 = document.getElementById("answer1").value.trim();
  const answer2 = document.getElementById("answer2").value.trim();
  const correct = Number(document.getElementById("correctAnswer").value);
  const birthdayMessage = document.getElementById("adminBirthday").value.trim();
  const newPassword = document.getElementById("newPassword").value;
  if (!question || !answer1 || !answer2 || !birthdayMessage || answer1 === answer2) {
    alert("Vui lòng nhập đầy đủ nội dung và hai đáp án khác nhau!"); return;
  }
  if (newPassword.trim() && newPassword.length < 6) {
    alert("Mật khẩu mới phải có ít nhất 6 ký tự!"); return;
  }
  settings = { question, answers:[answer1,answer2], correct, birthdayMessage };
  localStorage.setItem("websiteSettings",JSON.stringify(settings));
  if (newPassword.trim()) {
    adminPassword = newPassword;
    localStorage.setItem("adminPassword",adminPassword);
  }
  alert("Đã lưu cài đặt thành công!");
  closeAdmin();
}

/* =========================
   HIỆU ỨNG ICON SINH NHẬT
========================= */
function createConfetti() {
  if (confettiElements.length) return;
  const icons = ["🎂","🎉","🎊","🎈","💖","❤️","💕","🌸","✨","🥳","🎁","💗","🧸","⭐","🌷"];
  for (let i=0;i<55;i++) {
    const el = document.createElement("div");
    el.textContent = icons[Math.floor(Math.random()*icons.length)];
    el.style.position = "fixed";
    el.style.left = Math.random()*95+"vw";
    el.style.top = Math.random()*90+"vh";
    el.style.fontSize = (20+Math.random()*28)+"px";
    el.style.zIndex = "19";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    confettiElements.push(el);
    el.animate([
      {opacity:0,transform:"scale(.3) rotate(0deg)"},
      {opacity:1,transform:"scale(1.2) rotate(20deg)"},
      {opacity:0,transform:"scale(.5) rotate(-20deg)"}
    ],{duration:1300+Math.random()*900,iterations:Infinity});
    const interval = setInterval(() => {
      el.style.left = Math.random()*95+"vw";
      el.style.top = Math.random()*90+"vh";
      el.textContent = icons[Math.floor(Math.random()*icons.length)];
    },2200+Math.random()*1300);
    confettiIntervals.push(interval);
  }
}
function clearConfetti() {
  confettiIntervals.forEach(clearInterval);
  confettiIntervals = [];
  confettiElements.forEach(el => el.remove());
  confettiElements = [];
}

/* =========================
   GAME CỐT TRUYỆN
========================= */
function saveStoryData() { localStorage.setItem("birthdayStory",JSON.stringify(storyNodes)); }

function startBirthdayStory() {
  document.getElementById("birthdayModal").classList.add("hidden");
  document.getElementById("storyModal").classList.remove("hidden");
  currentStoryNodeId = "start";
  showStoryNode();
}
function closeStory() {
  document.getElementById("storyModal").classList.add("hidden");
  clearConfetti();
}
function getCurrentNode() { return storyNodes.find(node => node.id === currentStoryNodeId); }

function showStoryNode() {
  const node = getCurrentNode();
  if (!node) {
    alert("Không tìm thấy hộp thoại tiếp theo. Hãy kiểm tra lại liên kết trong Admin.");
    closeStory(); return;
  }
  document.getElementById("storySpeaker").textContent = node.speaker || "Nhân vật";
  document.getElementById("storyText").textContent = node.text || "";
  document.getElementById("storyCharacter").textContent = node.character || "💬";
  const choices = document.getElementById("storyChoices");
  choices.innerHTML = "";
  document.getElementById("storyNext").classList.add("hidden");
  document.getElementById("storyClose").classList.toggle("hidden",!node.ending);
  selectedStoryNext = null;

  if (node.ending) { playVictorySound(); return; }
  (node.choices || []).forEach(choice => {
    const button = document.createElement("button");
    button.textContent = choice.text;
    button.addEventListener("click", () => {
    currentStoryNodeId = choice.next;
    showStoryNode();
});
    choices.appendChild(button);
  });
  if (!node.choices || node.choices.length === 0) {
    document.getElementById("storyNext").classList.remove("hidden");
    document.getElementById("storyNext").textContent = "Kết thúc";
    selectedStoryNext = null;
  } else {
    document.getElementById("storyNext").textContent = "Tiếp tục ➜";
  }
}
function nextStory() {
  if (selectedStoryNext) {
    currentStoryNodeId = selectedStoryNext;
    showStoryNode();
  } else {
    const node = getCurrentNode();
    if (node && (!node.choices || node.choices.length === 0)) closeStory();
  }
}

/* =========================
   ADMIN: THÊM / SỬA / XÓA HỘP THOẠI
========================= */
function renderStoryAdmin() {
  const list = document.getElementById("storyNodeList");
  if (!list) return;
  list.innerHTML = "";
  storyNodes.forEach(node => {
    const item = document.createElement("div");
    item.className = "story-item";
    const title = document.createElement("strong");
    title.textContent = `${node.character || "💬"} ${node.speaker || "Nhân vật"} — ${node.id}`;
    const desc = document.createElement("p");
    desc.textContent = node.text.length > 120 ? node.text.slice(0,120)+"…" : node.text;
    const actions = document.createElement("div");
    actions.className = "story-item-actions";
    const edit = document.createElement("button");
    edit.textContent = "Sửa";
    edit.onclick = () => editStoryNode(node.id);
    const del = document.createElement("button");
    del.textContent = "Xóa";
    del.onclick = () => deleteStoryNode(node.id);
    actions.append(edit,del);
    item.append(title,desc,actions);
    list.appendChild(item);
  });
}
function newStoryNode() {
  editingNodeId = null;
  document.getElementById("storyEditorTitle").textContent = "Thêm hộp thoại";
  document.getElementById("nodeId").value = "";
  document.getElementById("nodeId").disabled = false;
  document.getElementById("nodeSpeaker").value = "";
  document.getElementById("nodeCharacter").value = "💬";
  document.getElementById("nodeText").value = "";
  document.getElementById("nodeEnding").checked = false;
  document.getElementById("choiceEditorList").innerHTML = "";
  document.getElementById("storyEditor").classList.remove("hidden");
  addChoiceEditor();
}
function editStoryNode(id) {
  const node = storyNodes.find(n => n.id === id);
  if (!node) return;
  editingNodeId = id;
  document.getElementById("storyEditorTitle").textContent = "Chỉnh sửa hộp thoại";
  document.getElementById("nodeId").value = node.id;
  document.getElementById("nodeId").disabled = true;
  document.getElementById("nodeSpeaker").value = node.speaker || "";
  document.getElementById("nodeCharacter").value = node.character || "";
  document.getElementById("nodeText").value = node.text || "";
  document.getElementById("nodeEnding").checked = !!node.ending;
  const container = document.getElementById("choiceEditorList");
  container.innerHTML = "";
  (node.choices || []).forEach(choice => addChoiceEditor(choice.text,choice.next));
  document.getElementById("storyEditor").classList.remove("hidden");
}
function addChoiceEditor(text="",next="") {
  const container = document.getElementById("choiceEditorList");
  const row = document.createElement("div");
  row.className = "choice-row";
  const textInput = document.createElement("input");
  textInput.className = "choice-text";
  textInput.placeholder = "Nội dung lựa chọn";
  textInput.value = text;
  const select = document.createElement("select");
  select.className = "choice-next";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Chọn hộp thoại tiếp theo";
  select.appendChild(placeholder);
  storyNodes.forEach(node => {
    const option = document.createElement("option");
    option.value = node.id;
    option.textContent = `${node.id} — ${node.speaker}`;
    select.appendChild(option);
  });
  select.value = next;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Xóa lựa chọn";
  remove.onclick = () => row.remove();
  row.append(textInput,select,remove);
  container.appendChild(row);
}
function cancelStoryEdit() {
  document.getElementById("storyEditor").classList.add("hidden");
  document.getElementById("nodeId").disabled = false;
}
function saveStoryNode() {
  const id = document.getElementById("nodeId").value.trim();
  const speaker = document.getElementById("nodeSpeaker").value.trim();
  const character = document.getElementById("nodeCharacter").value.trim() || "💬";
  const text = document.getElementById("nodeText").value.trim();
  const ending = document.getElementById("nodeEnding").checked;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) { alert("Mã hộp thoại chỉ dùng chữ không dấu, số, dấu gạch ngang hoặc gạch dưới."); return; }
  if (!speaker || !text) { alert("Vui lòng nhập tên người nói và nội dung lời thoại."); return; }
  if (!editingNodeId && storyNodes.some(n => n.id === id)) { alert("Mã hộp thoại này đã tồn tại."); return; }

  const choices = [...document.querySelectorAll("#choiceEditorList .choice-row")].map(row => ({
    text:row.querySelector(".choice-text").value.trim(),
    next:row.querySelector(".choice-next").value
  })).filter(c => c.text || c.next);

  if (!ending && choices.length === 0) { alert("Hộp thoại chưa kết thúc cần có ít nhất một lựa chọn."); return; }
  if (choices.some(c => !c.text || !c.next)) { alert("Mỗi lựa chọn cần có nội dung và hộp thoại tiếp theo."); return; }
  if (choices.some(c => c.next === id)) { alert("Không thể nối hộp thoại trực tiếp về chính nó."); return; }

  const node = { id, speaker, character, text, ending, choices:ending ? [] : choices };
  if (editingNodeId) {
    const index = storyNodes.findIndex(n => n.id === editingNodeId);
    storyNodes[index] = node;
  } else storyNodes.push(node);
  saveStoryData();
  renderStoryAdmin();
  cancelStoryEdit();
  alert("Đã lưu hộp thoại!");
}
function deleteStoryNode(id) {
  if (id === "start") { alert("Không thể xóa hộp thoại bắt đầu (start)."); return; }
  if (!confirm(`Bạn có chắc muốn xóa hộp thoại "${id}"?`)) return;
  storyNodes = storyNodes.filter(n => n.id !== id);
  storyNodes.forEach(n => n.choices = (n.choices || []).filter(c => c.next !== id));
  saveStoryData();
  renderStoryAdmin();
}
function previewStory() {
  if (!storyNodes.some(n => n.id === "start")) { alert('Cần có hộp thoại mang mã "start".'); return; }
  document.getElementById("adminModal").classList.add("hidden");
  document.getElementById("storyModal").classList.remove("hidden");
  currentStoryNodeId = "start";
  showStoryNode();
}

/* Nhấn Enter ở ô nhập tên/mật khẩu */
document.addEventListener("DOMContentLoaded",() => {
  document.getElementById("fullName").addEventListener("keydown",e => { if (e.key === "Enter") submitName(); });
  document.getElementById("adminPassword").addEventListener("keydown",e => { if (e.key === "Enter") loginAdmin(); });
});
