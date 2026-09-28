const fs = require("fs");
const readline = require("readline");
const P = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const { SESSION_DIR } = require("./config");
const { findPaperOnSite } = require("./scraper");

const logger = P({ level: "silent" });

// ================================
// USER STATES
// ================================

const userStates = new Map();

function createState() {
  return {
    step: "main",
    exam: "",
    stream: "",
    medium: "",
    subject: "",
    year: ""
  };
}

// ================================
// TERMINAL INPUT
// ================================

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ================================
// MAIN MENU
// ================================

function mainMenu() {
  return [
    "📚 *PASTPAPER PRO*",
    "",
    "Paper එකක් ලබාගැනීමට option එකක් තෝරන්න:",
    "",
    "1️⃣ O/L Papers",
    "2️⃣ A/L Papers",
    "3️⃣ Search Paper",
    "4️⃣ Help",
    "",
    "0️⃣ Exit",
    "",
    "👉 Number එකක් reply කරන්න"
  ].join("\n");
}

// ================================
// O/L MENU
// ================================

function olMenu() {
  return [
    "📘 *O/L PAPERS*",
    "",
    "Medium එක තෝරන්න:",
    "",
    "1️⃣ Sinhala Medium",
    "2️⃣ English Medium",
    "3️⃣ Tamil Medium",
    "",
    "0️⃣ Back"
  ].join("\n");
}

// ================================
// A/L STREAM MENU
// ================================

function alStreamMenu() {
  return [
    "📕 *A/L PAPERS*",
    "",
    "Stream එක තෝරන්න:",
    "",
    "1️⃣ Arts",
    "2️⃣ Commerce",
    "3️⃣ Science",
    "4️⃣ Technology",
    "5️⃣ Mathematics",
    "",
    "0️⃣ Back"
  ].join("\n");
}

// ================================
// MEDIUM MENU
// ================================

function mediumMenu(exam, stream = "") {
  return [
    `📚 *${exam} PAPERS*`,
    stream ? `\n📂 Stream: ${stream}` : "",
    "",
    "Medium එක තෝරන්න:",
    "",
    "1️⃣ Sinhala Medium",
    "2️⃣ English Medium",
    "3️⃣ Tamil Medium",
    "",
    "0️⃣ Back"
  ].join("\n");
}

// ================================
// O/L SUBJECT MENU
// ================================

function olSubjectMenu() {
  return [
    "📘 *O/L SUBJECTS*",
    "",
    "1️⃣ Mathematics",
    "2️⃣ Science",
    "3️⃣ ICT",
    "4️⃣ English",
    "5️⃣ Sinhala",
    "6️⃣ Buddhism",
    "7️⃣ History",
    "8️⃣ Geography",
    "9️⃣ Health",
    "🔟 Art",
    "",
    "0️⃣ Back"
  ].join("\n");
}

// ================================
// A/L SUBJECT MENU
// ================================

function alSubjectMenu(stream) {
  const subjects = {
    Arts: [
      "Logic",
      "Sinhala",
      "Political Science",
      "Geography",
      "History",
      "Buddhism"
    ],

    Commerce: [
      "Accounting",
      "Business Studies",
      "Economics",
      "ICT"
    ],

    Science: [
      "Physics",
      "Chemistry",
      "Biology",
      "ICT"
    ],

    Technology: [
      "Science for Technology",
      "Engineering Technology",
      "Bio Systems Technology",
      "ICT"
    ],

    Mathematics: [
      "Combined Mathematics",
      "Physics",
      "Chemistry",
      "ICT"
    ]
  };

  const list = subjects[stream] || [];

  const lines = [
    `📕 *A/L ${stream.toUpperCase()} SUBJECTS*`,
    "",
    "Subject එක තෝරන්න:",
    ""
  ];

  list.forEach((subject, index) => {
    lines.push(`${index + 1}️⃣ ${subject}`);
  });

  lines.push("");
  lines.push("0️⃣ Back");

  return lines.join("\n");
}

// ================================
// YEAR MENU
// ================================

function yearMenu() {
  return [
    "📅 *YEAR SELECT*",
    "",
    "Year එක තෝරන්න:",
    "",
    "1️⃣ 2027",
    "2️⃣ 2026",
    "3️⃣ 2025",
    "4️⃣ 2024",
    "5️⃣ 2023",
    "6️⃣ 2022",
    "7️⃣ 2021",
    "8️⃣ 2020",
    "9️⃣ 2019",
    "🔟 2018",
    "11️⃣ 2017",
    "12️⃣ 2016",
    "13️⃣ 2015",
    "14️⃣ 2014",
    "15️⃣ 2013",
    "16️⃣ 2012",
    "17️⃣ 2011",
    "18️⃣ 2010",
    "19️⃣ 2009",
    "20️⃣ 2008",
    "21️⃣ 2007",
    "22️⃣ 2006",
    "23️⃣ 2005",
    "24️⃣ 2004",
    "25️⃣ 2003",
    "26️⃣ 2002",
    "27️⃣ 2001",
    "28️⃣ 2000",
    "",
    "0️⃣ Back"
  ].join("\n");
}

// ================================
// HELP
// ================================

function helpMenu() {
  return [
    "ℹ️ *PASTPAPER PRO HELP*",
    "",
    "Paper එකක් ලබාගන්න:",
    "1. `.menu` යවන්න",
    "2. O/L හෝ A/L තෝරන්න",
    "3. Medium එක තෝරන්න",
    "4. Subject එක තෝරන්න",
    "5. Year එක තෝරන්න",
    "",
    "උදාහරණයක්:",
    "`.menu`",
    "→ O/L",
    "→ Sinhala",
    "→ ICT",
    "→ 2025",
    "",
    "0️⃣ Back"
  ].join("\n");
}

// ================================
// PAIRING NUMBER
// ================================

async function getPairingNumber() {

  if (
    fs.existsSync(SESSION_DIR) &&
    fs.readdirSync(SESSION_DIR).length > 0
  ) {
    return null;
  }

  console.log("\n=== WhatsApp Pairing ===");

  console.log(
    "WhatsApp account එකේ country code සමඟ phone number එක දාන්න."
  );

  console.log(
    "උදා: Sri Lanka: 9477XXXXXXX"
  );

  console.log(
    "Spaces, + sign, hyphens දාන්න එපා.\n"
  );

  const number =
    await ask("Phone number: ");

  const cleaned =
    number
      .trim()
      .replace(/[^0-9]/g, "");

  if (
    cleaned.length < 8 ||
    cleaned.length > 15
  ) {
    throw new Error(
      "Invalid phone number."
    );
  }

  console.log(
    "Using phone number:",
    cleaned
  );

  return cleaned;
}

// ================================
// SEND PAPER
// ================================

async function sendPaper(
  sock,
  remoteJid,
  state
) {

  const query = [
    state.year,
    state.exam,
    state.subject,
    state.medium
  ].join(" ");

  await sock.sendMessage(
    remoteJid,
    {
      text:
        "🔎 *Paper එක හොයනවා...*\n\n" +
        `📚 ${state.exam}\n` +
        `📖 ${state.subject}\n` +
        `🌐 ${state.medium}\n` +
        `📅 ${state.year}`
    }
  );

  console.log(
    "Searching:",
    query
  );

  try {

    const result =
      await findPaperOnSite(query);

    if (!result) {

      await sock.sendMessage(
        remoteJid,
        {
          text:
            "❌ *Paper එක හමු වුණේ නැහැ.*\n\n" +
            `Search: ${query}\n\n` +
            "වෙන year එකක් හෝ subject එකක් try කරන්න."
        }
      );

      return;
    }

    await sock.sendMessage(
      remoteJid,
      {
        document:
          result.pdf.buffer,

        mimetype:
          "application/pdf",

        fileName:
          `${safeFileName(result.title)}.pdf`,

        caption:
          `📄 ${result.title}\n\n` +
          "📚 PastPaper Pro"
      }
    );

    console.log(
      "Paper sent:",
      result.title
    );

  } catch (err) {

    console.error(
      "Paper error:",
      err
    );

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "⚠️ Paper එක ලබාගන්න error එකක් ආවා.\n" +
          "ටිකකින් නැවත try කරන්න."
      }
    );
  }
}

// ================================
// MESSAGE HANDLER
// ================================

async function handleMessage(
  sock,
  remoteJid,
  text
) {

  const input =
    text.trim();

  // ================================
  // .menu
  // ================================

  if (
    /^\.menu$/i.test(input)
  ) {

    userStates.set(
      remoteJid,
      createState()
    );

    await sock.sendMessage(
      remoteJid,
      {
        text: mainMenu()
      }
    );

    return;
  }

  // ================================
  // START / HELP
  // ================================

  if (
    /^(help|start)$/i.test(input)
  ) {

    userStates.set(
      remoteJid,
      createState()
    );

    await sock.sendMessage(
      remoteJid,
      {
        text: mainMenu()
      }
    );

    return;
  }

  // ================================
  // USER STATE
  // ================================

  let state =
    userStates.get(remoteJid);

  if (!state) {

    state =
      createState();

    userStates.set(
      remoteJid,
      state
    );

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "👋 PastPaper Pro වෙත සාදරයෙන් පිළිගන්නවා.\n\n" +
          "Menu එක open කරන්න `.menu` යවන්න."
      }
    );

    return;
  }

  // ================================
  // BACK
  // ================================

  if (input === "0") {

    if (
      state.step === "main"
    ) {

      await sock.sendMessage(
        remoteJid,
        {
          text:
            "👋 Menu එකෙන් ඉවත් වුණා.\n\n" +
            "`.menu` යවලා නැවත ආරම්භ කරන්න."
        }
      );

      userStates.delete(
        remoteJid
      );

      return;
    }

    if (
      state.step === "ol"
    ) {

      state.step = "main";

      await sock.sendMessage(
        remoteJid,
        {
          text: mainMenu()
        }
      );

      return;
    }

    if (
      state.step === "al_stream"
    ) {

      state.step = "main";

      await sock.sendMessage(
        remoteJid,
        {
          text: mainMenu()
        }
      );

      return;
    }

    if (
      state.step === "ol_medium"
    ) {

      state.step = "ol";

      await sock.sendMessage(
        remoteJid,
        {
          text: olMenu()
        }
      );

      return;
    }

    if (
      state.step === "al_medium"
    ) {

      state.step =
        "al_stream";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            alStreamMenu()
        }
      );

      return;
    }

    if (
      state.step === "ol_subject"
    ) {

      state.step =
        "ol_medium";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            mediumMenu("O/L")
        }
      );

      return;
    }

    if (
      state.step === "al_subject"
    ) {

      state.step =
        "al_medium";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            mediumMenu(
              "A/L",
              state.stream
            )
        }
      );

      return;
    }

    if (
      state.step === "year"
    ) {

      if (
        state.exam === "O/L"
      ) {

        state.step =
          "ol_subject";

        await sock.sendMessage(
          remoteJid,
          {
            text:
              olSubjectMenu()
          }
        );

      } else {

        state.step =
          "al_subject";

        await sock.sendMessage(
          remoteJid,
          {
            text:
              alSubjectMenu(
                state.stream
              )
          }
        );
      }

      return;
    }
  }

  // ================================
  // MAIN MENU
  // ================================

  if (
    state.step === "main"
  ) {

    if (input === "1") {

      state.exam = "O/L";
      state.step = "ol";

      await sock.sendMessage(
        remoteJid,
        {
          text: olMenu()
        }
      );

      return;
    }

    if (input === "2") {

      state.exam = "A/L";
      state.step = "al_stream";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            alStreamMenu()
        }
      );

      return;
    }

    if (input === "3") {

      await sock.sendMessage(
        remoteJid,
        {
          text:
            "🔎 *Search Paper*\n\n" +
            "Search format එක:\n\n" +
            "`2025 O/L ICT Sinhala`\n" +
            "`2024 O/L Mathematics English`\n" +
            "`2023 A/L ICT Sinhala`\n\n" +
            "ඒ format එකෙන් message එක යවන්න."
        }
      );

      return;
    }

    if (input === "4") {

      state.step = "help";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            helpMenu()
        }
      );

      return;
    }

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "❌ Invalid option.\n\n" +
          mainMenu()
      }
    );

    return;
  }

  // ================================
  // O/L MENU
  // ================================

  if (
    state.step === "ol"
  ) {

    const mediums = {
      "1": "Sinhala",
      "2": "English",
      "3": "Tamil"
    };

    if (
      mediums[input]
    ) {

      state.medium =
        mediums[input];

      state.step =
        "ol_subject";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            olSubjectMenu()
        }
      );

      return;
    }

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "❌ Invalid option.\n\n" +
          olMenu()
      }
    );

    return;
  }

  // ================================
  // A/L STREAM
  // ================================

  if (
    state.step === "al_stream"
  ) {

    const streams = {
      "1": "Arts",
      "2": "Commerce",
      "3": "Science",
      "4": "Technology",
      "5": "Mathematics"
    };

    if (
      streams[input]
    ) {

      state.stream =
        streams[input];

      state.step =
        "al_medium";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            mediumMenu(
              "A/L",
              state.stream
            )
        }
      );

      return;
    }

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "❌ Invalid option.\n\n" +
          alStreamMenu()
      }
    );

    return;
  }

  // ================================
  // O/L MEDIUM
  // ================================

  if (
    state.step === "ol_medium"
  ) {

    const mediums = {
      "1": "Sinhala",
      "2": "English",
      "3": "Tamil"
    };

    if (
      mediums[input]
    ) {

      state.medium =
        mediums[input];

      state.step =
        "ol_subject";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            olSubjectMenu()
        }
      );

      return;
    }

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "❌ Invalid option.\n\n" +
          mediumMenu("O/L")
      }
    );

    return;
  }

  // ================================
  // A/L MEDIUM
  // ================================

  if (
    state.step === "al_medium"
  ) {

    const mediums = {
      "1": "Sinhala",
      "2": "English",
      "3": "Tamil"
    };

    if (
      mediums[input]
    ) {

      state.medium =
        mediums[input];

      state.step =
        "al_subject";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            alSubjectMenu(
              state.stream
            )
        }
      );

      return;
    }

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "❌ Invalid option.\n\n" +
          mediumMenu(
            "A/L",
            state.stream
          )
      }
    );

    return;
  }

  // ================================
  // O/L SUBJECT
  // ================================

  if (
    state.step === "ol_subject"
  ) {

    const subjects = {
      "1": "Mathematics",
      "2": "Science",
      "3": "ICT",
      "4": "English",
      "5": "Sinhala",
      "6": "Buddhism",
      "7": "History",
      "8": "Geography",
      "9": "Health",
      "10": "Art"
    };

    if (
      subjects[input]
    ) {

      state.subject =
        subjects[input];

      state.step =
        "year";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            yearMenu()
        }
      );

      return;
    }

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "❌ Invalid subject option.\n\n" +
          olSubjectMenu()
      }
    );

    return;
  }

  // ================================
  // A/L SUBJECT
  // ================================

  if (
    state.step === "al_subject"
  ) {

    const subjects = {
      Arts: [
        "Logic",
        "Sinhala",
        "Political Science",
        "Geography",
        "History",
        "Buddhism"
      ],

      Commerce: [
        "Accounting",
        "Business Studies",
        "Economics",
        "ICT"
      ],

      Science: [
        "Physics",
        "Chemistry",
        "Biology",
        "ICT"
      ],

      Technology: [
        "Science for Technology",
        "Engineering Technology",
        "Bio Systems Technology",
        "ICT"
      ],

      Mathematics: [
        "Combined Mathematics",
        "Physics",
        "Chemistry",
        "ICT"
      ]
    };

    const list =
      subjects[state.stream] || [];

    const index =
      Number(input) - 1;

    if (
      list[index]
    ) {

      state.subject =
        list[index];

      state.step =
        "year";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            yearMenu()
        }
      );

      return;
    }

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "❌ Invalid subject option.\n\n" +
          alSubjectMenu(
            state.stream
          )
      }
    );

    return;
  }

  // ================================
  // YEAR
  // ================================

  if (
    state.step === "year"
  ) {

    const years = [
      2027, 2026, 2025, 2024,
      2023, 2022, 2021, 2020,
      2019, 2018, 2017, 2016,
      2015, 2014, 2013, 2012,
      2011, 2010, 2009, 2008,
      2007, 2006, 2005, 2004,
      2003, 2002, 2001, 2000
    ];

    const index =
      Number(input) - 1;

    if (
      years[index]
    ) {

      state.year =
        String(years[index]);

      await sendPaper(
        sock,
        remoteJid,
        state
      );

      state.step =
        "main";

      await sock.sendMessage(
        remoteJid,
        {
          text:
            "⬅️ වෙනත් paper එකක් ගන්න `.menu` යවන්න."
        }
      );

      return;
    }

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "❌ Invalid year option.\n\n" +
          yearMenu()
      }
    );

    return;
  }

  // ================================
  // HELP
  // ================================

  if (
    state.step === "help"
  ) {

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "`.menu` යවලා Main Menu එකට යන්න."
      }
    );

    return;
  }

  // ================================
  // DIRECT SEARCH
  // ================================

  if (
    input.length >= 4
  ) {

    await sock.sendMessage(
      remoteJid,
      {
        text:
          "🔎 Paper එක PastPaper Pro site එකෙන් හොයනවා..."
      }
    );

    try {

      const result =
        await findPaperOnSite(
          input
        );

      if (!result) {

        await sock.sendMessage(
          remoteJid,
          {
            text:
              "❌ Matching paper එකක් හමු වුණේ නැහැ.\n\n" +
              "උදා: `2025 O/L ICT Sinhala`"
          }
        );

        return;
      }

      await sock.sendMessage(
        remoteJid,
        {
          document:
            result.pdf.buffer,

          mimetype:
            "application/pdf",

          fileName:
            `${safeFileName(result.title)}.pdf`,

          caption:
            `📄 ${result.title}\n\nPastPaper Pro`
        }
      );

    } catch (err) {

      console.error(
        "Direct search error:",
        err
      );

      await sock.sendMessage(
        remoteJid,
        {
          text:
            "⚠️ Paper එක ලබාගන්න error එකක් ආවා."
        }
      );
    }

    return;
  }

  await sock.sendMessage(
    remoteJid,
    {
      text:
        "`.menu` යවලා menu එක open කරන්න."
    }
  );
}

// ================================
// SAFE FILE NAME
// ================================

function safeFileName(name) {

  return String(name)
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(0, 100)
    || "past-paper";
}

// ================================
// BOT CONNECTION
// ================================

// Important:
// එක වෙලාවක එක socket එකක් විතරයි.

let currentSocket = null;
let reconnectTimer = null;
let reconnecting = false;
let stopping = false;

// ================================
// START BOT
// ================================

async function startBot() {

  if (stopping) {
    return;
  }

  if (currentSocket) {
    console.log(
      "⚠️ Bot socket එක දැනටමත් running."
    );

    return;
  }

  console.log("");
  console.log(
    "================================"
  );
  console.log(
    "Starting WhatsApp Bot..."
  );
  console.log(
    "================================"
  );

  const {
    state,
    saveCreds
  } =
    await useMultiFileAuthState(
      SESSION_DIR
    );

  const {
    version
  } =
    await fetchLatestBaileysVersion();

  const sock =
    makeWASocket({
      version,
      auth: state,
      logger
    });

  currentSocket = sock;

  // ================================
  // SAVE CREDENTIALS
  // ================================

  sock.ev.on(
    "creds.update",
    saveCreds
  );

  // ================================
  // PAIRING
  // ================================

  if (
    !state.creds.registered
  ) {

    const number =
      await getPairingNumber();

    if (number) {

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            1500
          )
      );

      try {

        const code =
          await sock.requestPairingCode(
            number
          );

        console.log("");
        console.log(
          "================================"
        );

        console.log(
          "WHATSAPP PAIRING CODE:",
          code
        );

        console.log(
          "================================"
        );

        console.log("");
        console.log(
          "Phone එකේ:"
        );

        console.log(
          "WhatsApp → Settings → Linked devices"
        );

        console.log(
          "→ Link with phone number instead"
        );

        console.log(
          "→ Code එක enter කරන්න."
        );

        console.log("");

      } catch (err) {

        console.error(
          "Pairing code error:",
          err.message
        );
      }
    }
  }

  // ================================
  // CONNECTION UPDATE
  // ================================

  sock.ev.on(
    "connection.update",
    ({
      connection,
      lastDisconnect
    }) => {

      // ==============================
      // CONNECTED
      // ==============================

      if (
        connection === "open"
      ) {

        reconnecting =
          false;

        console.log("");
        console.log(
          "================================"
        );

        console.log(
          "✅ WhatsApp bot connected!"
        );

        console.log(
          "================================"
        );

        console.log(
          "Bot එක messages වලට reply කරනවා."
        );

        console.log("");
      }

      // ==============================
      // CLOSED
      // ==============================

      if (
        connection === "close"
      ) {

        // Current socket එක මේ socket එක නම්
        // විතරක් clear කරන්න.

        if (
          currentSocket === sock
        ) {
          currentSocket = null;
        }

        const code =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;

        console.log("");
        console.log(
          "WhatsApp connection closed."
        );

        console.log(
          "Disconnect code:",
          code
        );

        // ============================
        // LOGGED OUT
        // ============================

        if (
          code ===
          DisconnectReason.loggedOut
        ) {

          console.log(
            "❌ WhatsApp logged out."
          );

          console.log(
            "Pairing එක නැවත කරන්න ඕන."
          );

          return;
        }

        // ============================
        // ALREADY RECONNECTING
        // ============================

        if (
          reconnecting
        ) {

          console.log(
            "Reconnect එක දැනටමත් scheduled."
          );

          return;
        }

        // ============================
        // RECONNECT
        // ============================

        reconnecting =
          true;

        console.log(
          "🔄 Reconnecting in 5 seconds..."
        );

        if (
          reconnectTimer
        ) {
          clearTimeout(
            reconnectTimer
          );
        }

        reconnectTimer =
          setTimeout(
            async () => {

              reconnectTimer =
                null;

              try {

                reconnecting =
                  false;

                await startBot();

              } catch (error) {

                console.error(
                  "Reconnect error:",
                  error.message
                );

                currentSocket =
                  null;

                reconnecting =
                  false;

                console.log(
                  "Retrying in 5 seconds..."
                );

                reconnectTimer =
                  setTimeout(
                    () => {
                      startBot()
                        .catch(
                          err =>
                            console.error(
                              "Retry error:",
                              err.message
                            )
                        );
                    },
                    5000
                  );
              }

            },
            5000
          );
      }
    }
  );

  // ================================
  // INCOMING MESSAGES
  // ================================

  sock.ev.on(
    "messages.upsert",
    async ({
      messages
    }) => {

      const msg =
        messages?.[0];

      if (
        !msg ||
        msg.key.fromMe
      ) {
        return;
      }

      const remoteJid =
        msg.key.remoteJid;

      const body =
        msg.message?.conversation ||
        msg.message
          ?.extendedTextMessage
          ?.text ||
        "";

      const text =
        body.trim();

      if (!text) {
        return;
      }

      console.log(
        "Message:",
        text
      );

      try {

        await handleMessage(
          sock,
          remoteJid,
          text
        );

      } catch (err) {

        console.error(
          "Message handler error:",
          err
        );

        try {

          await sock.sendMessage(
            remoteJid,
            {
              text:
                "⚠️ Bot එකේ error එකක් ආවා."
            }
          );

        } catch (
          sendError
        ) {

          console.error(
            "Send error:",
            sendError.message
          );
        }
      }
    }
  );
}

// ================================
// START
// ================================

startBot()
  .catch(err => {

    console.error(
      "\n❌ Bot stopped:",
      err.message
    );

    process.exit(1);
  });

// ================================
// CLEAN SHUTDOWN
// ================================

process.on(
  "SIGINT",
  () => {

    console.log(
      "\nStopping bot..."
    );

    stopping =
      true;

    if (
      reconnectTimer
    ) {

      clearTimeout(
        reconnectTimer
      );

      reconnectTimer =
        null;
    }

    currentSocket =
      null;

    process.exit(0);
  }
);