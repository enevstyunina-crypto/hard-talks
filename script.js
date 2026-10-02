// ═══════════════════════════════════════════════════════════════
// КОНФИГ
// ═══════════════════════════════════════════════════════════════
const HF_TOKEN = "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";
const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct:novita";
const HF_URL   = "https://router.huggingface.co/v1/chat/completions";

// Заводские пароли
const DEFAULT_PASSWORDS = {
  "admin2026": { days: 99999, isAdmin: true },
  "demo7":     { days: 7,     isAdmin: false },
  "client30":  { days: 30,    isAdmin: false },
};
const DEFAULT_ADMIN_PASS = "admin2026";

// ═══════════════════════════════════════════════════════════════
// СИСТЕМА ПАРОЛЕЙ
// ═══════════════════════════════════════════════════════════════
const Auth = {
  STORAGE_KEY: "nt_passwords_v1",
  ADMIN_KEY: "nt_admin_pass_v1",
  SESSION_KEY: "nt_session_v1",

  getPasswords(){
    try{
      const raw=localStorage.getItem(this.STORAGE_KEY);
      if(!raw) return {...DEFAULT_PASSWORDS};
      return JSON.parse(raw);
    }catch(e){return {...DEFAULT_PASSWORDS};}
  },
  savePasswords(p){localStorage.setItem(this.STORAGE_KEY, JSON.stringify(p));},
  getAdminPass(){return localStorage.getItem(this.ADMIN_KEY) || DEFAULT_ADMIN_PASS;},
  setAdminPass(newPass){localStorage.setItem(this.ADMIN_KEY, newPass);},

  checkPassword(input){
    const passwords=this.getPasswords();
    const adminPass=this.getAdminPass();
    if(input===adminPass) return { password: input, days: 99999, isAdmin: true };
    if(passwords[input]) return { password: input, ...passwords[input] };
    return null;
  },

  startSession(entry){
    const now=Date.now();
    const expiresAt=entry.isAdmin ? Infinity : now + (entry.days * 24 * 60 * 60 * 1000);
    const session={ password: entry.password, isAdmin: entry.isAdmin, days: entry.days, startedAt: now, expiresAt };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return session;
  },

  getSession(){
    try{
      const raw=localStorage.getItem(this.SESSION_KEY);
      if(!raw) return null;
      const s=JSON.parse(raw);
      if(s.isAdmin) return s;
      if(s.expiresAt && Date.now() > s.expiresAt) return null;
      return s;
    }catch(e){return null;}
  },

  endSession(){localStorage.removeItem(this.SESSION_KEY);},
  createPassword(pass, days){
    const passwords=this.getPasswords();
    passwords[pass]={ days: days, isAdmin: false };
    this.savePasswords(passwords);
  },
  deletePassword(pass){
    const passwords=this.getPasswords();
    delete passwords[pass];
    this.savePasswords(passwords);
  },
  resetAll(){
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.ADMIN_KEY);
    localStorage.removeItem(this.SESSION_KEY);
  },
};

// ═══════════════════════════════════════════════════════════════
// ДАННЫЕ ИГРЫ
// ═══════════════════════════════════════════════════════════════
const OPPONENT_TYPES = {
  shark:{ name:"Акула", icon:"🦈", hint:"Давит временем, короткие фразы, нетерпелив, уважает только факты." },
  hawk:{ name:"Ястреб", icon:"🦅", hint:"Атакует, требует «да/нет», не выносит долгих обсуждений." },
  bear:{ name:"Белый медведь", icon:"🐻‍❄️", hint:"Опирается на регламенты, методичный, не терпит импровизаций." },
  spider:{ name:"Паук", icon:"🕷️", hint:"Мягкий, задаёт вопросы, ведёт в ловушку через доверие." },
};
const MOTIVES = {
  economy:{ name:"Экономия", icon:"💵", hint:"Хотел выгоды, скидок, лучшей цены." },
  safety:{ name:"Безопасность", icon:"🔒", hint:"Хотел гарантий, стабильности, чтобы не рисковать." },
  prestige:{ name:"Престиж", icon:"👑", hint:"Хотел статуса, показать руководству, быть «лучшим»." },
  comfort:{ name:"Комфорт", icon:"🛋️", hint:"Хотел удобства, простоты, чтобы никто не трогал." },
};
const TYPE_PROMPTS = {
  shark: "Ты — АКУЛА, финансовый директор Виктор. Прямолинейный, быстрый, доминирующий. Отвечай коротко (1-2 предложения), жёстко, фактами. Не терпишь воды и пауз. Уважаешь силу.",
  hawk: "Ты — ЯСТРЕБ, директор по закупкам Игорь. Агрессивный, атакуешь. Отвечай коротко (1-2 предложения), с напором, часто требуешь да/нет. Не выносишь долгих обсуждений.",
  bear: "Ты — МЕДВЕДЬ, начальник отдела закупок Сергей. Методичный, опираешься на регламенты. Отвечай спокойно, но твёрдо. Ссылайся на процедуры и правила.",
  spider: "Ты — ПАУК, директор по развитию Анна. Мягкая, манипулятивная. Отвечай вежливо, с вопросами, создавай доверие, но веди к своей цели.",
};
const MANIPULATIONS = [
  "[усмехается] Вы понимаете, чем это грозит?",
  "[откидывается назад] Иван Петрович был бы недоволен...",
  "[пауза] Это всё, что вы можете предложить?",
  "Вы за кого нас принимаете?",
  "[смотрит в глаза] Скажите прямо: да или нет?",
  "Это лишь ваше личное мнение.",
  "[перебивает] Стоп. Давайте по фактам.",
  "Я устал. Давайте закончим этот разговор.",
  "[наклоняется вперёд] У вас ровно 5 минут.",
];
const EVENTS = [
  { text:"🔔 Звонит телефон. Соперник берёт трубку: «Да, я через 10 минут». Возвращается: «Извините. Продолжим.»", effect:{pressure:-5} },
  { text:"🚪 В кабинет заглядывает человек: «О, я знаю этих... Они такое фуфло продают». Соперник: «Спасибо, я разберусь».", effect:{pressure:+15} },
  { text:"📄 Соперник достаёт документ: «Тут ваши конкуренты предложили на 10% меньше. Что скажете?»", effect:{pressure:+10} },
  { text:"☕ Соперник отвлекается на кофе. Молчит 3 секунды. У вас есть шанс взять инициативу.", effect:{pressure:-10} },
];

// ═══════════════════════════════════════════════════════════════
// СЦЕНАРИИ
// ═══════════════════════════════════════════════════════════════
const SCRIPTS = {
shark:[
  { line:"[смотрит на часы] У меня 15 минут. Ваши конкуренты дали 4,5 млн. Слушаю.", hint:"Он торопится. Что для него важно — цена или что-то другое?", choices:[
      { text:"Виктор, что для вас важнее в проекте — скорость внедрения или долгосрочная окупаемость? Мне важно понять ваш приоритет.", effects:{pressure:-8,deal:6,survival:6}, response:"[пауза] Окупаемость. Мне нужно понимать, когда я верну деньги." },
      { text:"Виктор, наша система окупается за 4 месяца. Это на 30% быстрее рынка. Вот цифры по вашему сектору.", effects:{pressure:-5,deal:10,survival:5}, response:"Быстрее рынка? На 30%? Покажите. У вас 5 минут." },
      { text:"Виктор, предлагаю сразу сравнить по трём параметрам: сроки, цена, гарантии. Могу дать таблицу по конкурентам.", effects:{pressure:0,deal:5,survival:3}, response:"Таблицу? Хорошо, давайте. Только по существу." },
      { text:"Виктор, дайте мне минуту — я сориентируюсь по вашему вопросу.", effects:{pressure:15,deal:-5,survival:-10}, response:"Минуту? У меня их нет. Говорите или уходите." },
    ]},
  { line:"Конкурент — 4,2 млн за 2 недели. Ваш срок — месяц. Почему я должен ждать?", hint:"Давление сроками. Он проверяет, сломаетесь ли вы.", choices:[
      { text:"Виктор, а что именно вы теряете за эти 2 недели? Если конкурент ошибётся — потери будут больше.", effects:{pressure:-10,deal:8,survival:8}, response:"Хм. Логично. Что предлагаете по срокам?" },
      { text:"Виктор, за 2 недели качественное внедрение невозможно. Я не готов рисковать вашим проектом ради скорости.", effects:{pressure:-8,deal:12,survival:8}, response:"Не готовы рисковать — это мне нравится. Продолжайте." },
      { text:"Виктор, давайте зафиксируем сроки в договоре с KPI. Если не уложимся — штраф. Так обе стороны защищены.", effects:{pressure:-3,deal:12,survival:6}, response:"Штраф? Хорошо. Мне нужны конкретные цифры." },
      { text:"Виктор, я не готов сейчас сравнивать по срокам — давайте вернёмся к ним после.", effects:{pressure:18,deal:-12,survival:-15}, response:"Не готовы? Тогда зачем мы вообще говорим?" },
    ]},
  { line:"[стучит пальцами по столу] Конкретно: 4,8 млн, эксклюзив 3 года. Иначе — не подпишу.", hint:"Он давит. Но что стоит за словом «эксклюзив»?", choices:[
      { text:"Виктор, а зачем вам эксклюзив? Это защита от конкурентов или обязательство для вас тоже?", effects:{pressure:-12,deal:10,survival:8}, response:"Чтобы мой отдел был единственным, кто работает с вами. Это моя ответственность." },
      { text:"Виктор, эксклюзив — это обоюдные обязательства. Если вы готовы зафиксировать объём на 3 года — я готов.", effects:{pressure:-5,deal:15,survival:8}, response:"Умно. Давайте так. Готовим документы." },
      { text:"Виктор, предлагаю эксклюзив по отрасли, но с исключением для смежных сфер. Это защитит ваши интересы.", effects:{pressure:-3,deal:10,survival:5}, response:"Уточните, что за исключения. Обсудим." },
      { text:"Виктор, мне нужно согласовать эксклюзив с руководством — это не моя зона.", effects:{pressure:20,deal:-15,survival:-12}, response:"Не ваша зона? Тогда зачем вы здесь?" },
    ]},
  { line:"А если я попрошу скидку 25%? Что вы сделаете?", hint:"Провокация. Проверка на прочность.", choices:[
      { text:"Виктор, что стоит за этой просьбой — проверка или реальное требование? Если требование — что взамен?", effects:{pressure:-15,deal:8,survival:12}, response:"[усмехается] Проверка. Вы держите удар. Уважаю." },
      { text:"Виктор, 25% — это несерьёзно. Если вы хотите торговаться — давайте о реальных цифрах.", effects:{pressure:-5,deal:8,survival:8}, response:"Согласен. Давайте о реальных." },
      { text:"Виктор, 25% скидка возможна при трёхлетнем контракте с оплатой год вперёд. Вот условия.", effects:{pressure:-2,deal:12,survival:6}, response:"Хорошо. Пришлите условия. Обсудим." },
      { text:"Виктор, 25% — очень много. Мне нужно подумать, что я могу предложить взамен.", effects:{pressure:15,deal:-10,survival:-12}, response:"Подумать? Пока думаете — я уйду к конкурентам." },
    ]},
  { line:"Последний вопрос. Почему я должен выбрать именно вас?", hint:"Финальный шанс. Одно предложение. Сильно.", choices:[
      { text:"Виктор, потому что я не обещаю больше, чем выполню. И я держу слово. Проверите — начнём с малого объёма.", effects:{pressure:-10,deal:18,survival:12}, response:"Хорошо сказано. Готовьте документы." },
      { text:"Виктор, потому что результат будет. Остальное — детали, которые мы решим по ходу.", effects:{pressure:-5,deal:15,survival:8}, response:"Лаконично. Мне нравится." },
      { text:"Виктор, три причины: технология, поддержка в РФ, лично я веду проект. Если нужно — проверим на пилоте.", effects:{pressure:-6,deal:16,survival:8}, response:"Пилот? Это разумно. Обсудим." },
      { text:"Виктор, у нас большой опыт и хорошая репутация.", effects:{pressure:15,deal:-10,survival:-12}, response:"Общие слова. Так не работает." },
    ]},
],
hawk:[
  { line:"[стучит кулаком по столу] У меня мало времени. Лучшая цена сейчас, или я иду к другим.", hint:"Атака. Не паникуйте.", choices:[
      { text:"Игорь, а что для вас важнее — цена или результат? Если результат — я покажу, как его обеспечим.", effects:{pressure:-12,deal:10,survival:10}, response:"Результат? Ну давай. Только быстро — что конкретно?" },
      { text:"Игорь, наша цена — лучшая. Другие просто не скажут вам правду. Хотите — сравним по фактам.", effects:{pressure:-5,deal:8,survival:8}, response:"Сравним. Только быстро. Минута." },
      { text:"Игорь, давайте по пунктам: цена, срок, гарантии. Я даю цифры — вы сравниваете.", effects:{pressure:-3,deal:10,survival:5}, response:"По пунктам. Хорошо. Начинай." },
      { text:"Игорь, дайте минуту подумать...", effects:{pressure:15,deal:-10,survival:-12}, response:"Думать? Времени нет. Говори или ухожу." },
    ]},
  { line:"Ты можешь дать 4,5 млн? Да или нет?", hint:"Не давайте «да/нет». Расширьте рамку.", choices:[
      { text:"Игорь, «да/нет» — не переговоры. Давайте я покажу, что входит в 4,5, и вы решите.", effects:{pressure:-12,deal:12,survival:10}, response:"Ладно, показывай. Не понравится — уйду." },
      { text:"Игорь, нет. 4,5 — ниже себестоимости. Но я готов показать, что можно за 4,8.", effects:{pressure:5,deal:-8,survival:-3}, response:"Угрожаешь? Ладно, показывай 4,8." },
      { text:"Игорь, давайте так: 4,5 — базовая комплектация, 4,8 — расширенная. Покажу разницу за 2 минуты.", effects:{pressure:-4,deal:10,survival:6}, response:"Хорошо. Показывай." },
      { text:"Игорь, я не готов ответить сразу — нужно уточнить у руководства.", effects:{pressure:18,deal:-12,survival:-12}, response:"Не готов? Тогда я не готов работать." },
    ]},
  { line:"[повышает голос] Слушай, ты понимаешь, с кем разговариваешь? Я тут решаю всё.", hint:"Угроза. Верните в деловое русло.", choices:[
      { text:"Игорь, понимаю. Давайте вернёмся к сделке. Что конкретно не устраивает в нашем предложении?", effects:{pressure:-15,deal:10,survival:15}, response:"Спокоен. Мне нравится. По делу." },
      { text:"Игорь, я знаю, с кем говорю. Именно поэтому предлагаю не тратить время на эмоции, а обсудить цифры.", effects:{pressure:-5,deal:8,survival:8}, response:"Жёстко. Хорошо. Давай цифры." },
      { text:"Игорь, давайте зафиксируем: цена, срок, гарантии. По каждому пункту — конкретное предложение.", effects:{pressure:-3,deal:10,survival:6}, response:"Идёт. Начинай." },
      { text:"Игорь, извините, я не хотел вас задеть...", effects:{pressure:20,deal:-12,survival:-18}, response:"Извинения? Ты слабак. Я не работаю со слабаками." },
    ]},
  { line:"Мне нужен персональный менеджер и поддержка 24/7. Иначе — сделки не будет.", hint:"Уточните, что он понимает под «24/7».", choices:[
      { text:"Игорь, давайте определим, что для вас «24/7». Критичные инциденты — да. Звонки в 3 ночи — фиксируем SLA.", effects:{pressure:-8,deal:14,survival:10}, response:"Логично. Фиксируем SLA. Готовь документы." },
      { text:"Игорь, 24/7 — нереально. Но я готов дать выделенного менеджера и поддержку в течение 1 часа.", effects:{pressure:5,deal:8,survival:5}, response:"Час? Приемлемо. Обсудим." },
      { text:"Игорь, три уровня поддержки: стандартная, расширенная, критичная. В расширенной — SLA 1 час днём, 4 часа ночью.", effects:{pressure:-4,deal:12,survival:8}, response:"Хорошо. Расширенная. Согласен." },
      { text:"Игорь, 24/7 нереально. Мы не можем этого гарантировать.", effects:{pressure:15,deal:-20,survival:-10}, response:"Не можете? Тогда не договоримся." },
    ]},
  { line:"Последний вопрос: почему я должен подписать именно с тобой?", hint:"Одна сильная фраза.", choices:[
      { text:"Игорь, потому что я буду держать ваш проект как свой. И вы это увидите через 3 недели.", effects:{pressure:-10,deal:20,survival:12}, response:"Хорошо. Готовь документы. Подписываю." },
      { text:"Игорь, потому что результат. Остальное — детали.", effects:{pressure:-5,deal:15,survival:8}, response:"Принято. Согласен." },
      { text:"Игорь, три причины: технология, поддержка, лично я веду проект. Проверим на пилоте.", effects:{pressure:-4,deal:16,survival:10}, response:"Пилот — разумно. Обсудим." },
      { text:"Игорь, ну, у нас хорошая репутация.", effects:{pressure:15,deal:-20,survival:-15}, response:"Репутация? Мне нужен результат." },
    ]},
],
bear:[
  { line:"[открывает папку, не смотрит на вас] Добрый день. Я изучил ваше предложение. Что в нём уникального?", hint:"«Уникальность» — не типичное слово для Медведя.", choices:[
      { text:"Сергей, что для вас «уникальное» в контексте проекта? Технология, команда, подход? Уточните критерий.", effects:{pressure:-10,deal:10,survival:10}, response:"Технология. И чтобы её видел совет директоров. Мне важно, как это выглядит." },
      { text:"Сергей, наше решение используют 3 компании из топ-100. Вот их отзывы. Можем организовать звонок с IT-директором.", effects:{pressure:-8,deal:12,survival:10}, response:"Звонок? Хорошо, организуйте. Это будет полезно." },
      { text:"Сергей, у нас 3 отличия: патентованная технология, сертификат ISO 27001, поддержка в РФ. По каждому — документация.", effects:{pressure:-5,deal:10,survival:6}, response:"Документацию пришлите. Изучу." },
      { text:"Сергей, мы не самые дешёвые, но качество выше. У нас есть скидки.", effects:{pressure:15,deal:-10,survival:-12}, response:"Скидки? Мне не нужны скидки. Мне нужна уникальность." },
    ]},
  { line:"Пункт 4.2 — сроки. У вас 30 дней, по регламенту — 21. Поясните.", hint:"Регламент — предлог. Что он на самом деле хочет?", choices:[
      { text:"Сергей, какой именно срок критичен — для вас лично или для тендерного комитета? Это разные вещи.", effects:{pressure:-12,deal:10,survival:12}, response:"Для меня. Мне нужно показать совету, что мы работаем быстро." },
      { text:"Сергей, мы готовы на 21 день, если увеличим команду до 5 инженеров. Стоимость +8%, но срок соблюдён.", effects:{pressure:-5,deal:14,survival:8}, response:"Команда больше — это заметно. Хорошо, обсудим." },
      { text:"Сергей, предлагаю зафиксировать срок 21 день с KPI и штрафом. Если не уложимся — компенсация.", effects:{pressure:-5,deal:12,survival:8}, response:"Штраф? Приемлемо. Обсудим цифры." },
      { text:"Сергей, у нас сложный продукт. 30 дней — обоснованный срок.", effects:{pressure:15,deal:-10,survival:-12}, response:"Обоснованный? Регламент не обсуждается." },
    ]},
  { line:"У нас внутренний конкурс. Конкурент дал цену на 10% ниже. Что скажете?", hint:"Не оправдывайтесь. Уточните факты.", choices:[
      { text:"Сергей, а что именно предлагает конкурент? Сроки, гарантии, команда? Сравним по фактам.", effects:{pressure:-10,deal:12,survival:10}, response:"Детали не помню. Но цена ниже. Может, скидку?" },
      { text:"Сергей, если критерий один — цена, мы не подходим. Мы конкурируем по результату, не по цене.", effects:{pressure:3,deal:-8,survival:5}, response:"Резко. Ладно, слушаю дальше." },
      { text:"Сергей, давайте сравним по 5 параметрам: цена, срок, гарантии, поддержка, кейсы. Я дам цифры.", effects:{pressure:-5,deal:14,survival:8}, response:"Хорошо. Давайте таблицу." },
      { text:"Сергей, мы не самые дешёвые, но качество выше...", effects:{pressure:15,deal:-10,survival:-12}, response:"«Качество выше» — не аргумент. Нужны цифры." },
    ]},
  { line:"По регламенту нам нужен ежеквартальный отчёт и аудит. Вы готовы?", hint:"Что за этим? Кто будет читать отчёт?", choices:[
      { text:"Сергей, а кто именно будет читать отчёт — вы, тендерный комитет или совет директоров? Формат от этого зависит.", effects:{pressure:-12,deal:14,survival:12}, response:"Совет директоров. Мне нужно, чтобы отчёт был презентабельным." },
      { text:"Сергей, готовы. Отчёт — стандартная форма, аудит за наш счёт. Можем даже расширить формат до ежемесячного.", effects:{pressure:-5,deal:12,survival:8}, response:"Ежемесячный? Хорошо. Это будет заметно." },
      { text:"Сергей, три формата отчёта: краткий, стандартный, расширенный. Расширенный включает графики и прогнозы.", effects:{pressure:-5,deal:14,survival:8}, response:"Расширенный. Пришлите образец." },
      { text:"Сергей, аудит — это доп. расходы. Мы не готовы на это.", effects:{pressure:18,deal:-25,survival:-10}, response:"Не готовы? Тогда не сможем работать." },
    ]},
  { line:"Последний вопрос: почему я должен выбрать вас, а не вашего конкурента?", hint:"Что важно ему лично?", choices:[
      { text:"Сергей, а что для вас лично — важнее всего в этом выборе? Технология, команда, отчёт для совета?", effects:{pressure:-12,deal:18,survival:14}, response:"Отчёт. Мне нужно, чтобы совет сказал: «Сергей выбрал лучших»." },
      { text:"Сергей, потому что с нами у вас будет отчёт, о котором узнает весь совет. Не просто выполнение — а победа.", effects:{pressure:-8,deal:20,survival:12}, response:"Победа? Мне это нравится. Готовьте документы." },
      { text:"Сергей, три причины: технология с патентами, отчёт для совета, лично я веду проект. Всё — с гарантиями.", effects:{pressure:-5,deal:16,survival:10}, response:"Хорошо. Присылайте документы." },
      { text:"Сергей, ну, у нас большой опыт и репутация.", effects:{pressure:15,deal:-15,survival:-12}, response:"Опыт? Мне нужны аргументы для совета." },
    ]},
],
spider:[
  { line:"[мягко улыбается] Здравствуйте! Как хорошо, что нашли время. Расскажите, что вас привело к нам?", hint:"Что она хочет услышать — про вас или про себя?", choices:[
      { text:"Анна, спасибо. Прежде чем расскажу — какие задачи вы сейчас решаете? Что для вас приоритет?", effects:{pressure:-10,deal:10,survival:10}, response:"О, у нас несколько задач... Но давайте сначала о вас." },
      { text:"Анна, мы пришли, потому что у нас есть решение, которое используют лидеры рынка. Готовы показать кейсы.", effects:{pressure:-5,deal:8,survival:5}, response:"Лидеры рынка? Как интересно. Какие именно?" },
      { text:"Анна, у нас 3 направления: автоматизация, аналитика, интеграция. Каждое решает конкретную задачу. Что ближе вам?", effects:{pressure:-3,deal:10,survival:6}, response:"Аналитика. Расскажите подробнее." },
      { text:"Анна, у нас есть несколько причин... с чего начать, не знаю.", effects:{pressure:12,deal:-8,survival:-10}, response:"Вы не уверены? Может, вам нужно время подумать?" },
    ]},
  { line:"У нас есть конкурент с похожим решением, но дешевле. Что скажете?", hint:"Не оправдывайтесь. Уточните факты.", choices:[
      { text:"Анна, а что именно предлагает конкурент? Условия, сроки, гарантии? Давайте сравним по фактам.", effects:{pressure:-12,deal:12,survival:10}, response:"Ой, я не помню детали... Но цена ниже. Может, скидку?" },
      { text:"Анна, если цена — единственный критерий, мы не подходим. Мы работаем по другому принципу.", effects:{pressure:3,deal:-10,survival:-3}, response:"Ой, не надо резко! Я просто спросила." },
      { text:"Анна, давайте зафиксируем: что входит в их цену, что в нашу. Сравним по 5 параметрам.", effects:{pressure:-5,deal:14,survival:8}, response:"Хорошо. Давайте сравним." },
      { text:"Анна, мы не самые дешёвые, но качество выше...", effects:{pressure:15,deal:-10,survival:-12}, response:"Да, но цена важна. Может, скидку?" },
    ]},
  { line:"А давайте без договора, на доверии? Так быстрее. Вы же мне доверяете?", hint:"Мягкое предложение с подвохом.", choices:[
      { text:"Анна, доверие важно. Но скажите честно — без договора вы чувствуете себя комфортнее?", effects:{pressure:-10,deal:12,survival:12}, response:"Ну, да. Мне так спокойнее. Я не люблю бумажную волокиту." },
      { text:"Анна, без договора мы не работаем. Но готовы упростить процедуру — типовой договор за 1 день.", effects:{pressure:5,deal:5,survival:5}, response:"Упростить? Хорошо, давайте посмотрим." },
      { text:"Анна, давайте так: сначала рамочный договор на 2 страницы, потом уточнения по мере необходимости.", effects:{pressure:-5,deal:12,survival:8}, response:"2 страницы? Это приемлемо. Давайте." },
      { text:"Анна, без договора мы не можем. Это небезопасно.", effects:{pressure:12,deal:-12,survival:-8}, response:"Небезопасно? Ну как хотите." },
    ]},
  { line:"У меня подруга в вашей отрасли. Она сказала, вы недавно потеряли крупного клиента. Правда?", hint:"Не оправдывайтесь. Уточните источник.", choices:[
      { text:"Анна, а что именно она сказала? Мне важно понять, о чём речь, чтобы ответить честно.", effects:{pressure:-10,deal:12,survival:12}, response:"Ну, она сказала, что у вас был конфликт с клиентом. Что случилось?" },
      { text:"Анна, это было 2 года назад. Кейс закрыт. Хотите — дам контакты самого клиента.", effects:{pressure:-5,deal:10,survival:8}, response:"Контакты? Давайте. Проверю." },
      { text:"Анна, у нас было 2 сложных кейса за 5 лет. Оба решены. Могу дать документальное подтверждение.", effects:{pressure:-5,deal:12,survival:10}, response:"Документально — хорошо. Пришлите." },
      { text:"Анна, я не знаю о чём речь. Наверное, это ошибка.", effects:{pressure:15,deal:-10,survival:-12}, response:"Не знаете? Странно. Она была уверена." },
    ]},
  { line:"Последний вопрос: почему я должна выбрать именно вас?", hint:"Что важно ей лично?", choices:[
      { text:"Анна, а что для вас лично — важно в этом выборе? Чтобы было спокойно? Престижно? Выгодно?", effects:{pressure:-12,deal:18,survival:14}, response:"Чтобы спокойно. Я не хочу потом разгребать. Если вы это обеспечите — я с вами." },
      { text:"Анна, потому что с нами вам не придётся ни о чём беспокоиться. Мы ведём всё — от начала до конца.", effects:{pressure:-8,deal:18,survival:12}, response:"Не беспокоиться? Мне это нравится. Готовьте документы." },
      { text:"Анна, три причины: технология, поддержка, личный менеджер. Плюс — отчёт для руководства, который заметят.", effects:{pressure:-5,deal:16,survival:10}, response:"Отчёт, который заметят? Да, важно. Присылайте документы." },
      { text:"Анна, ну, у нас хорошая репутация и опыт.", effects:{pressure:15,deal:-15,survival:-12}, response:"Репутация? Мне нужно, чтобы было удобно." },
    ]},
],
};

// ═══════════════════════════════════════════════════════════════
// СОСТОЯНИЕ
// ═══════════════════════════════════════════════════════════════
const state = {
  opponentType:null, motive:null,
  pressure:50, deal:10, survival:100,
  round:0, timer:null, timeLeft:40, gameOver:false,
  hintsLeft:3, hintsUsed:0,
  rounds:[],
  guessedType:null, guessedMotive:null,
  typeCorrect:false, motiveCorrect:false,
  aiMode:false, aiHistory:[],
  session:null,
};

// ═══════════════════════════════════════════════════════════════
// ЭКРАНЫ
// ═══════════════════════════════════════════════════════════════
const screens = {
  auth:document.getElementById("auth-screen"),
  theory:document.getElementById("theory-screen"),
  game:document.getElementById("game-screen"),
  guess:document.getElementById("guess-screen"),
  result:document.getElementById("result-screen"),
  admin:document.getElementById("admin-screen"),
};
function showScreen(n){
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  if(screens[n]) screens[n].classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}

// ═══════════════════════════════════════════════════════════════
// АВТОРИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════
function checkAuth(){
  const session=Auth.getSession();
  if(session){
    state.session=session;
    applySession();
    showScreen("theory");
  } else {
    showScreen("auth");
  }
}

function applySession(){
  const infoEl=document.getElementById("access-info");
  if(!infoEl) return;
  if(state.session.isAdmin){
    infoEl.textContent="🛡 Доступ администратора · бессрочно";
    document.getElementById("open-admin-btn").classList.remove("hidden");
  } else {
    const daysLeft=Math.max(0,Math.ceil((state.session.expiresAt - Date.now())/(1000*60*60*24)));
    infoEl.textContent=`🔓 Доступ активен · осталось ${daysLeft} дн.`;
    document.getElementById("open-admin-btn").classList.add("hidden");
  }
}

document.getElementById("auth-submit").addEventListener("click",()=>{
  const input=document.getElementById("auth-password").value.trim();
  const errorEl=document.getElementById("auth-error");
  if(!input){errorEl.textContent="Введите пароль";return;}
  const entry=Auth.checkPassword(input);
  if(!entry){
    errorEl.textContent="❌ Неверный пароль";
    document.getElementById("auth-password").value="";
    return;
  }
  const session=Auth.startSession(entry);
  state.session=session;
  errorEl.textContent="";
  document.getElementById("auth-password").value="";
  applySession();
  showScreen("theory");
});

document.getElementById("auth-password").addEventListener("keydown",(e)=>{
  if(e.key==="Enter") document.getElementById("auth-submit").click();
});

document.getElementById("logout-btn").addEventListener("click",()=>{
  if(!confirm("Выйти из тренажёра?")) return;
  Auth.endSession();
  state.session=null;
  showScreen("auth");
});

// ═══════════════════════════════════════════════════════════════
// АДМИН-ПАНЕЛЬ
// ═══════════════════════════════════════════════════════════════
document.getElementById("open-admin-btn").addEventListener("click",()=>{
  if(!state.session || !state.session.isAdmin) return;
  renderAdminPanel();
  showScreen("admin");
});

document.getElementById("admin-back-btn").addEventListener("click",()=>{
  showScreen("theory");
});

function renderAdminPanel(){
  const tbody=document.getElementById("admin-pass-tbody");
  const passwords=Auth.getPasswords();
  const adminPass=Auth.getAdminPass();
  tbody.innerHTML="";
  Object.keys(passwords).forEach(pass=>{
    const entry=passwords[pass];
    const tr=document.createElement("tr");
    const passDisplay=pass.length>4 ? pass.slice(0,3)+"***" : pass;
    tr.innerHTML=`
      <td>${passDisplay}</td>
      <td>${entry.days} дн.</td>
      <td>
        <div class="admin-row-actions">
          <button class="mini-btn" data-copy="${pass}">📋 Копировать</button>
          <button class="mini-btn danger" data-delete="${pass}">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  const trAdmin=document.createElement("tr");
  trAdmin.innerHTML=`
    <td>${adminPass.length>4 ? adminPass.slice(0,3)+"***" : adminPass} (админ)</td>
    <td>∞</td>
    <td><button class="mini-btn" data-copy="${adminPass}">📋 Копировать</button></td>
  `;
  tbody.appendChild(trAdmin);

  tbody.querySelectorAll("[data-copy]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      navigator.clipboard.writeText(btn.dataset.copy).then(()=>{
        btn.textContent="✅ Скопировано";
        setTimeout(()=>btn.textContent="📋 Копировать",1500);
      });
    });
  });
  tbody.querySelectorAll("[data-delete]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(!confirm("Удалить пароль "+btn.dataset.delete+"?")) return;
      Auth.deletePassword(btn.dataset.delete);
      renderAdminPanel();
    });
  });
}

document.getElementById("create-pass-btn").addEventListener("click",()=>{
  const pass=document.getElementById("new-pass-input").value.trim();
  const days=parseInt(document.getElementById("new-pass-days").value);
  const msg=document.getElementById("create-pass-msg");
  if(!pass || pass.length<3){msg.style.color="#ff5c5c";msg.textContent="Пароль слишком короткий (мин. 3 символа)";return;}
  if(!days || days<1){msg.style.color="#ff5c5c";msg.textContent="Укажите срок в днях (мин. 1)";return;}
  Auth.createPassword(pass, days);
  msg.style.color="#4ade80";
  msg.textContent=`✅ Пароль «${pass}» создан на ${days} дн.`;
  document.getElementById("new-pass-input").value="";
  document.getElementById("new-pass-days").value="";
  renderAdminPanel();
  setTimeout(()=>msg.textContent="",3000);
});

document.getElementById("change-admin-btn").addEventListener("click",()=>{
  const newPass=document.getElementById("new-admin-pass").value.trim();
  const msg=document.getElementById("admin-pass-msg");
  if(!newPass || newPass.length<4){msg.style.color="#ff5c5c";msg.textContent="Минимум 4 символа";return;}
  if(!confirm("Сменить пароль админа на «"+newPass+"»? Старый перестанет работать.")) return;
  Auth.setAdminPass(newPass);
  msg.style.color="#4ade80";
  msg.textContent="✅ Пароль админа изменён";
  document.getElementById("new-admin-pass").value="";
  renderAdminPanel();
  setTimeout(()=>msg.textContent="",3000);
});

document.getElementById("reset-admin-btn").addEventListener("click",()=>{
  if(!confirm("Сбросить ВСЕ пароли и вернуть заводские? Текущая сессия тоже завершится.")) return;
  Auth.resetAll();
  state.session=null;
  showScreen("auth");
});

// ═══════════════════════════════════════════════════════════════
// ИГРА
// ═══════════════════════════════════════════════════════════════
document.getElementById("start-btn").addEventListener("click",startGame);

function startGame(){
  const types=Object.keys(OPPONENT_TYPES);
  const motives=Object.keys(MOTIVES);
  state.opponentType=types[Math.floor(Math.random()*types.length)];
  state.motive=motives[Math.floor(Math.random()*motives.length)];
  state.rounds=[...SCRIPTS[state.opponentType]];
  state.pressure=50;
  state.deal=10;
  state.survival=100;
  state.round=0;
  state.gameOver=false;
  state.hintsLeft=3;
  state.hintsUsed=0;
  state.guessedType=null;
  state.guessedMotive=null;
  state.typeCorrect=false;
  state.motiveCorrect=false;
  state.aiMode=false;
  state.aiHistory=[];
  document.getElementById("dialog").innerHTML="";
  document.getElementById("hint-content").classList.add("hidden");
  document.getElementById("ai-block").classList.add("hidden");
  document.getElementById("ai-input").value="";
  document.getElementById("ai-toggle-btn").classList.remove("active");
  document.getElementById("hints-left").textContent=state.hintsLeft;
  document.getElementById("round-num").textContent="1";
  document.getElementById("opp-icon").textContent="❓";
  document.getElementById("opp-name").textContent="Неизвестный соперник";
  updateStats();
  showScreen("game");
  renderRound(0);
  startTimer();
}

function startTimer(){
  clearInterval(state.timer);
  state.timeLeft=40;
  updateTimerDisplay();
  state.timer=setInterval(()=>{
    state.timeLeft--;
    updateTimerDisplay();
    if(state.timeLeft===15){appendDialog("⏰ Соперник: Время идёт. Я жду.","system-msg")}
    if(state.timeLeft<=5 && state.timeLeft>0){appendDialog("🔥 Соперник: "+state.timeLeft+" секунд.","system-msg")}
    if(state.timeLeft<=0){clearInterval(state.timer);handleTimeout()}
  },1000);
}
function updateTimerDisplay(){
  const pct=state.timeLeft/40;
  const t=document.getElementById("timer");
  t.textContent="00:"+String(state.timeLeft).padStart(2,"0");
  t.classList.remove("warning","danger");
  if(pct<=.33) t.classList.add("danger");
  else if(pct<=.66) t.classList.add("warning");
}
function handleTimeout(){
  if(state.gameOver) return;
  state.pressure=Math.min(100,state.pressure+15);
  state.survival=Math.max(0,state.survival-10);
  updateStats();
  appendDialog("⏰ Время вышло. Соперник воспринял это как слабость.","system-msg");
  if(state.survival<=0){endGame("lose","Вы потеряли контроль.");return}
  nextRound();
}

function renderRound(idx){
  const round=state.rounds[idx];
  if(!round){endGame("win","Вы прошли все раунды!");return}
  document.getElementById("round-num").textContent=(idx+1);
  appendDialog(round.line,"opponent");
  if(idx>0 && idx<state.rounds.length-1 && Math.random()<0.3){
    const ev=EVENTS[Math.floor(Math.random()*EVENTS.length)];
    appendDialog(ev.text,"event-msg");
    state.pressure=Math.max(0,Math.min(100,state.pressure+(ev.effect.pressure||0)));
    updateStats();
  }
  document.getElementById("hint-content").classList.add("hidden");
  document.getElementById("hint-content").textContent=round.hint;
  const choicesEl=document.getElementById("choices");
  choicesEl.innerHTML="";
  let choices=[...round.choices].sort(()=>Math.random()-0.5);
  const letters=["A","B","C","D"];
  choices.forEach((c,i)=>{
    const btn=document.createElement("button");
    btn.className="choice-btn";
    btn.innerHTML=`<span class="choice-letter">${letters[i]}</span><span>${c.text}</span>`;
    btn.addEventListener("click",()=>handleChoice(c));
    choicesEl.appendChild(btn);
  });
}

function appendDialog(text,type){
  const div=document.createElement("div");
  if(type==="opponent"){div.innerHTML=`<span class="speaker">❓ Соперник:</span> ${text}`}
  else if(type==="player"){div.innerHTML=`<span class="player-reply">💼 Вы:</span> ${text}`}
  else if(type==="event-msg"){div.innerHTML=`<span class="event-msg">🎲 ${text}</span>`}
  else if(type==="ai-reply"){div.innerHTML=`<span class="ai-reply">🎤 AI-ответ:</span> ${text}`}
  else{div.innerHTML=`<span class="system-msg">${text}</span>`}
  const dialog=document.getElementById("dialog");
  dialog.appendChild(div);
  dialog.scrollTop=dialog.scrollHeight;
}

function handleChoice(choice){
  if(state.gameOver) return;
  clearInterval(state.timer);
  appendDialog(choice.text,"player");
  state.aiHistory.push({role:"user",content:choice.text});
  state.pressure=Math.max(0,Math.min(100,state.pressure+(choice.effects.pressure||0)));
  state.deal=Math.max(0,Math.min(100,state.deal+(choice.effects.deal||0)));
  state.survival=Math.max(0,Math.min(100,state.survival+(choice.effects.survival||0)));
  updateStats();
  if(state.survival<=0){setTimeout(()=>endGame("lose","Вы не выдержали давления."),700);return}
  let response=choice.response;
  if(Math.random()<0.5){
    const manip=MANIPULATIONS[Math.floor(Math.random()*MANIPULATIONS.length)];
    response+=" "+manip;
  }
  state.aiHistory.push({role:"assistant",content:response});
  setTimeout(()=>{
    appendDialog(response,"opponent");
    setTimeout(()=>{
      state.round++;
      if(state.round>=state.rounds.length){endGame("win","Вы прошли все раунды!")}
      else{renderRound(state.round);startTimer()}
    },1200);
  },700);
}

function nextRound(){
  state.round++;
  if(state.round>=state.rounds.length){endGame("win","Вы прошли все раунды!")}
  else{renderRound(state.round);startTimer()}
}

function updateStats(){
  document.getElementById("pressure-bar").style.width=state.pressure+"%";
  document.getElementById("deal-bar").style.width=state.deal+"%";
  document.getElementById("survival-bar").style.width=state.survival+"%";
}

// ═══════════════════════════════════════════════════════════════
// AI
// ═══════════════════════════════════════════════════════════════
function buildAIPrompt(playerReply){
  const typeDesc=TYPE_PROMPTS[state.opponentType];
  const motiveDesc={
    economy:"Мотив — ЭКОНОМИЯ: тебе важна выгода, скидки, лучшая цена.",
    safety:"Мотив — БЕЗОПАСНОСТЬ: тебе важны гарантии, стабильность, чтобы не рисковать.",
    prestige:"Мотив — ПРЕСТИЖ: тебе важно быть «лучшим», показать руководству, статус.",
    comfort:"Мотив — КОМФОРТ: тебе важно удобство, простота, чтобы никто не трогал.",
  }[state.motive];
  const historyStr=state.aiHistory.slice(-6).map(h=>`${h.role==="user"?"Продавец":"Ты"}: ${h.content}`).join("\n");
  return `${typeDesc}
${motiveDesc}

Текущее давление: ${state.pressure}/100. Прогресс сделки: ${state.deal}/100. Выживание продавца: ${state.survival}/100.

${historyStr}
Продавец: ${playerReply}

Ответь как этот переговорщик на последнюю реплику. Коротко (1-3 предложения). На русском. Не поясняй. Если давление >70 — угрожай уйти. Если <30 — уважай продавца.`;
}

async function sendToAI(playerReply){
  try {
    const res=await fetch(HF_URL,{
      method:"POST",
      headers:{"Authorization":`Bearer ${HF_TOKEN}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:HF_MODEL,
        messages:[{role:"user",content:buildAIPrompt(playerReply)}],
        max_tokens:150,
        temperature:0.8,
      })
    });
    if(!res.ok){console.error("HF error:",await res.text());return null}
    const data=await res.json();
    if(data.choices && data.choices[0]) return data.choices[0].message.content.trim();
    return null;
  } catch(e){console.error("AI fetch error:",e);return null}
}

// ═══════════════════════════════════════════════════════════════
// ГОЛОСОВОЙ ВВОД
// ═══════════════════════════════════════════════════════════════
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition=null;
let isRecording=false;

if(SpeechRecognition){
  recognition=new SpeechRecognition();
  recognition.lang="ru-RU";
  recognition.continuous=true;
  recognition.interimResults=true;

  recognition.onresult=(event)=>{
    let finalTranscript="";
    for(let i=event.resultIndex; i<event.results.length; i++){
      const transcript=event.results[i][0].transcript;
      if(event.results[i].isFinal) finalTranscript+=transcript+" ";
    }
    const input=document.getElementById("ai-input");
    if(finalTranscript){
      input.value=(input.value+" "+finalTranscript).trim();
    }
  };

  recognition.onerror=(e)=>{console.error("Speech error:",e.error);stopRecording();};
  recognition.onend=()=>{
    if(isRecording){
      try{recognition.start();}catch(e){stopRecording();}
    }
  };
}

function startRecording(){
  if(!recognition){
    alert("Голосовой ввод не поддерживается вашим браузером. Используйте Chrome, Edge или Yandex.Browser.");
    return;
  }
  try{
    recognition.start();
    isRecording=true;
    document.getElementById("mic-btn").classList.add("recording");
  }catch(e){console.error(e);}
}

function stopRecording(){
  isRecording=false;
  document.getElementById("mic-btn").classList.remove("recording");
  try{recognition && recognition.stop();}catch(e){}
}

document.getElementById("mic-btn").addEventListener("click",()=>{
  if(isRecording) stopRecording();
  else startRecording();
});

// ═══════════════════════════════════════════════════════════════
// AI UI
// ═══════════════════════════════════════════════════════════════
document.getElementById("ai-toggle-btn").addEventListener("click",()=>{
  if(state.gameOver) return;
  state.aiMode=!state.aiMode;
  const block=document.getElementById("ai-block");
  const btn=document.getElementById("ai-toggle-btn");
  if(state.aiMode){
    block.classList.remove("hidden");
    btn.classList.add("active");
    document.getElementById("ai-input").focus();
  } else {
    block.classList.add("hidden");
    btn.classList.remove("active");
    stopRecording();
  }
});

document.getElementById("ai-cancel-btn").addEventListener("click",()=>{
  state.aiMode=false;
  document.getElementById("ai-block").classList.add("hidden");
  document.getElementById("ai-toggle-btn").classList.remove("active");
  stopRecording();
});

document.getElementById("ai-send-btn").addEventListener("click",async()=>{
  if(state.gameOver) return;
  stopRecording();
  const input=document.getElementById("ai-input");
  const text=input.value.trim();
  if(!text) return;
  clearInterval(state.timer);
  appendDialog(text,"player");
  state.aiHistory.push({role:"user",content:text});
  input.value="";
  input.disabled=true;
  document.getElementById("ai-send-btn").disabled=true;
  document.getElementById("mic-btn").disabled=true;
  const loading=document.createElement("div");
  loading.className="loading-indicator";
  loading.textContent="AI-соперник думает...";
  document.getElementById("dialog").appendChild(loading);
  document.getElementById("dialog").scrollTop=999999;
  const aiReply=await sendToAI(text);
  loading.remove();
  input.disabled=false;
  document.getElementById("ai-send-btn").disabled=false;
  document.getElementById("mic-btn").disabled=false;
  const finalReply=aiReply || "[соперник отвлёкся] Извините, продолжим. Что вы говорили?";
  appendDialog(finalReply,"ai-reply");
  state.aiHistory.push({role:"assistant",content:finalReply});
  applyAILogic(text);
  setTimeout(()=>{
    state.round++;
    if(state.round>=state.rounds.length){endGame("win","Вы прошли все раунды!")}
    else{renderRound(state.round);startTimer()}
  },1400);
});

function applyAILogic(playerText){
  const lower=playerText.toLowerCase();
  let dP=0,dD=0,dS=0;
  if(lower.match(/\?$/)) { dD+=6; dP-=5; }
  if(lower.match(/(что если|а что|почему|зачем|как вы|расскажите)/)) { dD+=8; dP-=8; }
  if(lower.match(/(давайте зафиксируем|по пунктам|цифры|конкретн)/)) { dD+=10; dP-=6; }
  if(lower.match(/(да|хорошо|конечно|согласен)[.!,]/)) { dP+=10; dD-=3; dS-=5; }
  if(lower.match(/(скидк|дешевл|ниже цены|уступ)/)) { dP+=12; dD-=5; dS-=8; }
  if(lower.match(/(извин|простите|виноват)/)) { dP+=15; dS-=10; }
  if(lower.match(/(не могу|не готов|не уверен)/)) { dP+=8; dS-=6; }
  state.pressure=Math.max(0,Math.min(100,state.pressure+dP));
  state.deal=Math.max(0,Math.min(100,state.deal+dD));
  state.survival=Math.max(0,Math.min(100,state.survival+dS));
  updateStats();
  if(state.survival<=0){setTimeout(()=>endGame("lose","Вы не выдержали давления."),700)}
}

// ═══════════════════════════════════════════════════════════════
// ПОДСКАЗКА
// ═══════════════════════════════════════════════════════════════
document.getElementById("hint-btn").addEventListener("click",()=>{
  if(state.gameOver) return;
  if(state.hintsLeft<=0){
    document.getElementById("hint-content").classList.remove("hidden");
    document.getElementById("hint-content").textContent="❌ Подсказки закончились.";
    return;
  }
  state.hintsLeft--;
  state.hintsUsed++;
  document.getElementById("hints-left").textContent=state.hintsLeft;
  const round=state.rounds[state.round];
  document.getElementById("hint-content").textContent=round.hint;
  document.getElementById("hint-content").classList.remove("hidden");
});

// ═══════════════════════════════════════════════════════════════
// ФИНАЛ
// ═══════════════════════════════════════════════════════════════
function endGame(outcome,message){
  state.gameOver=true;
  clearInterval(state.timer);
  stopRecording();
  document.getElementById("choices").innerHTML="";
  document.getElementById("ai-block").classList.add("hidden");
  if(outcome==="lose"){showResult(outcome,message);return}
  const typeGrid=document.getElementById("type-guess-grid");
  typeGrid.innerHTML="";
  Object.keys(OPPONENT_TYPES).forEach(key=>{
    const b=document.createElement("button");
    b.className="guess-btn";
    b.innerHTML=`${OPPONENT_TYPES[key].icon} ${OPPONENT_TYPES[key].name}`;
    b.addEventListener("click",()=>checkType(key,b));
    typeGrid.appendChild(b);
  });
  document.getElementById("motive-block").classList.add("hidden");
  document.getElementById("guess-result").classList.add("hidden");
  showScreen("guess");
}

function checkType(key,btn){
  document.querySelectorAll("#type-guess-grid .guess-btn").forEach(b=>b.disabled=true);
  state.guessedType=key;
  state.typeCorrect=(key===state.opponentType);
  btn.classList.add(state.typeCorrect?"correct":"wrong");
  const motiveGrid=document.getElementById("motive-guess-grid");
  motiveGrid.innerHTML="";
  Object.keys(MOTIVES).forEach(m=>{
    const b=document.createElement("button");
    b.className="guess-btn";
    b.innerHTML=`${MOTIVES[m].icon} ${MOTIVES[m].name}`;
    b.addEventListener("click",()=>checkMotive(m,b));
    motiveGrid.appendChild(b);
  });
  document.getElementById("motive-block").classList.remove("hidden");
}

function checkMotive(key,btn){
  document.querySelectorAll("#motive-guess-grid .guess-btn").forEach(b=>b.disabled=true);
  state.guessedMotive=key;
  state.motiveCorrect=(key===state.motive);
  btn.classList.add(state.motiveCorrect?"correct":"wrong");
  const t=OPPONENT_TYPES[state.opponentType];
  const m=MOTIVES[state.motive];
  let result="";
  result+=`<div style="margin-bottom:8px"><b>Типаж:</b> ${state.typeCorrect?"✅ Угадали":"❌ Не угадали"} — это был ${t.icon} ${t.name}.<br><span style="color:#8899aa;font-size:.9em">${t.hint}</span></div>`;
  result+=`<div><b>Мотив:</b> ${state.motiveCorrect?"✅ Угадали":"❌ Не угадали"} — это был ${m.icon} ${m.name}.<br><span style="color:#8899aa;font-size:.9em">${m.hint}</span></div>`;
  document.getElementById("guess-result").innerHTML=result;
  document.getElementById("guess-result").classList.remove("hidden");
  if(state.typeCorrect) state.deal=Math.min(100,state.deal+10);
  else state.deal=Math.max(0,state.deal-5);
  if(state.motiveCorrect) state.deal=Math.min(100,state.deal+15);
  else state.deal=Math.max(0,state.deal-10);
  setTimeout(()=>showResult("win","Вы прошли переговоры!"),4000);
}

function showResult(outcome,message){
  const baseScore=(state.deal*0.4)+(state.survival*0.4)+((100-state.pressure)*0.2);
  const hintPenalty=state.hintsUsed*5;
  const finalScore=Math.max(0,Math.round(baseScore-hintPenalty));
  const icons={win:"🏆",lose:"💀"};
  const titles={win:"Победа!",lose:"Поражение"};
  document.getElementById("result-icon").textContent=icons[outcome]||"🏆";
  document.getElementById("result-title").textContent=titles[outcome]||"Результат";
  document.getElementById("result-subtitle").textContent=message+` Итоговый балл: ${finalScore}/100.`;
  document.getElementById("result-stats").innerHTML=`
    <div class="result-stat"><div class="result-stat-label">Давление</div><div class="result-stat-value pressure">${Math.round(state.pressure)}</div></div>
    <div class="result-stat"><div class="result-stat-label">Прогресс</div><div class="result-stat-value deal">${Math.round(state.deal)}</div></div>
    <div class="result-stat"><div class="result-stat-label">Выживание</div><div class="result-stat-value survival">${Math.round(state.survival)}</div></div>
  `;
  const t=OPPONENT_TYPES[state.opponentType];
  const m=MOTIVES[state.motive];
  document.getElementById("analysis-content").innerHTML=`
    <div class="analysis-item neutral"><span class="label">📊 База:</span> ${Math.round(baseScore)}/100</div>
    <div class="analysis-item ${hintPenalty>0?"bad":"good"}"><span class="label">💡 Подсказки:</span> ${state.hintsUsed} (−${hintPenalty})</div>
    <div class="analysis-item ${state.typeCorrect?"good":"bad"}"><span class="label">🎭 Типаж:</span> ${state.typeCorrect?"✅":"❌"} — ${t.icon} ${t.name}</div>
    <div class="analysis-item ${state.motiveCorrect?"good":"bad"}"><span class="label">💰 Мотив:</span> ${state.motiveCorrect?"✅":"❌"} — ${m.icon} ${m.name}</div>
    <div class="analysis-item ${finalScore>=70?"good":finalScore>=40?"neutral":"bad"}"><span class="label">🎯 Итог:</span> ${finalScore}/100</div>
  `;
  showScreen("result");
}

// ═══════════════════════════════════════════════════════════════
// КНОПКИ
// ═══════════════════════════════════════════════════════════════
document.getElementById("play-again-btn").addEventListener("click",startGame);
document.getElementById("back-to-theory").addEventListener("click",()=>{clearInterval(state.timer);state.gameOver=true;showScreen("theory")});
document.getElementById("home-btn").addEventListener("click",()=>{clearInterval(state.timer);stopRecording();state.gameOver=true;showScreen("theory")});
document.getElementById("restart-btn").addEventListener("click",()=>{stopRecording();startGame()});

// ═══════════════════════════════════════════════════════════════
// СТАРТ
// ═══════════════════════════════════════════════════════════════
checkAuth();