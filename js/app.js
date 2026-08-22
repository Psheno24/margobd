(function () {
  const Q = window.QUEST;
  const app = document.getElementById("app");
  const canvas = document.getElementById("confetti");
  const CANDLE_COUNT = 30;

  const state = {
    screen: "intro",
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
  };

  const Speech =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let recognizer = null;
  let listenTimer = 0;
  let wantListen = false;
  let suppressAbort = false;
  let judgedFinals = 0;

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

  function render() {
    const dots = ["quiz", "candles", "oath", "gift"]
      .map((id, i) => {
        const on =
          (state.screen === "quiz" && i === 0) ||
          (state.screen === "candles" && i <= 1) ||
          (state.screen === "oath" && i <= 2) ||
          (state.screen === "gift" && true);
        return `<i class="dot${on ? " is-on" : ""}"></i>`;
      })
      .join("");

    if (state.screen === "intro") {
      app.innerHTML = `
        <section class="screen is-on">
          <p class="kicker">${Q.dateLabel || "секретное послание"}</p>
          <h1 class="display">${escapeHtml(Q.herName)}</h1>
          <div class="rule"></div>
          <p class="lede">Чтобы открыть подарок, придётся пройти короткое испытание. И сказать одну важную вещь вслух.</p>
          <div style="height:28px"></div>
          <button class="seal" type="button" data-act="start">
            ${escapeHtml(Q.herName.charAt(0))}
            <span>вскрыть</span>
          </button>
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
        </section>`;
      const img = document.getElementById("qr");
      img.addEventListener("error", () => {
        img.classList.add("hidden");
        state.qrMissing = true;
        document.getElementById("missing").classList.add("is-on");
      });
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
    if (act === "start") go("quiz", { qIndex: 0, toast: "" });
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
    const bits = Array.from({ length: 90 }, () => ({
      x: w * 0.5 + (Math.random() - 0.5) * 80,
      y: h * 0.22,
      vx: (Math.random() - 0.5) * 7,
      vy: Math.random() * -7 - 3,
      g: 0.16 + Math.random() * 0.08,
      s: 3 + Math.random() * 5,
      a: 1,
      c: Math.random() > 0.5 ? "#c9a66b" : "#f3ead7",
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
  } else {
    render();
  }
})();
