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
  const target = types.find((t: any) =>
    t.discountClasses?.includes("ORDER")
  );

  if (!target) {
    throw new Error("No matching discount function found for ORDER class");
  }

  const { functionId, appKey, discountClasses } = target;

  await prisma.discountFunction.create({
    data: {
      functionId,
      appKey,
      discountClasses: JSON.stringify(discountClasses || []),
    },
  });

  return functionId;
}