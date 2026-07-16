import type { OrderLineItem, WithdrawalLocale } from "./withdrawal";

type RenderLocale = WithdrawalLocale | "liquid";

export function renderLookupPage({
  error,
  notice,
  locale = "sk",
}: {
  error?: string;
  notice?: string;
  locale?: RenderLocale;
} = {}) {
  const copy = withdrawalUiCopy(locale);

  return pageShell(`
    <section class="withdrawal-flow section-spacing section-spacing--tight">
      <h1 class="h1">${copy.lookupTitle}</h1>
      <p class="withdrawal-flow__intro text-subdued">${copy.lookupIntro}</p>
      ${notice ? `<div class="withdrawal-banner withdrawal-banner--notice">${escapeHtml(notice)}</div>` : ""}
      ${error ? `<div class="withdrawal-banner withdrawal-banner--error">${escapeHtml(error)}</div>` : ""}
      <form class="form withdrawal-form" method="post">
        <input type="hidden" name="intent" value="lookup">
        <input type="hidden" name="locale" value="${localeValue(locale)}">
        <div class="fieldset">
          ${renderTextInput({
            id: "withdrawal-order-name",
            name: "orderName",
            type: "text",
            label: copy.orderNumber,
            autocomplete: "off",
            placeholder: "#1001",
          })}
          ${renderTextInput({
            id: "withdrawal-order-email",
            name: "email",
            type: "email",
            label: copy.orderEmail,
            autocomplete: "email",
            placeholder: copy.orderEmail,
          })}
        </div>
        <button class="button withdrawal-form__submit" type="submit">${copy.verifyOrder}</button>
      </form>
    </section>
  `);
}

export function renderSelectionPage({
  orderName,
  email,
  token,
  lineItems,
  error,
  locale = "sk",
}: {
  orderName: string;
  email: string;
  token: string;
  lineItems: OrderLineItem[];
  error?: string;
  locale?: RenderLocale;
}) {
  const copy = withdrawalUiCopy(locale);
  const itemMarkup = lineItems
    .map((item) => {
      const variant = item.variantTitle ? `<span>${escapeHtml(item.variantTitle)}</span>` : "";
      const sku = item.sku ? `<span>SKU: ${escapeHtml(item.sku)}</span>` : "";
      const escapedId = escapeHtml(item.id);
      const escapedTitle = escapeHtml(item.title);

      return `
        <li class="withdrawal-item">
          <label class="withdrawal-item__choice">
            <input class="withdrawal-item__checkbox" type="checkbox" name="lineItemId" value="${escapedId}">
            <span class="withdrawal-item__description">
              <strong>${escapedTitle}</strong>
              ${variant}
              ${sku}
              <span>${copy.orderedQuantity}: ${item.quantity}</span>
            </span>
          </label>
          <input
            class="input withdrawal-item__quantity"
            name="quantity:${escapedId}"
            type="number"
            min="1"
            max="${item.quantity}"
            value="1"
            inputmode="numeric"
            aria-label="${copy.quantityFor} ${escapedTitle}"
          >
        </li>
      `;
    })
    .join("");

  return pageShell(`
    <section class="withdrawal-flow section-spacing section-spacing--tight">
      <h1 class="h1">${copy.selectTitle}</h1>
      <p class="withdrawal-flow__intro text-subdued">${copy.selectionIntro(escapeHtml(orderName), escapeHtml(email))}</p>
      ${error ? `<div class="withdrawal-banner withdrawal-banner--error">${escapeHtml(error)}</div>` : ""}
      <form class="form withdrawal-form" method="post">
        <input type="hidden" name="intent" value="submit">
        <input type="hidden" name="locale" value="${localeValue(locale)}">
        <input type="hidden" name="lookupToken" value="${escapeHtml(token)}">
        <ul class="withdrawal-items unstyled-list">
          ${itemMarkup}
        </ul>
        <button class="button withdrawal-form__submit" type="submit">${copy.submitWithdrawal}</button>
      </form>
    </section>
  `);
}

export function renderSuccessPage({
  requestNumber,
  orderName,
  emailFailed,
  locale = "sk",
}: {
  requestNumber: string;
  orderName: string;
  emailFailed?: boolean;
  locale?: RenderLocale;
}) {
  const copy = withdrawalUiCopy(locale);
  const emailMessage = emailFailed
    ? copy.emailFailed
    : copy.emailSent(escapeHtml(orderName));

  return pageShell(`
    <section class="withdrawal-flow section-spacing section-spacing--tight">
      <h1 class="h1">${copy.successTitle}</h1>
      <p class="withdrawal-flow__intro text-subdued">${emailMessage}</p>
      <dl class="withdrawal-summary">
        <dt>${copy.requestNumber}</dt>
        <dd>${escapeHtml(requestNumber)}</dd>
      </dl>
    </section>
  `);
}

function withdrawalUiCopy(locale: RenderLocale) {
  const text = (values: Record<WithdrawalLocale, string>) => localizedText(locale, values);

  return {
    lookupTitle: text({ sk: "Odstúpenie od zmluvy", cs: "Odstoupení od smlouvy", en: "Withdrawal from contract" }),
    lookupIntro: text({
      sk: "Overte objednávku a vyberte produkty, ktorých sa odstúpenie týka.",
      cs: "Ověřte objednávku a vyberte produkty, kterých se odstoupení týká.",
      en: "Verify your order and select the products covered by the withdrawal.",
    }),
    orderNumber: text({ sk: "Číslo objednávky", cs: "Číslo objednávky", en: "Order number" }),
    orderEmail: text({ sk: "E-mail z objednávky", cs: "E-mail z objednávky", en: "Order email" }),
    verifyOrder: text({ sk: "Overiť objednávku", cs: "Ověřit objednávku", en: "Verify order" }),
    selectTitle: text({ sk: "Vyberte produkty", cs: "Vyberte produkty", en: "Select products" }),
    selectionIntro: (orderName: string, email: string) => text({
      sk: `Objednávka ${orderName} bola overená pre e-mail ${email}.`,
      cs: `Objednávka ${orderName} byla ověřena pro e-mail ${email}.`,
      en: `Order ${orderName} was verified for ${email}.`,
    }),
    orderedQuantity: text({ sk: "Objednané množstvo", cs: "Objednané množství", en: "Ordered quantity" }),
    quantityFor: text({ sk: "Množstvo pre", cs: "Množství pro", en: "Quantity for" }),
    submitWithdrawal: text({
      sk: "Potvrdiť odstúpenie od zmluvy",
      cs: "Potvrdit odstoupení od smlouvy",
      en: "Submit withdrawal notice",
    }),
    successTitle: text({ sk: "Oznámenie bolo prijaté", cs: "Oznámení bylo přijato", en: "Notice received" }),
    emailFailed: text({
      sk: "Oznámenie bolo prijaté a uložené. Potvrdenie e-mailom sa momentálne nepodarilo odoslať, preto ho vybaví podpora obchodu manuálne.",
      cs: "Oznámení bylo přijato a uloženo. Potvrzení se momentálně nepodařilo odeslat e-mailem, proto jej podpora obchodu vyřídí ručně.",
      en: "Your notice was received and saved. The confirmation email could not be sent, so store support will handle it manually.",
    }),
    emailSent: (orderName: string) => text({
      sk: `Potvrdenie prijatia odstúpenia od zmluvy sme odoslali na e-mail z objednávky ${orderName}.`,
      cs: `Potvrzení přijetí odstoupení od smlouvy jsme odeslali na e-mail z objednávky ${orderName}.`,
      en: `We sent the withdrawal receipt confirmation to the email address used for order ${orderName}.`,
    }),
    requestNumber: text({ sk: "Číslo žiadosti", cs: "Číslo žádosti", en: "Request ID" }),
  };
}

function localizedText(locale: RenderLocale, values: Record<WithdrawalLocale, string>) {
  if (locale !== "liquid") {
    return values[locale];
  }

  return `{% case request.locale.iso_code %}{% when 'cs' %}${values.cs}{% when 'en' %}${values.en}{% else %}${values.sk}{% endcase %}`;
}

function localeValue(locale: RenderLocale) {
  return locale === "liquid" ? "{{ request.locale.iso_code }}" : locale;
}

function pageShell(body: string) {
  return `
    <style>
      #main:has(> .withdrawal-flow) {
        min-height: calc(100svh - var(--header-height, 0px));
        display: flex;
        flex-direction: column;
      }

      #main:has(> .withdrawal-flow) > .withdrawal-flow {
        flex: 0 0 auto;
        min-height: calc(100svh - var(--header-height, 0px));
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
      }

      .withdrawal-flow {
        width: min(760px, calc(100vw - (var(--container-gutter, 1.25rem) * 2)));
        margin-inline: auto;
        font: var(--text-font-style) var(--text-font-weight) var(--text-base) / 1.65 var(--text-font-family);
      }

      .withdrawal-flow h1 {
        font-family: var(--heading-font-family);
      }

      .withdrawal-flow__intro {
        max-width: 42rem;
        margin-block-start: 0.75rem;
      }

      .withdrawal-form {
        width: min(100%, 34rem);
        margin-block-start: 2rem;
        text-align: start;
      }

      .withdrawal-form__submit {
        justify-self: center;
      }

      .withdrawal-flow .floating-label {
        margin-block-start: 0;
      }

      .withdrawal-flow .input {
        min-height: 3rem;
      }

      .withdrawal-banner {
        margin-block-start: 1.5rem;
        padding: 0.875rem 1rem;
        border: 1px solid rgb(var(--border-color));
        border-radius: var(--input-border-radius);
      }

      .withdrawal-banner--error {
        background: rgb(var(--error-background));
        color: rgb(var(--error-text));
      }

      .withdrawal-banner--notice {
        background: rgb(var(--success-background));
        color: rgb(var(--success-text));
      }

      .withdrawal-items {
        display: grid;
        gap: 0.875rem;
      }

      .withdrawal-item {
        display: grid;
        grid-template-columns: 1fr minmax(76px, 110px);
        gap: 1rem;
        align-items: center;
        padding: 1rem;
        border: 1px solid rgb(var(--border-color));
        border-radius: var(--input-border-radius);
      }

      .withdrawal-item__choice {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: start;
        gap: 0.75rem;
      }

      .withdrawal-item__description {
        display: grid;
        gap: 0.1875rem;
      }

      .withdrawal-item__checkbox {
        inline-size: 1rem;
        block-size: 1rem;
        margin-block-start: 0.35em;
        accent-color: currentColor;
      }

      .withdrawal-item__quantity {
        max-width: 7rem;
      }

      .withdrawal-summary {
        display: grid;
        gap: 0.25rem;
        margin-block-start: 2rem;
      }

      .withdrawal-summary dt {
        color: rgb(var(--text-color) / 0.65);
        font-size: var(--text-sm);
      }

      @media (max-width: 560px) {
        .withdrawal-item {
          grid-template-columns: 1fr;
        }

        .withdrawal-item__quantity {
          max-width: 100%;
        }
      }
    </style>
    ${body}
  `;
}

function renderTextInput({
  id,
  name,
  type,
  label,
  autocomplete,
  placeholder,
}: {
  id: string;
  name: string;
  type: string;
  label: string;
  autocomplete: string;
  placeholder: string;
}) {
  return `
    <div class="form-control">
      <input
        id="${id}"
        class="input"
        name="${name}"
        type="${type}"
        autocomplete="${autocomplete}"
        required
        placeholder="${escapeHtml(placeholder)}"
      >
      <label for="${id}" class="floating-label text-xs">${escapeHtml(label)}</label>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
