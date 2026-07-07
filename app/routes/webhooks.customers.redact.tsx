import type { ActionFunctionArgs } from "react-router";

import db from "../db.server";
import { authenticate } from "../shopify.server";
import { hashEmail } from "../services/privacy.server";

type CustomerRedactPayload = {
  customer?: {
    email?: string;
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const customerEmail = (payload as CustomerRedactPayload).customer?.email;

  if (customerEmail) {
    await db.withdrawalRequest.updateMany({
      where: {
        shopDomain: shop,
        customerEmailHash: hashEmail(customerEmail),
      },
      data: {
        encryptedCustomerEmail: "",
      },
    });
  }

  return new Response();
};
