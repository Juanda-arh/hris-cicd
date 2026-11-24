'use strict';

const { Router } = require('express');
const contactoService = require('../services/contactoService');
const asyncHandler = require('../utils/asyncHandler');
const { idDe } = require('./params');

const router = Router();

router.get('/mis-contactos', asyncHandler(async (req, res) => {
  res.json(await contactoService.listar(req.user, req.user.id));
}));

router.post('/mis-contactos', asyncHandler(async (req, res) => {
  res.status(201).json(await contactoService.crear(req.user, req.user.id, req.body));
}));

router.get('/persona/:personaId', asyncHandler(async (req, res) => {
  res.json(await contactoService.listar(req.user, idDe(req.params.personaId, 'personaId')));
}));

// POST /api/contactos-emergencia { personaId, nombre, parentesco, telefono, ciudad }
router.post('/', asyncHandler(async (req, res) => {
  const personaId = idDe(req.body?.personaId, 'personaId');
  res.status(201).json(await contactoService.crear(req.user, personaId, req.body));
}));

module.exports = router;
