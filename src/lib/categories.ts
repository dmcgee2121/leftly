import {
  DEFAULT_CATEGORIES,
  type Bill,
  type BudgetCategory,
  type CategoryTargets,
  type Expense,
  type LeftlyPreferences,
  type PayPeriodSnapshot,
  type RecurringItemTemplate,
} from '../types/budget'

export const MAX_CATEGORY_NAME_LENGTH = 40
export const FALLBACK_CATEGORY: BudgetCategory = 'Other / Misc'

const BUILT_IN_CATEGORY_BY_KEY = new Map(
  DEFAULT_CATEGORIES.map((category) => [category.trim().toLocaleLowerCase(), category] as const),
)

type CategoryReplaceCollections = {
  bills: Bill[]
  expenses: Expense[]
  recurringTemplates: RecurringItemTemplate[]
  payPeriodHistory: PayPeriodSnapshot[]
  categoryTargets: CategoryTargets
  preferences: LeftlyPreferences
  categoryOrder: BudgetCategory[]
  customCategories: BudgetCategory[]
  setupDraft: unknown | null
}

export type CategoryReferenceCounts = {
  activeBills: number
  activeExpenses: number
  recurringTemplates: number
  preferences: number
  setupDraft: number
  historyBills: number
  historyExpenses: number
  activeTargets: number
  historyTargetSnapshots: number
}

export type ReplaceCategoryResult = CategoryReplaceCollections & {
  counts: CategoryReferenceCounts
}

export function normalizeCategoryName(value: unknown): BudgetCategory | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  return canonicalizeBuiltInCategoryName(trimmed) ?? trimmed
}

export function normalizeCategoryNameForComparison(value: string) {
  return value.trim().toLocaleLowerCase()
}

export function isBuiltInCategory(category: string): category is (typeof DEFAULT_CATEGORIES)[number] {
  return canonicalizeBuiltInCategoryName(category) !== null
}

export function getAllCategories(customCategories: BudgetCategory[]) {
  return [...DEFAULT_CATEGORIES, ...customCategories]
}

export function sanitizeCustomCategoryName(value: string) {
  return value.trim()
}

export function canonicalizeBuiltInCategoryName(value: unknown): (typeof DEFAULT_CATEGORIES)[number] | null {
  if (typeof value !== 'string') {
    return null
  }

  return BUILT_IN_CATEGORY_BY_KEY.get(value.trim().toLocaleLowerCase()) ?? null
}

export function validateCategoryName(params: {
  value: string
  existingCategories: string[]
  excludeName?: string
}): { ok: true; value: BudgetCategory } | { ok: false; error: string } {
  const nextName = sanitizeCustomCategoryName(params.value)
  if (!nextName) {
    return { ok: false, error: 'Category name cannot be blank.' }
  }

  if (nextName.length > MAX_CATEGORY_NAME_LENGTH) {
    return { ok: false, error: `Category names must be ${MAX_CATEGORY_NAME_LENGTH} characters or less.` }
  }

  const nextKey = normalizeCategoryNameForComparison(nextName)
  const excludeKey = params.excludeName ? normalizeCategoryNameForComparison(params.excludeName) : null
  const duplicate = params.existingCategories.some((category) => {
    const categoryKey = normalizeCategoryNameForComparison(category)
    return categoryKey === nextKey && categoryKey !== excludeKey
  })

  if (duplicate) {
    return { ok: false, error: 'That category name already exists.' }
  }

  return { ok: true, value: nextName }
}

export function deriveCustomCategories(params: {
  explicitCustomCategories?: unknown
  bills?: Bill[]
  expenses?: Expense[]
  recurringTemplates?: RecurringItemTemplate[]
  payPeriodHistory?: PayPeriodSnapshot[]
  categoryTargets?: CategoryTargets
  preferences?: LeftlyPreferences | null
  setupDraft?: unknown | null
}) {
  const customCategories = new Map<string, BudgetCategory>()

  const addCategory = (value: unknown) => {
    const category = normalizeCategoryName(value)
    if (!category || isBuiltInCategory(category)) {
      return
    }

    customCategories.set(normalizeCategoryNameForComparison(category), category)
  }

  if (Array.isArray(params.explicitCustomCategories)) {
    for (const category of params.explicitCustomCategories) {
      addCategory(category)
    }
  }

  params.bills?.forEach((bill) => addCategory(bill.category))
  params.expenses?.forEach((expense) => addCategory(expense.category))
  params.recurringTemplates?.forEach((template) => addCategory(template.category))
  Object.keys(params.categoryTargets ?? {}).forEach((category) => addCategory(category))
  params.payPeriodHistory?.forEach((snapshot) => {
    snapshot.bills.forEach((bill) => addCategory(bill.category))
    snapshot.expenses.forEach((expense) => addCategory(expense.category))
    getCategoryTargetKeys(snapshot.categoryTargets).forEach((category) => addCategory(category))
  })
  addCategory(params.preferences?.defaultCategory)

  const recurringItems = getSetupDraftRecurringItems(params.setupDraft)
  recurringItems.forEach((item) => addCategory(item.category))

  return [...customCategories.values()].sort((left, right) => left.localeCompare(right))
}

export function reconcileCategoryOrder(order: unknown, customCategories: BudgetCategory[]) {
  const combined = getAllCategories(customCategories)
  const seen = new Set<string>()
  const normalized: BudgetCategory[] = []

  if (Array.isArray(order)) {
    for (const value of order) {
      const category = normalizeCategoryName(value)
      if (!category) {
        continue
      }

      const key = normalizeCategoryNameForComparison(category)
      if (seen.has(key) || !combined.includes(category)) {
        continue
      }

      seen.add(key)
      normalized.push(category)
    }
  }

  for (const category of combined) {
    const key = normalizeCategoryNameForComparison(category)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    normalized.push(category)
  }

  return normalized
}

export function replaceCategoryAcrossData(
  collections: CategoryReplaceCollections,
  fromCategory: BudgetCategory,
  toCategory: BudgetCategory,
): ReplaceCategoryResult {
  const counts: CategoryReferenceCounts = {
    activeBills: 0,
    activeExpenses: 0,
    recurringTemplates: 0,
    preferences: 0,
    setupDraft: 0,
    historyBills: 0,
    historyExpenses: 0,
    activeTargets: 0,
    historyTargetSnapshots: 0,
  }

  const bills = collections.bills.map((bill) => {
    if (bill.category !== fromCategory) {
      return bill
    }

    counts.activeBills += 1
    return { ...bill, category: toCategory }
  })

  const expenses = collections.expenses.map((expense) => {
    if (expense.category !== fromCategory) {
      return expense
    }

    counts.activeExpenses += 1
    return { ...expense, category: toCategory }
  })

  const recurringTemplates = collections.recurringTemplates.map((template) => {
    if (template.category !== fromCategory) {
      return template
    }

    counts.recurringTemplates += 1
    return { ...template, category: toCategory }
  })

  const payPeriodHistory = collections.payPeriodHistory.map((snapshot) => ({
    ...snapshot,
    bills: snapshot.bills.map((bill) => {
      if (bill.category !== fromCategory) {
        return bill
      }

      counts.historyBills += 1
      return { ...bill, category: toCategory }
    }),
    expenses: snapshot.expenses.map((expense) => {
      if (expense.category !== fromCategory) {
        return expense
      }

      counts.historyExpenses += 1
      return { ...expense, category: toCategory }
    }),
  }))

  const preferences =
    collections.preferences.defaultCategory === fromCategory
      ? { ...collections.preferences, defaultCategory: toCategory }
      : collections.preferences
  if (preferences !== collections.preferences) {
    counts.preferences = 1
  }

  const categoryOrder = collections.categoryOrder.map((category) => (category === fromCategory ? toCategory : category))
  const customCategories = collections.customCategories.map((category) => (category === fromCategory ? toCategory : category))
  const setupDraftResult = replaceCategoryInSetupDraft(collections.setupDraft, fromCategory, toCategory)
  counts.setupDraft = setupDraftResult.replacements

  return {
    bills,
    expenses,
    recurringTemplates,
    payPeriodHistory,
    categoryTargets: collections.categoryTargets,
    preferences,
    categoryOrder,
    customCategories,
    setupDraft: setupDraftResult.value,
    counts,
  }
}

export function renameCategoryTargetKey(
  targets: CategoryTargets,
  fromCategory: BudgetCategory,
  toCategory: BudgetCategory,
): CategoryTargets {
  if (fromCategory === toCategory || targets[fromCategory] === undefined) {
    return targets
  }

  const nextTargets = { ...targets }
  nextTargets[toCategory] = nextTargets[fromCategory]
  delete nextTargets[fromCategory]
  return nextTargets
}

export function removeCategoryTargetKey(targets: CategoryTargets, category: BudgetCategory): CategoryTargets {
  if (targets[category] === undefined) {
    return targets
  }

  const nextTargets = { ...targets }
  delete nextTargets[category]
  return nextTargets
}

export function updateTargetKeysAcrossHistorySnapshots(
  history: PayPeriodSnapshot[],
  fromCategory: BudgetCategory,
  toCategory: BudgetCategory,
): PayPeriodSnapshot[] {
  return history.map((snapshot) => {
    const nextCategoryTargets = renameCategoryTargetKey(snapshot.categoryTargets, fromCategory, toCategory)
    return nextCategoryTargets === snapshot.categoryTargets
      ? snapshot
      : { ...snapshot, categoryTargets: nextCategoryTargets }
  })
}

export function removeTargetKeyAcrossHistorySnapshots(history: PayPeriodSnapshot[], category: BudgetCategory): PayPeriodSnapshot[] {
  return history.map((snapshot) => {
    const nextCategoryTargets = removeCategoryTargetKey(snapshot.categoryTargets, category)
    return nextCategoryTargets === snapshot.categoryTargets
      ? snapshot
      : { ...snapshot, categoryTargets: nextCategoryTargets }
  })
}

export function countCategoryTargetReferences(
  categoryTargets: CategoryTargets,
  payPeriodHistory: PayPeriodSnapshot[],
  category: BudgetCategory,
) {
  return {
    activeTargets: categoryTargets[category] === undefined ? 0 : 1,
    historyTargetSnapshots: payPeriodHistory.reduce(
      (count, snapshot) => count + (snapshot.categoryTargets[category] === undefined ? 0 : 1),
      0,
    ),
  }
}

export function removeCategoryFromCustomList(customCategories: BudgetCategory[], categoryToRemove: BudgetCategory) {
  return customCategories.filter((category) => category !== categoryToRemove)
}

export function getCategoryReferenceCounts(
  collections: Omit<CategoryReplaceCollections, 'categoryOrder' | 'customCategories'>,
  category: BudgetCategory,
) {
  const counts = replaceCategoryAcrossData(
    {
      ...collections,
      categoryOrder: [],
      customCategories: [],
    },
    category,
    category,
  ).counts

  return {
    ...counts,
    ...countCategoryTargetReferences(collections.categoryTargets, collections.payPeriodHistory, category),
  }
}

function getSetupDraftRecurringItems(value: unknown | null) {
  const draft = value as { recurringItems?: Array<{ category?: unknown }> } | null
  return Array.isArray(draft?.recurringItems) ? draft.recurringItems : []
}

function getCategoryTargetKeys(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  return Object.keys(value)
}

function replaceCategoryInSetupDraft(value: unknown | null, fromCategory: BudgetCategory, toCategory: BudgetCategory) {
  const draft = value as { recurringItems?: Array<Record<string, unknown>> } | null
  if (!draft || !Array.isArray(draft.recurringItems)) {
    return { value, replacements: 0 }
  }

  let replacements = 0
  const recurringItems = draft.recurringItems.map((item) => {
    if (item.category !== fromCategory) {
      return item
    }

    replacements += 1
    return { ...item, category: toCategory }
  })

  return {
    value: replacements > 0 ? { ...draft, recurringItems } : value,
    replacements,
  }
}
