import React from "react";

function AdminLoginPage({ message, onLogin, t }) {
  const [form, setForm] = React.useState({
    email: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onLogin(form);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="admin-login-page">
      <div className="admin-login-brand">
        <img src="/images/brand/ep-chemical-logo.png" alt="EB Chemical" />
      </div>

      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div className="admin-login-icon" aria-hidden="true">
          <span>EB</span>
        </div>
        <h1>{t("adminLogin.title")}</h1>
        <p>{t("adminLogin.subtitle")}</p>

        {message && <div className="message-panel error">{message}</div>}

        <label>
          {t("auth.email")}
          <input
            autoComplete="email"
            name="email"
            onChange={handleChange}
            placeholder={t("auth.email")}
            required
            type="email"
            value={form.email}
          />
        </label>

        <label>
          {t("auth.password")}
          <input
            autoComplete="current-password"
            name="password"
            onChange={handleChange}
            placeholder={t("auth.password")}
            required
            type="password"
            value={form.password}
          />
        </label>

        <button className="admin-login-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? t("common.temporaryContent") : t("adminLogin.signIn")}
        </button>
      </form>
    </section>
  );
}

export default AdminLoginPage;
