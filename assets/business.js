// Fill in confirmed business details here. Empty fields use honest call-to-confirm guidance.
window.BUSINESS_CONFIG = {
  name: 'Three Brothers Seafood',
  phone: '305-842-0535',
  email: 'gilbertolopez0535@gmail.com',
  website: 'https://www.threebrotherseafood.com/',
  locations: [
    {id:'greensboro', name:'Greensboro, NC', address:'5416 W Market St, Greensboro, NC 27409', phone:'336-617-3380'},
    {id:'roanoke', name:'Roanoke, VA', address:'5524 Williamson Rd, Unit 10, Roanoke, VA', phone:''}
  ],
  deliveryAreas: '',
  deliveryMinimum: '',
  deliveryFees: '',
  deliverySchedule: '',
  orderCutoff: '',
  pickupLocation: '',
  pickupHours: '',
  customerTypes: 'Wholesale inquiries welcome. Tell us if you are buying for a business or for home.',
  responseTime: '',
  pricesUpdated: '', // Actual price-list update date, not the visitor's current date.
  weekendNote: 'Emergency weekend deliveries available. Call to check availability.',
  PRODUCT_OVERRIDES: {
    // Add only verified values, keyed by the sheet's product ID:
    // i123: { orderUnit: 'case', caseWeightLb: 24, minQty: 2 }
    // Optional sheet columns order_unit, case_weight_lb, and min_qty are
    // also supported and editable from the admin page's Products tab —
    // prefer those for routine changes; use overrides here only for
    // verified values you want to guarantee ship with the code.
  }
};
