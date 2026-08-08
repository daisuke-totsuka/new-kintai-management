const fs = require("fs");
const path = require("path");

const resultPath = path.join(__dirname, "..", "test-results", "result.json");
const metadataDir = path.join(__dirname, "..", "tests", "metadata");
const outputDir = path.join(__dirname, "..", "test-results");

const APPROVED_SCREEN_NAMES = [
  "勤務実績",
  "ユーザ管理",
  "ユーザ登録",
  "支店管理",
  "権限管理",
  "権限登録",
  "権限編集",
  "通常勤務時間設定",
  "年度設定",
  "経費請求",
  "業務請求明細",
  "提出状況",
  "確定画面",
  "ログイン",
  "サイドナビ",
  "Next APIプロキシ",
  "DB境界値",
  "権限DB境界値",
  "Excelレポート",
];
const APPROVED_SCREEN_NAME_SET = new Set(APPROVED_SCREEN_NAMES);
const ENGLISH_SCREEN_NAMES = new Set([
  "Attendance Settings",
  "Business Bill Details",
  "Dashboard",
  "DB Boundary",
  "Expense Claims",
  "Leader",
  "Login",
  "Next API Proxy",
  "Role DB Boundary",
]);
const WINDOWS_FILE_NAME_INVALID_PATTERN = /[<>:"/\\|?*\u0000-\u001f]/;

const HEADERS = [
  "テストID",
  "種別",
  "画面名",
  "テスト項目",
  "入力値",
  "期待結果",
  "実際結果",
  "判定",
  "実行日時",
];

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadMetadata() {
  return fs
    .readdirSync(metadataDir)
    .filter((fileName) => fileName.endsWith(".metadata.json"))
    .flatMap((fileName) => {
      const loaded = loadJson(path.join(metadataDir, fileName));
      return (Array.isArray(loaded) ? loaded : [loaded]).map((item) => ({
        ...item,
        metadataFile: fileName,
      }));
    });
}

function validateMetadata(metadata) {
  const missingScreenName = metadata
    .filter((item) => !item.screenName)
    .map(formatMetadataItem);
  const missingTestName = metadata
    .filter((item) => !item.testName)
    .map(formatMetadataItem);
  const missingTestId = metadata
    .filter((item) => !item.testId)
    .map(formatMetadataItem);
  const invalidScreenName = metadata
    .filter((item) => item.screenName && !isApprovedScreenName(item.screenName))
    .map(formatInvalidScreenNameItem);
  const englishOnlyTestName = metadata
    .filter((item) => item.testName && !containsJapanese(item.testName))
    .map(formatMetadataItem);
  const duplicateTestIds = findDuplicates(
    metadata
      .filter((item) => item.testId)
      .map((item) => [item.testId, formatMetadataItem(item)]),
  );
  const duplicateScreenAndTestNames = findDuplicates(
    metadata
      .filter((item) => item.screenName && item.testName)
      .map((item) => [`${item.screenName}::${item.testName}`, formatMetadataItem(item)]),
  );
  const errors = [];

  if (missingScreenName.length > 0) {
    errors.push(["screenNameがありません。", ...missingScreenName].join("\n"));
  }

  if (missingTestName.length > 0) {
    errors.push(["testNameがありません。", ...missingTestName].join("\n"));
  }

  if (missingTestId.length > 0) {
    errors.push(["testIdがありません。", ...missingTestId].join("\n"));
  }

  if (invalidScreenName.length > 0) {
    errors.push([
      "metadata screenName は正式日本語名称を設定してください。",
      ...invalidScreenName,
    ].join("\n"));
  }

  if (englishOnlyTestName.length > 0) {
    errors.push([
      "metadata testName は日本語名称を設定してください。",
      ...englishOnlyTestName,
    ].join("\n"));
  }

  if (duplicateTestIds.length > 0) {
    errors.push(["testIdが重複しています。", ...duplicateTestIds].join("\n"));
  }

  if (duplicateScreenAndTestNames.length > 0) {
    errors.push([
      "screenNameとtestNameの組み合わせが重複しています。",
      ...duplicateScreenAndTestNames,
    ].join("\n"));
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n\n"));
  }
}

function isApprovedScreenName(screenName) {
  const value = String(screenName || "");
  const normalized = value.trim();
  return (
    value === normalized &&
    APPROVED_SCREEN_NAME_SET.has(normalized) &&
    !isAsciiOnly(normalized) &&
    !ENGLISH_SCREEN_NAMES.has(normalized)
  );
}

function isAsciiOnly(value) {
  return /^[\x00-\x7f]+$/.test(String(value || ""));
}

function containsJapanese(value) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value || ""));
}

function findDuplicates(entries) {
  const byValue = new Map();

  for (const [value, label] of entries) {
    if (!byValue.has(value)) {
      byValue.set(value, []);
    }
    byValue.get(value).push(label);
  }

  return Array.from(byValue.entries())
    .filter(([, labels]) => labels.length > 1)
    .flatMap(([value, labels]) => [`${value}`, ...labels]);
}

function indexMetadata(metadata) {
  const byTestName = new Map();
  for (const item of metadata) {
    if (item.testName) {
      byTestName.set(item.testName, item);
    }
  }
  return byTestName;
}

function formatExecutionTime(resultJson) {
  const startTime = resultJson.startTime;
  const date = startTime ? new Date(startTime) : new Date();
  return formatDateTime(date);
}

function buildRowsByScreen(resultJson, metadata) {
  const byTestName = indexMetadata(metadata);
  const executionTime = formatExecutionTime(resultJson);
  const rowsByScreen = new Map();
  const matched = new Set();
  const missingMetadata = [];

  for (const file of resultJson.testResults || []) {
    for (const test of file.assertionResults || []) {
      const meta = byTestName.get(test.title);
      if (!meta) {
        missingMetadata.push(formatTestItem(file, test));
        continue;
      }

      matched.add(meta.testName);
      const passed = test.status === "passed";
      const expected = meta.expected || "";
      const actual = passed
        ? meta.actual || expected
        : (test.failureMessages || []).join("\n");
      const screenName = meta.screenName || "TestResult";

      if (!rowsByScreen.has(screenName)) {
        rowsByScreen.set(screenName, [HEADERS]);
      }

      rowsByScreen.get(screenName).push([
        meta.testId || "",
        meta.type || "Frontend",
        screenName,
        meta.testName || "",
        meta.input || "",
        expected,
        actual,
        passed ? "OK" : "NG",
        executionTime,
      ]);
    }
  }

  const unmatched = metadata
    .filter((item) => item.testName && !matched.has(item.testName))
    .map(formatMetadataItem);
  const errors = [];

  if (missingMetadata.length > 0) {
    errors.push(["metadataがありません。", ...missingMetadata].join("\n"));
  }

  if (unmatched.length > 0) {
    errors.push(["metadataに一致するテスト結果がありません。", ...unmatched].join("\n"));
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n\n"));
  }

  return rowsByScreen;
}

function main() {
  const resultJson = loadJson(resultPath);
  const metadata = loadMetadata();
  validateMetadata(metadata);
  const rowsByScreen = buildRowsByScreen(resultJson, metadata);

  if (rowsByScreen.size === 0) {
    throw new Error("metadataに一致するテスト結果がありません");
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = formatTimestamp(new Date());
  for (const [screenName, rows] of rowsByScreen.entries()) {
    const outputPath = buildOutputPath(outputDir, screenName, timestamp);
    writeXlsx(outputPath, rows);
    console.log(`Excel出力完了: ${outputPath}`);
  }
}

function formatTestItem(file, test) {
  const fileName = file.name
    ? path.relative(path.join(__dirname, ".."), file.name).replace(/\\/g, "/")
    : "(unknown file)";
  return `${fileName}: ${test.title}`;
}

function formatMetadataItem(item) {
  const fileName = item.metadataFile || "(unknown metadata)";
  return `${fileName}: ${item.testName || item.testId || "(unknown test)"}`;
}

function formatInvalidScreenNameItem(item) {
  const screenName = String(item.screenName || "");
  const reason = ENGLISH_SCREEN_NAMES.has(screenName) || isAsciiOnly(screenName)
    ? "英語または英数字のみの名称です"
    : "未承認名称です";
  return `${formatMetadataItem(item)}: screenName="${screenName}" (${reason})`;
}

function buildOutputPath(targetDir, screenName, timestamp) {
  const fileName = `${screenName}_${timestamp}.xlsx`;

  if (!screenName || WINDOWS_FILE_NAME_INVALID_PATTERN.test(fileName)) {
    throw new Error(`Excelファイル名生成に失敗しました: ${fileName}`);
  }

  const outputPath = path.join(targetDir, fileName);
  if (path.basename(outputPath) !== fileName) {
    throw new Error(`Excelファイル名生成に失敗しました: ${fileName}`);
  }

  return outputPath;
}

function writeXlsx(filePath, sheetRows) {
  const entries = {
    "[Content_Types].xml": contentTypesXml(),
    "_rels/.rels": rootRelsXml(),
    "xl/workbook.xml": workbookXml(),
    "xl/_rels/workbook.xml.rels": workbookRelsXml(),
    "xl/worksheets/sheet1.xml": sheetXml(sheetRows),
  };

  writeZip(filePath, entries);
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="TestResult" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;
}

function sheetXml(sheetRows) {
  const xmlRows = sheetRows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex + 1)}${rowNumber}`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
}

function columnName(index) {
  let name = "";
  let current = index;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }

  return name;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function writeZip(filePath, entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) |
    (now.getMinutes() << 5) |
    Math.floor(now.getSeconds() / 2);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(Object.keys(entries).length, 8);
  endRecord.writeUInt16LE(Object.keys(entries).length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  fs.writeFileSync(filePath, Buffer.concat([...localParts, centralDirectory, endRecord]));
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function formatTimestamp(date) {
  return (
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0") +
    "_" +
    String(date.getHours()).padStart(2, "0") +
    String(date.getMinutes()).padStart(2, "0") +
    String(date.getSeconds()).padStart(2, "0")
  );
}

function formatDateTime(date) {
  return (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")} ` +
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}:` +
    `${String(date.getSeconds()).padStart(2, "0")}`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  APPROVED_SCREEN_NAMES,
  buildOutputPath,
  buildRowsByScreen,
  validateMetadata,
};
