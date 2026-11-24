'use strict';

const { Router } = require('express');
const comprobanteService = require('../services/comprobanteService');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// GET /api/comprobantes/mis-comprobantes?anio=2026
router.get('/mis-comprobantes', asyncHandler(async (req, res) => {
  res.json(await comprobanteService.listarPropios(req.user, req.query));
}));

module.exports = router;
