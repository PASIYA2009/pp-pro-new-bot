const {
  SITE_URL,
  MAX_PDF_MB,
  REQUEST_TIMEOUT_MS
} = require("./config");

const PROJECT_ID = "past-paper-pro-4c0cb";
const DATABASE = "(default)";
const COLLECTION = "papers";

const MAX_BYTES = MAX_PDF_MB * 1024 * 1024;

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFirestoreValue(value) {
  if (!value) return null;

  if (value.stringValue !== undefined) {
    return value.stringValue;
  }

  if (value.integerValue !== undefined) {
    return Number(value.integerValue);
  }

  if (value.doubleValue !== undefined) {
    return Number(value.doubleValue);
  }

  if (value.booleanValue !== undefined) {
    return value.booleanValue;
  }

  if (value.timestampValue !== undefined) {
    return value.timestampValue;
  }

  if (value.nullValue !== undefined) {
    return null;
  }

  if (value.arrayValue) {
    return (value.arrayValue.values || [])
      .map(getFirestoreValue);
  }

  if (value.mapValue) {
    const fields =
      value.mapValue.fields || {};

    const result = {};

    for (const [key, val] of Object.entries(fields)) {
      result[key] = getFirestoreValue(val);
    }

    return result;
  }

  return null;
}

function firestoreDocumentToPaper(document) {
  const fields = document.fields || {};

  return {
    id:
      document.name?.split("/").pop() || "",

    exam: getFirestoreValue(fields.exam),
    stream: getFirestoreValue(fields.stream),
    subject: getFirestoreValue(fields.subject),
    year: getFirestoreValue(fields.year),
    title: getFirestoreValue(fields.title),
    file: getFirestoreValue(fields.file)
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent":
          "PastPaperProWhatsAppBot/1.0",
        Accept: "application/json",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getAllPapers() {
  const papers = [];

  let pageToken = "";

  while (true) {
    const params = new URLSearchParams();

    params.set("pageSize", "1000");

    if (pageToken) {
      params.set(
        "pageToken",
        pageToken
      );
    }

    const url =
      `https://firestore.googleapis.com/v1/` +
      `projects/${PROJECT_ID}/databases/${DATABASE}` +
      `/documents/${COLLECTION}?${params.toString()}`;

    const response =
      await fetchWithTimeout(url);

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        `Firestore request failed: ${response.status} ${errorText}`
      );
    }

    const data =
      await response.json();

    for (const document of data.documents || []) {
      const paper =
        firestoreDocumentToPaper(document);

      if (
        paper.exam &&
        paper.subject &&
        paper.year &&
        paper.title &&
        paper.file
      ) {
        papers.push(paper);
      }
    }

    pageToken =
      data.nextPageToken || "";

    if (!pageToken) {
      break;
    }
  }

  return papers;
}

function extractYear(query) {
  const match =
    String(query).match(/\b(20\d{2})\b/);

  return match ? match[1] : "";
}

function extractExam(query) {
  const value =
    normalize(query);

  if (value.includes("o l")) {
    return "O/L";
  }

  if (value.includes("a l")) {
    return "A/L";
  }

  return "";
}

function extractMedium(query) {
  const value =
    normalize(query);

  if (
    value.includes("sinhala") ||
    value.includes("sinhalese")
  ) {
    return "sinhala";
  }

  if (value.includes("english")) {
    return "english";
  }

  return "";
}

function containsMedium(paper, medium) {
  if (!medium) return true;

  const text =
    normalize(
      `${paper.title || ""} ${paper.subject || ""}`
    );

  return text.includes(medium);
}

function exactScore(paper, query) {
  const q = normalize(query);

  const exam =
    normalize(paper.exam);

  const stream =
    normalize(paper.stream);

  const subject =
    normalize(paper.subject);

  const year =
    normalize(paper.year);

  const title =
    normalize(paper.title);

  const file =
    normalize(paper.file);

  let score = 0;

  if (exam && q.includes(exam.replace("/", " "))) {
    score += 50;
  }

  if (
    year &&
    q.includes(year)
  ) {
    score += 60;
  }

  if (
    subject &&
    q.includes(subject)
  ) {
    score += 100;
  }

  if (
    stream &&
    q.includes(stream)
  ) {
    score += 70;
  }

  if (
    title &&
    q === title
  ) {
    score += 500;
  }

  const words =
    q.split(" ").filter(Boolean);

  for (const word of words) {
    if (word.length < 3) continue;

    if (title.includes(word)) {
      score += 8;
    }

    if (subject.includes(word)) {
      score += 15;
    }

    if (stream.includes(word)) {
      score += 10;
    }
  }

  if (/\.pdf($|\?)/i.test(file)) {
    score += 10;
  }

  if (/drive\.google\.com/i.test(file)) {
    score += 5;
  }

  return score;
}

function findExactPaper(papers, query) {
  const year =
    extractYear(query);

  const exam =
    extractExam(query);

  const medium =
    extractMedium(query);

  const normalizedQuery =
    normalize(query);

  let candidates =
    papers.filter((paper) => {
      if (
        exam &&
        normalize(paper.exam) !==
          normalize(exam)
      ) {
        return false;
      }

      if (
        year &&
        String(paper.year) !== year
      ) {
        return false;
      }

      if (
        medium &&
        !containsMedium(paper, medium)
      ) {
        return false;
      }

      return true;
    });

  /*
    Subject එක exact match කරන්න
    මුලින් උත්සාහ කරනවා.
  */

  const subjectMatches =
    candidates.filter((paper) => {
      const subject =
        normalize(paper.subject);

      return (
        subject &&
        normalizedQuery.includes(subject)
      );
    });

  if (subjectMatches.length) {
    candidates = subjectMatches;
  }

  /*
    Stream එක query එකේ තිබුණොත්
    ඒ stream එකට විතරක් සීමා කරනවා.
  */

  const streamMatches =
    candidates.filter((paper) => {
      const stream =
        normalize(paper.stream);

      if (!stream) {
        return false;
      }

      return normalizedQuery.includes(
        stream
      );
    });

  if (streamMatches.length) {
    candidates = streamMatches;
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort(
    (a, b) =>
      exactScore(b, query) -
      exactScore(a, query)
  );

  /*
    Top result එකට score එකක් නැත්නම්
    random paper එකක් යවන්නේ නැහැ.
  */

  const best =
    candidates[0];

  const bestScore =
    exactScore(best, query);

  if (bestScore < 80) {
    return null;
  }

  return best;
}

function getGoogleDriveUrl(url) {
  if (!url) return null;

  try {
    const u =
      new URL(url);

    let id = null;

    const fileMatch =
      u.pathname.match(
        /\/file\/d\/([^/]+)/i
      );

    if (fileMatch) {
      id = fileMatch[1];
    }

    if (!id) {
      id =
        u.searchParams.get("id");
    }

    if (!id) {
      return null;
    }

    return (
      "https://drive.google.com/" +
      `uc?export=download&id=${id}`
    );
  } catch {
    return null;
  }
}

async function downloadPdf(url) {
  if (!url) return null;

  const driveUrl =
    getGoogleDriveUrl(url);

  const targetUrl =
    driveUrl || url;

  const response =
    await fetchWithTimeout(
      targetUrl,
      {
        redirect: "follow"
      }
    );

  if (!response.ok) {
    throw new Error(
      `PDF download failed: ${response.status}`
    );
  }

  const contentLength =
    Number(
      response.headers.get(
        "content-length"
      ) || 0
    );

  if (
    contentLength > MAX_BYTES
  ) {
    throw new Error(
      "PDF is larger than the configured limit."
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  if (buffer.length > MAX_BYTES) {
    throw new Error(
      "PDF is larger than the configured limit."
    );
  }

  const contentType =
    (
      response.headers.get(
        "content-type"
      ) || ""
    ).toLowerCase();

  const isPdf =
    buffer
      .subarray(0, 5)
      .toString() === "%PDF-" ||
    contentType.includes(
      "application/pdf"
    );

  if (!isPdf) {
    throw new Error(
      "The selected URL did not return a PDF file."
    );
  }

  return {
    buffer,
    url:
      response.url || targetUrl
  };
}

async function findPaperOnSite(query) {
  console.log(
    `Searching Firestore papers for: ${query}`
  );

  const papers =
    await getAllPapers();

  console.log(
    `Firestore papers loaded: ${papers.length}`
  );

  const paper =
    findExactPaper(
      papers,
      query
    );

  if (!paper) {
    console.log(
      `No exact paper found for: ${query}`
    );

    return null;
  }

  console.log(
    `Matched paper: ${paper.title}`
  );

  console.log(
    `Paper URL: ${paper.file}`
  );

  const pdf =
    await downloadPdf(
      paper.file
    );

  return {
    title: paper.title,
    pdf,
    paper
  };
}

module.exports = {
  findPaperOnSite
};