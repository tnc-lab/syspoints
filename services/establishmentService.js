const crypto = require('crypto');
const { listEstablishments, createEstablishment, findById, updateEstablishment } = require('../repositories/establishmentRepository');

async function listEstablishmentsService() {
  return listEstablishments();
}

async function createEstablishmentService({ name, category, image_url }) {
  const id = crypto.randomUUID();
  return createEstablishment({ id, name, category, image_url });
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
    createEstablishment: createEstablishmentService,
    getEstablishmentById,
    updateEstablishment: updateEstablishmentService,
  },
};
