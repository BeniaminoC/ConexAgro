// Envío de correo: el proveedor NO está decidido (ver PROGRESS.md). El servicio solo depende de esta interfaz:
//   sendVerification({ to, nombre, token })
// Fuera de producción se usa un mailer de consola (muestra el enlace en el log del servidor).
// En producción, sin proveedor configurado, falla de forma explícita: nunca se escribe el token en logs,
// salvo opt-in explícito MAIL_TRANSPORT=console (solo para una demo sin proveedor; NO usar con usuarios reales).
const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
export const verificationLink = (token) => `${appUrl()}/verificar-correo?token=${encodeURIComponent(token)}`;

export function createConsoleMailer(log = console.log) {
  return {
    async sendVerification({ to, token }) {
      log(`[correo:desarrollo] Verificación para ${to}: ${verificationLink(token)}`);
    },
  };
}

export function createMailerFromEnv() {
  if (process.env.NODE_ENV === 'production' && process.env.MAIL_TRANSPORT !== 'console') {
    return {
      async sendVerification() {
        throw new Error('Proveedor de correo no configurado (decisión pendiente)');
      },
    };
  }
  return createConsoleMailer();
}
