import { query, withTransaction } from "../../../db/connection.mjs";

async function findOrCreateStockProduct(client, productName, productCategory) {
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
    [productName, productCategory],
  );

  return Number(result.rows[0].id);
}

function mapSupplierRow(row) {
  const rawProductNames = typeof row.product_names === "string" ? row.product_names.trim() : "";
  const rawProductCount = row.product_count;

  return {
    id: Number(row.id),
    supplierName: row.supplier_name,
    primaryCategory: row.primary_category,
    defaultUnitPrice: row.default_unit_price === null ? null : Number(row.default_unit_price),
    currencyCode: row.currency_code,
    pricingUnit: row.pricing_unit ?? null,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    isActive: Boolean(row.is_active),
    productNames: rawProductNames ? rawProductNames : null,
    productCount:
      rawProductCount === null || rawProductCount === undefined ? 0 : Number(rawProductCount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSuppliers() {
  const result = await query(
    `
      select
        s.id,
        s.supplier_name,
        s.primary_category,
        s.default_unit_price,
        s.currency_code,
        s.pricing_unit,
        s.contact_name,
        s.phone,
        s.email,
        s.address,
        s.notes,
        s.is_active,
        s.created_at,
        s.updated_at,
        products.product_names,
        products.product_count
      from inventory.suppliers s
      left join lateral (
        select
          string_agg(distinct sp.product_name, ', ' order by sp.product_name) as product_names,
          count(distinct sp.id) as product_count
        from inventory.supplier_products sps
        join inventory.stock_products sp on sp.id = sps.stock_product_id
        where sps.supplier_id = s.id
      ) products on true
      where s.is_active = true
      order by s.updated_at desc, s.supplier_name asc
      limit 100
    `,
  );

  return result.rows.map(mapSupplierRow);
}

export async function createSupplier({
  supplierName,
  primaryCategory,
  defaultUnitPrice,
  pricingUnit,
  contactName,
  phone,
  email,
  address,
  notes,
  featuredProductName,
}) {
  return withTransaction(async (client) => {
    const supplierResult = await client.query(
      `
        insert into inventory.suppliers (
          supplier_name,
          primary_category,
          default_unit_price,
          currency_code,
          pricing_unit,
          contact_name,
          phone,
          email,
          address,
          notes
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (supplier_name)
        do update
          set
            primary_category = coalesce(excluded.primary_category, inventory.suppliers.primary_category),
            default_unit_price = coalesce(excluded.default_unit_price, inventory.suppliers.default_unit_price),
            pricing_unit = coalesce(excluded.pricing_unit, inventory.suppliers.pricing_unit),
            contact_name = coalesce(excluded.contact_name, inventory.suppliers.contact_name),
            phone = coalesce(excluded.phone, inventory.suppliers.phone),
            email = coalesce(excluded.email, inventory.suppliers.email),
            address = coalesce(excluded.address, inventory.suppliers.address),
            notes = coalesce(excluded.notes, inventory.suppliers.notes),
            updated_at = now()
        returning
          id,
          supplier_name,
          primary_category,
          default_unit_price,
          currency_code,
          pricing_unit,
          contact_name,
          phone,
          email,
          address,
          notes,
          is_active,
          created_at,
          updated_at
      `,
      [
        supplierName,
        primaryCategory,
        defaultUnitPrice,
        "VND",
        pricingUnit ?? null,
        contactName,
        phone,
        email,
        address,
        notes,
      ],
    );

    const supplier = supplierResult.rows[0];
    const supplierId = Number(supplier.id);

    if (featuredProductName && defaultUnitPrice !== null) {
      const stockProductId = await findOrCreateStockProduct(
        client,
        featuredProductName,
        primaryCategory,
      );

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
        [supplierId, stockProductId, defaultUnitPrice, pricingUnit ?? null],
      );
    }

    return mapSupplierRow(supplier);
  });
}
