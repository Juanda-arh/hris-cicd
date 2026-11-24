// Configuración de Jest (documento técnico del pipeline, sección 5.3) con dos ajustes:
//  - verbose: true, para que la salida liste cada prueba PU-xx con su resultado.
//  - roots incluye src/ además de tests/: así Jest ve también los archivos SIN pruebas y los cuenta
//    con 0 % en la cobertura. Con roots solo en tests/unit esos archivos se ignoran y el umbral nunca falla.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/services/**/*.js',
    'src/utils/**/*.js',
    'src/middlewares/**/*.js',
  ],
  coverageDirectory: 'coverage',
  // 'text' imprime la tabla en consola. Con --json (npm run test:ci) Jest silencia la consola,
  // por eso la misma tabla se guarda también en coverage/coverage.txt y el pipeline la muestra.
  coverageReporters: ['text', ['text', { file: 'coverage.txt' }], 'lcov', 'cobertura', 'json-summary'],
  coverageThreshold: {
    './src/services/': { lines: 80 },
    './src/utils/': { lines: 80 },
  },
};
