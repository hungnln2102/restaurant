import { withTransaction } from "../../../db/connection.mjs";

function mapInventoryReceipt({ product, inbound, balance }) {
  return {
    id: Number(inbound.id),
    product: {
      id: Number(product.id),
      name: product.product_name,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    },
    inbound: {
      id: Number(inbound.id),
      inputQuantity: Number(inbound.input_quantity),
      inputUnit: inbound.input_unit,
      unitPrice: inbound.unit_price === null ? null : Number(inbound.unit_price),
      currencyCode: inbound.currency_code,
      supplierId: inbound.supplier_id === null ? null : Number(inbound.supplier_id),
      supplierName: inbound.supplier_name ?? null,
      unitConversionId:
        inbound.unit_conversion_id === null ? null : Number(inbound.unit_conversion_id),
      conversionRatio:
        inbound.conversion_ratio === null ? null : Number(inbound.conversion_ratio),
      createdAt: inbound.created_at,
      updatedAt: inbound.updated_at,
    },
    stock: {
      id: Number(balance.id),
      quantity: Number(balance.on_hand_quantity),
      unit: balance.on_hand_unit,
      unitConversionId:
        balance.unit_conversion_id === null ? null : Number(balance.unit_conversion_id),
      conversionRatio:
        balance.conversion_ratio === null ? null : Number(balance.conversion_ratio),
      createdAt: balance.created_at,
      updatedAt: balance.updated_at,
    },
  };
}

async function findUnitConversionById(client, id) {
  const result = await client.query(
    `
      select
        id,
        stock_unit,
        processing_unit,
        conversion_ratio
      from inventory.unit_conversions
      where id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function findOrCreateStockProduct(client, ingredientName) {
  const result = await client.query(
    `
      insert into inventory.stock_products (
        product_name
      )
      values ($1)
      on conflict (product_name)
      do update
        set updated_at = now()
      returning
        id,
        product_name,
        created_at,
        updated_at
    `,
    [ingredientName],
  );

  return result.rows[0];
}

async function attachProductCategory(client, stockProductId, productCategory) {
  if (!productCategory) {
    return;
  }

  await client.query(
    `
      update inventory.stock_products
      set
        product_category = $1,
        updated_at = now()
      where id = $2
    `,
    [productCategory, stockProductId],
  );
}

async function findOrCreateSupplier(
  client,
  {
    supplierName,
    primaryCategory = null,
    defaultUnitPrice = null,
    pricingUnit = null,
  },
) {
  const result = await client.query(
    `
      insert into inventory.suppliers (
        supplier_name,
        primary_category,
        default_unit_price,
        pricing_unit
      )
      values ($1, $2, $3, $4)
      on conflict (supplier_name)
      do update
        set
          primary_category = coalesce(excluded.primary_category, inventory.suppliers.primary_category),
          default_unit_price = coalesce(excluded.default_unit_price, inventory.suppliers.default_unit_price),
          pricing_unit = coalesce(excluded.pricing_unit, inventory.suppliers.pricing_unit),
          updated_at = now()
      returning
        id,
        supplier_name
    `,
    [supplierName, primaryCategory, defaultUnitPrice, pricingUnit],
  );

  return result.rows[0];
}

async function upsertSupplierProductPricing(
  client,
  supplierId,
  stockProductId,
  unitPrice,
  pricingUnit = null,
) {
  if (unitPrice === null) {
    return;
  }

  await client.query(
    `
      insert into inventory.supplier_products (
        supplier_id,
        stock_product_id,
        unit_price,
        pricing_unit
      )
      values ($1, $2, $3, $4)
      on conflict (supplier_id, stock_product_id)
      do update
        set
          unit_price = excluded.unit_price,
          pricing_unit = coalesce(excluded.pricing_unit, inventory.supplier_products.pricing_unit),
          updated_at = now()
    `,
    [supplierId, stockProductId, unitPrice, pricingUnit],
  );
}

async function upsertStockBalance(
  client,
  stockProductId,
  onHandQuantityDelta,
  onHandUnit,
  unitConversionId,
  conversionRatio,
) {
  const existingBalanceResult = await client.query(
    `
      select
        id,
        stock_product_id,
        on_hand_quantity,
        on_hand_unit,
        unit_conversion_id,
        conversion_ratio,
        created_at,
        updated_at
      from inventory.stock_balances
      where stock_product_id = $1
      limit 1
    `,
    [stockProductId],
  );

  const existingBalance = existingBalanceResult.rows[0] ?? null;

  if (!existingBalance) {
    const insertResult = await client.query(
      `
        insert into inventory.stock_balances (
          stock_product_id,
          on_hand_quantity,
          on_hand_unit,
          unit_conversion_id,
          conversion_ratio
        )
        values ($1, $2, $3, $4, $5)
        returning
          id,
          stock_product_id,
          on_hand_quantity,
          on_hand_unit,
          unit_conversion_id,
          conversion_ratio,
          created_at,
          updated_at
      `,
      [stockProductId, onHandQuantityDelta, onHandUnit, unitConversionId, conversionRatio],
    );

    return insertResult.rows[0];
  }

  if (existingBalance.on_hand_unit !== onHandUnit) {
    const error = new Error(
      `Tồn kho hiện tại đang dùng đơn vị ${existingBalance.on_hand_unit}, không thể cộng thêm bằng đơn vị ${onHandUnit}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const updateResult = await client.query(
    `
      update inventory.stock_balances
      set
        on_hand_quantity = on_hand_quantity + $1,
        unit_conversion_id = coalesce($2, unit_conversion_id),
        conversion_ratio = coalesce($3, conversion_ratio),
        updated_at = now()
      where id = $4
      returning
        id,
        stock_product_id,
        on_hand_quantity,
        on_hand_unit,
        unit_conversion_id,
        conversion_ratio,
        created_at,
        updated_at
    `,
    [onHandQuantityDelta, unitConversionId, conversionRatio, existingBalance.id],
  );

  return updateResult.rows[0];
}

export async function createStockReceipt({
  ingredientName,
  productCategory,
  supplierName,
  inputQuantity,
  inputUnit,
  unitPrice,
  unitConversionId,
}) {
  return withTransaction(async (client) => {
    let conversionSnapshot = null;

    if (unitConversionId !== null) {
      conversionSnapshot = await findUnitConversionById(client, unitConversionId);

      if (!conversionSnapshot) {
        const error = new Error("Không tìm thấy tỷ lệ quy đổi đã chọn.");
        error.statusCode = 404;
        throw error;
      }

      if (conversionSnapshot.stock_unit !== inputUnit) {
        const error = new Error("Đơn vị nhập không khớp với đơn vị kho của tỷ lệ quy đổi.");
        error.statusCode = 400;
        throw error;
      }
    }

    const product = await findOrCreateStockProduct(client, ingredientName);
    await attachProductCategory(client, product.id, productCategory);
    const supplier = await findOrCreateSupplier(client, {
      supplierName,
      primaryCategory: productCategory,
      defaultUnitPrice: unitPrice,
      pricingUnit: unitPrice !== null ? inputUnit : null,
    });
    await upsertSupplierProductPricing(
      client,
      supplier.id,
      product.id,
      unitPrice,
      unitPrice !== null ? inputUnit : null,
    );

    const normalizedQuantity = conversionSnapshot
      ? inputQuantity * Number(conversionSnapshot.conversion_ratio)
      : inputQuantity;
    const normalizedUnit = conversionSnapshot
      ? conversionSnapshot.processing_unit
      : inputUnit;

    const inboundResult = await client.query(
      `
        insert into inventory.stock_inbounds (
          stock_product_id,
          supplier_id,
          input_quantity,
          input_unit,
          unit_price,
          currency_code,
          unit_conversion_id,
          conversion_ratio,
          remaining_quantity
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning
          id,
          stock_product_id,
          supplier_id,
          input_quantity,
          input_unit,
          unit_price,
          currency_code,
          unit_conversion_id,
          conversion_ratio,
          remaining_quantity,
          (
            select supplier_name
            from inventory.suppliers
            where id = supplier_id
          ) as supplier_name,
          created_at,
          updated_at
      `,
      [
        product.id,
        supplier.id,
        inputQuantity,
        inputUnit,
        unitPrice,
        "VND",
        unitConversionId,
        conversionSnapshot ? conversionSnapshot.conversion_ratio : null,
        normalizedQuantity,
      ],
    );

    const balance = await upsertStockBalance(
      client,
      product.id,
      normalizedQuantity,
      normalizedUnit,
      unitConversionId,
      conversionSnapshot ? Number(conversionSnapshot.conversion_ratio) : null,
    );

    return mapInventoryReceipt({
      product,
      inbound: inboundResult.rows[0],
      balance,
    });
  });
}
