import { json } from '@remix-run/node';
import { Form, Link, useActionData, useFetcher, useLoaderData } from '@remix-run/react';
import { useMemo, useState } from 'react';
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { authenticate } from '../shopify.server';

const GET_PROGRESSIVE_CONFIG_QUERY = `
  query GetProgressiveConfig {
    shop {
      id
      metafields(first: 10, namespace: "bwb_progressive") {
        edges {
          node {
            id
            key
            namespace
            type
            value
          }
        }
      }
    }
  }
`;

const SAVE_PROGRESSIVE_CONFIG_MUTATION = `
  mutation SaveProgressiveConfig($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        key
        namespace
        type
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function metafieldsToConfig(edges) {
  const config = {
    mode: 'off',
    trigger_code: '',
    step_1: '',
    step_2: '',
    step_3: '',
  };

  for (const edge of edges || []) {
    const mf = edge.node;
    if (!mf) continue;
    if (Object.prototype.hasOwnProperty.call(config, mf.key)) {
      config[mf.key] = mf.value || '';
    }
  }

  return config;
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(GET_PROGRESSIVE_CONFIG_QUERY);
  const data = await response.json();

  const shop = data.data?.shop;
  const shopId = shop?.id;
  const edges = shop?.metafields?.edges || [];

  const config = metafieldsToConfig(edges);

  return json({
    shopId,
    config,
  });
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const shopId = (formData.get('shopId') || '').toString().trim();
  const mode = (formData.get('mode') || 'off').toString().trim();
  const triggerCode = (formData.get('trigger_code') || '').toString().trim();
  const step1 = (formData.get('step_1') || '').toString().trim();
  const step2 = (formData.get('step_2') || '').toString().trim();
  const step3 = (formData.get('step_3') || '').toString().trim();

  if (!shopId) {
    return json({ error: 'Missing shop ID.', success: null }, { status: 400 });
  }

  const allowedModes = ['off', 'manual', 'automatic'];
  const safeMode = allowedModes.includes(mode) ? mode : 'off';

  const metafields = [
    {
      ownerId: shopId,
      namespace: 'bwb_progressive',
      key: 'mode',
      type: 'single_line_text_field',
      value: safeMode,
    },
    {
      ownerId: shopId,
      namespace: 'bwb_progressive',
      key: 'trigger_code',
      type: 'single_line_text_field',
      value: triggerCode,
    },
    {
      ownerId: shopId,
      namespace: 'bwb_progressive',
      key: 'step_1',
      type: 'single_line_text_field',
      value: step1,
    },
    {
      ownerId: shopId,
      namespace: 'bwb_progressive',
      key: 'step_2',
      type: 'single_line_text_field',
      value: step2,
    },
    {
      ownerId: shopId,
      namespace: 'bwb_progressive',
      key: 'step_3',
      type: 'single_line_text_field',
      value: step3,
    },
  ];

  try {
    const response = await admin.graphql(SAVE_PROGRESSIVE_CONFIG_MUTATION, {
      variables: { metafields },
    });
    const data = await response.json();
    const payload = data.data?.metafieldsSet;

    if (!payload || (payload.userErrors && payload.userErrors.length)) {
      const messages = (payload?.userErrors || [])
        .map(e => `${(e.field || []).join('.')}: ${e.message}`)
        .join('; ');

      return json(
        {
          error: `Failed to save configuration: ${messages || 'Unknown error'}`,
          success: null,
        },
        { status: 400 }
      );
    }

    return json({
      error: null,
      success: 'Configuration saved.',
    });
  } catch (err) {
    console.error('Error saving progressive configuration', err);
    return json(
      {
        error: 'Internal error while saving configuration.',
        success: null,
      },
      { status: 500 }
    );
  }
}

export default function ProgressiveDiscountsPage() {
  const { shopId, config } = useLoaderData();
  const actionData = useActionData();
  const createDiscounts = useFetcher();

  const [mode, setMode] = useState(config.mode || 'off');
  const [triggerCode, setTriggerCode] = useState(config.trigger_code || '');
  const [step1, setStep1] = useState(config.step_1 || '');
  const [step2, setStep2] = useState(config.step_2 || '');
  const [step3, setStep3] = useState(config.step_3 || '');
  const [createTriggerCode, setCreateTriggerCode] = useState(config.trigger_code || '');
  const [createAutomatic, setCreateAutomatic] = useState(true);

  const modeOptions = useMemo(
    () => [
      { label: 'Disabled', value: 'off' },
      { label: 'URL / Manual', value: 'manual' },
      { label: 'Automatic', value: 'automatic' },
    ],
    []
  );

  const hasConfig = config.mode !== 'off' && config.trigger_code && config.step_1;

  const getContextualMessage = () => {
    if (!hasConfig) {
      return {
        tone: 'info',
        title: 'Start here',
        message: 'Step 1: Add the theme snippet before configuring discounts.',
      };
    }
    if (createDiscounts.data?.success) {
      return {
        tone: 'success',
        title: 'Discounts created',
        message:
          'Remember to activate the correct discount in Shopify Admin based on your selected mode (Step 5).',
      };
    }
    return null;
  };

  const contextualMessage = getContextualMessage();

  return (
    <Page title='Progressive Discounts'>
      <Layout>
        <Layout.Section>
          <BlockStack gap='400'>
            <InlineStack gap='200' align='start' blockAlign='center'>
              <Text tone='subdued'>Need full instructions?</Text>
              <Link to='/app/setup-guide'>Open the setup guide →</Link>
            </InlineStack>
            {contextualMessage && (
              <Banner title={contextualMessage.title} tone={contextualMessage.tone}>
                <p>{contextualMessage.message}</p>
                <p style={{ marginTop: '8px' }}>
                  <Link to='/app/theme-setup'>Open theme snippet steps →</Link>
                </p>
                <p style={{ marginTop: '4px' }}>
                  <Link to='/app/setup-guide'>View full setup guide →</Link>
                </p>
              </Banner>
            )}

            <Card>
              <BlockStack gap='400'>
                <Text as='h2' variant='headingMd'>
                  Step 1: Add the theme snippet
                </Text>
                <Text tone='subdued'>
                  The theme snippet is required to write cart attributes for the discount function.
                </Text>
                <InlineStack gap='300' align='start' blockAlign='center'>
                  <Link to='/app/theme-setup'>Open theme snippet steps →</Link>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap='400'>
                <Text as='h2' variant='headingMd'>
                  Step 2: Configuration
                </Text>
                <Text tone='subdued'>
                  Configure tiers and mode. These values are stored as shop metafields and used by
                  the theme snippet.
                </Text>
                <Text tone='subdued'>
                  Rebuy manual codes apply at checkout, not in-cart.
                
                </Text>

                <Form method='post'>
                  <input type='hidden' name='shopId' value={shopId} />
                  <FormLayout>
                    <Select
                      label='Mode'
                      name='mode'
                      options={modeOptions}
                      value={mode}
                      onChange={setMode}
                      helpText='Manual requires a code. Automatic applies automatically.'
                    />
                    <TextField
                      label='Trigger code'
                      name='trigger_code'
                      value={triggerCode}
                      onChange={setTriggerCode}
                      placeholder='e.g. GETMORE'
                      helpText='Must match a discount code created below.'
                    />
                    <Text variant='bodySm' tone='subdued'>
                      Discount steps (format: amount / % off, e.g. 30/10)
                    </Text>
                    <InlineStack gap='400' wrap={false}>
                      <TextField
                        label='Step 1'
                        name='step_1'
                        value={step1}
                        onChange={setStep1}
                        placeholder='e.g. 30/10'
                      />
                      <TextField
                        label='Step 2'
                        name='step_2'
                        value={step2}
                        onChange={setStep2}
                        placeholder='e.g. 50/20'
                      />
                      <TextField
                        label='Step 3'
                        name='step_3'
                        value={step3}
                        onChange={setStep3}
                        placeholder='e.g. 80/40'
                      />
                    </InlineStack>
                    <InlineStack align='end'>
                      <Button submit variant='primary'>
                        Save configuration
                      </Button>
                    </InlineStack>
                  </FormLayout>
                </Form>

                {actionData?.success && (
                  <Banner tone='success'>
                    <p>{actionData.success}</p>
                  </Banner>
                )}

                {actionData?.error && (
                  <Banner tone='critical'>
                    <p>{actionData.error}</p>
                  </Banner>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap='400'>
                <Text as='h2' variant='headingMd'>
                  Step 3: Create discounts
                </Text>
                <Text tone='subdued'>
                  Use this when creating a new trigger code. You can still adjust tiers without
                  re-creating discounts.
                </Text>
                {hasConfig && triggerCode && (
                  <Banner tone='info'>
                    <p>
                      Creating discounts for trigger code: <strong>{triggerCode}</strong>
                    </p>
                  </Banner>
                )}

                <createDiscounts.Form method='post' action='/app/progressive-discounts'>
                  <input type='hidden' name='createAutomatic' value={createAutomatic ? 'on' : ''} />
                  <FormLayout>
                    <TextField
                      label='Trigger code'
                      name='triggerCode'
                      value={createTriggerCode}
                      onChange={setCreateTriggerCode}
                      placeholder='e.g. GETMORE'
                      requiredIndicator
                    />
                    <Checkbox
                      label='Also create automatic progressive discount'
                      checked={createAutomatic}
                      onChange={setCreateAutomatic}
                    />
                    <InlineStack align='space-between' blockAlign='center'>
                      <Button submit>Create discounts</Button>
                    </InlineStack>
                  </FormLayout>
                </createDiscounts.Form>

                {createDiscounts.data?.error && (
                  <Banner tone='critical'>
                    <p>{createDiscounts.data.error}</p>
                  </Banner>
                )}
                {createDiscounts.data?.success && (
                  <Banner tone='success'>
                    <BlockStack gap='200'>
                      <Text as='p'>
                        Discounts created for code{' '}
                        <Text as='span' fontWeight='bold'>
                          {createDiscounts.data.success.code}
                        </Text>
                        .
                      </Text>
                      <Text as='p' fontWeight='semibold'>
                        Step 4: Enable the Discount Watcher block
                      </Text>
                      <Text as='p' tone='subdued'>
                        In Shopify Admin → Settings → Checkout, click Customize and add
                        the Discount Watcher block.
                      </Text>
                      <Text as='p' fontWeight='semibold'>
                        Step 5: Activate in Shopify Admin
                      </Text>
                      <Text as='p' tone='subdued'>
                        Navigate to{' '}
                        <Text as='span' fontWeight='bold'>
                          Shopify Admin → Discounts
                        </Text>{' '}
                        and activate the correct discount:
                      </Text>
                      <Text as='p' tone='subdued'>
                        • <strong>URL / Manual mode:</strong> Activate the "(URL/Manual)" discount
                        <br />• <strong>Automatic mode:</strong> Activate the "(Automatic)" discount
                      </Text>
                      <Text as='p' tone='subdued'>
                        Ensure only ONE progressive discount is active at a time.
                      </Text>
                    </BlockStack>
                  </Banner>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap='400'>
                <Text as='h2' variant='headingMd'>
                  Step 4: Enable the Discount Watcher block
                </Text>
                <Text tone='subdued'>
                  Add the checkout block so the discount message can appear.
                </Text>

                <BlockStack gap='200'>
                  <Text as='p' variant='bodyMd'>
                    Go to: <Text as='span' fontWeight='bold'>Shopify Admin → Settings → Checkout</Text>
                  </Text>
                  <Text tone='subdued'>
                    Click <Text as='span' fontWeight='bold'>Customize</Text>, then add the
                    <Text as='span' fontWeight='bold'> Discount Watcher</Text> block and save.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap='400'>
                <Text as='h2' variant='headingMd'>
                  Step 5: Activate in Shopify Admin
                </Text>
                <Text tone='subdued'>
                  After creating discounts, you need to manually activate the correct one in your
                  Shopify Admin.
                </Text>

                <BlockStack gap='200'>
                  <Text as='p' variant='bodyMd'>
                    Navigate to:{' '}
                    <Text as='span' fontWeight='bold'>
                      Shopify Admin → Discounts
                    </Text>
                  </Text>

                  <Banner tone='info'>
                    <BlockStack gap='200'>
                      <Text as='p'>
                        <strong>URL / Manual mode:</strong> Activate the discount ending with "(URL/Manual)"
                        and deactivate any "(Automatic)" discount.
                      </Text>
                      <Text as='p'>
                        <strong>Automatic mode:</strong> Activate the discount ending with
                        "(Automatic)" and deactivate any "(URL/Manual)" discount.
                      </Text>
                      <Text as='p'>
                        <strong>Important:</strong> Only ONE progressive discount should be active
                        at a time.
                      </Text>
                    </BlockStack>
                  </Banner>

                  <Text tone='subdued'>
                    The app cannot automatically activate/deactivate discounts, so this step must be
                    done manually. Look for discounts with "Progressive" in the title.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
            <div style={{ marginBottom: '16px' }} />
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
