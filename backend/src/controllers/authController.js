'use strict';

const { Router } = require('express');
const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// POST /api/auth/login { usuario, clave } -> { token } o { requiereOtp, personaId } (Administrador)
router.post('/login', asyncHandler(async (req, res) => {
  res.json(await authService.login(req.body));
}));

// POST /api/auth/verify-otp { personaId, codigo } -> { token }
router.post('/verify-otp', asyncHandler(async (req, res) => {
  res.json(await authService.verificarOtp(req.body));
}));

module.exports = router;
