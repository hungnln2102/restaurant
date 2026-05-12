import { createPortioningRule } from "../domains/inventory/use-cases/createPortioningRule.mjs";
import { listPortioningRules } from "../domains/inventory/use-cases/listPortioningRules.mjs";

const seedRules = [
  {
    name: "Quy ước bò bằm phần chuẩn",
    description: "Định lượng cho mì Ý sốt bò bằm.",
    stockUnit: "kg",
    processingUnit: "phần",
    conversionRatio: 8.3,
  },
  {
    name: "Quy ước cá hồi áp chảo",
    description: "Định lượng cho salad cá hồi áp chảo.",
    stockUnit: "kg",
    processingUnit: "phần",
    conversionRatio: 6.6,
  },
  {
    name: "Quy ước gạo combo trưa",
    description: "Định lượng gạo cho combo cơm trưa văn phòng.",
    stockUnit: "bao 5 kg",
    processingUnit: "phần",
    conversionRatio: 38,
  },
  {
    name: "Quy ước phô mai pizza",
    description: "Định lượng mozzarella cho pizza 4 phô mai.",
    stockUnit: "kg",
    processingUnit: "bánh",
    conversionRatio: 8,
  },
];

function buildSignature(rule) {
  return [
    rule.name.trim().toLowerCase(),
    rule.stockUnit.trim().toLowerCase(),
    rule.processingUnit.trim().toLowerCase(),
    String(rule.conversionRatio),
  ].join("|");
}

async function run() {
  const existingRules = await listPortioningRules();
  const existingSignatures = new Set(existingRules.map(buildSignature));
  let createdCount = 0;

  for (const rule of seedRules) {
    const signature = buildSignature(rule);

    if (existingSignatures.has(signature)) {
      continue;
    }

    await createPortioningRule(rule);
    existingSignatures.add(signature);
    createdCount += 1;
  }

  console.log("Inventory portioning seed: OK");
  console.log(`Inserted: ${createdCount}`);
  console.log(`Existing total: ${existingSignatures.size}`);
}

await run();
