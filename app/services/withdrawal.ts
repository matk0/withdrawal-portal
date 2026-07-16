export type WithdrawalLocale = "sk" | "cs" | "en";

export interface OrderLineItem {
  id: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
}

export interface SelectedLineItem {
  lineItemId: string;
  quantity: number;
}

export interface SelectedWithdrawalItem extends OrderLineItem {
  quantity: number;
}

export function normalizeOrderName(orderName: string) {
  const trimmed = orderName.trim();

  if (trimmed.startsWith("#")) {
    return trimmed;
  }

  return `#${trimmed}`;
}

export function checkOrderLookupEligibility({
  createdAt,
  now = new Date(),
  cutoffDays,
}: {
  createdAt: string;
  now?: Date;
  cutoffDays: number;
}): { eligible: true; reason: "within_cutoff" } | { eligible: false; reason: "outside_cutoff" } {
  const createdTime = new Date(createdAt).getTime();

  if (Number.isNaN(createdTime)) {
    throw new Error("Order createdAt is invalid");
  }

  const cutoffMs = cutoffDays * 24 * 60 * 60 * 1000;
  const ageMs = now.getTime() - createdTime;

  if (ageMs <= cutoffMs) {
    return { eligible: true, reason: "within_cutoff" };
  }

  return { eligible: false, reason: "outside_cutoff" };
}

export function validateSubmissionSelection(
  orderItems: OrderLineItem[],
  selectedItems: SelectedLineItem[],
) {
  if (selectedItems.length === 0) {
    throw new Error("Select at least one item");
  }

  const orderItemById = new Map(orderItems.map((item) => [item.id, item]));

  return selectedItems.map((selected) => {
    if (!Number.isInteger(selected.quantity) || selected.quantity <= 0) {
      throw new Error("Selected quantity must be positive");
    }

    const orderItem = orderItemById.get(selected.lineItemId);

    if (!orderItem) {
      throw new Error("Selected item does not belong to this order");
    }

    if (selected.quantity > orderItem.quantity) {
      throw new Error("Selected quantity exceeds ordered quantity");
    }

    return {
      ...orderItem,
      quantity: selected.quantity,
    };
  });
}

export function buildConfirmationEmail({
  requestId,
  orderName,
  submittedAt,
  items,
  shopName,
  locale,
}: {
  requestId: string;
  orderName: string;
  submittedAt: Date;
  items: SelectedWithdrawalItem[];
  shopName: string;
  locale: WithdrawalLocale;
}) {
  const quantityLabel = locale === "cs" ? "množství" : locale === "en" ? "quantity" : "množstvo";
  const itemLines = items
    .map((item) => {
      const variant = item.variantTitle ? ` (${item.variantTitle})` : "";
      const sku = item.sku ? `, SKU: ${item.sku}` : "";
      return `- ${item.title}${variant}, ${quantityLabel}: ${item.quantity}${sku}`;
    })
    .join("\n");
  const html = buildConfirmationEmailHtml({
    requestId,
    orderName,
    submittedAt,
    items,
    shopName,
    locale,
  });

  if (locale === "cs") {
    return {
      subject: "Potvrzení přijetí odstoupení od smlouvy",
      text: [
        `Potvrzujeme přijetí oznámení o odstoupení od smlouvy pro objednávku ${orderName}.`,
        `Číslo žádosti: ${requestId}`,
        `Přijato: ${submittedAt.toISOString()}`,
        "",
        "Vybrané položky:",
        itemLines,
        "",
        "Toto potvrzení není schválením refundace. Obchodník vaši žádost zpracuje podle svých obchodních podmínek a platných právních předpisů.",
        "",
        shopName,
      ].join("\n"),
      html,
    };
  }

  if (locale === "en") {
    return {
      subject: "Withdrawal notice receipt confirmation",
      text: [
        `We confirm receipt of your withdrawal notice for order ${orderName}.`,
        `Request ID: ${requestId}`,
        `Received at: ${submittedAt.toISOString()}`,
        "",
        "Selected items:",
        itemLines,
        "",
        "This confirmation is not refund approval. The merchant will process your request under its terms and applicable law.",
        "",
        shopName,
      ].join("\n"),
      html,
    };
  }

  return {
    subject: "Potvrdenie prijatia odstúpenia od zmluvy",
    text: [
      `Potvrdzujeme prijatie oznámenia o odstúpení od zmluvy k objednávke ${orderName}.`,
      `Číslo žiadosti: ${requestId}`,
      `Prijaté: ${submittedAt.toISOString()}`,
      "",
      "Vybrané položky:",
      itemLines,
      "",
      "Toto potvrdenie nie je schválením refundácie. Obchodník vašu žiadosť spracuje podľa svojich obchodných podmienok a platných právnych predpisov.",
      "",
      shopName,
    ].join("\n"),
    html,
  };
}

function buildConfirmationEmailHtml({
  requestId,
  orderName,
  submittedAt,
  items,
  shopName,
  locale,
}: {
  requestId: string;
  orderName: string;
  submittedAt: Date;
  items: SelectedWithdrawalItem[];
  shopName: string;
  locale: WithdrawalLocale;
}) {
  const copy = confirmationEmailCopy(locale, orderName, requestId, submittedAt);
  const itemRows = items.map(renderEmailItemRow).join("");
  const safeShopName = escapeHtml(shopName);

  return `<!doctype html>
<html lang="${locale === "cs" ? "cs" : locale === "en" ? "en" : "sk"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(copy.subject)}</title>
    <style>
      body { margin: 0; }
      a:hover { color: #1990C6; text-decoration: none; }
      a:active { color: #1990C6; text-decoration: none; }
      a:visited { color: #1990C6; text-decoration: none; }
      @media (max-width: 600px) {
        .container { width: 94% !important; }
        .header { margin-top: 20px !important; margin-bottom: 2px !important; }
        .shop-name__cell { display: block; }
        .order-number__cell { display: block; text-align: left !important; margin-top: 20px; }
        .customer-info__item { display: block; width: 100% !important; }
        .spacer { display: none; }
      }
    </style>
  </head>
  <body class="body" style="margin:0;background-color:#f6f6f6;color:#333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;">
    <table role="presentation" class="body" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f6f6;border-spacing:0;border-collapse:collapse;margin:0;padding:0;width:100%;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" class="header row" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-spacing:0;border-collapse:collapse;margin:40px 0 20px;">
            <tr>
              <td class="header__cell" align="center">
                <center>
                  <table role="presentation" class="container" width="560" cellspacing="0" cellpadding="0" style="width:560px;text-align:left;border-spacing:0;border-collapse:collapse;margin:0 auto;">
                    <tr>
                      <td class="shop-name__cell">
                        <h1 class="shop-name__text" style="margin:0;color:#333;font-size:30px;font-weight:400;line-height:1.2;">${safeShopName}</h1>
                      </td>
                      <td class="order-number__cell" style="text-align:right;color:#999;font-size:14px;text-transform:uppercase;">
                        ${escapeHtml(requestId)}
                      </td>
                    </tr>
                  </table>
                </center>
              </td>
            </tr>
          </table>
          <table role="presentation" class="row content" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-spacing:0;border-collapse:collapse;">
            <tr>
              <td class="content__cell" align="center" style="padding-bottom:40px;">
                <center>
                  <table role="presentation" class="container" width="560" cellspacing="0" cellpadding="0" style="width:560px;text-align:left;border-spacing:0;border-collapse:collapse;margin:0 auto;background:#ffffff;">
                    <tr>
                      <td style="padding:0 0 24px;">
                        <h2 style="margin:0 0 16px;color:#333;font-size:24px;line-height:1.25;font-weight:400;">${escapeHtml(copy.heading)}</h2>
                        <p style="margin:0;color:#555;">${escapeHtml(copy.intro)}</p>
                      </td>
                    </tr>
                  </table>
                </center>
              </td>
            </tr>
          </table>
          <table role="presentation" class="row section" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-spacing:0;border-collapse:collapse;">
            <tr>
              <td class="section__cell" align="center" style="padding:40px 0;border-top:1px solid #e5e5e5;">
                <center>
                  <table role="presentation" class="container" width="560" cellspacing="0" cellpadding="0" style="width:560px;text-align:left;border-spacing:0;border-collapse:collapse;margin:0 auto;background:#ffffff;">
                    <tr>
                      <td>
                        <h3 style="margin:0 0 12px;color:#333;font-size:20px;font-weight:400;">${escapeHtml(copy.summaryHeading)}</h3>
                        <table role="presentation" class="row subtotal-table" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-spacing:0;border-collapse:collapse;">
                          <tr class="subtotal-line">
                            <td class="subtotal-line__title" style="padding:8px 0;color:#777;">${escapeHtml(copy.requestLabel)}</td>
                            <td class="subtotal-line__value" align="right" style="padding:8px 0;color:#333;font-weight:600;">${escapeHtml(requestId)}</td>
                          </tr>
                          <tr class="subtotal-line">
                            <td class="subtotal-line__title" style="padding:8px 0;color:#777;">${escapeHtml(copy.orderLabel)}</td>
                            <td class="subtotal-line__value" align="right" style="padding:8px 0;color:#333;">${escapeHtml(orderName)}</td>
                          </tr>
                          <tr class="subtotal-line">
                            <td class="subtotal-line__title" style="padding:8px 0;color:#777;">${escapeHtml(copy.receivedLabel)}</td>
                            <td class="subtotal-line__value" align="right" style="padding:8px 0;color:#333;">${escapeHtml(submittedAt.toISOString())}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </center>
              </td>
            </tr>
          </table>
          <table role="presentation" class="row section" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-spacing:0;border-collapse:collapse;">
            <tr>
              <td class="section__cell" align="center" style="padding:40px 0;border-top:1px solid #e5e5e5;">
                <center>
                  <table role="presentation" class="container" width="560" cellspacing="0" cellpadding="0" style="width:560px;text-align:left;border-spacing:0;border-collapse:collapse;margin:0 auto;background:#ffffff;">
                    <tr>
                      <td>
                        <h3 style="margin:0 0 12px;color:#333;font-size:20px;font-weight:400;">${escapeHtml(copy.itemsHeading)}</h3>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-spacing:0;border-collapse:collapse;">
                          ${itemRows}
                        </table>
                        <p style="margin:28px 0 0;padding:18px 0 0;border-top:1px solid #e5e5e5;color:#777;font-size:14px;">${escapeHtml(copy.disclaimer)}</p>
                      </td>
                    </tr>
                  </table>
                </center>
              </td>
            </tr>
          </table>
          <table role="presentation" class="row footer" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-spacing:0;border-collapse:collapse;border-top:1px solid #e5e5e5;">
            <tr>
              <td class="footer__cell" align="center" style="padding:32px 0;">
                <center>
                  <table role="presentation" class="container" width="560" cellspacing="0" cellpadding="0" style="width:560px;text-align:left;border-spacing:0;border-collapse:collapse;margin:0 auto;">
                    <tr>
                      <td>
                        <p class="disclaimer__subtext" style="margin:0;color:#999;font-size:14px;line-height:1.5;">${safeShopName}</p>
                      </td>
                    </tr>
                  </table>
                </center>
              </td>
            </tr>
          </table>
          <table role="presentation" class="spacer" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-spacing:0;border-collapse:collapse;">
            <tr>
              <td style="font-size:1px;line-height:1px;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderEmailItemRow(item: SelectedWithdrawalItem) {
  const variant = item.variantTitle
    ? `<span class="order-list__item-variant" style="font-size:14px;color:#999;display:block;margin-top:4px;">${escapeHtml(item.variantTitle)}</span>`
    : "";
  const sku = item.sku
    ? `<span class="order-list__item-variant" style="font-size:14px;color:#999;display:block;margin-top:4px;">SKU: ${escapeHtml(item.sku)}</span>`
    : "";

  return `<tr class="order-list__item" style="width:100%;border-top:1px solid #e5e5e5;">
    <td class="order-list__item__cell" style="padding:15px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-spacing:0;border-collapse:collapse;">
        <tr>
          <td class="order-list__product-description-cell">
            <span class="order-list__item-title" style="font-size:16px;font-weight:600;line-height:1.4;color:#333;">${escapeHtml(item.title)}</span>
            ${variant}
            ${sku}
          </td>
          <td class="order-list__price-cell" align="right" style="white-space:nowrap;color:#555;">
            <p class="order-list__item-price" style="margin:0;">x ${item.quantity}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function confirmationEmailCopy(
  locale: WithdrawalLocale,
  orderName: string,
  requestId: string,
  submittedAt: Date,
) {
  void requestId;
  void submittedAt;

  if (locale === "cs") {
    return {
      subject: "Potvrzení přijetí odstoupení od smlouvy",
      heading: "Potvrzení přijetí odstoupení od smlouvy",
      intro: `Potvrzujeme přijetí oznámení o odstoupení od smlouvy pro objednávku ${orderName}.`,
      summaryHeading: "Souhrn žádosti",
      requestLabel: "Číslo žádosti",
      orderLabel: "Objednávka",
      receivedLabel: "Přijato",
      itemsHeading: "Vybrané položky",
      disclaimer:
        "Toto potvrzení není schválením refundace. Obchodník vaši žádost zpracuje podle svých obchodních podmínek a platných právních předpisů.",
    };
  }

  if (locale === "en") {
    return {
      subject: "Withdrawal notice receipt confirmation",
      heading: "Withdrawal notice received",
      intro: `We confirm receipt of your withdrawal notice for order ${orderName}.`,
      summaryHeading: "Request summary",
      requestLabel: "Request ID",
      orderLabel: "Order",
      receivedLabel: "Received",
      itemsHeading: "Selected items",
      disclaimer:
        "This confirmation is not refund approval. The merchant will process your request under its terms and applicable law.",
    };
  }

  return {
    subject: "Potvrdenie prijatia odstúpenia od zmluvy",
    heading: "Potvrdenie prijatia odstúpenia od zmluvy",
    intro: `Potvrdzujeme prijatie oznámenia o odstúpení od zmluvy k objednávke ${orderName}.`,
    summaryHeading: "Súhrn žiadosti",
    requestLabel: "Číslo žiadosti",
    orderLabel: "Objednávka",
    receivedLabel: "Prijaté",
    itemsHeading: "Vybrané položky",
    disclaimer:
      "Toto potvrdenie nie je schválením refundácie. Obchodník vašu žiadosť spracuje podľa svojich obchodných podmienok a platných právnych predpisov.",
  };
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
