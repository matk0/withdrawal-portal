export interface ShopifyProductJson {
  id: number | string;
  title: string;
  handle: string;
  body_html?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  tags?: string[] | string | null;
  variants: ShopifyProductVariantJson[];
  images: ShopifyProductImageJson[];
}

export interface ShopifyProductVariantJson {
  id: number | string;
  title: string;
  sku?: string | null;
  barcode?: string | null;
  price: string;
  available: boolean;
  inventory_management?: string | null;
}

export interface ShopifyProductImageJson {
  src: string;
}

interface ShopifyProductsJsonResponse {
  products?: ShopifyProductJson[];
}

interface ShopifyProductDetailJsonResponse {
  variants?: Array<{
    id: number | string;
    available: boolean;
    inventory_management?: string | null;
  }>;
}

interface BuildGlamiFeedOptions {
  products: ShopifyProductJson[];
  publicStoreUrl: string;
  deliveryDate?: string;
  deliveryId?: string;
  deliveryPrice?: string;
  manufacturer?: string;
}

interface FetchShopifyProductsOptions {
  publicStoreUrl: string;
  fetchImpl?: typeof fetch;
  limit?: number;
}

type LoadGlamiFeedXmlOptions = Omit<BuildGlamiFeedOptions, "products">;

interface CreateGlamiFeedXmlLoaderOptions {
  fetchProducts?: (
    options: FetchShopifyProductsOptions,
  ) => Promise<ShopifyProductJson[]>;
  now?: () => number;
  ttlMs?: number;
}

const GLAMI_CATEGORY_BY_PRODUCT_TYPE: Record<string, string> = {
  "Hodvábna šatka":
    "Glami.sk | Dámske oblečenie a obuv | Dámske doplnky | Šatky a šály",
  "Hodvábny župan":
    "Glami.sk | Dámske oblečenie a obuv | Dámske oblečenie | Dámske župany",
};

const EXCLUDED_PRODUCT_TYPES = new Set(["Darčekový poukaz"]);

export function buildGlamiFeedXml({
  products,
  publicStoreUrl,
  deliveryDate = "0",
  deliveryId = "PACKETA",
  deliveryPrice = "3.90",
  manufacturer = "One by One",
}: BuildGlamiFeedOptions) {
  const baseUrl = publicStoreUrl.replace(/\/+$/, "");
  const items = products.flatMap((product) =>
    buildGlamiItems({
      product,
      baseUrl,
      deliveryDate,
      deliveryId,
      deliveryPrice,
      manufacturer,
    }),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<SHOP>",
    ...items,
    "</SHOP>",
    "",
  ].join("\n");
}

export function createGlamiFeedXmlLoader({
  fetchProducts = fetchShopifyProductsJson,
  now = Date.now,
  ttlMs = 900_000,
}: CreateGlamiFeedXmlLoaderOptions = {}) {
  let cachedFeed:
    | { key: string; xml: string; expiresAt: number }
    | undefined;
  let pendingFeed: { key: string; promise: Promise<string> } | undefined;

  return async (options: LoadGlamiFeedXmlOptions) => {
    const key = JSON.stringify(options);
    const currentTime = now();

    if (
      cachedFeed?.key === key &&
      cachedFeed.expiresAt > currentTime
    ) {
      return cachedFeed.xml;
    }

    if (pendingFeed?.key === key) {
      return pendingFeed.promise;
    }

    const promise = fetchProducts({
      publicStoreUrl: options.publicStoreUrl,
    }).then((products) => buildGlamiFeedXml({ ...options, products }));
    pendingFeed = { key, promise };

    try {
      const xml = await promise;
      cachedFeed = { key, xml, expiresAt: now() + ttlMs };
      return xml;
    } finally {
      if (pendingFeed?.promise === promise) {
        pendingFeed = undefined;
      }
    }
  };
}

export async function fetchShopifyProductsJson({
  publicStoreUrl,
  fetchImpl = fetch,
  limit = 250,
}: FetchShopifyProductsOptions) {
  const products: ShopifyProductJson[] = [];
  const baseUrl = publicStoreUrl.replace(/\/+$/, "");

  for (let page = 1; ; page += 1) {
    const url = `${baseUrl}/products.json?limit=${limit}&page=${page}`;
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Shopify products feed returned ${response.status} for ${url}`);
    }

    const payload = (await response.json()) as ShopifyProductsJsonResponse;
    const pageProducts = payload.products || [];
    products.push(
      ...(await hydrateInventoryManagement({
        products: pageProducts,
        baseUrl,
        fetchImpl,
      })),
    );

    if (pageProducts.length < limit) {
      return products;
    }
  }
}

async function hydrateInventoryManagement({
  products,
  baseUrl,
  fetchImpl,
}: {
  products: ShopifyProductJson[];
  baseUrl: string;
  fetchImpl: typeof fetch;
}) {
  const hydratedProducts: ShopifyProductJson[] = [];

  for (const product of products) {
    if (
      !categoryForProduct(product) ||
      !product.variants.some((variant) => variant.available)
    ) {
      hydratedProducts.push(product);
      continue;
    }

    const url = `${baseUrl}/products/${encodeURIComponent(product.handle)}.js`;
    const response = await fetchProductWithRetry({ url, fetchImpl });

    if (!response.ok) {
      throw new Error(
        `Shopify product inventory returned ${response.status} for ${url}`,
      );
    }

    const payload = (await response.json()) as ShopifyProductDetailJsonResponse;
    const variantsById = new Map(
      (payload.variants || []).map((variant) => [String(variant.id), variant]),
    );
    hydratedProducts.push({
      ...product,
      variants: product.variants.map((variant) => {
        const inventoryVariant = variantsById.get(String(variant.id));

        if (!inventoryVariant) {
          throw new Error(
            `Shopify product inventory omitted variant ${variant.id} for ${url}`,
          );
        }

        return {
          ...variant,
          available: inventoryVariant.available,
          inventory_management: inventoryVariant.inventory_management || null,
        };
      }),
    });
  }

  return hydratedProducts;
}

async function fetchProductWithRetry({
  url,
  fetchImpl,
}: {
  url: string;
  fetchImpl: typeof fetch;
}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
    });

    if (response.status !== 429 || attempt === 3) {
      return response;
    }

    const retryAfter = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1_000
      : 1_000 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Shopify product inventory retries exhausted for ${url}`);
}

function buildGlamiItems({
  product,
  baseUrl,
  deliveryDate,
  deliveryId,
  deliveryPrice,
  manufacturer,
}: {
  product: ShopifyProductJson;
  baseUrl: string;
  deliveryDate: string;
  deliveryId: string;
  deliveryPrice: string;
  manufacturer: string;
}) {
  const categoryText = categoryForProduct(product);

  if (!categoryText || !product.images.length || !product.handle) {
    return [];
  }

  const availableVariants = product.variants.filter(
    (variant) => variant.available && variant.inventory_management === "shopify",
  );
  const itemGroupId = String(product.id);

  return availableVariants.map((variant) =>
    renderShopItem({
      product,
      variant,
      baseUrl,
      categoryText,
      deliveryDate,
      deliveryId,
      deliveryPrice,
      itemGroupId,
      manufacturer,
    }),
  );
}

function renderShopItem({
  product,
  variant,
  baseUrl,
  categoryText,
  deliveryDate,
  deliveryId,
  deliveryPrice,
  itemGroupId,
  manufacturer,
}: {
  product: ShopifyProductJson;
  variant: ShopifyProductVariantJson;
  baseUrl: string;
  categoryText: string;
  deliveryDate: string;
  deliveryId: string;
  deliveryPrice: string;
  itemGroupId: string;
  manufacturer: string;
}) {
  const itemId = variant.sku?.trim() || `${product.id}-${variant.id}`;
  const productUrl = `${baseUrl}/products/${encodeURIComponent(product.handle)}`;
  const variantUrl = `${productUrl}?variant=${encodeURIComponent(String(variant.id))}`;
  const description = stripHtml(product.body_html || product.title);
  const images = product.images.filter((image) => image.src).slice(0, 11);
  const gtin = normalizeGtin(variant.barcode);
  const color = colorForProduct(product);

  return [
    "  <SHOPITEM>",
    element("ITEM_ID", itemId, 4),
    element("ITEMGROUP_ID", itemGroupId, 4),
    element("PRODUCTNAME", productName(product), 4),
    element("DESCRIPTION", description, 4),
    element("URL", productUrl, 4),
    element("URL_SIZE", variantUrl, 4),
    element("IMGURL", images[0]?.src || "", 4),
    ...images.slice(1).map((image) => element("IMGURL_ALTERNATIVE", image.src, 4)),
    element("PRICE_VAT", normalizePrice(variant.price), 4),
    element("MANUFACTURER", manufacturer, 4),
    element("CATEGORYTEXT", categoryText, 4),
    ...(gtin ? [element("GTIN", gtin, 4)] : []),
    element("DELIVERY_DATE", deliveryDate, 4),
    renderDelivery(deliveryId, deliveryPrice, 4),
    renderParam("Materiál", "Hodváb", 4),
    renderParam("farba", color, 4),
    "  </SHOPITEM>",
  ].join("\n");
}

function productName(product: ShopifyProductJson) {
  const prefix =
    product.product_type === "Hodvábny župan"
      ? "Dámsky hodvábny župan"
      : "Dámska hodvábna šatka";

  return `${prefix} ${product.title}`;
}

function categoryForProduct(product: ShopifyProductJson) {
  const productType = product.product_type?.trim();

  if (!productType || EXCLUDED_PRODUCT_TYPES.has(productType)) {
    return null;
  }

  return GLAMI_CATEGORY_BY_PRODUCT_TYPE[productType] || null;
}

function renderParam(name: string, value: string, indent: number) {
  const padding = " ".repeat(indent);

  return [
    `${padding}<PARAM>`,
    element("PARAM_NAME", name, indent + 2),
    element("VAL", value, indent + 2),
    `${padding}</PARAM>`,
  ].join("\n");
}

function renderDelivery(deliveryId: string, deliveryPrice: string, indent: number) {
  const padding = " ".repeat(indent);

  return [
    `${padding}<DELIVERY>`,
    element("DELIVERY_ID", deliveryId, indent + 2),
    element("DELIVERY_PRICE", normalizePrice(deliveryPrice), indent + 2),
    `${padding}</DELIVERY>`,
  ].join("\n");
}

function element(name: string, value: string, indent: number) {
  return `${" ".repeat(indent)}<${name}>${escapeXml(value)}</${name}>`;
}

function normalizePrice(price: string) {
  return Number.parseFloat(price).toFixed(2);
}

function normalizeGtin(value?: string | null) {
  const gtin = value?.replace(/[\s-]/g, "") || "";

  return /^(?:\d{8}|\d{12}|\d{13}|\d{14}|\d{18})$/.test(gtin) ? gtin : null;
}

const COLOR_RULES: Array<{ value: string; patterns: RegExp[] }> = [
  { value: "korálová", patterns: [/\bcoral\b/i, /koral/iu] },
  { value: "tyrkysová", patterns: [/\bturquoise\b/i, /tyrkys/iu] },
  {
    value: "modrá",
    patterns: [/\bblue\b/i, /\bnavy\b/i, /\bazure\b/i, /biscay/i, /modr/iu],
  },
  {
    value: "červená",
    patterns: [/\bred\b/i, /\breddish\b/i, /červen/iu, /cerven/iu, /bordov/iu, /vín/iu],
  },
  {
    value: "zelená",
    patterns: [/\bgreen\b/i, /\bemerald\b/i, /zelen/iu, /smaragd/iu, /mentol/iu],
  },
  { value: "ružová", patterns: [/\bpink\b/i, /ruž/iu, /ruz/iu, /púd/iu, /pud/iu, /losos/iu] },
  {
    value: "fialová",
    patterns: [/\bpurple\b/i, /\blilac\b/i, /fial/iu, /levandu/iu, /ametyst/iu],
  },
  { value: "oranžová", patterns: [/\borange\b/i, /oranž/iu, /oranz/iu] },
  { value: "žltá", patterns: [/\byellow\b/i, /žlt/iu, /zlt/iu, /maslov/iu] },
  { value: "zlatá", patterns: [/\bgold\b/i, /zlat/iu] },
  { value: "čierna", patterns: [/\bblack\b/i, /čier/iu, /cier/iu] },
  { value: "biela", patterns: [/\bwhite\b/i, /biel/iu] },
  { value: "hnedá", patterns: [/\bbrown\b/i, /\bmocha\b/i, /hned/iu, /mokka/iu] },
  { value: "béžová", patterns: [/\bbeige\b/i, /béž/iu, /bezov/iu, /krém/iu, /krem/iu, /smotan/iu] },
  { value: "sivá", patterns: [/\bgrey\b/i, /\bgray\b/i, /siv/iu, /šed/iu, /sed/iu] },
];

function colorForProduct(product: ShopifyProductJson) {
  const text = `${product.title} ${stripHtml(product.body_html || "")}`.slice(0, 500);
  const match = COLOR_RULES.find(({ patterns }) =>
    patterns.some((pattern) => pattern.test(text)),
  );

  return match?.value || "viacfarebná";
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
