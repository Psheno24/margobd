(function () {
  const Q = window.QUEST;
  const app = document.getElementById("app");
  const canvas = document.getElementById("confetti");
  const CANDLE_COUNT = 30;
  const GUESTBOOK_KEY = "margo-guestbook-v1";

  const state = {
    screen: "difficulty",
    qIndex: 0,
    toast: "",
    blown: [],
    listening: false,
    heard: "",
    status: "Нажми и скажи вслух",
    hintOn: false,
    qrMissing: false,
    liveError: "",
    verdict: "",
    slander: 0,
    diffError: "",
    hardcoreReady: false,
    guestbookStatus: "",
    guestbookBusy: false,
  };

  const Speech =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let recognizer = null;
  let listenTimer = 0;
  let wantListen = false;
  let suppressAbort = false;
  let judgedFinals = 0;

  function mascotsHtml() {
    return `<div class="mascots" aria-hidden="true">
      <img class="mascot mascot-flower" src="assets/tsvetochka.webp" alt="" />
      <img class="mascot mascot-bee" src="assets/shmelechka.webp" alt="" />
    </div>`;
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^а-яa-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function phraseOk(raw) {
    const n = normalize(raw);
    if (!n) return false;
    const target = normalize(Q.phrase);
    if (n.includes(target) || n.replace(/\s/g, "").includes(target.replace(/\s/g, ""))) {
      return true;
    }
    const hasName = /сереж[аеуыи]|серег[аеуы]|sere[jz]h?a|seryozha/.test(n);
    const hasNeg = hasNegation(n);
    const hasGay = hasGayWord(n);
    return hasName && hasNeg && hasGay;
  }

  function hasGayWord(n) {
    return /(^| )гей( |$)|(^| )gay( |$)/.test(n);
  }

  function hasNegation(n) {
    return /(^| )не( |$)/.test(n) || /негей|не gay/.test(n);
  }

  function judgePhrase(raw) {
    const n = normalize(raw);
    if (!n) return "none";
    if (phraseOk(raw)) return "ok";
    if (hasGayWord(n) && !hasNegation(n)) return "slander";
    return "wrong";
  }

  function go(screen, extra) {
    Object.assign(state, extra || {}, { screen: screen });
    render();
  }

  function loadGuestbook() {
    try {
      const raw = localStorage.getItem(GUESTBOOK_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveGuestbook(list) {
    localStorage.setItem(GUESTBOOK_KEY, JSON.stringify(list));
  }

  function telegramConfigured() {
    return Boolean(Q.telegram && Q.telegram.botToken && Q.telegram.chatId);
  }

  function sendTelegram(text) {
    if (!telegramConfigured()) {
      return Promise.reject(new Error("telegram-not-configured"));
    }
    const url =
      "https://api.telegram.org/bot" +
      encodeURIComponent(Q.telegram.botToken) +
      "/sendMessage";
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Q.telegram.chatId,
        text: text,
        disable_web_page_preview: true,
      }),
    }).then((res) => {
      if (!res.ok) throw new Error("telegram-http-" + res.status);
      return res.json();
    });
  }

  function progressDots() {
    return ["quiz", "candles", "oath", "gift"]
      .map((id, i) => {
        const on =
          (state.screen === "quiz" && i === 0) ||
          (state.screen === "candles" && i <= 1) ||
          (state.screen === "oath" && i <= 2) ||
          (state.screen === "gift" && true);
        return `<i class="dot${on ? " is-on" : ""}"></i>`;
      })
      .join("");
  }

  function render() {
    const dots = progressDots();

    if (state.screen === "difficulty") {
      const D = Q.difficulty;
      if (state.hardcoreReady) {
        app.innerHTML = `
          <section class="screen is-on">
            ${mascotsHtml()}
            <p class="kicker">${escapeHtml(Q.dateLabel || "квест")}</p>
            <h1 class="brand">${escapeHtml(Q.herName)}</h1>
            <div class="rule"></div>
            <div class="hardcore-ok">
              <p>${escapeHtml(D.options.find((o) => o.id === "hardcore").accept)}</p>
              <button class="btn btn-solid" type="button" data-act="begin">Далее</button>
            </div>
          </section>`;
        return;
      }

      app.innerHTML = `
        <section class="screen is-on">
          ${mascotsHtml()}
          <p class="kicker">${escapeHtml(Q.dateLabel || "квест")}</p>
          <h1 class="brand">${escapeHtml(Q.herName)}</h1>
          <div class="rule"></div>
          <h2 class="display display-m">${escapeHtml(D.title)}</h2>
          <p class="lede">${escapeHtml(D.lead)}</p>
          <div class="difficulty">
            ${D.options
              .map((opt) => {
                const hard = opt.id === "hardcore";
                return `<button class="diff-btn${hard ? " is-hardcore" : ""}" type="button" data-act="diff" data-id="${escapeAttr(opt.id)}">
                  <strong>${escapeHtml(opt.label)}</strong>
                  <span>${escapeHtml(opt.hint || "")}</span>
                </button>`;
              })
              .join("")}
          </div>
          <p class="diff-error${state.diffError ? " is-shake" : ""}" id="diff-error">${escapeHtml(state.diffError)}</p>
        </section>`;
      return;
    }

    if (state.screen === "quiz") {
      const q = Q.questions[state.qIndex];
      app.innerHTML = `
        <section class="screen is-on">
          <div class="progress">${dots}</div>
          <article class="paper">
            <p class="kicker">${escapeHtml(q.kicker)}</p>
            <h2>${escapeHtml(q.text)}</h2>
            <div class="options">
              ${q.options
                .map(
                  (opt, i) =>
                    `<button class="option" type="button" data-act="answer" data-i="${i}">${escapeHtml(opt.label)}</button>`
                )
                .join("")}
            </div>
            <p class="toast">${escapeHtml(state.toast)}</p>
          </article>
        </section>`;
      return;
    }

    if (state.screen === "candles") {
      const left = CANDLE_COUNT - state.blown.length;
      app.innerHTML = `
        <section class="screen screen-cake is-on">
          <div class="progress">${dots}</div>
          <p class="kicker">Испытание</p>
          <h1 class="display display-m">Тридцать огней</h1>
          <p class="lede">Погаси каждую свечу. Пока горит хотя бы одна — замок не откроется.</p>
          <div class="cake-scene" id="cake-scene" style="--lit:${left}">
            <div class="cake-halo"></div>
            <div class="cake">
              <div class="cake-top" id="cake-top">
                ${candleSpots(CANDLE_COUNT)
                  .map((spot, i) => candleHtml(i, spot))
                  .join("")}
              </div>
              <div class="cake-body">
                <i class="drip"></i>
              </div>
              <div class="plate"></div>
              <div class="plate-shadow"></div>
            </div>
          </div>
          <p class="flame-count" id="flame-count">${left} <span>ещё горят</span></p>
        </section>`;
      return;
    }

    if (state.screen === "oath") {
      app.innerHTML = `
        <section class="screen is-on">
          <div class="progress">${dots}</div>
          <p class="kicker">Голосовой замок</p>
          <h1 class="display display-m">Клятва</h1>
          <div class="rule"></div>
          <p class="riddle-lead">${escapeHtml(Q.riddleLead)}</p>
          <ul class="riddle">
            ${Q.riddle.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
          <button class="mic${state.listening ? " is-live" : ""}" id="mic-btn" type="button" data-act="listen" ${
            Speech ? "" : "disabled"
          }>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.6"/>
              <path d="M6 11a6 6 0 0 0 12 0" stroke="currentColor" stroke-width="1.6"/>
              <path d="M12 17v4" stroke="currentColor" stroke-width="1.6"/>
            </svg>
          </button>
          <p class="mic-label" id="mic-status">${escapeHtml(state.status)}</p>
          <p class="heard${state.verdict ? " is-" + state.verdict : ""}" id="mic-heard">${escapeHtml(state.heard || state.liveError)}</p>
          ${
            state.hintOn
              ? `<p class="lede">Подсказка: «${escapeHtml(Q.hint)}»</p>`
              : `<button class="ghost" type="button" data-act="hint">Сдаюсь, нужна подсказка</button>`
          }
          <details class="fallback">
            <summary>Микрофон не работает</summary>
            <div class="row">
              <input id="typed" type="text" autocomplete="off" placeholder="напиши три слова" />
              <button class="btn btn-solid" type="button" data-act="type">Ок</button>
            </div>
          </details>
        </section>`;
      return;
    }

    if (state.screen === "gift") {
      const entries = loadGuestbook();
      app.innerHTML = `
        <section class="screen is-on">
          <div class="progress">${dots}</div>
          <p class="kicker">замок открыт</p>
          <h1 class="display display-m">Подарок</h1>
          <div class="rule"></div>
          <article class="gift-card">
            <img id="qr" src="${escapeAttr(Q.qrImage)}" alt="QR-код подарка" />
            <div class="missing-qr${state.qrMissing ? " is-on" : ""}" id="missing">
              Положи файл <b>qr.png</b> в папку <b>assets</b> — и обнови страницу.
            </div>
            <p>${escapeHtml(Q.giftCaption)}</p>
            <p class="after">${escapeHtml(Q.afterword)}</p>
          </article>
          <form class="guestbook" id="guestbook-form">
            <h3>${escapeHtml(Q.guestbookTitle)}</h3>
            <p class="hint">${escapeHtml(Q.guestbookHint)}</p>
            <div class="field">
              <label for="gb-name">От кого</label>
              <input id="gb-name" name="name" type="text" maxlength="60" autocomplete="name" placeholder="Марго" required />
            </div>
            <div class="field">
              <label for="gb-msg">Запись</label>
              <textarea id="gb-msg" name="message" maxlength="500" placeholder="Спасибо за квест…" required></textarea>
            </div>
            <button class="btn btn-solid" type="submit" ${state.guestbookBusy ? "disabled" : ""}>Отправить</button>
            <p class="guestbook-status">${escapeHtml(state.guestbookStatus)}</p>
            ${
              entries.length
                ? `<ul class="guestbook-list">${entries
                    .slice()
                    .reverse()
                    .slice(0, 8)
                    .map(
                      (e) =>
                        `<li><strong>${escapeHtml(e.name)}</strong>${escapeHtml(e.message)}</li>`
                    )
                    .join("")}</ul>`
                : ""
            }
          </form>
        </section>`;
      const img = document.getElementById("qr");
      img.addEventListener("error", () => {
        img.classList.add("hidden");
        state.qrMissing = true;
        document.getElementById("missing").classList.add("is-on");
      });
      const form = document.getElementById("guestbook-form");
      if (form) {
        form.addEventListener("submit", onGuestbookSubmit);
      }
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  function pickDifficulty(id) {
    const opt = Q.difficulty.options.find((o) => o.id === id);
    if (!opt) return;
    if (opt.id === "hardcore") {
      state.diffError = "";
      state.hardcoreReady = true;
      render();
      return;
    }
    state.diffError = opt.reject || "нет";
    state.hardcoreReady = false;
    render();
  }

  function onGuestbookSubmit(event) {
    event.preventDefault();
    if (state.guestbookBusy) return;
    const nameInput = document.getElementById("gb-name");
    const msgInput = document.getElementById("gb-msg");
    const name = nameInput ? nameInput.value.trim() : "";
    const message = msgInput ? msgInput.value.trim() : "";
    if (!name || !message) {
      state.guestbookStatus = "Заполни оба поля.";
      render();
      return;
    }

    const entry = {
      id: Date.now(),
      name: name,
      message: message,
      at: new Date().toISOString(),
    };

    const list = loadGuestbook();
    list.push(entry);
    saveGuestbook(list);

    state.guestbookBusy = true;
    state.guestbookStatus = "Отправляю…";
    render();

    const text = [
      "🎂 Запись с сайта Марго",
      "От: " + entry.name,
      "",
      entry.message,
      "",
      "время: " + new Date(entry.at).toLocaleString("ru-RU"),
    ].join("\n");

    sendTelegram(text)
      .then(() => {
        state.guestbookBusy = false;
        state.guestbookStatus = Q.guestbookThanks || "Сохранено.";
        render();
      })
      .catch((err) => {
        state.guestbookBusy = false;
        if (String(err && err.message) === "telegram-not-configured") {
          state.guestbookStatus =
            "Сохранено на устройстве. Добавь botToken и chatId в config.js — и записи пойдут в Telegram.";
        } else {
          state.guestbookStatus =
            "Сохранено локально, но Telegram не ответил. Проверь токен и chat_id.";
        }
        render();
      });
  }

  function answer(i) {
    const q = Q.questions[state.qIndex];
    const opt = q.options[i];
    if (!opt.correct) {
      state.toast = q.wrong;
      render();
      const btn = app.querySelector(`[data-i="${i}"]`);
      if (btn) {
        btn.classList.add("is-wrong");
      }
      return;
    }
    state.toast = "";
    if (state.qIndex < Q.questions.length - 1) {
      state.qIndex += 1;
      render();
      return;
    }
    go("candles", { blown: [] });
  }

  function candleSpots(n) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const spots = [];
    for (let i = 0; i < n; i += 1) {
      const r = Math.sqrt((i + 0.45) / n);
      const a = (i + 1) * golden;
      const x = 50 + Math.cos(a) * r * 38;
      const y = 56 + Math.sin(a) * r * 30;
      spots.push({ x, y, z: 10 + Math.round(y) });
    }
    return spots;
  }

  function candleHtml(i, spot) {
    const out = state.blown.includes(i);
    const place = spot
      ? ` style="left:${spot.x.toFixed(2)}%;top:${spot.y.toFixed(2)}%;z-index:${spot.z}"`
      : "";
    return `<button class="candle c${i % 4}${out ? " is-out" : ""}" type="button" data-act="blow" data-i="${i}"${place} ${
      out ? "disabled" : ""
    } aria-label="свеча ${i + 1}"><i class="flame"><i class="core"></i></i><i class="wick"></i><i class="stick"></i><i class="smoke"></i></button>`;
  }

  function blow(i) {
    if (state.blown.includes(i)) return;
    state.blown = state.blown.concat(i);
    const btn = app.querySelector(`.candle[data-i="${i}"]`);
    if (btn) {
      btn.classList.add("is-out");
      btn.disabled = true;
    }
    const left = CANDLE_COUNT - state.blown.length;
    const scene = document.getElementById("cake-scene");
    const count = document.getElementById("flame-count");
    if (scene) scene.style.setProperty("--lit", String(left));
    if (count) {
      count.innerHTML = left
        ? `${left} <span>ещё горят</span>`
        : `0 <span>погасли</span>`;
    }
    if (left <= 0) {
      window.setTimeout(() => go("oath"), 900);
    }
  }

  function paintOathStatus() {
    const mic = document.getElementById("mic-btn");
    const label = document.getElementById("mic-status");
    const heard = document.getElementById("mic-heard");
    if (!mic) return;
    mic.classList.toggle("is-live", state.listening);
    if (label) label.textContent = state.status;
    if (heard) {
      heard.textContent = state.heard || state.liveError || "";
      heard.classList.remove("is-slander", "is-wrong");
      if (state.verdict) heard.classList.add("is-" + state.verdict);
    }
  }

  function flashPunish() {
    const screen = app.querySelector(".screen");
    if (!screen) return;
    screen.classList.remove("is-punish");
    void screen.offsetWidth;
    screen.classList.add("is-punish");
    window.setTimeout(() => screen.classList.remove("is-punish"), 700);
  }

  function reactToSpeech(text) {
    const kind = judgePhrase(text);
    if (kind === "ok") {
      unlock();
      return;
    }
    if (kind === "slander") {
      state.slander += 1;
      state.verdict = "slander";
      stopListen();
      if (navigator.vibrate) navigator.vibrate([50, 80, 50, 80, 120]);
      flashPunish();
      if (state.slander >= 2) {
        state.status = "Замок обиделся";
        state.heard = "Слово «гей» без «не» — это клевета. Свечи зажглись снова.";
        paintOathStatus();
        window.setTimeout(() => {
          state.slander = 0;
          state.verdict = "";
          go("candles", { blown: [] });
        }, 1400);
        return;
      }
      state.status = "Клевета";
      state.heard = "«Гей» без частицы «не» сюда нельзя. Добавь отрицание.";
      paintOathStatus();
      return;
    }
    if (kind === "wrong") {
      state.verdict = "wrong";
      state.status = "Не туда";
      state.heard = "Не в ту сторону думаешь. Три слова — как в загадке.";
      paintOathStatus();
    }
  }

  function onHeard(text, isFinal) {
    if (phraseOk(text)) {
      unlock();
      return;
    }
    if (isFinal) {
      reactToSpeech(text);
      return;
    }
    if (!state.verdict) {
      state.heard = text;
      paintOathStatus();
    }
  }

  function getRecognizer() {
    if (recognizer) return recognizer;
    recognizer = new Speech();
    recognizer.lang = "ru-RU";
    recognizer.interimResults = true;
    recognizer.continuous = true;
    recognizer.maxAlternatives = 4;

    recognizer.onstart = () => {
      state.listening = true;
      state.status = "Слушаю… говори";
      paintOathStatus();
    };

    recognizer.onresult = (event) => {
      let live = "";
      for (let i = 0; i < event.results.length; i += 1) {
        for (let j = 0; j < event.results[i].length; j += 1) {
          if (phraseOk(event.results[i][j].transcript)) {
            unlock();
            return;
          }
        }
        live += event.results[i][0].transcript + " ";
        if (event.results[i].isFinal && i >= judgedFinals) {
          judgedFinals = i + 1;
          onHeard(event.results[i][0].transcript, true);
          if (state.screen !== "oath") return;
        }
      }
      if (state.screen === "oath" && !state.verdict) {
        onHeard(live, false);
      }
    };

    recognizer.onerror = (event) => {
      const err = event.error;
      if (err === "aborted" && suppressAbort) return;
      if (err === "no-speech") {
        state.status = "Тишина. Скажи ещё раз, не отпуская момент.";
        paintOathStatus();
        return;
      }
      wantListen = false;
      state.listening = false;
      if (err === "not-allowed") {
        state.status = "Нет доступа к микрофону";
        state.liveError = "Разреши микрофон в браузере или напиши фразу ниже.";
      } else if (err === "audio-capture") {
        state.status = "Микрофон недоступен";
        state.liveError = "Проверь, что микрофон не занят другой программой.";
      } else if (err === "network") {
        state.status = "Нет связи с распознаванием";
        state.liveError = "Chrome отправляет голос в интернет. Проверь сеть или напиши фразу ниже.";
      } else {
        state.status = "Не получилось слушать";
        state.liveError = "Ошибка: " + err + ". Можно написать фразу ниже.";
      }
      paintOathStatus();
    };

    recognizer.onend = () => {
      state.listening = false;
      if (wantListen && state.screen === "oath") {
        window.setTimeout(() => {
          if (!wantListen || state.screen !== "oath") return;
          try {
            recognizer.start();
          } catch (err) {
            /* already started */
          }
        }, 220);
        return;
      }
      if (state.screen === "oath") {
        state.status = state.status.indexOf("Слушаю") === 0 ? "Нажми и скажи вслух" : state.status;
        paintOathStatus();
      }
    };

    return recognizer;
  }

  function startListen() {
    if (!Speech) {
      state.liveError = "Этот браузер не умеет слушать. Напиши фразу ниже.";
      paintOathStatus();
      return;
    }
    if (wantListen) {
      stopListen();
      state.status = "Нажми и скажи вслух";
      paintOathStatus();
      return;
    }

    wantListen = true;
    suppressAbort = false;
    judgedFinals = 0;
    state.heard = "";
    state.liveError = "";
    state.verdict = "";
    state.status = "Слушаю…";
    state.listening = true;
    paintOathStatus();

    try {
      getRecognizer().start();
    } catch (err) {
      wantListen = false;
      state.listening = false;
      state.status = "Не вышло включить микрофон";
      state.liveError = String(err && err.message ? err.message : err);
      paintOathStatus();
      return;
    }

    window.clearTimeout(listenTimer);
    listenTimer = window.setTimeout(() => {
      if (!wantListen) return;
      stopListen();
      state.status = "Время вышло — нажми ещё раз";
      paintOathStatus();
    }, 15000);
  }

  function stopListen() {
    wantListen = false;
    suppressAbort = true;
    window.clearTimeout(listenTimer);
    state.listening = false;
    if (recognizer) {
      try {
        recognizer.abort();
      } catch (err) {
        /* already stopped */
      }
    }
  }

  function unlock() {
    stopListen();
    if (state.screen === "gift") return;
    if (navigator.vibrate) navigator.vibrate(40);
    go("gift");
    burst();
  }

  function tryTyped() {
    const input = document.getElementById("typed");
    const value = input ? input.value : "";
    if (!value.trim()) {
      state.verdict = "wrong";
      state.status = "Пусто";
      state.heard = "Сначала напиши три слова.";
      paintOathStatus();
      return;
    }
    reactToSpeech(value);
    const again = document.querySelector(".fallback");
    if (again) again.open = true;
    const next = document.getElementById("typed");
    if (next) next.value = value;
  }

  app.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (act === "diff") pickDifficulty(btn.getAttribute("data-id"));
    if (act === "begin") go("quiz", { qIndex: 0, toast: "" });
    if (act === "answer") answer(Number(btn.getAttribute("data-i")));
    if (act === "blow") blow(Number(btn.getAttribute("data-i")));
    if (act === "listen") startListen();
    if (act === "hint") {
      state.hintOn = true;
      render();
    }
    if (act === "type") tryTyped();
  });

  app.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "typed") {
      event.preventDefault();
      tryTyped();
    }
  });

  function burst() {
    const ctx = canvas.getContext("2d");
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);
    const colors = ["#f07828", "#ffd24a", "#6ec8e8", "#ff7a9a", "#3d9a45", "#1a1a1a"];
    const bits = Array.from({ length: 90 }, () => ({
      x: w * 0.5 + (Math.random() - 0.5) * 80,
      y: h * 0.22,
      vx: (Math.random() - 0.5) * 7,
      vy: Math.random() * -7 - 3,
      g: 0.16 + Math.random() * 0.08,
      s: 3 + Math.random() * 5,
      a: 1,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));

    let frame = 0;
    function tick() {
      ctx.clearRect(0, 0, w, h);
      bits.forEach((p) => {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.a -= 0.008;
        ctx.globalAlpha = Math.max(p.a, 0);
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.s, p.s * 1.4);
      });
      ctx.globalAlpha = 1;
      frame += 1;
      if (frame < 140) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    }
    tick();
  }

  const params = new URLSearchParams(location.search);
  if (params.get("gift") === "1") {
    go("gift");
  } else if (params.get("candles") === "1") {
    go("candles", { blown: [] });
  } else if (params.get("oath") === "1") {
    go("oath");
  } else if (params.get("quiz") === "1") {
    go("quiz", { qIndex: 0, toast: "" });
  } else {
    render();
  }
})();
