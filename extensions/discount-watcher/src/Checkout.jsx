import {
  reactExtension,
  useAttributes,
  useTotalAmount,
  useSubtotalAmount,
  useDiscountCodes,
  BlockStack,
  Text,
} from "@shopify/ui-extensions-react/checkout";
import {useMemo} from "react";

export default reactExtension("purchase.checkout.block.render", () => <App />);

function App() {
  const attributes = useAttributes();
  const totalAmount = useTotalAmount();       // total after discounts
  const subtotalAmount = useSubtotalAmount(); // subtotal before discounts
  const discountCodes = useDiscountCodes();   // entered discount codes, e.g. GETMORE

  // Map attributes into a plain object for convenience
  const attrMap = useMemo(
    () => Object.fromEntries(attributes.map(a => [a.key, a.value])),
    [attributes],
  );

  // Parse tiers: "25/10", "50/20", "80/40"
  const tiers = useMemo(() => {
    const stepKeys = ["step_1", "step_2", "step_3"];

    return stepKeys
      .map((key) => {
        const raw = attrMap[key];
        if (!raw || typeof raw !== "string") return null;

        const [thresholdStr, percentStr] = raw.split("/");
        const threshold = parseFloat(thresholdStr);
        const percentage = parseFloat(percentStr);

        if (Number.isNaN(threshold) || Number.isNaN(percentage)) {
          console.warn("Could not parse tier", key, raw);
          return null;
        }

        return {key, raw, threshold, percentage};
      })
      .filter(Boolean)
      .sort((a, b) => a.threshold - b.threshold);
  }, [attrMap]);

  // If no tiers or missing money data, don't render anything
  if (!tiers.length || !subtotalAmount || !totalAmount) {
    return null;
  }

  const originalSubtotal = (() => {
    const val = parseFloat(subtotalAmount.amount);
    return Number.isNaN(val) ? 0 : val;
  })();

  const totalAfterDiscounts = (() => {
    const val = parseFloat(totalAmount.amount);
    return Number.isNaN(val) ? 0 : val;
  })();

  if (!originalSubtotal) {
    return null;
  }

  // Determine active tier based on *original* subtotal
  const activeTier = useMemo(() => {
    if (!tiers.length) return null;

    let best = null;
    for (const tier of tiers) {
      if (originalSubtotal >= tier.threshold) {
        best = tier;
      }
    }
    return best;
  }, [tiers, originalSubtotal]);

  // If no tier is active, hide the block
  if (!activeTier) {
    return null;
  }

  // Determine trigger code label
  const triggerCode = useMemo(() => {
    // Prefer progression_codes attribute from your theme script
    const fromAttribute =
      typeof attrMap.progression_codes === "string"
        ? attrMap.progression_codes
        : null;

    if (fromAttribute && fromAttribute.trim() !== "") {
      // Can be comma-separated; use first
      return fromAttribute.split(",")[0].trim();
    }

    // Fallback: first discount code entered at checkout
    const fromDiscountHook =
      discountCodes && discountCodes.length > 0
        ? discountCodes[0]?.code
        : null;

    return fromDiscountHook || "your discount";
  }, [attrMap, discountCodes]);

  // Calculate absolute savings (clamped to >= 0)
  const savings = Math.max(0, originalSubtotal - totalAfterDiscounts);

  return (
    <BlockStack spacing="tight">
      <Text type="strong" tone="info">
      You’re getting {activeTier.percentage}% off with {triggerCode}!   🐻 🎉
      </Text>
    </BlockStack>
  );
}



// import {
//   reactExtension,
//   useDiscountCodes,
//   useDiscountAllocations,
//   useAttributes,
//   useApplyAttributeChange,
// } from "@shopify/ui-extensions-react/checkout";
// import {useEffect, useMemo, useRef} from "react";

// export default reactExtension("purchase.checkout.block.render", () => <App />);

// function App() {
//   const ATTR_KEY = "active_codes"; // write strictly to this field
//   const attributes = useAttributes();
//   const discountCodes = useDiscountCodes();           // discount codes
//   const discountAllocations = useDiscountAllocations(); // automatic discounts (and other allocations)
//   const applyAttributeChange = useApplyAttributeChange();
//   console.log('attributes', attributes)
//   console.log('discountCodes', discountCodes)
//   console.log('discountAllocations', discountAllocations)

//   const namesJson = useMemo(() => {
//     const codeNames =
//       (discountCodes ?? [])
//         .map(d => d?.code)
//         .filter(Boolean);

//     const autoNames =
//       (discountAllocations ?? [])
//         .map(a => a?.discountApplication)
//         .filter(app => app?.type === "AUTOMATIC")
//         .map(app => app?.title || "automatic_discount")
//         .filter(Boolean);

//     // remove duplicates and get the final flat array of strings
//     const unique = Array.from(new Set([...codeNames, ...autoNames]));
//     return JSON.stringify(unique);
//   }, [discountCodes, discountAllocations]);

//   // To avoid an infinite loop, write only on a real change
//   const lastWrittenRef = useRef(null);
//   useEffect(() => {
//     let alive = true;

//     async function writeIfChanged() {
//       if (lastWrittenRef.current === namesJson) return;

//       const existing = attributes?.find(a => a.key === ATTR_KEY)?.value ?? null;
//       if (existing === namesJson) {
//         lastWrittenRef.current = namesJson;
//         return;
//       }
//       console.log('namesJson', namesJson)
//       if (!alive) return;
//       await applyAttributeChange({
//         type: "updateAttribute",
//         key: ATTR_KEY,
//         value: namesJson, // strictly a JSON array of strings
//       });

//       lastWrittenRef.current = namesJson;
//     }

//     const t = setTimeout(writeIfChanged, 80);
//     return () => { alive = false; clearTimeout(t); };
//   }, [namesJson, attributes, applyAttributeChange]);


//   return null; // no UI
// }
