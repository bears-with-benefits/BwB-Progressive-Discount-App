import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

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

// Convert metafield edges into a simple config object
function metafieldsToConfig(edges) {
  const config = {
    mode: "off",
    trigger_code: "",
    step_1: "",
    step_2: "",
    step_3: "",
  };

  for (const edge of edges || []) {
    const mf = edge.node;
    if (!mf) continue;
    if (Object.prototype.hasOwnProperty.call(config, mf.key)) {
      config[mf.key] = mf.value || "";
    }
  }

  return config;
}

// Loader: fetch shop id + existing metafields
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

// Action: save config to shop metafields
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const shopId = (formData.get("shopId") || "").toString().trim();
  const mode = (formData.get("mode") || "off").toString().trim();
  const triggerCode = (formData.get("trigger_code") || "").toString().trim();
  const step1 = (formData.get("step_1") || "").toString().trim();
  const step2 = (formData.get("step_2") || "").toString().trim();
  const step3 = (formData.get("step_3") || "").toString().trim();

  if (!shopId) {
    return json(
      { error: "Missing shop ID.", success: null },
      { status: 400 }
    );
  }

  const allowedModes = ["off", "manual", "automatic"];
  const safeMode = allowedModes.includes(mode) ? mode : "off";

  const metafields = [
    {
      ownerId: shopId,
      namespace: "bwb_progressive",
      key: "mode",
      type: "single_line_text_field",
      value: safeMode,
    },
    {
      ownerId: shopId,
      namespace: "bwb_progressive",
      key: "trigger_code",
      type: "single_line_text_field",
      value: triggerCode,
    },
    {
      ownerId: shopId,
      namespace: "bwb_progressive",
      key: "step_1",
      type: "single_line_text_field",
      value: step1,
    },
    {
      ownerId: shopId,
      namespace: "bwb_progressive",
      key: "step_2",
      type: "single_line_text_field",
      value: step2,
    },
    {
      ownerId: shopId,
      namespace: "bwb_progressive",
      key: "step_3",
      type: "single_line_text_field",
      value: step3,
    },
  ];

  try {
    const response = await admin.graphql(
      SAVE_PROGRESSIVE_CONFIG_MUTATION,
      { variables: { metafields } }
    );
    const data = await response.json();
    const payload = data.data?.metafieldsSet;

    if (!payload || (payload.userErrors && payload.userErrors.length)) {
      const messages = (payload?.userErrors || [])
        .map((e) => `${(e.field || []).join(".")}: ${e.message}`)
        .join("; ");

      return json(
        {
          error: `Failed to save configuration: ${messages || "Unknown error"}`,
          success: null,
        },
        { status: 400 }
      );
    }

    return json({
      error: null,
      success: "Configuration saved.",
    });
  } catch (err) {
    console.error("Error saving progressive configuration", err);
    return json(
      {
        error: "Internal error while saving configuration.",
        success: null,
      },
      { status: 500 }
    );
  }
}

export default function ProgressiveConfigPage() {
  const { shopId, config } = useLoaderData();
  const actionData = useActionData();

  return (
    <div style={{ padding: 16, maxWidth: 600 }}>
      <h1 style={{ marginBottom: 12 }}>Progressive Discount Configuration</h1>
      <p style={{ marginBottom: 12 }}>
        Configure how the progressive discount behaves.
        These settings are stored as shop metafields and used by the theme snippet.
      </p>

      <Form method="post">
        <input type="hidden" name="shopId" value={shopId} />

        <div style={{ marginBottom: 12 }}>
          <label>
            Mode:{" "}
            <select name="mode" defaultValue={config.mode}>
              <option value="off">Disabled</option>
              <option value="manual">Manual / URL code</option>
              <option value="automatic">Automatic</option>
            </select>
          </label>
          <div style={{ fontSize: 12, color: "#666" }}>
            Disabled = no progressive discount. Manual / URL = requires code. Automatic = applies automatically.
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Trigger code:{" "}
            <input
              type="text"
              name="trigger_code"
              defaultValue={config.trigger_code}
              placeholder="e.g. GETMORE or TIEREDDISCOUNT"
              style={{ marginLeft: 8 }}
            />
          </label>
          <div style={{ fontSize: 12, color: "#666" }}>
            Must match a discount code created on the Progressive Discounts page. This page selects which code we want to use (we can create lots of potential app-based discounts on the Progressive Discounts page, here we select which one will be used)
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <strong>Discount steps</strong>
          <div style={{ fontSize: 12, color: "#666" }}>
            Format: <code>amount / % off</code>, e.g. <code>30/10</code> for €30 and 10% off.
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>
            Step 1:{" "}
            <input
              type="text"
              name="step_1"
              defaultValue={config.step_1}
              placeholder="e.g. 30/10"
              style={{ marginLeft: 8 }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>
            Step 2:{" "}
            <input
              type="text"
              name="step_2"
              defaultValue={config.step_2}
              placeholder="e.g. 50/20"
              style={{ marginLeft: 8 }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>
            Step 3:{" "}
            <input
              type="text"
              name="step_3"
              defaultValue={config.step_3}
              placeholder="e.g. 80/40"
              style={{ marginLeft: 8 }}
            />
          </label>
        </div>

        <button type="submit" style={{ marginTop: 12 }}>
          Save configuration
        </button>
      </Form>

      {actionData?.error && (
        <p style={{ color: "red", marginTop: 16 }}>{actionData.error}</p>
      )}
      {actionData?.success && (
        <p style={{ color: "green", marginTop: 16 }}>{actionData.success}</p>
      )}

      <div style={{ marginTop: 24, fontSize: 12, color: "#666" }}>
        <p>
          Once saved, the <code>progressive-discount</code> liquid snippet will read
          these values via <code>shop.metafields.bwb_progressive</code> and
          write them into <code>cart.attributes</code> as{" "}
          <code>progressive_mode</code>, <code>step_1/2/3</code>, and{" "}
          <code>progression_codes</code>.
        </p>
      </div>
    </div>
  );
}