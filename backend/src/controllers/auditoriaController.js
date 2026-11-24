'use strict';

const { Router } = require('express');
const config = require('../config');
const auditService = require('../services/auditService');
const { authorize } = require('../middlewares/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// GET /api/auditoria?fechaInicio=&fechaFin=&personaId=&accion=&pagina=&porPagina=
router.get('/', authorize(config.ROLES.ADMIN), asyncHandler(async (req, res) => {
  res.json(await auditService.listar(req.query));
}));

module.exports = router;
