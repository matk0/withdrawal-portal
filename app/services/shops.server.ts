import db from "../db.server";
import type { WithdrawalLocale } from "./withdrawal";

export async function ensureShop(shopDomain: string) {
  return db.shop.upsert({
    where: { shop: shopDomain },
    create: {
      shop: shopDomain,
      installed: true,
    },
    update: {
      installed: true,
    },
  });
}

export async function updateShopSettings(
  shopDomain: string,
  settings: {
    locale: WithdrawalLocale;
    cutoffDays: number;
    supportEmail: string | null;
    replyToEmail: string | null;
    shopName: string | null;
  },
) {
  return db.shop.update({
    where: { shop: shopDomain },
    data: settings,
  });
}

export async function markShopUninstalled(shopDomain: string) {
  await db.shop.updateMany({
    where: { shop: shopDomain },
    data: { installed: false },
  });
}

export async function redactShop(shopDomain: string) {
  await db.shop.deleteMany({
    where: { shop: shopDomain },
  });
}
