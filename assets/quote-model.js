(function (root) {
  'use strict';
  function positive(value) { var n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; }
  function positiveInt(value) { var n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; }
  function unit(value) {
    var key = String(value || '').trim().toLowerCase();
    return ({lb:'lb',lbs:'lb',pound:'lb',pounds:'lb',cs:'case',case:'case',cases:'case',box:'box',boxes:'box',bag:'bag',bags:'bag',ea:'each',each:'each'})[key] || null;
  }
  // mode: 'retail' or 'wholesale' (default). Only affects items priced per lb
  // that have no explicit per-item order-unit override — those items switch
  // between ordering by the lb (retail, always priced) and by the case
  // (wholesale, priced only once a verified case weight exists). An explicit
  // override (business.js PRODUCT_OVERRIDES or the order_unit sheet column)
  // always wins over the mode, since it represents a verified business rule.
  function offer(item, config, mode) {
    var priceUnit = unit(item.unit);
    var verified = ((config || {}).PRODUCT_OVERRIDES || {})[item.id] || {};
    // Never infer weight from qty, names or legacy packaging strings.
    var weight = positive(verified.caseWeightLb || item.case_weight_lb);
    var explicitUnit = unit(verified.orderUnit || item.order_unit);
    var orderUnit = explicitUnit || (priceUnit === 'lb' ? (mode === 'retail' ? 'lb' : 'case') : priceUnit) || 'package';
    var price = positive(item.price);
    var multiplier = orderUnit === priceUnit ? 1 : (orderUnit === 'case' && priceUnit === 'lb' ? weight : null);
    var minQty = positiveInt(verified.minQty != null ? verified.minQty : item.min_qty);
    return { price:price, priceUnit:priceUnit, orderUnit:orderUnit, weight:weight, minQty:minQty,
      orderPrice: price !== null && multiplier !== null ? Math.round(price * multiplier * 100) / 100 : null };
  }
  function quantity(value, min) {
    var n = Number(value);
    min = positiveInt(min) || 1;
    return Number.isInteger(n) && n >= min && n <= 9999 ? n : 0;
  }
  function totals(items, cart, config, mode) {
    var cents = 0, pending = 0, count = 0;
    items.forEach(function (item) { var o = offer(item, config, mode); var q = quantity(cart[item.id], o.minQty); if (!q) return;
      count++;
      if (o.orderPrice === null) pending++; else cents += Math.round(o.orderPrice * 100) * q;
    });
    return {subtotal:cents / 100, pending:pending, count:count};
  }
  function plural(unitName, n) { return unitName === 'each' ? 'each' : unitName + (n === 1 ? '' : 's'); }
  var api = {offer:offer, totals:totals, quantity:quantity, unit:unit, plural:plural};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuoteModel = api;
})(typeof window !== 'undefined' ? window : this);
