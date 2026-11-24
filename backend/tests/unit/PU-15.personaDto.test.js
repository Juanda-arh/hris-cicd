/**
 * PU-15 · Serializador (DTO) de persona/empleado
 * Resultado esperado: La respuesta excluye el hash de contraseña y los secretos de 2FA.
 * Código bajo prueba: src/utils/personaDto.js
 */
const { toPersonaDTO, toPersonaListDTO, CAMPOS_PUBLICOS } = require('../../src/utils/personaDto');

const HASH = '$2a$10$abcdefghijklmnopqrstuuJ0vY1e1q8Tq8Q8yQb8E8Q8b8Q8b8Q8b';
const SECRETO = 'JBSWY3DPEHPK3PXP';

const FILA = {
  id: 1,
  nombre: 'Administrador HRIS',
  cedula: '1000000001',
  correo: 'admin@msmechanical.test',
  usuario: 'admin',
  rol: 'Administrador',
  fecha_nacimiento: '1985-05-20',
  telefono: '3000000001',
  direccion: 'Calle 1 # 2-3',
  eps: 'Sura',
  arl: 'Sura',
  fondo_pension: 'Porvenir',
  cesantias: 'Porvenir',
  dias_vacaciones: 15,
  lider_id: null,
  estado: 'Activo',
  creado_en: new Date('2026-10-01T00:00:00Z'),
  actualizado_en: new Date('2026-10-01T00:00:00Z'),
  clave_hash: HASH,
  totp_secret: SECRETO,
  columna_interna_nueva: 'no debe salir',
};

describe('PU-15 · Serializador (DTO) de persona/empleado', () => {
  test('excluye el hash de contraseña y el secreto de 2FA', () => {
    const dto = toPersonaDTO(FILA);
    expect(dto).not.toHaveProperty('clave_hash');
    expect(dto).not.toHaveProperty('totp_secret');
  });

  test('el JSON que viaja al cliente no contiene el hash ni el secreto', () => {
    const json = JSON.stringify(toPersonaDTO(FILA));
    expect(json).not.toContain(HASH);
    expect(json).not.toContain(SECRETO);
  });

  test('es una lista blanca: columnas nuevas no salen hasta que se agreguen explícitamente', () => {
    const dto = toPersonaDTO(FILA);
    expect(dto).not.toHaveProperty('columna_interna_nueva');
    const permitidos = [...CAMPOS_PUBLICOS, 'edad', 'tiene_2fa'];
    expect(Object.keys(dto).every((campo) => permitidos.includes(campo))).toBe(true);
  });

  test('conserva los datos públicos e indica si tiene 2FA sin revelar el secreto', () => {
    const dto = toPersonaDTO(FILA);
    expect(dto).toEqual(expect.objectContaining({ id: 1, nombre: 'Administrador HRIS', correo: 'admin@msmechanical.test', rol: 'Administrador', eps: 'Sura' }));
    expect(dto.tiene_2fa).toBe(true);
    expect(toPersonaDTO({ ...FILA, totp_secret: null }).tiene_2fa).toBe(false);
    expect(typeof dto.edad).toBe('number');
  });

  test('una fecha de nacimiento inválida deja la edad en null', () => {
    expect(toPersonaDTO({ ...FILA, fecha_nacimiento: 'x' }).edad).toBeNull();
  });

  test('las listas se serializan elemento por elemento; null se mantiene', () => {
    const lista = toPersonaListDTO([FILA, { ...FILA, id: 2 }]);
    expect(lista).toHaveLength(2);
    expect(JSON.stringify(lista)).not.toContain(HASH);
    expect(toPersonaListDTO()).toEqual([]);
    expect(toPersonaDTO(null)).toBeNull();
  });
});
