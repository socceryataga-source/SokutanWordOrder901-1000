(() => {
  "use strict";
  const DATA = Array.isArray(window.WORD_ORDER_DATA) ? window.WORD_ORDER_DATA : [];
  const $ = (id) => document.getElementById(id);
  const screens = { setup: $("setupScreen"), quiz: $("quizScreen"), result: $("resultScreen") };
  const startInput = $("startInput"), endInput = $("endInput"), rangeError = $("rangeError");
  const jpText = $("jpText"), questionNumber = $("questionNumber"), progressText = $("progressText"), progressFill = $("progressFill");
  const wordPool = $("wordPool"), answerZone = $("answerZone"), answerPlaceholder = $("answerPlaceholder");
  const feedback = $("feedback"), checkBtn = $("checkBtn"), nextBtn = $("nextBtn"), scoreText = $("scoreText");

  let mode = "order";
  let quiz = [];
  let current = 0;
  let score = 0;
  let poolTokens = [];
  let answerTokens = [];
  let checked = false;
  let settings = { start: 901, end: 1000, mode: "order" };

  try {
    const saved = JSON.parse(localStorage.getItem("wordOrder901Settings") || "null");
    if (saved && Number.isInteger(saved.start) && Number.isInteger(saved.end) && ["order","random"].includes(saved.mode)) {
      startInput.value = saved.start;
      endInput.value = saved.end;
      mode = saved.mode;
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    }
  } catch (_) {}

  document.querySelectorAll(".mode-btn").forEach(btn => btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b === btn));
  }));

  $("startBtn").addEventListener("click", () => startQuiz(false));
  $("retryBtn").addEventListener("click", () => startQuiz(true));
  $("changeRangeBtn").addEventListener("click", () => showScreen("setup"));
  $("backToSetupBtn").addEventListener("click", () => showScreen("setup"));
  $("homeLogo").addEventListener("click", (e) => { e.preventDefault(); showScreen("setup"); });
  $("clearBtn").addEventListener("click", clearAnswer);
  checkBtn.addEventListener("click", checkAnswer);
  nextBtn.addEventListener("click", nextQuestion);

  function startQuiz(useSaved) {
    const start = useSaved ? settings.start : Number(startInput.value);
    const end = useSaved ? settings.end : Number(endInput.value);
    const selectedMode = useSaved ? settings.mode : mode;
    const error = validateRange(start, end);
    if (error) { rangeError.textContent = error; rangeError.classList.remove("hidden"); return; }
    rangeError.classList.add("hidden");
    settings = { start, end, mode: selectedMode };
    try { localStorage.setItem("wordOrder901Settings", JSON.stringify(settings)); } catch (_) {}
    quiz = DATA.filter(q => q.id >= start && q.id <= end).map(q => ({...q}));
    if (selectedMode === "random") shuffle(quiz);
    current = 0; score = 0; scoreText.textContent = "0";
    showScreen("quiz");
    loadQuestion();
  }

  function validateRange(start, end) {
    if (!Number.isInteger(start) || !Number.isInteger(end)) return "開始番号と終了番号を入力してください。";
    if (start < 901 || start > 1000 || end < 901 || end > 1000) return "901〜1000の範囲で入力してください。";
    if (start > end) return "開始番号は終了番号以下にしてください。";
    return "";
  }

  function loadQuestion() {
    const q = quiz[current];
    checked = false;
    answerTokens = [];
    const words = tokenize(q.sentence).map((text, i) => ({ uid: `${q.id}-${i}`, text, order: i }));
    poolTokens = [...words];
    shuffle(poolTokens);
    if (poolTokens.length > 2 && poolTokens.every((t, i) => t.order === i)) [poolTokens[0], poolTokens[1]] = [poolTokens[1], poolTokens[0]];
    poolTokens.forEach((token, i) => token.bankOrder = i);

    questionNumber.textContent = `No.${q.id}`;
    progressText.textContent = `${current + 1} / ${quiz.length}`;
    progressFill.style.width = `${((current + 1) / quiz.length) * 100}%`;
    jpText.textContent = q.jp;
    feedback.className = "feedback hidden";
    feedback.innerHTML = "";
    checkBtn.classList.remove("hidden");
    nextBtn.classList.add("hidden");
    answerZone.classList.remove("locked");
    wordPool.classList.remove("locked");
    renderTokens();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function tokenize(sentence) { return sentence.trim().split(/\s+/).filter(Boolean); }

  function renderTokens() {
    wordPool.innerHTML = "";
    answerZone.querySelectorAll(".token").forEach(el => el.remove());
    answerPlaceholder.classList.toggle("hidden", answerTokens.length > 0);

    answerTokens.forEach(token => answerZone.appendChild(makeToken(token, "answer")));
    // Return-to-pool preserves each token's original shuffled pool position.
    poolTokens.forEach(token => wordPool.appendChild(makeToken(token, "pool")));
    checkBtn.disabled = answerTokens.length === 0 || checked;
  }

  function makeToken(token, area) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "token"; b.textContent = token.text;
    b.dataset.uid = token.uid;
    b.setAttribute("aria-label", area === "pool" ? `${token.text} を解答欄へ` : `${token.text} を単語プールへ戻す`);
    b.addEventListener("click", () => area === "pool" ? moveToAnswer(token.uid) : returnToPool(token.uid));
    return b;
  }

  function moveToAnswer(uid) {
    if (checked) return;
    const index = poolTokens.findIndex(t => t.uid === uid);
    if (index < 0) return;
    const [token] = poolTokens.splice(index, 1);
    answerTokens.push(token);
    renderTokens();
  }

  function returnToPool(uid) {
    if (checked) return;
    const index = answerTokens.findIndex(t => t.uid === uid);
    if (index < 0) return;
    const [token] = answerTokens.splice(index, 1);
    poolTokens.push(token);
    poolTokens.sort((a, b) => a.bankOrder - b.bankOrder);
    renderTokens();
  }

  function clearAnswer() {
    if (checked || !answerTokens.length) return;
    while (answerTokens.length) returnToPool(answerTokens[answerTokens.length - 1].uid);
  }

  function checkAnswer() {
    if (checked || answerTokens.length === 0) return;
    checked = true;
    const q = quiz[current];
    const user = answerTokens.map(t => t.text).join(" ");
    const correct = user === q.sentence;
    if (correct) score++;
    scoreText.textContent = String(score);
    feedback.className = `feedback ${correct ? "correct" : "wrong"}`;
    feedback.innerHTML = correct
      ? `✓ 正解！<span class="correct-sentence">${escapeHtml(q.sentence)}</span>`
      : `✕ もう一度確認しよう。<span class="correct-sentence">正解：${escapeHtml(q.sentence)}</span>`;
    checkBtn.classList.add("hidden");
    nextBtn.textContent = current === quiz.length - 1 ? "結果を見る →" : "次の問題へ →";
    nextBtn.classList.remove("hidden");
    answerZone.classList.add("locked"); wordPool.classList.add("locked");
  }

  function nextQuestion() {
    if (!checked) return;
    if (current < quiz.length - 1) { current++; loadQuestion(); }
    else showResult();
  }

  function showResult() {
    $("finalScore").textContent = `${score} / ${quiz.length}`;
    $("finalPercent").textContent = `${Math.round((score / quiz.length) * 100)}%`;
    $("resultRange").textContent = `No.${settings.start}–${settings.end} · ${settings.mode === "random" ? "ランダム" : "順番通り"}`;
    showScreen("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }

  if (!DATA.length) {
    document.body.innerHTML = '<main style="padding:2rem;font-family:sans-serif"><h1>データを読み込めませんでした</h1><p>data.js が index.html と同じ階層にあるか確認してください。</p></main>';
  }
})();
