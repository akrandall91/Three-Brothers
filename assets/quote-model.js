(function (root) {
  'use strict';
  function positive(value) { var n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; }
  function unit(value) {
    var key = String(value || '').trim().toLowerCase();
    return ({lb:'lb',lbs:'lb',pound:'lb',pounds:'lb',cs:'case',case:'case',cases:'case',box:'box',boxes:'box',bag:'bag',bags:'bag',ea:'each',each:'each'})[key] || null;
  }
  function offer(item, config) {
    var priceUnit = unit(item.unit);
    var verified = ((config || {}).PRODUCT_OVERRIDES || {})[item.id] || {};
    // Never infer weight from qty, names or legacy packaging strings.
    var weight = positive(verified.caseWeightLb || item.case_weight_lb);
    var orderUnit = unit(verified.orderUnit || item.order_unit) || (priceUnit === 'lb' ? 'case' : priceUnit) || 'package';
    var price = positive(item.price);
    var multiplier = orderUnit === priceUnit ? 1 : (orderUnit === 'case' && priceUnit === 'lb' ? weight : null);
    return { price:price, priceUnit:priceUnit, orderUnit:orderUnit, weight:weight,
      orderPrice: price !== null && multiplier !== null ? Math.round(price * multiplier * 100) / 100 : null };
  }
  function quantity(value) { var n = Number(value); return Number.isInteger(n) && n > 0 && n <= 9999 ? n : 0; }
  function totals(items, cart, config) {
    var cents = 0, pending = 0, count = 0;
    items.forEach(function (item) { var q = quantity(cart[item.id]); if (!q) return;
      count++; var o = offer(item, config);
      if (o.orderPrice === null) pending++; else cents += Math.round(o.orderPrice * 100) * q;
    });
    return {subtotal:cents / 100, pending:pending, count:count};
  }
  function plural(unitName, n) { return unitName === 'each' ? 'each' : unitName + (n === 1 ? '' : 's'); }
  var api = {offer:offer, totals:totals, quantity:quantity, unit:unit, plural:plural};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuoteModel = api;
})(typeof window !== 'undefined' ? window : this);
