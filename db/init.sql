-- =====================================================================
-- HRIS - M&S Mechanical LLC · Esquema y datos semilla
-- PostgreSQL lo ejecuta solo cuando el volumen de datos está vacío
-- (docker-entrypoint-initdb.d). Para reinicializar: docker compose down -v
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Personas: Administrador, Líder y Empleado en una sola tabla
-- ---------------------------------------------------------------------
CREATE TABLE personas (
    id               SERIAL PRIMARY KEY,
    nombre           VARCHAR(100) NOT NULL CHECK (length(trim(nombre)) > 0),
    cedula           VARCHAR(10)  NOT NULL UNIQUE CHECK (cedula ~ '^[0-9]{6,10}$'),
    correo           VARCHAR(100) NOT NULL UNIQUE CHECK (correo = lower(correo) AND correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    usuario          VARCHAR(50)  NOT NULL UNIQUE CHECK (usuario ~ '^[a-z0-9._-]{3,50}$'),
    clave_hash       VARCHAR(100),
    rol              VARCHAR(20)  NOT NULL CHECK (rol IN ('Administrador', 'Lider', 'Empleado')),
    fecha_nacimiento DATE         NOT NULL,
    telefono         VARCHAR(10)  CHECK (telefono ~ '^[0-9]{10}$'),
    direccion        VARCHAR(100),
    eps              VARCHAR(50)  NOT NULL,
    arl              VARCHAR(50)  NOT NULL,
    fondo_pension    VARCHAR(50)  NOT NULL,
    cesantias        VARCHAR(50)  NOT NULL,
    dias_vacaciones  INTEGER      NOT NULL DEFAULT 15 CHECK (dias_vacaciones BETWEEN 0 AND 365),
    lider_id         INTEGER      REFERENCES personas (id) ON DELETE SET NULL,
    totp_secret      VARCHAR(64)  CHECK (totp_secret ~ '^[A-Z2-7]+=*$'),
    estado           VARCHAR(10)  NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT personas_lider_distinto CHECK (lider_id IS NULL OR lider_id <> id)
);

CREATE INDEX idx_personas_lider ON personas (lider_id);

-- ---------------------------------------------------------------------
-- Contactos de emergencia (varios por persona)
-- ---------------------------------------------------------------------
CREATE TABLE contactos_emergencia (
    id          SERIAL PRIMARY KEY,
    persona_id  INTEGER      NOT NULL REFERENCES personas (id) ON DELETE CASCADE,
    nombre      VARCHAR(100) NOT NULL CHECK (length(trim(nombre)) > 0),
    parentesco  VARCHAR(30)  NOT NULL,
    telefono    VARCHAR(10)  NOT NULL CHECK (telefono ~ '^[0-9]{10}$'),
    ciudad      VARCHAR(50),
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contactos_persona ON contactos_emergencia (persona_id);

-- ---------------------------------------------------------------------
-- Permisos y vacaciones: Pendiente -> Aprobado | Rechazado
-- ---------------------------------------------------------------------
CREATE TABLE permisos (
    id                  SERIAL PRIMARY KEY,
    empleado_id         INTEGER      NOT NULL REFERENCES personas (id) ON DELETE CASCADE,
    tipo                VARCHAR(20)  NOT NULL CHECK (tipo IN ('Vacaciones', 'Ausencia')),
    fecha_inicio        DATE         NOT NULL,
    fecha_fin           DATE         NOT NULL,
    dias_habiles        INTEGER      NOT NULL CHECK (dias_habiles > 0),
    motivo              VARCHAR(300),
    estado              VARCHAR(10)  NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado')),
    fecha_solicitud     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    decidido_por        INTEGER      REFERENCES personas (id),
    fecha_decision      TIMESTAMPTZ,
    comentario_decision VARCHAR(300),
    CONSTRAINT permisos_rango_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT permisos_decision_completa CHECK (
        (estado = 'Pendiente' AND decidido_por IS NULL AND fecha_decision IS NULL)
        OR (estado <> 'Pendiente' AND decidido_por IS NOT NULL AND fecha_decision IS NOT NULL)
    ),
    CONSTRAINT permisos_no_autoaprobado CHECK (decidido_por IS NULL OR decidido_por <> empleado_id)
);

CREATE INDEX idx_permisos_empleado ON permisos (empleado_id, estado);

-- ---------------------------------------------------------------------
-- Comprobantes de pago (uno por persona y mes)
-- ---------------------------------------------------------------------
CREATE TABLE comprobantes_pago (
    id            SERIAL PRIMARY KEY,
    persona_id    INTEGER       NOT NULL REFERENCES personas (id) ON DELETE CASCADE,
    periodo       DATE          NOT NULL CHECK (EXTRACT(DAY FROM periodo) = 1),
    fecha_pago    DATE          NOT NULL,
    salario_base  NUMERIC(14,2) NOT NULL CHECK (salario_base >= 0),
    deducciones   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (deducciones >= 0),
    neto          NUMERIC(14,2) NOT NULL,
    creado_en     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT comprobantes_unico_por_mes UNIQUE (persona_id, periodo),
    CONSTRAINT comprobantes_neto CHECK (neto = salario_base - deducciones)
);

-- ---------------------------------------------------------------------
-- Auditoría: solo acciones de usuarios autenticados (persona_id obligatorio)
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
    id              BIGSERIAL PRIMARY KEY,
    persona_id      INTEGER     NOT NULL REFERENCES personas (id),
    accion          VARCHAR(50) NOT NULL,
    tabla_afectada  VARCHAR(50) NOT NULL,
    registro_id     INTEGER,
    detalle         JSONB,
    fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auditoria_fecha ON auditoria (fecha DESC);
CREATE INDEX idx_auditoria_persona ON auditoria (persona_id);

-- =====================================================================
-- Datos semilla
-- Contraseñas: Admin123* · Lider123* · Empleado123* (hashes bcrypt de 10 rondas)
-- 2FA del Administrador: secreto base32 JBSWY3DPEHPK3PXP (registrar en Google Authenticator
-- o usar `npm run totp` en backend/)
-- Las semillas son acciones del sistema: no generan registros de auditoría.
-- =====================================================================
INSERT INTO personas (id, nombre, cedula, correo, usuario, clave_hash, rol, fecha_nacimiento, telefono, direccion,
                      eps, arl, fondo_pension, cesantias, dias_vacaciones, lider_id, totp_secret) VALUES
(1, 'Andrea Molina',   '1000000001', 'admin@msmechanical.test',     'admin',
    '$2a$10$VtIxevvA60dWbDacgxDmPeLs0dGma1iUOQNNhHuPcadpv7ZLw/0o.', 'Administrador', '1985-05-20', '3000000001', 'Calle 10 # 5-20, Armenia',
    'Sura', 'Sura', 'Porvenir', 'Porvenir', 15, NULL, 'JBSWY3DPEHPK3PXP'),
(2, 'Carlos Ramírez',  '1000000002', 'lider@msmechanical.test',     'lider',
    '$2a$10$j6Exa4.sRXNlu6kbcSBLr.iSSFiHG4V3vTQPMum1NE76UAjE4hgtG', 'Lider',         '1988-09-12', '3000000002', 'Carrera 14 # 20-30, Armenia',
    'Sanitas', 'Positiva', 'Protección', 'Protección', 15, NULL, NULL),
(3, 'Ana Torres',      '1000000003', 'empleado1@msmechanical.test', 'empleado1',
    '$2a$10$M8m6nsgufHbXF1aycGeRZudM4yEIzvIj73Ay2FNWu223TfcfaSid6', 'Empleado',      '2000-02-29', '3000000003', 'Calle 21 # 15-08, Armenia',
    'Nueva EPS', 'Positiva', 'Colpensiones', 'Fondo Nacional del Ahorro', 15, 2, NULL),
(4, 'Pedro Gómez',     '1000000004', 'empleado2@msmechanical.test', 'empleado2',
    '$2a$10$M8m6nsgufHbXF1aycGeRZudM4yEIzvIj73Ay2FNWu223TfcfaSid6', 'Empleado',      '1992-11-03', '3000000004', 'Avenida Bolívar # 3-45, Armenia',
    'Compensar', 'Sura', 'Porvenir', 'Porvenir', 10, 2, NULL),
(5, 'Sofía Rojas',     '1000000005', 'empleado3@msmechanical.test', 'empleado3',
    '$2a$10$M8m6nsgufHbXF1aycGeRZudM4yEIzvIj73Ay2FNWu223TfcfaSid6', 'Empleado',      '1997-07-25', '3000000005', 'Calle 50 # 12-10, Armenia',
    'Salud Total', 'Colmena', 'Skandia', 'Skandia', 5, 2, NULL);

SELECT setval(pg_get_serial_sequence('personas', 'id'), (SELECT MAX(id) FROM personas));

INSERT INTO contactos_emergencia (persona_id, nombre, parentesco, telefono, ciudad) VALUES
(3, 'María Torres', 'Mother', '3100000003', 'Armenia'),
(4, 'Luisa Gómez',  'Spouse', '3100000004', 'Pereira');

INSERT INTO comprobantes_pago (persona_id, periodo, fecha_pago, salario_base, deducciones, neto) VALUES
(2, '2026-08-01', '2026-08-30', 6500000, 520000, 5980000),
(2, '2026-09-01', '2026-09-30', 6500000, 520000, 5980000),
(3, '2026-08-01', '2026-08-30', 3200000, 256000, 2944000),
(3, '2026-09-01', '2026-09-30', 3200000, 256000, 2944000),
(3, '2026-10-01', '2026-10-30', 3200000, 256000, 2944000),
(4, '2026-09-01', '2026-09-30', 2900000, 232000, 2668000),
(4, '2026-10-01', '2026-10-30', 2900000, 232000, 2668000),
(5, '2026-10-01', '2026-10-30', 2500000, 200000, 2300000);

COMMIT;
