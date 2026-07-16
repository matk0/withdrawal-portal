import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const extensionFile = (relativePath: string) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const block = readFileSync(extensionFile("./blocks/withdrawal-link.liquid"), "utf8");

const locale = (filename: string) =>
  JSON.parse(readFileSync(extensionFile(`./locales/${filename}`), "utf8")) as {
    withdrawal_link: { label: string };
  };

describe("withdrawal link theme block", () => {
  it("selects its default customer label from the active storefront locale", () => {
    expect(locale("sk.json").withdrawal_link.label).toBe("Odstúpiť od zmluvy tu");
    expect(locale("cs.json").withdrawal_link.label).toBe("Odstoupit od smlouvy zde");
    expect(locale("en.default.json").withdrawal_link.label).toBe(
      "Withdraw from the contract here",
    );
    expect(block).toContain("assign link_label = 'withdrawal_link.label' | t");
    expect(block).toContain("configured_link_label != 'Odstúpiť od zmluvy tu'");
    expect(block).not.toContain('"default": "Odstúpiť od zmluvy tu"');
  });

  it("preserves the active locale prefix in the app proxy URL", () => {
    expect(block).toContain(
      "assign link_url = routes.root_url | append: '/apps/odstupenie-od-zmluvy' | replace: '//apps', '/apps'",
    );
    expect(block).toContain('href="{{ link_url }}"');
    expect(block).not.toContain('href="/apps/odstupenie-od-zmluvy"');
  });
});
