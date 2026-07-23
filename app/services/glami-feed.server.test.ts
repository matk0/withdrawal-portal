import { describe, expect, it, vi } from "vitest";

import {
  buildGlamiFeedXml,
  createGlamiFeedXmlLoader,
  fetchShopifyProductsJson,
} from "./glami-feed.server";

describe("GLAMI product feed", () => {
  it("renders only available physical fashion products as GLAMI SHOPITEM XML", () => {
    const xml = buildGlamiFeedXml({
      publicStoreUrl: "https://onebyone.sk",
      products: [
        {
          id: 1,
          title: "Blue & Gold <Scarf>",
          handle: "blue-gold-scarf",
          body_html: "<p>100% hodváb & ručne šité lemy.</p>",
          vendor: "Keyana",
          product_type: "Hodvábna šatka",
          tags: ["hodvabna-satka"],
          variants: [
            {
              id: 101,
              title: "Default Title",
              sku: "KEY-BLUE-GOLD",
              barcode: "1234567890123",
              price: "144.00",
              available: true,
              inventory_management: "shopify",
            },
          ],
          images: [
            { src: "https://cdn.shopify.com/scarf-main.jpg" },
            { src: "https://cdn.shopify.com/scarf-alt.jpg" },
          ],
        },
        {
          id: 2,
          title: "Sold Out Scarf",
          handle: "sold-out-scarf",
          body_html: "<p>Sold out.</p>",
          vendor: "Keyana",
          product_type: "Hodvábna šatka",
          tags: ["hodvabna-satka"],
          variants: [
            {
              id: 201,
              title: "Default Title",
              sku: "KEY-SOLD",
              price: "130.00",
              available: false,
              inventory_management: "shopify",
            },
          ],
          images: [{ src: "https://cdn.shopify.com/sold-out.jpg" }],
        },
        {
          id: 3,
          title: "Darčekový poukaz",
          handle: "darcekovy-poukaz",
          body_html: "<p>Poukaz.</p>",
          vendor: "Keyana",
          product_type: "Darčekový poukaz",
          tags: [],
          variants: [
            {
              id: 301,
              title: "€150.00",
              sku: "GIFT-150",
              price: "150.00",
              available: true,
            },
          ],
          images: [{ src: "https://cdn.shopify.com/voucher.jpg" }],
        },
        {
          id: 4,
          title: "Hawaii",
          handle: "hawai-silk-robe",
          body_html: "<p>Župan bez sledovaných skladových zásob.</p>",
          vendor: "Keyana",
          product_type: "Hodvábny župan",
          tags: [],
          variants: [
            {
              id: 401,
              title: "Default Title",
              sku: "KEY-HAWAI-SILK-ROBE",
              price: "219.00",
              available: true,
              inventory_management: null,
            },
          ],
          images: [{ src: "https://cdn.shopify.com/robe.jpg" }],
        },
      ],
    });

    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(xml).toContain("<SHOP>");
    expect(xml).toContain("<ITEM_ID>KEY-BLUE-GOLD</ITEM_ID>");
    expect(xml).toContain("<ITEMGROUP_ID>1</ITEMGROUP_ID>");
    expect(xml).toContain(
      "<PRODUCTNAME>Dámska hodvábna šatka Blue &amp; Gold &lt;Scarf&gt;</PRODUCTNAME>",
    );
    expect(xml).toContain("<DESCRIPTION>100% hodváb &amp; ručne šité lemy.</DESCRIPTION>");
    expect(xml).toContain(
      "<URL>https://onebyone.sk/products/blue-gold-scarf</URL>",
    );
    expect(xml).toContain(
      "<URL_SIZE>https://onebyone.sk/products/blue-gold-scarf?variant=101</URL_SIZE>",
    );
    expect(xml).toContain("<IMGURL>https://cdn.shopify.com/scarf-main.jpg</IMGURL>");
    expect(xml).toContain(
      "<IMGURL_ALTERNATIVE>https://cdn.shopify.com/scarf-alt.jpg</IMGURL_ALTERNATIVE>",
    );
    expect(xml).toContain("<PRICE_VAT>144.00</PRICE_VAT>");
    expect(xml).toContain("<MANUFACTURER>One by One</MANUFACTURER>");
    expect(xml).toContain("<GTIN>1234567890123</GTIN>");
    expect(xml).not.toContain("<SIZE>UNI</SIZE>");
    expect(xml).not.toContain("<PARAM_NAME>veľkosť</PARAM_NAME>");
    expect(xml).not.toContain("<PARAM_NAME>size_system</PARAM_NAME>");
    expect(xml).toContain(
      [
        "    <DELIVERY>",
        "      <DELIVERY_ID>PACKETA</DELIVERY_ID>",
        "      <DELIVERY_PRICE>3.90</DELIVERY_PRICE>",
        "    </DELIVERY>",
      ].join("\n"),
    );
    expect(xml).toContain("<DELIVERY_DATE>0</DELIVERY_DATE>");
    expect(xml).toContain(
      [
        "    <PARAM>",
        "      <PARAM_NAME>farba</PARAM_NAME>",
        "      <VAL>modrá</VAL>",
        "    </PARAM>",
      ].join("\n"),
    );
    expect(xml).toContain("Dámske doplnky | Šatky a šály");
    expect(xml).not.toContain("KEY-SOLD");
    expect(xml).not.toContain("KEY-HAWAI-SILK-ROBE");
    expect(xml).not.toContain("GIFT-150");
  });

  it("hydrates Shopify inventory management before building the feed", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            products: [
              {
                id: 1,
                title: "Oriental",
                handle: "oriental",
                product_type: "Hodvábna šatka",
                variants: [
                  {
                    id: 101,
                    title: "Default Title",
                    sku: "KEY-ORIENTAL",
                    price: "144.00",
                    available: true,
                  },
                ],
                images: [{ src: "https://cdn.shopify.com/oriental.jpg" }],
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "0" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            variants: [
              {
                id: 101,
                available: true,
                inventory_management: "shopify",
              },
            ],
          }),
        ),
      );

    const products = await fetchShopifyProductsJson({
      publicStoreUrl: "https://onebyone.sk",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://onebyone.sk/products/oriental.js",
      { headers: { Accept: "application/json" } },
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "https://onebyone.sk/products/oriental.js",
      { headers: { Accept: "application/json" } },
    );
    expect(products[0]?.variants[0]).toMatchObject({
      available: true,
      inventory_management: "shopify",
    });
  });

  it("reuses generated XML until the feed cache expires", async () => {
    let now = 1_000;
    const fetchProducts = vi.fn().mockResolvedValue([
      {
        id: 1,
        title: "Oriental",
        handle: "oriental",
        product_type: "Hodvábna šatka",
        variants: [
          {
            id: 101,
            title: "Default Title",
            sku: "KEY-ORIENTAL",
            price: "144.00",
            available: true,
            inventory_management: "shopify",
          },
        ],
        images: [{ src: "https://cdn.shopify.com/oriental.jpg" }],
      },
    ]);
    const loadXml = createGlamiFeedXmlLoader({
      fetchProducts,
      now: () => now,
      ttlMs: 900_000,
    });

    const firstXml = await loadXml({ publicStoreUrl: "https://onebyone.sk" });
    const cachedXml = await loadXml({ publicStoreUrl: "https://onebyone.sk" });

    expect(cachedXml).toBe(firstXml);
    expect(fetchProducts).toHaveBeenCalledTimes(1);

    now += 900_000;
    await loadXml({ publicStoreUrl: "https://onebyone.sk" });

    expect(fetchProducts).toHaveBeenCalledTimes(2);
  });
});
