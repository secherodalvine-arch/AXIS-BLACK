/**
 * Plain-language categories for stock items and money records.
 *
 * `value` is what gets saved. `hint` is shown next to it in dropdowns so a
 * business owner can instantly tell which one fits their product / expense.
 */
export interface CategoryOption {
  value: string;
  hint: string;
}

export const CUSTOM_CATEGORY_VALUE = '__CUSTOM__';

// ── Stock / Inventory ─────────────────────────────────────────────────────────
export const INVENTORY_CATEGORIES: CategoryOption[] = [
  { value: 'Hair Products', hint: 'wigs, braids, extensions, shampoo, hair oil' },
  { value: 'Skin & Beauty', hint: 'lotion, soap, face cream, makeup, perfume' },
  { value: 'Food & Drinks', hint: 'groceries, snacks, juice, water, cooking items' },
  { value: 'Clothes & Shoes', hint: 'dresses, shirts, shoes, bags, accessories' },
  { value: 'Phones & Electronics', hint: 'phones, chargers, TVs, speakers, computers' },
  { value: 'Home & Kitchen', hint: 'utensils, furniture, cleaning items, bedding' },
  { value: 'Health & Medicine', hint: 'drugs, supplements, first-aid, medical supplies' },
  { value: 'Building & Tools', hint: 'cement, paint, nails, pipes, hand tools' },
  { value: 'Stationery & Office', hint: 'books, pens, paper, printers, office items' },
  { value: 'Materials I Use To Make Things', hint: 'cloth, wood, ingredients, raw materials' },
  { value: 'Packaging', hint: 'boxes, bags, bottles, labels, wrapping' },
  { value: 'Other Items', hint: 'anything that does not fit above' }
];

// ── Money In (sales / income) ─────────────────────────────────────────────────
export const LEDGER_MONEY_IN_CATEGORIES: CategoryOption[] = [
  { value: 'Product Sales', hint: 'money from selling items to customers' },
  { value: 'Service Income', hint: 'money from work you did, e.g. salon, repairs, delivery' },
  { value: 'Customer Payment (Debt Paid)', hint: 'a customer paying what they owed you' },
  { value: 'Loan or Capital Received', hint: 'money borrowed or put into the business' },
  { value: 'Other Income', hint: 'any other money coming in' }
];

// ── Money Out (expenses) ──────────────────────────────────────────────────────
export const LEDGER_MONEY_OUT_CATEGORIES: CategoryOption[] = [
  { value: 'Buying Stock', hint: 'buying items you will resell' },
  { value: 'Rent', hint: 'shop, salon or office rent' },
  { value: 'Salaries & Wages', hint: 'paying workers or casual labour' },
  { value: 'Electricity, Water & Internet', hint: 'power tokens, water bill, WiFi, airtime' },
  { value: 'Transport & Delivery', hint: 'fuel, fare, boda, courier, delivery costs' },
  { value: 'Advertising & Promotion', hint: 'posters, social media ads, promotions' },
  { value: 'Repairs & Equipment', hint: 'fixing or buying machines, tools, furniture' },
  { value: 'Software & Subscriptions', hint: 'apps, online tools, monthly subscriptions' },
  { value: 'Taxes, Licences & Fees', hint: 'permits, county fees, KRA, bank charges' },
  { value: 'Loan Repayment', hint: 'paying back money you borrowed' },
  { value: 'Owner Withdrawal', hint: 'money you took out for personal use' },
  { value: 'Other Expenses', hint: 'any other money going out' }
];

export const DEFAULT_INVENTORY_CATEGORY = INVENTORY_CATEGORIES[0].value;
export const DEFAULT_LEDGER_EXPENSE_CATEGORY = 'Other Expenses';
export const DEFAULT_LEDGER_INCOME_CATEGORY = 'Product Sales';

export const getLedgerCategories = (type?: string): CategoryOption[] =>
  type === 'Revenue' ? LEDGER_MONEY_IN_CATEGORIES : LEDGER_MONEY_OUT_CATEGORIES;

export const getDefaultLedgerCategory = (type?: string): string =>
  type === 'Revenue' ? DEFAULT_LEDGER_INCOME_CATEGORY : DEFAULT_LEDGER_EXPENSE_CATEGORY;

export const ALL_LEDGER_CATEGORIES: CategoryOption[] = [
  ...LEDGER_MONEY_IN_CATEGORIES,
  ...LEDGER_MONEY_OUT_CATEGORIES
];

/** "Hair Products — wigs, braids…" text used inside <option> elements. */
export const categoryOptionLabel = (c: CategoryOption): string => `${c.value} — ${c.hint}`;

export const isPresetCategory = (value: string, list: CategoryOption[]): boolean =>
  list.some(c => c.value === value);
