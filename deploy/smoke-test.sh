#!/usr/bin/env bash
# =====================================================================
# Prueba de humo del HRIS contra un ambiente desplegado.
# Verifica /health y los casos de caja negra CN-01, 02, 03, 04, 07, 08, 12, 13 y 19
# del plan de pruebas usando curl (y Python 3 para leer JSON y calcular el código 2FA).
#
# Uso:
#   deploy/smoke-test.sh [BASE_URL]            # por defecto http://localhost:3000
# Variables opcionales:
#   ADMIN_TOTP_SECRET  secreto 2FA del Administrador (por defecto el de la semilla)
#   JWT_SECRET         si se conoce, CN-07 comprueba además el mensaje "Token expired"
#   SMOKE_READONLY=1   no crea registros (omite el 201 de CN-08). Úsalo contra un servidor real.
#   HEALTH_TIMEOUT     segundos a esperar a que /health responda (por defecto 90)
# Sale con código 0 si todo pasa y 1 si algo falla.
# =====================================================================
set -uo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}"
ADMIN_TOTP_SECRET="${ADMIN_TOTP_SECRET:-JBSWY3DPEHPK3PXP}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
SMOKE_READONLY="${SMOKE_READONLY:-0}"

# Python 3 (python3 en Linux/macOS, python en Windows/Git Bash)
PY=""
for candidato in python3 python; do
  if command -v "$candidato" >/dev/null 2>&1 && "$candidato" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
    PY="$candidato"
    break
  fi
done
if [ -z "$PY" ]; then
  echo "ERROR: Python 3 is required to read JSON responses" >&2
  exit 2
fi
# En Windows Python lee stdin como cp1252: se fuerza UTF-8 para no dañar las tildes de las respuestas
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8

TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT
PASSED=0
FAILED=0
STATUS=""
BODY=""

# req METODO RUTA [TOKEN] [JSON]  -> deja STATUS y BODY
req() {
  local metodo="$1" ruta="$2" token="${3:-}" datos="${4:-}"
  local args=(-s -o "$TMP_BODY" -w '%{http_code}' -X "$metodo" "${BASE_URL}${ruta}" -H 'Accept: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer ${token}")
  # El cuerpo va por stdin y no como argumento: curl.exe en Windows recodifica los argumentos
  # y dañaría las tildes (UTF-8)
  [ -n "$datos" ] && args+=(-H 'Content-Type: application/json; charset=utf-8' --data-binary @-)
  STATUS="$(printf '%s' "$datos" | curl "${args[@]}")" || STATUS="000"
  BODY="$(cat "$TMP_BODY")"
}

# json 'expresión sobre d'  -> evalúa sobre el BODY actual (d = JSON decodificado)
json() {
  printf '%s' "$BODY" | "$PY" -c 'import json,sys
try:
    d = json.loads(sys.stdin.read() or "null")
    r = eval(sys.argv[1])
except Exception:
    r = ""
print("true" if r is True else "false" if r is False else r)' "$1"
}

# payload de un JWT sin verificar la firma: jwt_claim TOKEN campo
jwt_claim() {
  "$PY" -c 'import base64,json,sys
p = sys.argv[1].split(".")[1]
print(json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4))).get(sys.argv[2], ""))' "$1" "$2" 2>/dev/null
}

totp() {
  "$PY" -c 'import base64,hashlib,hmac,struct,sys,time
k = base64.b32decode(sys.argv[1].upper() + "=" * (-len(sys.argv[1]) % 8))
h = hmac.new(k, struct.pack(">Q", int(time.time()) // 30), hashlib.sha1).digest()
o = h[-1] & 15
print("%06d" % ((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 1000000))' "$1"
}

# JWT HS256 ya vencido; si no se conoce JWT_SECRET se firma con otro secreto
expired_token() {
  "$PY" -c 'import base64,hashlib,hmac,json,sys,time
b = lambda x: base64.urlsafe_b64encode(json.dumps(x, separators=(",", ":")).encode()).rstrip(b"=")
n = int(time.time())
s = b".".join([b({"alg": "HS256", "typ": "JWT"}), b({"id": 3, "rol": "Empleado", "iat": n - 7200, "exp": n - 3600})])
f = base64.urlsafe_b64encode(hmac.new(sys.argv[1].encode(), s, hashlib.sha256).digest()).rstrip(b"=")
print((s + b"." + f).decode())' "$1"
}

ok() { PASSED=$((PASSED + 1)); printf '  \342\234\223 %s\n' "$1"; }
ko() { FAILED=$((FAILED + 1)); printf '  \342\234\227 %s\n      status=%s body=%s\n' "$1" "$STATUS" "${BODY:0:300}"; }
expect_status() { if [ "$STATUS" = "$2" ]; then ok "$1 (HTTP $STATUS)"; else ko "$1 (expected HTTP $2)"; fi; }
expect_true() { if [ "$2" = "true" ]; then ok "$1"; else ko "$1"; fi; }

login() { req POST /api/auth/login "" "{\"usuario\":\"$1\",\"clave\":\"$2\"}"; }

echo "Smoke test against ${BASE_URL}"
echo

# ---------------------------------------------------------------- health
echo "[health] GET /health"
inicio=$(date +%s)
while :; do
  req GET /health
  [ "$STATUS" = "200" ] && break
  if [ $(( $(date +%s) - inicio )) -ge "$HEALTH_TIMEOUT" ]; then break; fi
  sleep 3
done
expect_status "API and database are up" 200
if [ "$STATUS" != "200" ]; then
  echo "API is not healthy; aborting."
  exit 1
fi

# ---------------------------------------------------------------- CN-01
echo "[CN-01] Employee login with valid credentials"
login empleado1 'Empleado123*'
expect_status "Login returns 200" 200
EMP_TOKEN="$(json "d.get('token', '')")"
expect_true "Response contains a JWT with role Empleado" "$( [ -n "$EMP_TOKEN" ] && [ "$(jwt_claim "$EMP_TOKEN" rol)" = "Empleado" ] && echo true )"
EMP_ID="$(jwt_claim "$EMP_TOKEN" id)"

# ---------------------------------------------------------------- CN-02
echo "[CN-02] Login with wrong password"
login empleado1 'WrongPass123*'
expect_status "Wrong password returns 401" 401
expect_true "Message is \"Invalid credentials\"" "$(json "d.get('error') == 'Invalid credentials'")"
login usuario.inexistente 'WrongPass123*'
expect_true "Unknown user gets the same 401 \"Invalid credentials\" (does not reveal if the user exists)" "$( [ "$STATUS" = "401" ] && json "d.get('error') == 'Invalid credentials'" )"

# ---------------------------------------------------------------- CN-03
echo "[CN-03] Login with empty fields or invalid email"
login '' ''
expect_status "Empty fields return 400" 400
expect_true "Validation message in English" "$(json "'required' in d.get('error', '')")"
login 'empleado1@correo' 'Empleado123*'
expect_status "Invalid email format returns 400" 400

# ---------------------------------------------------------------- CN-04
echo "[CN-04] Administrator login with valid credentials"
login admin 'Admin123*'
expect_status "Admin login returns 200" 200
expect_true "Asks for the 2FA code (requiereOtp) and does not return a token" "$(json "d.get('requiereOtp') is True and 'token' not in d")"
ADMIN_ID="$(json "d.get('personaId', '')")"

# ---------------------------------------------------------------- CN-07
echo "[CN-07] Protected endpoint without token, with expired token and with tampered token"
req GET /api/empleados/me
expect_status "Without token returns 401" 401
if [ -n "${JWT_SECRET:-}" ]; then
  req GET /api/empleados/me "$(expired_token "$JWT_SECRET")"
  expect_true "Expired token returns 401 \"Token expired\"" "$( [ "$STATUS" = "401" ] && json "d.get('error') == 'Token expired'" )"
else
  req GET /api/empleados/me "$(expired_token "not-the-server-secret")"
  expect_status "Expired token returns 401" 401
fi
TAMPERED="$("$PY" -c 'import base64,json,sys
h, p, s = sys.argv[1].split(".")
d = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
d["rol"] = "Administrador"
print(h + "." + base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode() + "." + s)' "$EMP_TOKEN" 2>/dev/null)"
req GET /api/empleados/me "$TAMPERED"
expect_status "Tampered token returns 401" 401
expect_true "401 messages are in English" "$(json "d.get('error') in ('Invalid token', 'Token expired', 'Authentication token is missing')")"

# ---------------------------------------------------------------- CN-08
echo "[CN-08] Only the Administrator can create employees"
SUFIJO="$(date +%s | tail -c 7)"
NUEVO="{\"nombre\":\"Smoke Test ${SUFIJO}\",\"cedula\":\"9${SUFIJO}\",\"correo\":\"smoke${SUFIJO}@msmechanical.test\",\"fechaNacimiento\":\"1990-01-15\",\"eps\":\"Sura\",\"arl\":\"Sura\",\"fondoPension\":\"Porvenir\",\"cesantias\":\"Porvenir\",\"liderId\":2}"
req POST /api/empleados "$EMP_TOKEN" "$NUEVO"
expect_status "Employee gets 403" 403
login lider 'Lider123*'
LIDER_TOKEN="$(json "d.get('token', '')")"
req POST /api/empleados "$LIDER_TOKEN" "$NUEVO"
expect_status "Leader gets 403" 403
if [ "$SMOKE_READONLY" = "1" ]; then
  echo "  - Administrator 201 skipped (SMOKE_READONLY=1)"
else
  login admin 'Admin123*'
  req POST /api/auth/verify-otp "" "{\"personaId\":${ADMIN_ID:-1},\"codigo\":\"$(totp "$ADMIN_TOTP_SECRET")\"}"
  ADMIN_TOKEN="$(json "d.get('token', '')")"
  expect_true "Administrator obtains a token after 2FA" "$( [ -n "$ADMIN_TOKEN" ] && [ "$(jwt_claim "$ADMIN_TOKEN" rol)" = "Administrador" ] && echo true )"
  req POST /api/empleados "$ADMIN_TOKEN" "$NUEVO"
  expect_status "Administrator gets 201" 201
fi

# ---------------------------------------------------------------- CN-12
echo "[CN-12] Employee views their own profile"
req GET /api/empleados/me "$EMP_TOKEN"
expect_status "GET /api/empleados/me returns 200" 200
expect_true "Returns their own data" "$(json "str(d.get('id')) == '${EMP_ID}' and bool(d.get('cedula'))")"
expect_true "Does not include the password hash or the 2FA secret" "$(json "'clave_hash' not in d and 'totp_secret' not in d")"
req GET "/api/empleados/${EMP_ID}" "$EMP_TOKEN"
expect_status "GET /api/empleados/{own id} returns 200" 200

# ---------------------------------------------------------------- CN-13
echo "[CN-13] Employee requests another employee's profile"
OTRO_ID=$(( EMP_ID == 4 ? 5 : 4 ))
req GET "/api/empleados/${OTRO_ID}" "$EMP_TOKEN"
expect_status "Another employee's profile returns 403" 403
expect_true "No third-party data in the response" "$(json "set(d.keys()) <= {'error'}")"

# ---------------------------------------------------------------- CN-19
echo "[CN-19] Employee views their pay stubs"
req GET /api/comprobantes/mis-comprobantes "$EMP_TOKEN"
expect_status "GET /api/comprobantes/mis-comprobantes returns 200" 200
expect_true "Only the authenticated employee's pay stubs" "$(json "isinstance(d, list) and len(d) > 0 and all(str(c.get('persona_id')) == '${EMP_ID}' for c in d)")"

echo
echo "Result: ${PASSED} passed, ${FAILED} failed"
[ "$FAILED" -eq 0 ]
