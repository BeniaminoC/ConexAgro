// Servicio de autenticación: RF-01 (registro + verificación de correo) y RF-02 (login, bloqueo, tokens).
import bcrypt from 'bcryptjs';
import { AppError, validationError, unauthorized } from '../projects/errors.js';
import { validateRegistration } from './registration.js';
import { generateVerification, hashToken } from './verification.js';
import { signToken, verifyToken, TokenError, ACCESS_TTL_S } from './jwt.js';
import { isLocked, lockRemainingMs, LOCK_MS } from './lockout.js';

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
const locked = (ms) => new AppError(423, 'ACCOUNT_LOCKED',
  `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${Math.max(1, Math.ceil(ms / 60000))} min`);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

const publicUser = (u) => ({ id: u.id, nombreCompleto: u.nombreCompleto, correo: u.correo, roles: u.roles });

export function createAuthService(repo, { mailer, now = () => Date.now(), secret, bcryptRounds } = {}) {
  // RN-10: bcrypt con al menos 10 rondas.
  const rounds = Math.max(10, bcryptRounds ?? (Number(process.env.BCRYPT_ROUNDS) || 10));
  let dummyHash; // para igualar el tiempo de respuesta cuando el correo no existe
  const dummy = () => (dummyHash ??= bcrypt.hashSync('no-existe-0', rounds));

  async function issueVerification(user) {
    const v = generateVerification(now());
    await repo.insertVerification(user.id, v.tokenHash, v.expiraEn);
    try {
      await mailer.sendVerification({ to: user.correo, nombre: user.nombreCompleto, token: v.token });
      return true;
    } catch (e) {
      console.error('No se pudo enviar el correo de verificación:', e.message);
      return false; // la cuenta existe; el usuario puede pedir el reenvío
    }
  }

  const tokensFor = (u) => ({
    accessToken: signToken({ sub: u.id, roles: u.roles, type: 'access' }, { now: now(), secret }),
    refreshToken: signToken({ sub: u.id, roles: u.roles, type: 'refresh' }, { now: now(), secret }),
    expiresIn: ACCESS_TTL_S,
  });

  return {
    // RF-01
    async register(input) {
      const d = validateRegistration(input);
      const contrasenaHash = await bcrypt.hash(d.contrasena, rounds);
      const user = await repo.insertUser({ ...d, contrasenaHash });
      const correoEnviado = await issueVerification(user);
      return { id: user.id, correo: user.correo, correoEnviado,
        mensaje: 'Cuenta creada. Revisa tu correo para verificarla (el enlace vence en 24 horas).' };
    },

    // RF-01 pasos 6-7 y FA-03
    async verifyEmail(input) {
      const token = str(input?.token);
      if (!token) throw validationError({ token: 'El token es obligatorio' });
      const estado = await repo.consumeVerification(hashToken(token), now());
      if (estado === 'valido') return { mensaje: 'Correo verificado. Ya puedes iniciar sesión.' };
      if (estado === 'expirado') throw new AppError(410, 'TOKEN_EXPIRED', 'El enlace venció. Solicita un nuevo correo de verificación');
      if (estado === 'usado') throw new AppError(409, 'TOKEN_USED', 'Este enlace ya fue utilizado');
      throw new AppError(400, 'TOKEN_INVALID', 'Enlace de verificación inválido');
    },

    // FA-03 / RF-02 FA-03: siempre responde igual, exista o no el correo (no revela cuentas).
    async resendVerification(input) {
      const correo = str(input?.correo).toLowerCase();
      if (!correo) throw validationError({ correo: 'El correo es obligatorio' });
      const user = await repo.findByEmail(correo);
      if (user && user.activo && !user.correoVerificado) await issueVerification(user);
      return { mensaje: 'Si el correo corresponde a una cuenta pendiente de verificación, se envió un nuevo enlace.' };
    },

    // RF-02
    async login(input) {
      const correo = str(input?.correo).toLowerCase();
      const contrasena = typeof input?.contrasena === 'string' ? input.contrasena : '';
      const f = {};
      if (!correo) f.correo = 'El correo es obligatorio';
      if (!contrasena) f.contrasena = 'La contraseña es obligatoria';
      if (Object.keys(f).length) throw validationError(f);

      const user = await repo.findByEmail(correo);
      if (!user) { await bcrypt.compare(contrasena, dummy()); throw invalidCredentials(); }

      // Precondición: no estar bloqueado. Mientras dure el bloqueo ni siquiera se evalúa la contraseña.
      if (isLocked(user, now())) throw locked(lockRemainingMs(user, now()));

      if (!(await bcrypt.compare(contrasena, user.contrasenaHash))) {
        const estado = await repo.recordFailure(user.id, now());
        if (isLocked(estado, now())) throw locked(LOCK_MS);
        throw invalidCredentials();
      }
      if (user.intentosFallidos > 0 || user.bloqueadoHasta) await repo.resetFailures(user.id);

      // Estos estados se revelan solo con la contraseña correcta.
      if (!user.activo) throw new AppError(403, 'ACCOUNT_INACTIVE', 'Tu cuenta está inactiva. Contacta a soporte');
      if (!user.correoVerificado) {
        throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Debes verificar tu correo antes de iniciar sesión (puedes pedir un nuevo enlace)');
      }
      return { ...tokensFor(user), user: publicUser(user) };
    },

    // Renueva el token de acceso con datos frescos de la BD (roles y estado actuales).
    async refresh(input) {
      const rt = str(input?.refreshToken);
      if (!rt) throw validationError({ refreshToken: 'El token de refresco es obligatorio' });
      let claims;
      try { claims = verifyToken(rt, { type: 'refresh', now: now(), secret }); }
      catch (e) {
        if (e instanceof TokenError && e.code !== 'NO_SECRET') {
          throw new AppError(401, e.code === 'EXPIRED' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID', 'Sesión no válida. Inicia sesión de nuevo');
        }
        throw e;
      }
      const user = Number.isSafeInteger(Number(claims.sub)) ? await repo.findById(Number(claims.sub)) : null;
      if (!user || !user.activo || !user.correoVerificado) {
        throw new AppError(401, 'TOKEN_INVALID', 'Sesión no válida. Inicia sesión de nuevo');
      }
      const { accessToken, expiresIn } = tokensFor(user);
      return { accessToken, expiresIn, user: publicUser(user) };
    },

    async me(authUser) {
      const id = Number(authUser?.id);
      const user = Number.isSafeInteger(id) ? await repo.findById(id) : null;
      if (!user || !user.activo) throw unauthorized();
      return publicUser(user);
    },

    // Alta de un administrador (RN-05: no existe por registro público). Usada por scripts/create-admin.js.
    async createAdmin(input) {
      const d = validateRegistration({ ...input, roles: ['PROPIETARIO'], aceptaTerminos: true });
      const contrasenaHash = await bcrypt.hash(d.contrasena, rounds);
      const user = await repo.insertUser({ ...d, roles: ['ADMINISTRADOR'], contrasenaHash }, { verificado: true });
      return publicUser(user);
    },
  };
}
