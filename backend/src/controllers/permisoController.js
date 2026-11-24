'use strict';

const { Router } = require('express');
const config = require('../config');
const vacacionesService = require('../services/vacacionesService');
const { authorize } = require('../middlewares/auth');
const asyncHandler = require('../utils/asyncHandler');
const { idDe } = require('./params');

const { ADMIN, LIDER } = config.ROLES;
const router = Router();

router.get('/saldo', asyncHandler(async (req, res) => {
  res.json(await vacacionesService.consultarSaldo(req.user));
}));

router.get('/mias', asyncHandler(async (req, res) => {
  res.json(await vacacionesService.listarPropias(req.user, req.query));
}));

router.get('/revision', authorize(ADMIN, LIDER), asyncHandler(async (req, res) => {
  res.json(await vacacionesService.listarParaRevision(req.user, req.query));
}));

// POST /api/permisos { tipo, fechaInicio, fechaFin, motivo }
router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json(await vacacionesService.solicitar(req.user, req.body));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await vacacionesService.obtener(req.user, idDe(req.params.id)));
}));

// PATCH /api/permisos/:id/decision { decision: 'Aprobado' | 'Rechazado', comentario }
router.patch('/:id/decision', authorize(ADMIN, LIDER), asyncHandler(async (req, res) => {
  res.json(await vacacionesService.decidir(req.user, idDe(req.params.id), req.body));
}));

module.exports = router;
