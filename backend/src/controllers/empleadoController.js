'use strict';

const { Router } = require('express');
const config = require('../config');
const empleadoService = require('../services/empleadoService');
const { authorize } = require('../middlewares/auth');
const asyncHandler = require('../utils/asyncHandler');
const { idDe } = require('./params');

const { ADMIN, LIDER } = config.ROLES;
const router = Router();

router.get('/', authorize(ADMIN, LIDER), asyncHandler(async (req, res) => {
  res.json(await empleadoService.listar(req.user));
}));

// Va antes de /:id para que "me" no se lea como id
router.get('/me', asyncHandler(async (req, res) => {
  res.json(await empleadoService.obtenerPropio(req.user));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await empleadoService.obtener(req.user, idDe(req.params.id)));
}));

router.post('/', authorize(ADMIN), asyncHandler(async (req, res) => {
  const creado = await empleadoService.crear(req.user, req.body);
  res.status(201).location(`/api/empleados/${creado.id}`).json({ ...creado, personaId: creado.id });
}));

router.patch('/:id', authorize(ADMIN), asyncHandler(async (req, res) => {
  res.json(await empleadoService.actualizar(req.user, idDe(req.params.id), req.body));
}));

module.exports = router;
