/**
 * There is no self-service reset flow to link to — accounts get a temporary
 * password from an admin (see manageMustChangePassword), not email. Payload's
 * LoginForm renders "Olvidé mi contraseña" as a bare, unclassed <a> — the only
 * one that's a direct child of the login form, which is what this targets.
 */
export default function HideForgotPassword() {
  return <style>{'form.login__form > a { display: none; }'}</style>
}
