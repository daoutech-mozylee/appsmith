#!/usr/bin/env node
/**
 * Appsmith Export Format -> UIModule API Format Converter
 *
 * Appsmith 내보내기 형식의 JSON 파일을 UIModule API 형식으로 변환합니다.
 *
 * Usage:
 *   node scripts/convert-module-format.js <input.json> [output.json]
 *   node scripts/convert-module-format.js --all [output-dir]
 *
 * Options:
 *   --all           모든 JSON 파일 변환 (data/packages/*.json)
 *   --dry-run       변환 결과 미리보기 (파일 저장 안 함)
 */

const fs = require("fs");
const path = require("path");

const PACKAGES_DIR = "app/client/src/data/packages";
const DEFAULT_OUTPUT_DIR = "app/client/src/data/packages-converted";

/**
 * Appsmith Export Format -> UIModule Format 변환
 */
function convertAppsmithExportToUIModule(exportJson, filename) {
  const modules = [];

  const { exportedPackage, moduleList, actionList, actionCollectionList } =
    exportJson;

  if (!exportedPackage || !moduleList) {
    throw new Error(
      "Invalid Appsmith export format: missing exportedPackage or moduleList"
    );
  }

  const packageUUID = exportedPackage.packageUUID;
  const packageName = exportedPackage.unpublishedPackage?.name || "Unknown";
  const packageIcon = exportedPackage.unpublishedPackage?.icon;
  const packageColor = exportedPackage.unpublishedPackage?.color;

  // 각 모듈 변환
  moduleList
    .filter((module) => !module.deleted && module.type === "UI_MODULE")
    .forEach((module) => {
      const moduleUUID = module.moduleUUID;
      const moduleName = module.unpublishedModule?.name || filename || "Unknown";

      // 이 모듈에 속한 액션들 필터링
      const moduleActions = (actionList || []).filter(
        (action) =>
          !action.deleted && action.unpublishedAction?.moduleId === moduleName
      );

      // 이 모듈에 속한 JS 컬렉션 필터링
      const moduleActionCollections = (actionCollectionList || []).filter(
        (collection) =>
          !collection.deleted &&
          collection.unpublishedCollection?.moduleId === moduleName
      );

      // layouts 배열 구성
      const layouts = module.unpublishedModule?.layouts || [];
      const layoutsForApi = layouts.map((layout) => ({
        dsl: layout.dsl,
      }));

      // UIModule 형식으로 변환
      const uiModule = {
        moduleUUID,
        packageUUID,
        moduleName,
        packageName,
        version: "1.0.0",
        meta: {
          icon: packageIcon,
          color: packageColor,
          description: `Migrated from ${filename || "export file"}`,
        },
        definition: {
          layouts: layoutsForApi,
          inputsForm: module.unpublishedModule?.inputsForm || [],
          outputsForm: module.unpublishedModule?.outputsForm || [],
          actionList: moduleActions,
          actionCollectionList: moduleActionCollections,
        },
      };

      modules.push(uiModule);
    });

  return modules;
}

/**
 * 단일 파일 변환
 */
function convertFile(inputPath, outputPath, dryRun = false) {
  const filename = path.basename(inputPath, ".json");

  console.log(`Converting: ${inputPath}`);

  const content = fs.readFileSync(inputPath, "utf-8");
  const exportJson = JSON.parse(content);

  // Appsmith export 형식인지 확인
  if (!exportJson.exportedPackage && !exportJson.moduleList) {
    // 이미 UIModule 형식일 수 있음
    if (exportJson.moduleUUID && exportJson.definition) {
      console.log(`  [SKIP] Already in UIModule format`);
      return null;
    }
    throw new Error("Unknown JSON format");
  }

  const modules = convertAppsmithExportToUIModule(exportJson, filename);

  if (modules.length === 0) {
    console.log(`  [SKIP] No UI modules found`);
    return null;
  }

  console.log(`  Found ${modules.length} module(s)`);

  if (dryRun) {
    modules.forEach((m) => {
      console.log(`    - ${m.moduleName} (${m.moduleUUID})`);
    });
    return modules;
  }

  // 파일 저장
  modules.forEach((module, index) => {
    let outPath = outputPath;

    if (modules.length > 1) {
      // 여러 모듈이면 파일명에 인덱스 추가
      const ext = path.extname(outputPath);
      const base = outputPath.slice(0, -ext.length);
      outPath = `${base}_${index + 1}${ext}`;
    }

    const outputDir = path.dirname(outPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outPath, JSON.stringify(module, null, 2));
    console.log(`  [SAVED] ${outPath}`);
  });

  return modules;
}

/**
 * 모든 파일 변환
 */
function convertAll(outputDir, dryRun = false) {
  const packagesDir = PACKAGES_DIR;

  if (!fs.existsSync(packagesDir)) {
    console.error(`Error: Packages directory not found: ${packagesDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(packagesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(packagesDir, f));

  console.log(`Found ${files.length} JSON files\n`);

  let total = 0;
  let success = 0;
  let failed = 0;
  let skipped = 0;

  files.forEach((file) => {
    total++;
    const filename = path.basename(file, ".json");
    const outputPath = path.join(outputDir, `${filename}.json`);

    try {
      const result = convertFile(file, outputPath, dryRun);
      if (result) {
        success++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.log(`  [ERROR] ${err.message}`);
      failed++;
    }
    console.log("");
  });

  console.log("========================================");
  console.log("  Conversion Summary");
  console.log("========================================");
  console.log(`Total:    ${total}`);
  console.log(`Success:  ${success}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);

  if (dryRun) {
    console.log(`\nDry run completed. No files were saved.`);
    console.log(`Run without --dry-run to save converted files.`);
  }
}

// CLI
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Appsmith Export Format -> UIModule API Format Converter

Usage:
  node scripts/convert-module-format.js <input.json> [output.json]
  node scripts/convert-module-format.js --all [output-dir]

Options:
  --all           Convert all JSON files in data/packages/
  --dry-run       Preview conversion without saving files
  --help, -h      Show this help message

Examples:
  node scripts/convert-module-format.js app/client/src/data/packages/Test.json converted.json
  node scripts/convert-module-format.js --all --dry-run
  node scripts/convert-module-format.js --all ./converted-modules
`);
  process.exit(0);
}

const dryRun = args.includes("--dry-run");
const filteredArgs = args.filter((a) => !a.startsWith("--"));

if (args.includes("--all")) {
  const outputDir = filteredArgs[0] || DEFAULT_OUTPUT_DIR;
  convertAll(outputDir, dryRun);
} else if (filteredArgs.length >= 1) {
  const inputPath = filteredArgs[0];
  const outputPath = filteredArgs[1] || inputPath.replace(".json", "-converted.json");
  try {
    convertFile(inputPath, outputPath, dryRun);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
} else {
  console.log("Usage: node scripts/convert-module-format.js <input.json> [output.json]");
  console.log("       node scripts/convert-module-format.js --all [output-dir]");
  console.log("Run with --help for more options.");
  process.exit(1);
}
