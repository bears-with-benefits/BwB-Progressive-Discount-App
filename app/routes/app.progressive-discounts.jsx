import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { getOrRefreshFunctionId } from "../discountFunction.server";

const CREATE_CODE_DISCOUNT_MUTATION = `
  mutation CreateProgressiveCodeDiscount($codeAppDiscount: DiscountCodeAppInput!) {
    discountCodeAppCreate(codeAppDiscount: $codeAppDiscount) {
      codeAppDiscount {
        discountId
        title
        status
        codes(first: 5) {
          nodes {
            code
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CREATE_AUTOMATIC_DISCOUNT_MUTATION = `
  mutation CreateProgressiveAutomaticDiscount($automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
      automaticAppDiscount {
        discountId
        title
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const triggerCode = (formData.get("triggerCode") || "").toString().trim();
  const createAutomatic = formData.get("createAutomatic") === "on";

  if (!triggerCode) {
    return json(
      { error: "Trigger code is required.", success: null },
      { status: 400 }
    );
  }

  try {
    const now = new Date().toISOString();

    // 0) Get current functionId dynamically (cached via discountFunction.server)
    const functionId = await getOrRefreshFunctionId(request);

    // 1) Create code-based discount
    const codeResponse = await admin.graphql(
      CREATE_CODE_DISCOUNT_MUTATION,
      {
        variables: {
          codeAppDiscount: {
            code: triggerCode,
            title: `${triggerCode} Progressive (URL/Manual)`,
            functionId,
            startsAt: now,
            discountClasses: ["ORDER"],
            combinesWith: {
              orderDiscounts: true,
              productDiscounts: true,
              shippingDiscounts: true,
            },
          },
        },
      }
    );

    const codeData = await codeResponse.json();
    const codePayload = codeData.data?.discountCodeAppCreate;

    if (!codePayload || (codePayload.userErrors && codePayload.userErrors.length)) {
      const messages = (codePayload?.userErrors || [])
        .map((e) => `${(e.field || []).join(".")}: ${e.message}`)
        .join("; ");
      const humanMessage = messages.includes("Code must be unique")
        ? "That discount code already exists. Choose a different code or use another existing one."
        : null;
      return json(
        {
          error: humanMessage || `Failed to create code discount: ${messages}`,
          success: null,
        },
        { status: 400 }
      );
    }

    let automaticInfo = null;

    // 2) Optionally create automatic discount
    if (createAutomatic) {
      const autoResponse = await admin.graphql(
        CREATE_AUTOMATIC_DISCOUNT_MUTATION,
        {
          variables: {
            automaticAppDiscount: {
              title: `${triggerCode} Progressive (Automatic)`,
              functionId,
              startsAt: now,
              discountClasses: ["ORDER"],
              combinesWith: {
                orderDiscounts: true,
                productDiscounts: true,
                shippingDiscounts: true,
              },
            },
          },
        }
      );

      const autoData = await autoResponse.json();
      const autoPayload = autoData.data?.discountAutomaticAppCreate;

      if (!autoPayload || (autoPayload.userErrors && autoPayload.userErrors.length)) {
        const messages = (autoPayload?.userErrors || [])
          .map((e) => `${(e.field || []).join(".")}: ${e.message}`)
          .join("; ");
        return json(
          {
            error:
              `Code discount created, but failed to create automatic discount: ${messages}`,
            success: null,
          },
          { status: 400 }
        );
      }

      automaticInfo = {
        discountId: autoPayload.automaticAppDiscount?.discountId,
      };
    }

    try {
      await prisma.discountLog.create({
        data: {
          shop: session?.shop || null,
          triggerCode,
          codeDiscountId: codePayload.codeAppDiscount?.discountId || null,
          automaticDiscountId: automaticInfo?.discountId || null,
        },
      });
    } catch (logError) {
      console.error("Failed to persist discount log", logError);
    }

    return json({
      error: null,
      success: {
        code: triggerCode,
        codeDiscountId: codePayload.codeAppDiscount?.discountId,
        automaticDiscountId: automaticInfo?.discountId || null,
      },
    });
  } catch (err) {
    console.error("Error creating progressive discounts", err);
    return json(
      { error: "Internal error while creating discounts.", success: null },
      { status: 500 }
    );
  }
}