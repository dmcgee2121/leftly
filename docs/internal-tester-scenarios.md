# Leftly Internal Tester Scenarios

Use this guide to test Leftly the way a real user would, before sharing a new build more widely.

Goal:
- Catch confusing onboarding, restore, backup, and navigation flows.
- Reproduce common budgeting patterns with fake data only.
- Record findings in one place so issues are easy to compare across runs.

How to use this guide:
- Pick one persona and follow the steps in order.
- Enter the example paycheck, bills, and expenses with made-up values only.
- Note anything unclear, slow, broken, or surprising in the notes area.
- Repeat on mobile widths, desktop, and at least one fresh browser profile when possible.

## Quick Smoke-Test Checklist

- First-time landing screen.
- Start budgeting locally.
- Setup flow.
- Add recurring bill.
- Add one-time bill.
- Add manual expense.
- Quick Add.
- Bill Plan.
- Close current pay period.
- Start from history.
- JSON export/import.
- CSV export.
- Optional cloud backup upload/restore.
- Reset to empty.
- Returning local user behavior.
- Signed-out with local data behavior.
- `360px` mobile check.
- `390px` mobile check.

## Scenario 1: Weekly Hourly Worker With Variable Income

- Persona: Weekly hourly worker with changing hours each week.
- Situation: Paychecks move around, so they need a fast way to see what is safe to spend.
- Fake paycheck amount: `$742.50`
- Example bills/expenses to enter:
  - Rent: `$325.00`
  - Phone: `$58.00`
  - Gas: `$42.00`
  - Groceries: `$96.50`
  - Coffee shop expense: `$8.75`
- What the tester should try:
  - Start with the landing screen.
  - Complete setup with a weekly cadence.
  - Add the bills above and one manual expense.
  - Open Quick Add and enter another small expense.
- What should feel clear:
  - How much is left after bills and spending.
  - That Leftly works paycheck by paycheck, not as a bank-connected app.
  - Where to add repeating bills versus one-time spending.
- What might be confusing:
  - Whether variable income should be entered as a new paycheck or edited in the current period.
  - The difference between Bill Plan items and one-time bills.
- Expected result:
  - The weekly setup completes.
  - The current pay period shows a useful leftover amount.
  - Quick Add is easy to reach from the current period.
- Notes:
  - Findings:
  - Follow-up:

## Scenario 2: Biweekly Salary Worker With Predictable Bills

- Persona: Biweekly salary worker with stable pay and routine bills.
- Situation: The budget repeats predictably and the user wants consistency.
- Fake paycheck amount: `$2,480.00`
- Example bills/expenses to enter:
  - Mortgage or rent: `$1,150.00`
  - Internet: `$72.00`
  - Electric: `$88.00`
  - Streaming service: `$19.99`
  - Lunch expense: `$16.40`
- What the tester should try:
  - Use the landing screen and choose local budgeting.
  - Set a biweekly pay period.
  - Add recurring bills that should show up every period.
  - Use Bill Plan to preview what gets carried forward.
- What should feel clear:
  - That recurring bills can be prepared once and reused.
  - That the user can stay local without signing in.
  - That current period totals and categories are understandable.
- What might be confusing:
  - Whether a recurring bill should be entered as a Bill Plan item or as a one-time bill.
  - The meaning of any rollover or unpaid carryover language.
- Expected result:
  - The pay period opens with the expected recurring items.
  - The user can review and apply Bill Plan items without needing cloud features.
- Notes:
  - Findings:
  - Follow-up:

## Scenario 3: Rent Due Right After Payday

- Persona: User whose rent is due immediately after getting paid.
- Situation: Timing matters more than category totals.
- Fake paycheck amount: `$1,320.00`
- Example bills/expenses to enter:
  - Rent due the next day: `$950.00`
  - Transit pass: `$45.00`
  - Phone bill: `$62.00`
  - Fast food expense: `$13.25`
- What the tester should try:
  - Enter a pay period that starts right before rent is due.
  - Add rent as a bill with the correct due date.
  - Check whether the app makes the timing relationship obvious.
- What should feel clear:
  - Which bill is urgent.
  - What happens if spending is entered before rent is paid.
  - Whether the app makes the remaining amount easy to understand.
- What might be confusing:
  - If due dates are not visually obvious enough.
  - If the user cannot quickly tell what to pay first.
- Expected result:
  - Rent is clearly visible as an early due item.
  - The user can see the impact on leftover money right away.
- Notes:
  - Findings:
  - Follow-up:

## Scenario 4: Small Paycheck, Many Bills

- Persona: User with a small paycheck and too many obligations.
- Situation: The budget is tight and the user needs to avoid surprise spending.
- Fake paycheck amount: `$615.00`
- Example bills/expenses to enter:
  - Rent share: `$300.00`
  - Water: `$28.00`
  - Electric: `$54.00`
  - Phone: `$51.00`
  - School fee: `$40.00`
  - Bus fare: `$22.00`
  - Emergency expense: `$35.00`
- What the tester should try:
  - Enter all bills and one manual expense.
  - Check whether the app still feels readable when money is tight.
  - Use the History and Overview areas to see if the remaining balance is easy to track.
- What should feel clear:
  - The user should immediately understand the budget is constrained.
  - Important actions should remain usable even when numbers are stressful.
- What might be confusing:
  - If too much text makes the screen feel crowded.
  - If the user cannot easily tell what is most important.
- Expected result:
  - The app stays readable.
  - The user can still enter data and see what is left.
- Notes:
  - Findings:
  - Follow-up:

## Scenario 5: Wants Demo Data First

- Persona: User who wants to explore before entering real data.
- Situation: The user is curious and wants a sample budget before committing.
- Fake paycheck amount: `$1,875.00`
- Example bills/expenses to enter:
  - Demo rent: `$760.00`
  - Demo subscription: `$14.99`
  - Demo groceries: `$132.45`
  - Demo ride share: `$24.00`
- What the tester should try:
  - Open the first-time landing screen.
  - Decide whether the app makes sample data clearly separate from real data.
  - Check whether any demo/sample path is easy to understand without being pushed.
- What should feel clear:
  - The app does not require a bank connection.
  - Sample data is not the same as a real budget.
  - Local data ownership remains obvious.
- What might be confusing:
  - If demo/sample wording sounds like required onboarding.
  - If it is unclear how to leave sample data and start a real budget.
- Expected result:
  - The user can understand the difference between exploring and starting a real budget.
  - No one feels forced into an account or bank setup.
- Notes:
  - Findings:
  - Follow-up:

## Scenario 6: Returning Local User Not Signed In

- Persona: Returning user who is signed out but still has data on the device.
- Situation: The user closed the browser and came back later.
- Fake paycheck amount: `$1,940.00`
- Example bills/expenses to enter:
  - Existing rent bill.
  - Existing utilities bill.
  - One recent manual expense.
- What the tester should try:
  - Reload the app in a profile that already has local data.
  - Confirm the landing screen does not appear.
  - Confirm the app goes straight into the saved budget.
- What should feel clear:
  - Being signed out does not mean being new.
  - Local data should always win over sign-in state.
- What might be confusing:
  - If sign-in and new-user state look too similar.
- Expected result:
  - The user goes directly into the app.
  - No first-time landing screen blocks access.
- Notes:
  - Findings:
  - Follow-up:

## Scenario 7: Restore From JSON Backup

- Persona: User recovering a budget from a saved JSON backup file.
- Situation: The user reset the device or switched browsers and wants their budget back.
- Fake paycheck amount: `$2,050.00`
- Example bills/expenses to enter:
  - Car payment: `$310.00`
  - Insurance: `$114.00`
  - Gas: `$48.00`
  - Pharmacy: `$27.35`
- What the tester should try:
  - Export a JSON backup from a working budget.
  - Reset or clear local data.
  - Restore the backup from the landing screen or Data screen.
- What should feel clear:
  - JSON is the restore format.
  - The restore action is easy to find.
  - The user understands that restoring replaces local data.
- What might be confusing:
  - If restore warnings are too subtle.
  - If the user cannot tell JSON backup from CSV export.
- Expected result:
  - The restored budget matches the saved snapshot.
  - The user can continue budgeting without rebuilding everything manually.
- Notes:
  - Findings:
  - Follow-up:

## Scenario 8: Optional Cloud Backup User

- Persona: User who wants optional cloud backup and restore.
- Situation: The user wants a second copy of their budget in addition to local storage.
- Fake paycheck amount: `$3,400.00`
- Example bills/expenses to enter:
  - Rent: `$1,250.00`
  - Insurance: `$168.00`
  - Internet: `$69.00`
  - Dining out: `$84.20`
- What the tester should try:
  - Confirm the cloud backup entry point is optional.
  - Sign in only if cloud backup is configured.
  - Upload a snapshot and then attempt restore.
- What should feel clear:
  - Cloud backup is not required to use the app.
  - Cloud backup is about backup and restore, not live sync.
  - Local data still exists even when cloud backup is used.
- What might be confusing:
  - If cloud wording sounds mandatory.
  - If the user cannot tell which data is local and which is cloud-backed.
- Expected result:
  - Optional sign-in works only when cloud backup is configured.
  - Upload and restore reuse the existing backup model safely.
- Notes:
  - Findings:
  - Follow-up:

## Notes Template

Use this for each test session:

- Date:
- Tester:
- Device/browser:
- Persona tested:
- Build/branch:
- What worked:
- What was confusing:
- Bugs found:
- Severity:
- Follow-up needed:
- Screenshots or links:

## Suggested Pass Order

If time is limited, test in this order:

1. First-time landing screen.
2. Returning local user behavior.
3. JSON export/import.
4. Setup flow.
5. Add recurring bill and one-time bill.
6. Quick Add and Bill Plan.
7. Close current pay period and start from history.
8. Optional cloud backup upload/restore.
9. Reset to empty.
10. `360px` and `390px` mobile checks.
