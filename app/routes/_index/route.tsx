import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>Shopify app for EU withdrawal requests</p>
        <h1 className={styles.heading}>Withdrawal Portal</h1>
        <p className={styles.text}>
          Help customers submit online withdrawal declarations and keep a traceable request record
          inside Shopify.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Recent order lookup</strong>. Customers verify an order number and email before
            selecting eligible items.
          </li>
          <li>
            <strong>Storefront app proxy</strong>. The withdrawal flow runs on the merchant domain
            and can be linked from a theme app extension.
          </li>
          <li>
            <strong>Merchant records</strong>. Requests are saved with selected items, timestamps,
            audit events, email notifications, and CSV export.
          </li>
        </ul>
      </div>
    </div>
  );
}
