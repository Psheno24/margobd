window.QUEST = {
  herName: "Марго",
  hisName: "Серёжа",
  phrase: "Серёжа не гей",
  qrImage: "assets/qr.png",
  dateLabel: "квест на день рождения",
  giftCaption: "Покажи этот код — и забирай подарок.",
  afterword: "С днём рождения. Ты справилась.",
  guestbookTitle: "Оставь запись",
  guestbookHint: "Пожелание, шутка или признание — уйдёт Серёже в Telegram.",
  guestbookThanks: "Записано. Шмелёчка одобряет.",

  // Заполни после создания бота у @BotFather
  telegram: {
    botToken: "",
    chatId: "",
  },

  pets: {
    tsvetochka: { name: "Тшветочка", image: "assets/tsvetochka.webp" },
    shmelechka: { name: "Шмелёчка", image: "assets/shmelechka.webp" },
  },

  difficulty: {
    title: "Выбери сложность",
    lead: "Тшветочка и Шмелёчка уже наготове. Не подведи.",
    options: [
      {
        id: "easy",
        label: "Лёгкая",
        hint: "для пусек",
        reject: "выбери другой, ты же не пуська",
      },
      {
        id: "medium",
        label: "Средняя",
        hint: "почти серьёзно",
        reject: "не расстраивай",
      },
      {
        id: "hard",
        label: "Сложная",
        hint: "огонь",
        reject: "Подумай ещё раз",
      },
      {
        id: "hardcore",
        label: "ХАРДКОР",
        hint: "только для Марго",
        accept: "тут без разницы было, вопросы одинаковые кек",
      },
    ],
  },

  questions: [
    {
      kicker: "Допрос · 1 из 3",
      text: "Кто устроил всё это безобразие?",
      options: [
        { label: "Серёжа", correct: true },
        { label: "Анонимный благотворитель", correct: false },
        { label: "Сама вселенная, ей было скучно", correct: false },
      ],
      wrong: "Тёплая попытка. Но есть конкретный подозреваемый.",
    },
    {
      kicker: "Допрос · 2 из 3",
      text: "И зачем ему это понадобилось?",
      options: [
        { label: "Потому что у тебя день рождения", correct: true },
        { label: "Чтобы вернуть долг в 200 рублей", correct: false },
        { label: "Случайно нажал «создать сайт»", correct: false },
      ],
      wrong: "Нет. Сегодня не про долги.",
    },
    {
      kicker: "Допрос · 3 из 3",
      text: "Какая версия событий сегодня единственно верная?",
      options: [
        { label: "Марго — именинница, и ей положен подарок", correct: true },
        { label: "Это всё сон, можно не проходить", correct: false },
        { label: "Подарков не будет, только моральная поддержка", correct: false },
      ],
      wrong: "Слишком пессимистично для праздника.",
    },
  ],

  riddleLead: "Три слова.",
  riddle: [
    "Первое — имя того, кто это затеял.",
    "Второе — короткое «не».",
    "Третье — снимает обидное обвинение.",
  ],

  hint: "Серёжа не гей",
};
