async function listModules(dbClient) {
  const result = await dbClient.query(
    `SELECT
      module_key,
      name,
      version,
      description,
      manifest_json,
      manifest_sha256,
      status,
      execution_order,
      uploaded_by,
      uploaded_at,
      activated_at,
      deactivated_at,
      last_error
     FROM system_modules
     ORDER BY execution_order ASC, uploaded_at ASC`
  );
  return result.rows;
}

async function listActiveModules(dbClient) {
  const result = await dbClient.query(
    `SELECT
      module_key,
      name,
      version,
      description,
      manifest_json,
      manifest_sha256,
      status,
      execution_order,
      uploaded_by,
      uploaded_at,
      activated_at,
      deactivated_at,
      last_error
     FROM system_modules
     WHERE status = 'active'
     ORDER BY execution_order ASC, uploaded_at ASC`
  );
  return result.rows;
}

async function findByModuleKey(dbClient, moduleKey) {
  const result = await dbClient.query(
    `SELECT
      module_key,
      name,
      version,
      description,
      manifest_json,
      manifest_sha256,
      status,
      execution_order,
      uploaded_by,
      uploaded_at,
      activated_at,
      deactivated_at,
      last_error
     FROM system_modules
     WHERE module_key = $1
     LIMIT 1`,
    [moduleKey]
  );
  return result.rows[0] || null;
}

async function insertModule(dbClient, payload) {
  const result = await dbClient.query(
    `INSERT INTO system_modules (
      module_key,
      name,
      version,
      description,
      manifest_json,
      manifest_sha256,
      status,
      execution_order,
      uploaded_by
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
    RETURNING
      module_key,
      name,
      version,
      description,
      manifest_json,
      manifest_sha256,
      status,
      execution_order,
      uploaded_by,
      uploaded_at,
      activated_at,
      deactivated_at,
      last_error`,
    [
      payload.module_key,
      payload.name,
      payload.version,
      payload.description || null,
      JSON.stringify(payload.manifest_json),
      payload.manifest_sha256,
      payload.status || 'inactive',
      payload.execution_order,
      payload.uploaded_by || null,
    ]
  );

  return result.rows[0] || null;
}

async function activateModule(dbClient, moduleKey) {
  const result = await dbClient.query(
    `UPDATE system_modules
     SET status = 'active',
         activated_at = NOW(),
         deactivated_at = NULL,
         last_error = NULL
     WHERE module_key = $1
     RETURNING
      module_key,
      name,
      version,
      description,
      manifest_json,
      manifest_sha256,
      status,
      execution_order,
      uploaded_by,
      uploaded_at,
      activated_at,
      deactivated_at,
      last_error`,
    [moduleKey]
  );
  return result.rows[0] || null;
}

async function deactivateModule(dbClient, moduleKey) {
  const result = await dbClient.query(
    `UPDATE system_modules
     SET status = 'inactive',
         deactivated_at = NOW(),
         last_error = NULL
     WHERE module_key = $1
     RETURNING
      module_key,
      name,
      version,
      description,
      manifest_json,
      manifest_sha256,
      status,
      execution_order,
      uploaded_by,
      uploaded_at,
      activated_at,
      deactivated_at,
      last_error`,
    [moduleKey]
  );
  return result.rows[0] || null;
}

module.exports = {
  listModules,
  listActiveModules,
  findByModuleKey,
  insertModule,
  activateModule,
  deactivateModule,
};
