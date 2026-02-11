const crypto = require('crypto');
const { listEstablishments, createEstablishment, findById } = require('../repositories/establishmentRepository');

async function listEstablishmentsService() {
  return listEstablishments();
}

async function createEstablishmentService({ name, category }) {
  const id = crypto.randomUUID();
  return createEstablishment({ id, name, category });
}

async function getEstablishmentById(id) {
  return findById(id);
}

module.exports = {
  establishmentService: {
    listEstablishments: listEstablishmentsService,
    createEstablishment: createEstablishmentService,
    getEstablishmentById,
  },
};
