import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import {
  Banner,
  BlockStack,
  Box,
  Card,
  InlineStack,
  Layout,
  List,
  Page,
  Text,
  Button,
} from "@shopify/polaris";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { authenticate } from "../shopify.server";
export async function loader({ request }) {
  await authenticate.admin(request);
  const snippetPath = path.join(
    process.cwd(),
    "snippet",
    "progressive-discount-liquid-snippet.md"
  );
  const snippetContent = await readFile(snippetPath, "utf8");
  return json({ snippetContent });
}

export default function ThemeSnippetPage() {
  const { snippetContent } = useLoaderData();
  const [showSnippet, setShowSnippet] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippetContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Could not copy snippet", err);
    }
  };

  return (
    <Page
      title="Theme Snippet"
      subtitle="Manual setup for the progressive discount snippet"
      backAction={{ content: "Back", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner title="Required for storefront" tone="info">
              <p>
                The progressive discount Function relies on cart attributes set
                by this snippet.
              </p>
            </Banner>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 1 — Create the snippet
                </Text>
                <List>
                  <List.Item>
                    In your theme code editor, create a new snippet named
                    <code>progressive-discount.liquid</code>.
                  </List.Item>
                  <List.Item>
                    <BlockStack gap="200">
                      <Text as="p">
                        Paste the following into your new snippet file:
                      </Text>
                      <InlineStack gap="300" align="start" blockAlign="center">
                        <Button onClick={() => setShowSnippet(!showSnippet)}>
                          {showSnippet ? "Hide snippet" : "Show snippet"}
                        </Button>
                        <Button onClick={copySnippet}>
                          {copied ? "Copied" : "Copy snippet"}
                        </Button>
                      </InlineStack>
                      {showSnippet && (
                        <Box
                          padding="400"
                          background="bg-surface-active"
                          borderWidth="025"
                          borderRadius="200"
                          overflowX="scroll"
                        >
                          <pre style={{ margin: 0 }}>
                            <code>{snippetContent}</code>
                          </pre>
                        </Box>
                      )}
                    </BlockStack>
                  </List.Item>
                  <List.Item>Save the snippet.</List.Item>
                </List>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 2 — Render it in theme.liquid
                </Text>
                <List>
                  <List.Item>
                    Add the render line near the bottom of
                    <code> theme.liquid </code> (before <code>&lt;/body&gt;</code>).
                  </List.Item>
                  <List.Item>
                    Use: <code>{"{% render 'progressive-discount' %}"}</code>
                  </List.Item>
                </List>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 3 — Verify
                </Text>
                <Text tone="subdued">
                  Add items to cart and confirm the progressive discount applies
                  once thresholds are met.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
