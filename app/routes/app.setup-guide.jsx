import { json } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Card,
  Divider,
  Layout,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request);
  return json({});
}

export default function SetupGuidePage() {
  return (
    <Page
      title="Setup Guide"
      subtitle="Simple steps to launch progressive discounts"
      backAction={{ content: "Back", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner title="5 steps" tone="info">
              <p>
                1) Add the theme snippet<br />
                2) Configure tiers and mode<br />
                3) Create discounts<br />
                4) Enable the Discount Watcher checkout block<br />
                5) Activate the right discount in Shopify Admin
              </p>
            </Banner>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 1 — Add the theme snippet
                </Text>
                <Text tone="subdued">
                  Install the snippet into your theme, then add the render line.
                </Text>
                <List>
                  <List.Item>
                    Go to <Link to="/app/theme-setup">Theme Snippet</Link>
                  </List.Item>
                  <List.Item>
                    Create <code>snippets/progressive-discount.liquid</code> and
                    paste the snippet contents
                  </List.Item>
                  <List.Item>
                    Add <code>{"{% render 'progressive-discount' %}"}</code> to theme.liquid (before <code>&lt;/body&gt;</code>)
                  </List.Item>
                </List>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 2 — Configure
                </Text>
                <Text tone="subdued">
                  Go to <Link to="/app">Progressive Discounts</Link> and set:
                </Text>
                <List>
                  <List.Item>
                    <strong>Mode</strong> (URL / Manual, Automatic, or Disabled)
                  </List.Item>
                  <List.Item>
                    <strong>Trigger code</strong> (the customer-facing code)
                  </List.Item>
                  <List.Item>
                    <strong>Steps</strong> using the format{" "}
                    <code>amount/percent</code> (amount is in store currency, not
                    cents)
                  </List.Item>
                </List>
                <Text tone="subdued">
                  Example: <code>30/10</code>, <code>50/20</code>,{" "}
                  <code>80/40</code>. Use whole numbers only.
                </Text>
                <Text tone="subdued">
                  URL/manual codes apply at checkout. Cart previews may differ.
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 3 — Create discounts
                </Text>
                <Text tone="subdued">
                  Use the “Create discounts” section on the same page. You only
                  need to do this once per trigger code.
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 4 — Enable the Discount Watcher block
                </Text>
                <Text tone="subdued">
                  Add the checkout block so the discount message can appear.
                </Text>
                <List>
                  <List.Item>
                    Go to Shopify Admin → Settings → Checkout
                  </List.Item>
                  <List.Item>
                    Click <strong>Customize</strong> to open the checkout editor
                  </List.Item>
                  <List.Item>
                    Add the <strong>Discount Watcher</strong> block to Checkout. Looks best in Order Summary, between Discounts and Total.
                  </List.Item>
                  <List.Item>
                    Save changes
                  </List.Item>
                </List>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 5 — Activate in Shopify Admin
                </Text>
                <Text tone="subdued">
                  In Shopify Admin → Discounts, activate the correct discount:
                </Text>
                <List>
                  <List.Item>
                    <strong>URL / Manual mode:</strong> activate “(URL/Manual)”, disable
                    “(Automatic)”
                  </List.Item>
                  <List.Item>
                    <strong>Automatic mode:</strong> activate “(Automatic)”, disable
                    “(URL/Manual)”
                  </List.Item>
                </List>
              </BlockStack>
            </Card>

            <Divider />

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Mode cheat sheet
                </Text>
                <List>
                  <List.Item>
                    <strong>URL / Manual code:</strong> customer enters the code
                  </List.Item>
                  <List.Item>
                    <strong>Automatic:</strong> discount applies automatically
                  </List.Item>
                  <List.Item>
                    <strong>Disabled:</strong> no progressive discount
                  </List.Item>
                </List>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Quick troubleshooting
                </Text>
                <List>
                  <List.Item>
                    Discount not applying? Check that the correct discount is
                    active in Admin.
                  </List.Item>
                  <List.Item>
                    Discount message missing? Ensure the Discount Watcher block
                    is enabled in Checkout Editor.
                  </List.Item>
                  <List.Item>
                    Wrong tier? Refresh the storefront and cart after updating
                    config.
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </BlockStack>
          <div style={{ marginBottom: '16px' }} />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
