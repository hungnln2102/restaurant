import { createClient } from "../db/connection.mjs";

const stockIngredients = [
  { name: "Ba chỉ bò", category: "Thịt" },
  { name: "Sụn heo", category: "Thịt" },
  { name: "Gà lẩu", category: "Thịt" },
  { name: "Vẹm", category: "Hải sản" },
  { name: "Tôm lẩu", category: "Hải sản" },
  { name: "Mực lá", category: "Hải sản" },
  { name: "Xúc xích", category: "Đồ chế biến" },
  { name: "Mỳ tôm", category: "Tinh bột" },
];

const menuProduct = {
  name: "Lẩu khế nhỏ",
  category: "Nồi",
  servingUnit: "nồi",
  sellingPrice: 375000,
  status: "Đang bán",
};

const components = [
  { ingredient: "Ba chỉ bò", quantity: 150, unit: "gram", unitPrice: 139000 },
  { ingredient: "Sụn heo", quantity: 100, unit: "gram", unitPrice: 100000 },
  { ingredient: "Gà lẩu", quantity: 100, unit: "gram", unitPrice: 83000 },
  { ingredient: "Vẹm", quantity: 100, unit: "gram", unitPrice: 71000 },
  { ingredient: "Tôm lẩu", quantity: 100, unit: "gram", unitPrice: 186000 },
  { ingredient: "Mực lá", quantity: 100, unit: "gram", unitPrice: 215000 },
  { ingredient: "Xúc xích", quantity: 20, unit: "gram", unitPrice: 65000 },
  { ingredient: "Mỳ tôm", quantity: 2, unit: "vắt", unitPrice: 4500 },
];

async function upsertStockProduct(client, ingredient) {
  const result = await client.query(
    `
      insert into inventory.stock_products (
        product_name,
        product_category
      )
      values ($1, $2)
      on conflict (product_name)
      do update
        set
          product_category = coalesce(excluded.product_category, inventory.stock_products.product_category),
          updated_at = now()
      returning id
    `,
    [ingredient.name, ingredient.category],
  );

  return Number(result.rows[0].id);
}

async function upsertMenuProduct(client) {
  const result = await client.query(
    `
      insert into inventory.menu_products (
        product_name,
        product_category,
        serving_unit,
        selling_price,
        status
      )
      values ($1, $2, $3, $4, $5)
      on conflict (product_name)
      do update
        set
          product_category = excluded.product_category,
          serving_unit = excluded.serving_unit,
          selling_price = excluded.selling_price,
          status = excluded.status,
          updated_at = now()
      returning id
    `,
    [
      menuProduct.name,
      menuProduct.category,
      menuProduct.servingUnit,
      menuProduct.sellingPrice,
      menuProduct.status,
    ],
  );

  return Number(result.rows[0].id);
}

async function upsertComponent(client, menuProductId, stockProductId, component, sortOrder) {
  await client.query(
    `
      insert into inventory.menu_product_components (
        menu_product_id,
        stock_product_id,
        quantity,
        unit,
        sort_order
      )
      values ($1, $2, $3, $4, $5)
      on conflict (menu_product_id, stock_product_id)
      do update
        set
          quantity = excluded.quantity,
          unit = excluded.unit,
          sort_order = excluded.sort_order,
          updated_at = now()
    `,
    [menuProductId, stockProductId, component.quantity, component.unit, sortOrder],
  );
}

async function upsertSupplierPrice(client, stockProductId, unitPrice) {
  const supplierResult = await client.query(
    `
      insert into inventory.suppliers (
        supplier_name,
        primary_category
      )
      values ($1, $2)
      on conflict (supplier_name)
      do update
        set updated_at = now()
      returning id
    `,
    ["NCC mặc định định lượng", "Nguyên liệu tổng hợp"],
  );
  const supplierId = Number(supplierResult.rows[0].id);

  await client.query(
    `
      insert into inventory.supplier_products (
        supplier_id,
        stock_product_id,
        unit_price,
        is_preferred
      )
      values ($1, $2, $3, true)
      on conflict (supplier_id, stock_product_id)
      do update
        set
          unit_price = excluded.unit_price,
          is_preferred = true,
          updated_at = now()
    `,
    [supplierId, stockProductId, unitPrice],
  );
}

async function run() {
  const client = createClient({ preferUnpooled: true });

  try {
    await client.connect();
    await client.query("begin");

    const stockProductMap = new Map();

    for (const ingredient of stockIngredients) {
      const stockProductId = await upsertStockProduct(client, ingredient);
      stockProductMap.set(ingredient.name, stockProductId);
    }

    const menuProductId = await upsertMenuProduct(client);

    for (const [index, component] of components.entries()) {
      const stockProductId = stockProductMap.get(component.ingredient);

      if (!stockProductId) {
        continue;
      }

      await upsertComponent(client, menuProductId, stockProductId, component, index + 1);
      await upsertSupplierPrice(client, stockProductId, component.unitPrice);
    }

    await client.query("commit");

    console.log("Product portioning seed: OK");
    console.log(`Menu product: ${menuProduct.name}`);
    console.log(`Components: ${components.length}`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("Product portioning seed: FAILED");
    console.error(`Message: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

await run();
