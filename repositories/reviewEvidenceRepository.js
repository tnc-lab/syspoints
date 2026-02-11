async function createEvidenceBatch(client, { review_id, evidence }) {
  if (evidence.length === 0) return [];

  const values = [];
  const params = [];
  let index = 1;

  evidence.forEach((item) => {
    values.push(`($${index++}, $${index++})`);
    params.push(review_id, item.image_url);
  });

  const result = await client.query(
    `INSERT INTO review_evidence (review_id, image_url)
     VALUES ${values.join(', ')}
     RETURNING id, review_id, image_url, created_at`,
    params
  );

  return result.rows;
}

module.exports = {
  createEvidenceBatch,
};
