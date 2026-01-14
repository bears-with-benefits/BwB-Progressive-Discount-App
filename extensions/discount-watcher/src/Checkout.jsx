import {
  reactExtension,
  useAttributes,
  useTotalAmount,
  useSubtotalAmount,
  useDiscountCodes,
  useDiscountAllocations,
  useTranslate,
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
  const discountAllocations = useDiscountAllocations();

  const translate = useTranslate();

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

  const appliedCodes = useMemo(() => (
    discountCodes || []
  ).map((entry) => (entry?.code || "").toLowerCase()).filter(Boolean), [discountCodes]);

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

    // Build localized message using Shopify i18n
  // "progressive.message" is defined in locales/*.json files
  const normalizedTriggerCode =
    typeof triggerCode === "string" ? triggerCode.toLowerCase() : "";
  const triggerPrefix = normalizedTriggerCode ? `${normalizedTriggerCode}-` : "";

  const allocations = Array.isArray(discountAllocations) ? discountAllocations : [];

  const hasAppliedProgressiveAllocation = allocations.some((allocation) => {
    if (!allocation || !allocation.type) return false;

    if (allocation.type === "code") {
      const code = (allocation.code || "").toLowerCase();
      return (
        normalizedTriggerCode &&
        (code === normalizedTriggerCode || (triggerPrefix && code.startsWith(triggerPrefix)))
      );
    }

    if (allocation.type === "automatic" || allocation.type === "custom") {
      const title = (allocation.title || "").toLowerCase();
      if (!title) return false;
      return (
        title.includes("progressive") ||
        (normalizedTriggerCode && title.includes(normalizedTriggerCode))
      );
    }

    return false;
  });

  const hasAppliedProgressiveCode = normalizedTriggerCode
    ? appliedCodes.some((code) =>
        code === normalizedTriggerCode || (triggerPrefix && code.startsWith(triggerPrefix))
      )
    : false;

  if (!hasAppliedProgressiveAllocation && !hasAppliedProgressiveCode) {
    return null;
  }

  const message = translate("progressive.message", {
    percent: activeTier.percentage,
    code: triggerCode,
  });

  return (
    <BlockStack spacing="tight">
      <Text type="strong" tone="info">
        {message}
      </Text>
    </BlockStack>
  );
}