import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
  ProductDiscountSelectionStrategy,
} from '../generated/api';


/**
  * @typedef {import("../generated/api").CartInput} RunInput
  * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
  */

/**
  * @param {RunInput} input
  * @returns {CartLinesDiscountsGenerateRunResult}
  */

export function cartLinesDiscountsGenerateRun(input) {
  const ops = [];

  const mode = (input.cart?.progressiveMode?.value || "manual")
    .toString()
    .trim()
    .toLowerCase();

  // If explicitly off, do nothing
  if (mode === "off") {
    return { operations: ops };
  }

  console.log('input', JSON.stringify(input.cart));
  console.log('activeCodes', input.cart?.activeCodes?.value);

  const progressCode = (input.cart?.progressCodes?.value ?? "").trim().toUpperCase();
  console.log('progressCode', progressCode)
  // 1) Find intersection of progressCodes and discountClasses and take the matching element
  const rawActiveCodes = input.cart?.activeCodes?.value;

  // Build an array of uppercased “active discount” codes from active_codes cart attribute
  const activeDiscounts = Array.isArray(rawActiveCodes)
    ? rawActiveCodes.map((s) => String(s).trim().toUpperCase())
    : rawActiveCodes
    ? String(rawActiveCodes)
        .split(/[,;|\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    : [];
  console.log('activeDiscounts', activeDiscounts)
  console.log('activeDiscounts type', typeof activeDiscounts)
    const fallbackTrigger = (input.triggeringDiscountCode || "")
      .trim()
      .toUpperCase();

    const matchedClass = activeDiscounts.find(c =>
      progressCode ? c.includes(progressCode) : Boolean(c),
    );

    // Mode decides whether we require a code trigger
    const isAutomatic = mode === "automatic";

    // If there's no matching active code and no triggering code:
    // - In manual mode, require some sort of code → bail.
    // - In automatic mode, continue (tiers + cart values will drive behavior).
    if (!matchedClass && !fallbackTrigger) {
      if (!isAutomatic) {
        return { operations: ops };
      }
    }

// Determine a display code for associatedDiscountCode; prefer progressCode when present
const triggeringCode = (matchedClass || fallbackTrigger || progressCode || "")
  .trim()
  .toUpperCase();
  console.log('triggeringCode', triggeringCode)
  // 3) Collect list of allowed codes from cart.attributes
  const allowedCodes = new Set();

  const addCode = (v) => {
    if (!v) return;
    String(v)
      .split(/[,;|\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .forEach(code => allowedCodes.add(code));
  };

  //addCode(input.cart?.progress_codes?.value);
  addCode(input.cart?.code_1?.value);
  addCode(input.cart?.code_2?.value);
  addCode(input.cart?.code_3?.value);

  console.log('allowedCodes', allowedCodes)
  // If code is not allowed — do nothing
  if (allowedCodes.size > 0 && !allowedCodes.has(triggeringCode)) {
    return { operations: ops };
  }

  // 4) Calculate totalAmount (as you requested)
  const totalAmount = Number(input.cart?.cost?.totalAmount?.amount ?? "0");
  if (!(totalAmount > 0)) return { operations: ops };
  console.log('totalAmount', totalAmount)
  // 5) Parse steps. Expected format "THRESHOLD/PERCENT%" for example "100/10%"
  const stepKeys = [
    "step_1", "step_2", "step_3"
  ];

  /** @type {{threshold:number, percent:number}[]} */
  const steps = [];

  for (const k of stepKeys) {
    const raw = input.cart?.[k]?.value;
    console.log('raw', raw)
    if (!raw) continue;
    // allow spaces and different cases, percentages can be with/without % sign
    // Examples: "100/10%", " 300 / 25", "250.5/7.5%"
    const m = String(raw).trim().match(/^([\d.]+)\s*\/\s*([\d.]+)\s*%?\s*$/i);
    if (!m) continue;
    const threshold = Number(m[1]);
    const percent = Number(m[2]);
    if (isFinite(threshold) && isFinite(percent)) {
      steps.push({ threshold, percent });
    }
  }
  console.log('steps', JSON.stringify(steps))
  if (steps.length === 0) return { operations: ops };

  // 6) Take the MAXIMUM suitable step by threshold
  const applicable = steps
    .filter(s => totalAmount >= s.threshold)
    .sort((a, b) => b.threshold - a.threshold)[0];
  console.log('applicable', JSON.stringify(applicable))
  if (!applicable || !(applicable.percent > 0)) {
    return { operations: ops };
  }

  // 7) Form Order discount operation (percentage on order subtotal)
  // Strategy can be kept FIRST — we have one candidate
  const displayCode = applicable.percent ? `${progressCode || triggeringCode}-${applicable.percent}` : (progressCode || triggeringCode);

  ops.push({
    orderDiscountsAdd: {
      selectionStrategy: "MAXIMUM",
      candidates: [
        {
          // Link candidate with code (looks better in admin)
          associatedDiscountCode: { code: displayCode },
          message: null,
          targets: [
            { orderSubtotal: { excludedCartLineIds: [] } }
          ],
          value: {
            percentage: { value: applicable.percent }
          },
          conditions: null
        }
      ]
    }
  });
  console.log('ops', ops)
  return { operations: ops };
}
