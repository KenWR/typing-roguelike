import { mkdir } from "node:fs/promises";

const sourceDirectory = Bun.argv[2];
const outputRoot = Bun.argv[3] ?? "apps/game/public/assets/images/relic_icons";

if (sourceDirectory === undefined) {
  throw new Error(
    "Usage: bun scripts/generate-relic-assets.ts <source-directory> [output-directory]",
  );
}

const relicSource = await Bun.file("packages/shared/src/content/relics.ts").text();
const relics = [
  ...relicSource.matchAll(
    /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*rarity:\s*"([^"]+)"/g,
  ),
].map((match) => ({
  id: match[1]!,
  name: match[2]!,
  rarity: match[3]!,
}));

if (relics.length !== 57) {
  throw new Error(`Expected 57 relic definitions, got ${relics.length}`);
}

await mkdir(`${outputRoot}/96`, { recursive: true });
await mkdir(`${outputRoot}/192`, { recursive: true });

for (const relic of relics) {
  const sourcePath = `${sourceDirectory}/${relic.name}.png`;
  if (!(await Bun.file(sourcePath).exists())) {
    throw new Error(`Missing source image: ${sourcePath}`);
  }

  for (const size of [96, 192] as const) {
    const outputPath = `${outputRoot}/${size}/${relic.id}.png`;
    const result = Bun.spawnSync([
      "ffmpeg",
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      sourcePath,
      "-vf",
      `scale=${size}:${size}:flags=lanczos`,
      "-frames:v",
      "1",
      "-compression_level",
      "9",
      outputPath,
    ]);

    if (result.exitCode !== 0) {
      throw new Error(
        `ffmpeg failed for ${relic.id} at ${size}px: ${result.stderr.toString()}`,
      );
    }
  }
}

const manifest = [
  "relic_id,rarity,name_ko,file_96,file_192",
  ...relics.map((relic) =>
    [
      relic.id,
      relic.rarity,
      relic.name,
      `96/${relic.id}.png`,
      `192/${relic.id}.png`,
    ].join(","),
  ),
].join("\n");

await Bun.write(`${outputRoot}/manifest.csv`, `${manifest}\n`);
await Bun.write(
  `${outputRoot}/README.md`,
  `# 유물 아이콘 에셋

- 유물 수: 57종
- 런타임 HUD: \`96/\`의 96×96 PNG
- 상세 표시: \`192/\`의 192×192 PNG
- ID 및 한국어 이름 매핑: \`manifest.csv\`
- 1254×1254 원본은 총 128MB이므로 저장소에 포함하지 않고 런타임 파생본만 관리합니다.
- 리사이즈 필터: Lanczos
`,
);

console.log(`Generated ${relics.length} relic icons in ${outputRoot}`);
