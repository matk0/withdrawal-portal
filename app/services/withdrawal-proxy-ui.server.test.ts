import { describe, expect, it } from "vitest";

import {
  renderLookupPage,
  renderSelectionPage,
  renderSuccessPage,
} from "./withdrawal-proxy-ui.server";

describe("withdrawal proxy UI", () => {
  it("renders the lookup form with storefront theme classes and tokens", () => {
    const html = renderLookupPage();

    expect(html).toContain('class="withdrawal-flow section-spacing section-spacing--tight"');
    expect(html).toContain('<h1 class="h1">Odstúpenie od zmluvy</h1>');
    expect(html).toContain('class="form withdrawal-form"');
    expect(html).toContain('class="form-control"');
    expect(html).toContain('class="input"');
    expect(html).toContain('class="floating-label text-xs"');
    expect(html).toContain('class="button withdrawal-form__submit"');
    expect(html).toContain("font: var(--text-font-style) var(--text-font-weight) var(--text-base) / 1.65 var(--text-font-family)");
    expect(html).toContain("font-family: var(--heading-font-family)");
    expect(html).not.toContain("border-radius: 4px");
  });

  it("lets the withdrawal section fill the first viewport before the footer", () => {
    const html = renderLookupPage();

    expect(html).toContain("#main:has(> .withdrawal-flow)");
    expect(html).toContain("min-height: calc(100svh - var(--header-height, 0px))");
    expect(html).toContain("flex-direction: column");
    expect(html).toContain("#main:has(> .withdrawal-flow) > .withdrawal-flow");
    expect(html).toMatch(
      /#main:has\(> \.withdrawal-flow\) > \.withdrawal-flow \{\s+flex: 0 0 auto;\s+min-height: calc\(100svh - var\(--header-height, 0px\)\)/,
    );
    expect(html).toContain("flex: 0 0 auto");
    expect(html).toContain("justify-content: center");
    expect(html).toContain("align-items: center");
    expect(html).toContain("text-align: center");
    expect(html).toContain("width: min(100%, 34rem)");
    expect(html).toContain("justify-self: center");
  });

  it("renders selectable order items without overriding theme input and button styling", () => {
    const html = renderSelectionPage({
      orderName: "#1007",
      email: "customer@example.com",
      token: "lookup-token",
      lineItems: [
        {
          id: "gid://shopify/LineItem/1",
          title: "Silk scarf",
          variantTitle: "Blue",
          sku: "SCARF-BLUE",
          quantity: 2,
        },
      ],
    });

    expect(html).toContain('class="withdrawal-item__checkbox"');
    expect(html).toContain('class="input withdrawal-item__quantity"');
    expect(html).toContain('class="button withdrawal-form__submit"');
    expect(html).not.toContain("background: #1f1f1f");
  });

  it("renders a controlled received state when confirmation email fails", () => {
    const html = renderSuccessPage({
      requestNumber: "WDR-20260706-ABCD1234",
      orderName: "#1001",
      emailFailed: true,
    });

    expect(html).toContain("<h1 class=\"h1\">Oznámenie bolo prijaté</h1>");
    expect(html).toContain("Oznámenie bolo prijaté a uložené");
    expect(html).toContain("Potvrdenie e-mailom sa momentálne nepodarilo odoslať");
    expect(html).toContain("WDR-20260706-ABCD1234");
    expect(html).not.toContain("There was an error in the third-party application.");
  });

  it("renders the complete Czech withdrawal flow", () => {
    const lookup = renderLookupPage({ locale: "cs" });
    const selection = renderSelectionPage({
      locale: "cs",
      orderName: "#1007",
      email: "customer@example.com",
      token: "lookup-token",
      lineItems: [
        {
          id: "gid://shopify/LineItem/1",
          title: "Silk scarf",
          variantTitle: "Blue",
          sku: "SCARF-BLUE",
          quantity: 2,
        },
      ],
    });
    const success = renderSuccessPage({
      locale: "cs",
      requestNumber: "WDR-20260716-CZ",
      orderName: "#1007",
    });

    expect(lookup).toContain("Odstoupení od smlouvy");
    expect(lookup).toContain("Ověřte objednávku a vyberte produkty");
    expect(lookup).toContain("Číslo objednávky");
    expect(lookup).toContain("E-mail z objednávky");
    expect(lookup).toContain("Ověřit objednávku");
    expect(selection).toContain("Vyberte produkty");
    expect(selection).toContain("Objednané množství: 2");
    expect(selection).toContain("Množství pro Silk scarf");
    expect(selection).toContain("Potvrdit odstoupení od smlouvy");
    expect(success).toContain("Oznámení bylo přijato");
    expect(success).toContain("Číslo žádosti");
    expect(success).not.toMatch(/Odstúpenie|Overte|množstvo|Potvrdiť|Oznámenie|žiadosti/);
  });

  it("lets Shopify resolve the initial locale and keeps form posts on the localized route", () => {
    const html = renderLookupPage({ locale: "liquid" });

    expect(html).toContain("{% case request.locale.iso_code %}");
    expect(html).toContain('name="locale" value="{{ request.locale.iso_code }}"');
    expect(html).toContain('<form class="form withdrawal-form" method="post">');
    expect(html).not.toContain('action="/apps/odstupenie-od-zmluvy"');
  });
});
