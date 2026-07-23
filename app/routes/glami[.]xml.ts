import { buildGlamiFeedXml, fetchShopifyProductsJson } from "../services/glami-feed.server";

export const loader = async () => {
  const publicStoreUrl =
    process.env.GLAMI_PUBLIC_STORE_URL || "https://onebyone.sk";
  const products = await fetchShopifyProductsJson({ publicStoreUrl });
  const xml = buildGlamiFeedXml({
    products,
    publicStoreUrl,
    deliveryId: process.env.GLAMI_DELIVERY_ID || "PACKETA",
    deliveryPrice: process.env.GLAMI_DELIVERY_PRICE || "3.90",
    manufacturer: process.env.GLAMI_MANUFACTURER || "One by One",
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
};
