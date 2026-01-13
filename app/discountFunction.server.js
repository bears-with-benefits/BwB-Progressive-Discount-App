import prisma from "~/db.server";
import { authenticate } from "~/shopify.server";

// Call this from an action/loader where you have `request`
export async function getOrRefreshFunctionId(request) {
  const cached = await prisma.discountFunction.findFirst();

  if (cached) {
    return cached.functionId;
  }

  // No cache: fetch via Admin API
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query GetAppDiscountTypes {
      appDiscountTypes {
        appKey
        title
        functionId
        discountClasses
      }
    }
  `);

  const data = await response.json();
  const types = data.data?.appDiscountTypes ?? [];

  // Filter for your app and desired class
  // appKey will usually match your app's client_id or dev dashboard app key
  const appKey = process.env.SHOPIFY_API_KEY;
  const target = types.find(
    (t) =>
      (!appKey || t.appKey === appKey) &&
      t.discountClasses?.includes("ORDER")
  );

  if (!target) {
    throw new Error(
      "No matching discount function found for ORDER class and appKey"
    );
  }

  const { functionId, appKey: resolvedAppKey, discountClasses } = target;

  await prisma.discountFunction.create({
    data: {
      functionId,
      appKey: resolvedAppKey,
      discountClasses: JSON.stringify(discountClasses || []),
    },
  });

  return functionId;
}
