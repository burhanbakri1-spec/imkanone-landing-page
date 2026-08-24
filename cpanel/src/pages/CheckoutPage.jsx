import React from "react";
import { buildWhatsAppOrderUrl } from "../utils/whatsapp.js";

const initialCheckoutForm = {
  name: "",
  phone: "",
  city: "",
  address: "",
  notes: "",
};

function getMessageItems(items, products, language) {
  return items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const productName = product?.name?.[language] || item.productName || item.slug || item.productId;

    return {
      ...item,
      productName,
      selectedSize: item.selectedSize || item.size,
      lineTotal: item.lineTotal ?? Number(item.price || 0) * Number(item.quantity || 1),
    };
  });
}

function CheckoutPage({
  cartItems,
  checkoutMessage,
  currentUser,
  lastOrder,
  language,
  onCreateOrder,
  onNavigate,
  products,
  t,
  total,
}) {
  const [form, setForm] = React.useState(() => ({
    ...initialCheckoutForm,
    name: currentUser?.role === "customer" ? currentUser.name : "",
    phone: currentUser?.role === "customer" ? currentUser.phone : "",
  }));
  const [orderPlaced, setOrderPlaced] = React.useState(false);
  const [orderError, setOrderError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (currentUser?.role === "customer") {
      setForm((currentForm) => ({
        ...currentForm,
        name: currentForm.name || currentUser.name,
        phone: currentForm.phone || currentUser.phone,
      }));
    }
  }, [currentUser]);

  function handleInputChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setOrderError("");
    setIsSubmitting(true);

    try {
      const submittedForm = { ...form };
      const submittedItems = getMessageItems(cartItems, products, language);
      const submittedTotal = total;
      const order = await onCreateOrder(submittedForm);
      const whatsappUrl = buildWhatsAppOrderUrl({
        customer: { ...submittedForm, ...(order?.customer || {}) },
        items: order?.items?.length ? order.items : submittedItems,
        total: order?.total ?? submittedTotal,
      });

      setOrderPlaced(true);
      if (typeof window !== "undefined") {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setOrderError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const messageItems = orderPlaced && lastOrder ? lastOrder.items : cartItems;
  const messageTotal = orderPlaced && lastOrder ? lastOrder.total : total;
  const whatsappUrl = buildWhatsAppOrderUrl({
    customer: orderPlaced && lastOrder ? lastOrder.customer : form,
    items: getMessageItems(messageItems, products, language),
    total: messageTotal,
  });

  if (cartItems.length === 0 && !orderPlaced) {
    return (
      <section className="page-shell">
        <div className="empty-panel">
          <h1>{t("checkout.noProductsTitle")}</h1>
          <p>{t("checkout.noProductsText")}</p>
          <button className="primary-action" onClick={() => onNavigate("products")}>
            {t("cart.browseProducts")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell checkout-page">
      <div className="page-heading">
        <p className="eyebrow">{t("checkout.eyebrow")}</p>
        <h1>{t("checkout.title")}</h1>
        <p>{t("checkout.subtitle")}</p>
      </div>

      {(orderPlaced || checkoutMessage) && (
        <div className="success-panel">
          {checkoutMessage || t("checkout.success")}
        </div>
      )}
      {orderError && <div className="message-panel error">{orderError}</div>}

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <label>
            {t("checkout.name")}
            <input
              name="name"
              onChange={handleInputChange}
              placeholder={t("checkout.namePlaceholder")}
              required
              type="text"
              value={form.name}
            />
          </label>
          <label>
            {t("checkout.phone")}
            <input
              name="phone"
              onChange={handleInputChange}
              placeholder={t("checkout.phonePlaceholder")}
              required
              type="tel"
              value={form.phone}
            />
          </label>
          <label>
            {t("checkout.city")}
            <input
              name="city"
              onChange={handleInputChange}
              placeholder={t("checkout.cityPlaceholder")}
              required
              type="text"
              value={form.city}
            />
          </label>
          <label>
            {t("checkout.address")}
            <input
              name="address"
              onChange={handleInputChange}
              placeholder={t("checkout.addressPlaceholder")}
              required
              type="text"
              value={form.address}
            />
          </label>
          <label className="full-field">
            {t("checkout.notes")}
            <textarea
              name="notes"
              onChange={handleInputChange}
              placeholder={t("checkout.notesPlaceholder")}
              rows="5"
              value={form.notes}
            />
          </label>
          <button className="primary-action large" disabled={isSubmitting || orderPlaced} type="submit">
            {isSubmitting ? t("common.temporaryContent") : t("checkout.placeOrder")}
          </button>
        </form>

        <aside className="summary-card">
          <h2>{t("cart.orderSummary")}</h2>
          {messageItems.map((item) => {
            const product = products.find((entry) => entry.id === item.productId);
            const productName = product?.name?.[language] || item.productName || item.slug;

            return (
              <div className="summary-line" key={item.cartId || `${item.productId}-${item.selectedSize || item.size}`}>
                <span>
                  {productName} - {item.selectedSize || item.size} x{item.quantity}
                </span>
                <strong>
                  {(item.lineTotal ?? item.price * item.quantity)} {t("common.ils")}
                </strong>
              </div>
            );
          })}
          <div className="summary-row total-row">
            <span>{t("common.total")}</span>
            <strong>
              {messageTotal} {t("common.ils")}
            </strong>
          </div>
          <a className="whatsapp-action" href={whatsappUrl} rel="noopener noreferrer" target="_blank">
            {t("checkout.sendWhatsApp")}
          </a>
        </aside>
      </div>
    </section>
  );
}

export default CheckoutPage;
