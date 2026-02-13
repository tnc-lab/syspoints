const crypto = require('crypto');
const {
  listEstablishments,
  listTopReviewedEstablishments,
  createEstablishment,
  findById,
  updateEstablishment,
} = require('../repositories/establishmentRepository');

async function listEstablishmentsService() {
  return listEstablishments();
}

async function createEstablishmentService({ name, category, image_url }) {
  const id = crypto.randomUUID();
  return createEstablishment({ id, name, category, image_url });
}

async function listTopReviewedEstablishmentsService({ page, pageSize }) {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listTopReviewedEstablishments({ limit: pageSize, offset });

  return {
    data: rows.map((row) => ({
      ...row,
      review_count: Number(row.review_count || 0),
      avg_stars: Number(row.avg_stars || 0),
    })),
    meta: {
      page,
      page_size: pageSize,
      total,
    },
  };
}

async function getEstablishmentById(id) {
  return findById(id);
}

async function updateEstablishmentService({ id, name, category, image_url }) {
  return updateEstablishment({ id, name, category, image_url });
}

module.exports = {
  establishmentService: {
    listEstablishments: listEstablishmentsService,
    listTopReviewedEstablishments: listTopReviewedEstablishmentsService,
    createEstablishment: createEstablishmentService,
    getEstablishmentById,
    updateEstablishment: updateEstablishmentService,
  },
};
