'use strict';

// Envuelve un controlador async para que los errores lleguen al manejador global
const asyncHandler = (controlador) => (req, res, next) => {
  Promise.resolve(controlador(req, res, next)).catch(next);
};

module.exports = asyncHandler;
