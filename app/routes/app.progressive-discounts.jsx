   import { json } from "@remix-run/node";
   import { Form, useActionData } from "@remix-run/react";
   import { authenticate } from "../shopify.server";

const PROGRESSIVE_FUNCTION_ID = "019b98d5-d1a6-7c01-a28a-200f38dd225f";

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

   export async function loader({ request }) {
     await authenticate.admin(request);
     return json({});
   }

   export async function action({ request }) {
     const { admin } = await authenticate.admin(request);
     const formData = await request.formData();

     const triggerCode = (formData.get("triggerCode") || "").trim();
     const createAutomatic = formData.get("createAutomatic") === "on";

     if (!triggerCode) {
       return json(
         { error: "Trigger code is required.", success: null },
         { status: 400 }
       );
     }

     if (!PROGRESSIVE_FUNCTION_ID || PROGRESSIVE_FUNCTION_ID === "YOUR_FUNCTION_ID_HERE") {
       return json(
         {
           error:
             "PROGRESSIVE_FUNCTION_ID is not configured. Set it in your environment.",
           success: null,
         },
         { status: 500 }
       );
     }

     try {
       const now = new Date().toISOString();

       // 1) Create code-based discount
       const codeResponse = await admin.graphql(
         CREATE_CODE_DISCOUNT_MUTATION,
         {
           variables: {
             codeAppDiscount: {
               code: triggerCode,
               title: `${triggerCode} Progressive (Manual)`,
               functionId: PROGRESSIVE_FUNCTION_ID,
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
         return json(
           {
             error: `Failed to create code discount: ${messages}`,
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
                 functionId: PROGRESSIVE_FUNCTION_ID,
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

   export default function ProgressiveDiscountsPage() {
     const actionData = useActionData();

     return (
       <div style={{ padding: 16, maxWidth: 600 }}>
         <h1>Progressive Discount Campaign</h1>
         <p>
           Enter a new trigger code (e.g. <code>GETMORE</code> or{" "}
           <code>TIEREDDISCOUNT</code>). This will create:
         </p>
         <ul>
           <li>A code-based app discount using our progressive discount Function</li>
           <li>Optionally, an automatic app discount using the same Function</li>
         </ul>

         <Form method="post">
           <div style={{ marginBottom: 12 }}>
             <label>
               Trigger code:{" "}
               <input
                 type="text"
                 name="triggerCode"
                 required
                 style={{ marginLeft: 8 }}
               />
             </label>
           </div>
           <div style={{ marginBottom: 12 }}>
             <label>
               <input
                 type="checkbox"
                 name="createAutomatic"
                 defaultChecked
               />{" "}
               Also create automatic progressive discount
             </label>
           </div>
           <button type="submit">Create Progressive Discounts</button>
         </Form>

         {actionData?.error && (
           <p style={{ color: "red", marginTop: 16 }}>{actionData.error}</p>
         )}
         {actionData?.success && (
           <div style={{ marginTop: 16 }}>
             <p style={{ color: "green" }}>
               Discounts created for code{" "}
               <strong>{actionData.success.code}</strong>.
             </p>
             {actionData.success.codeDiscountId && (
               <p>Code discount ID: {actionData.success.codeDiscountId}</p>
             )}
             {actionData.success.automaticDiscountId && (
               <p>
                 Automatic discount ID: {actionData.success.automaticDiscountId}
               </p>
             )}
             <div style={{ marginTop: 8 }}>
               <p>Next steps:</p>
               <ol>
                 <li>
                   In your theme settings, set <strong>Trigger code</strong> to{" "}
                   <code>{actionData.success.code}</code>.
                 </li>
                 <li>
                   Choose <strong>Manual / URL code</strong> or{" "}
                   <strong>Automatic (Function-powered)</strong> mode.
                 </li>
                 <li>
                   In <strong>Discounts</strong>, ensure only the matching
                   discount (code or automatic) is active for this mode.
                 </li>
                 <li>
                   Then, don't forget to configure the tiers / percentage amounts in the theme settings.
                 </li>
               </ol>
             </div>
           </div>
         )}
       </div>
     );
   }