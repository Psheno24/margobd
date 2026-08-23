window.QUEST = {
  herName: "Марго",
  hisName: "Серёжа",
  phrase: "Серёжа не гей",
  dateLabel: "квест на день рождения",
  giftCaption: "Покажи код — и забирай подарок.",
  afterword: "С днём рождения. Ты справилась.",

  pets: {
    tsvetochka: { name: "Тшветочка", image: "assets/tsvetochka.webp" },
    shmelechka: { name: "Шмелёчка", image: "assets/shmelechka.webp" },
  },

  // Положи картинки кодов в assets (png/jpg/webp) — имена ниже
  codes: [
    {
      title: "Озоновый слой",
      image: "assets/code-ozone.png",
      fileHint: "code-ozone.png",
    },
    {
      title: "Дикие ягодки",
      image: "assets/code-berries.png",
      fileHint: "code-berries.png",
    },
  ],

  difficulty: {
    title: "Выбери сложность",
    lead: "Тшветочек и Шмелёчек наготове",
    leadSub: "Не подведи",
    options: [
      {
        id: "easy",
        label: "Лёгкая",
        reject: "выбери другой, ты же не пуська",
      },
      {
        id: "medium",
        label: "Средняя",
        reject: "не расстраивай",
      },
      {
        id: "hard",
        label: "Сложная",
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
        {
          label: "Анонимный благотворитель",
          correct: false,
          wrong: "Благотворитель нашёлся, но он не анонимный.",
        },
        {
          label: "Сама вселенная, ей было скучно",
          correct: false,
          wrong: "Вселенная отдыхает. Тут конкретный человек.",
        },
      ],
    },
    {
      kicker: "Допрос · 2 из 3",
      text: "И зачем ему это понадобилось?",
      options: [
        { label: "Потому что у тебя день рождения", correct: true },
        {
          label: "Чтобы вернуть долг в 200 рублей",
          correct: false,
          wrong: "Нет. Сегодня не про долги.",
        },
        {
          label: "Случайно нажал «создать сайт»",
          correct: false,
          wrong: "Сайты сами себя не делают. Это было намеренно.",
        },
      ],
    },
    {
      kicker: "Допрос · 3 из 3",
      text: "Какая версия событий сегодня единственно верная?",
      options: [
        { label: "Марго — именинница, и ей положен подарок", correct: true },
        {
          label: "Это всё сон, можно не проходить",
          correct: false,
          wrong: "Не сон. Проходить всё равно придётся.",
        },
        {
          label: "Подарков не будет, только моральная поддержка",
          correct: false,
          wrong: "Слишком пессимистично для праздника.",
        },
      ],
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
