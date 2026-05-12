import { query, withTransaction } from "../../../db/connection.mjs";

function mapPortioningRule(row) {
  const conversionRatio = Number(row.conversion_ratio);

  return {
    id: row.unit_conversion_id,
    portionDefinitionId: row.portion_definition_id,
    name: row.portion_name,
    description: row.portion_description,
    stockUnit: row.stock_unit,
    processingUnit: row.processing_unit,
    conversionRatio,
    ratioLabel: `1 ${row.stock_unit} = ${conversionRatio} ${row.processing_unit}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findRuleById(client, id) {
  const result = await client.query(
    `
      select
        uc.id as unit_conversion_id,
        pd.id as portion_definition_id,
        pd.name as portion_name,
        pd.description as portion_description,
        uc.stock_unit,
        uc.processing_unit,
        uc.conversion_ratio,
        uc.created_at,
        uc.updated_at
      from inventory.unit_conversions uc
      join inventory.portion_definitions pd
        on pd.id = uc.portion_definition_id
      where uc.id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function listPortioningRules() {
  const result = await query(`
    select
      uc.id as unit_conversion_id,
      pd.id as portion_definition_id,
      pd.name as portion_name,
      pd.description as portion_description,
      uc.stock_unit,
      uc.processing_unit,
      uc.conversion_ratio,
      uc.created_at,
      uc.updated_at
    from inventory.unit_conversions uc
    join inventory.portion_definitions pd
      on pd.id = uc.portion_definition_id
    where pd.is_active = true
    order by uc.created_at desc, uc.id desc
  `);

  return result.rows.map(mapPortioningRule);
}

export async function createPortioningRule({
  name,
  description,
  stockUnit,
  processingUnit,
  conversionRatio,
}) {
  return withTransaction(async (client) => {
    const portionResult = await client.query(
      `
        insert into inventory.portion_definitions (name, description)
        values ($1, $2)
        returning id, name, description
      `,
      [name, description || null],
    );

    const portionDefinition = portionResult.rows[0];

    const conversionResult = await client.query(
      `
        insert into inventory.unit_conversions (
          portion_definition_id,
          stock_unit,
          processing_unit,
          conversion_ratio
        )
        values ($1, $2, $3, $4)
        returning
          id as unit_conversion_id,
          portion_definition_id,
          stock_unit,
          processing_unit,
          conversion_ratio,
          created_at,
          updated_at
      `,
      [portionDefinition.id, stockUnit, processingUnit, conversionRatio],
    );

    return mapPortioningRule({
      ...conversionResult.rows[0],
      portion_name: portionDefinition.name,
      portion_description: portionDefinition.description,
    });
  });
}

export async function updatePortioningRule({
  id,
  name,
  description,
  stockUnit,
  processingUnit,
  conversionRatio,
}) {
  return withTransaction(async (client) => {
    const existingRule = await findRuleById(client, id);

    if (!existingRule) {
      const error = new Error("Không tìm thấy quy đổi cần sửa.");
      error.statusCode = 404;
      throw error;
    }

    await client.query(
      `
        update inventory.portion_definitions
        set
          name = $1,
          description = $2,
          updated_at = now()
        where id = $3
      `,
      [name, description || null, existingRule.portion_definition_id],
    );

    await client.query(
      `
        update inventory.unit_conversions
        set
          stock_unit = $1,
          processing_unit = $2,
          conversion_ratio = $3,
          updated_at = now()
        where id = $4
      `,
      [stockUnit, processingUnit, conversionRatio, id],
    );

    const updatedRule = await findRuleById(client, id);
    return mapPortioningRule(updatedRule);
  });
}
