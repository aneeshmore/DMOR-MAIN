# Functional Requirement Specification — Recent Enhancements

**System:** DMOR Paints ERP (Morex Technologies Order Management System)
**Document type:** Delta FRS — recently implemented changes only
**Status:** Implemented, pending business verification

---

## About This Document

This specification documents **only the recent changes** made to the system. It does
not describe the modules from the beginning.

The existing behaviour of every module is treated as the **agreed baseline**. Anything
not described here is unchanged and must continue to behave exactly as it does today.

Each change is stated as a delta: what changed, why it was needed, how the business
flow now works, and what must be verified. This document describes **what** the system
must do, not how it is built.

**Change index**

| Ref    | Area                       | Nature of change                                                              |
| ------ | -------------------------- | ----------------------------------------------------------------------------- |
| FRS-01 | Purchase Order             | New capability — purchase Finished Goods, Raw Material and Packaging Material |
| FRS-02 | Inward from Purchase Order | New capability — receive Finished Goods into stock                            |
| FRS-03 | Purchase Order             | Defect correction — form no longer loses entered data                         |
| FRS-04 | Current Stock Report       | Refinement — filter and column presentation                                   |
| FRS-05 | Production Batch Reports   | Refinement — dates, percentage, and packaging balance                         |
| FRS-06 | CRM                        | Refinement — naming and navigation                                            |

---

# FRS-01 — Multi-Category Purchase Ordering

## 1. What Changed

A Purchase Order could previously be raised only against materials drawn from a single
combined material list. It was not possible to raise a Purchase Order for Finished
Goods, and Raw Material and Packaging Material could not be browsed separately.

A Purchase Order can now include **Finished Goods, Raw Material and Packaging Material**,
and the buyer can browse each category independently while building the order.

## 2. Why the Change Was Required

The business buys finished paint products from external suppliers, not only raw and
packaging inputs. There was no way to record those purchases, so they sat outside the
purchasing process entirely — with no order record, no vendor trail, and no route into
goods receipt.

Buyers also reported difficulty locating the right item when raw and packaging materials
were presented together in one long list.

## 3. New Business Flow

1. The buyer opens Create Purchase Order and selects the vendor and order details as before.
2. Above the item lines, the buyer chooses which product category to browse: **FG, RM or PM**.
3. The item picker lists only products of the selected category.
4. The buyer adds an item. Its unit of measure, tax rate, tax classification code and
   indicative rate are filled in automatically from that product's own master record.
5. The buyer may switch category at any time and continue adding lines.
6. A single Purchase Order may contain any combination of the three categories.
7. The order is submitted, approved, printed and tracked exactly as before.

## 4. User Interaction Flow

- The category selector sits directly above the item lines, because that is the only
  thing it governs.
- Selecting a category **filters the product list only**. It is not a mode, and it does
  not classify the order.
- Switching category **never** clears, alters or removes lines already entered.
- A line already added remains fully visible and readable while a different category is
  being browsed.
- Categories are presented in the order **FG, RM, PM**, with FG selected on opening.

## 5. Expected System Behaviour

- Only products of the chosen category appear in the picker. No cross-category leakage.
- Finished Goods are offered from the **Product Variants & SKU's** catalogue — the
  specific sellable variant, not the generic product family.
- Raw Material and Packaging Material are offered from the **Paint Product Catalogue**,
  exactly as before.
- Unit, tax rate and tax classification code populate automatically on selection. Where a
  variant does not carry its own value, the value is taken from the product family it
  belongs to.
- The indicative rate is pre-filled for Finished Goods lines and remains fully editable.
- Order totals, taxes and amounts are calculated exactly as they are today.

## 6. Validation Rules

| Scenario                                        | Expected outcome                                         |
| ----------------------------------------------- | -------------------------------------------------------- |
| Order contains items from one category          | Accepted                                                 |
| Order contains a mix of FG, RM and PM lines     | Accepted                                                 |
| A product's tax rate is recorded as zero        | Zero is honoured as a real value, not treated as missing |
| A variant has no tax rate of its own            | The product family's tax rate is used                    |
| Neither variant nor family holds a tax rate     | Field is shown as blank; the order may still proceed     |
| Rate is not held on the master                  | Field is left for the buyer to enter                     |
| Buyer overwrites an auto-filled value           | The buyer's entry is always kept                         |
| Category is switched with lines already entered | Lines are preserved without prompting                    |

## 7. Impact on Related Modules

- **Goods receipt** — Finished Goods orders become receivable (see FRS-02).
- **Purchase Order history and printing** — orders appear and print as they do today,
  with no new order types or numbering.
- **Vendor records** — unaffected.
- No report gains or loses a column as a result of this change.

## 8. Integration With the Existing Workflow

This extends the existing purchasing workflow. Order numbering, approval, status
progression, printing and history are untouched. The category selector adds a way to
_find_ products; everything downstream of selection is the established process.

## 9. Expected Results

A buyer can raise one Purchase Order covering finished goods, raw materials and
packaging together, with commercial details filled in from the masters, and process it
through the normal purchasing lifecycle.

## 10. Backward Compatibility

Existing Purchase Orders open, edit, print and report exactly as before. Raw Material
and Packaging Material purchasing is functionally unchanged. Nothing about the order
record itself changed, so no historic order is affected.

---

# FRS-02 — Finished Goods Inward and Inventory Integration

## 1. What Changed

Goods receipt against a Purchase Order supported Raw Material and Packaging Material.
Finished Goods lines could not be received into stock.

Finished Goods received against a Purchase Order now update stock and flow into the
inventory and reporting chain on the same basis as Raw Material and Packaging Material.

## 2. Why the Change Was Required

FRS-01 makes it possible to order Finished Goods. Without a matching receipt path,
those orders could not be completed and purchased stock would never reach inventory.

Critically, Finished Goods stock is held **against the specific saleable variant**, not
against the product family. A receipt that identifies only the family cannot increase
stock, because the system cannot tell which variant was received. Left unaddressed,
a receipt would appear to succeed while stock never moved — the most damaging possible
outcome, because it is silent.

## 3. New Business Flow

1. The storekeeper selects the Purchase Order being received.
2. Each ordered line is matched to the product it represents.
3. Finished Goods lines are matched to a **specific variant** in Product Variants & SKU's.
4. The storekeeper enters received quantities and confirms.
5. Stock for each received item increases.
6. A stock movement record is created for every received line.
7. The Purchase Order status advances according to the quantities received.

## 4. User Interaction Flow

- Matching is proposed automatically from the ordered description; the storekeeper
  reviews rather than re-keys.
- Where a Finished Goods line cannot be matched to exactly one variant, the affected
  line is highlighted with a clear explanation.
- The message states plainly what is wrong and what to do: the item is not linked to a
  valid variant, and the variant must be created or corrected before receipt.

## 5. Expected System Behaviour

- Finished Goods receipts increase stock **on the received variant only**.
- Raw Material and Packaging Material receipts behave exactly as they do today.
- Every successful receipt records a stock movement, on the same basis for all categories.
- Where more than one variant could plausibly match a line, the system **never guesses**.

## 6. Validation Rules

| Scenario                                                  | Expected outcome                                  |
| --------------------------------------------------------- | ------------------------------------------------- |
| FG line matches exactly one variant                       | Receipt proceeds; stock increases on that variant |
| FG line matches the family, which has exactly one variant | Receipt proceeds against that variant             |
| FG line could match two or more variants                  | **Blocked** — ambiguous, never guessed            |
| FG line matches no variant                                | **Blocked** with a clear explanation              |
| Any line on the receipt is blocked                        | **The entire receipt is refused**                 |
| Received quantity is zero or negative                     | Rejected, as today                                |
| RM or PM line                                             | Unchanged behaviour                               |

**No partial processing.** When a receipt is refused, nothing at all is committed: no
receipt record, no stock movement, no stock change, and no change to Purchase Order
status. Inventory integrity takes precedence over completing the transaction.

## 7. Impact on Related Modules

After a successful Finished Goods receipt, the transaction must be visible in:

- **Current Stock** — increased quantity for the received variant
- **Stock movement and ledger views** — a receipt entry on the same basis as RM and PM
- **Inward history** — the receipt listed alongside all other receipts
- **Purchase Order history and status** — progressed to partially or fully received
- **Purchase reporting** — included in purchase values and volumes
- **Dashboard stock indicators** — reflecting the revised position
- **Low-stock alerts** — cleared where the receipt resolves a shortage

This is integration, not duplication: Finished Goods enter the **same** inventory and
reporting chain already used by Raw Material and Packaging Material. No parallel
reporting exists or should be created.

## 8. Integration With the Existing Workflow

The receipt process, screens and sequence are unchanged. Finished Goods lines simply
resolve to the level at which their stock is held, and are then processed identically.

## 9. Expected Results

A Finished Goods purchase can be received, stock rises against the correct variant, and
the movement appears everywhere Raw Material and Packaging Material receipts appear —
with no separate process to learn and no separate reports to consult.

## 10. Backward Compatibility

Raw Material and Packaging Material receipts are unchanged in matching, validation and
outcome. Historic receipts are unaffected. No previously accepted RM or PM receipt
becomes invalid.

## 11. Known Gap — Open for Business Decision

A line matching **no product at all** (for example free-text wording, or an item renamed
after ordering) is still accepted and posts no stock movement. This is long-standing
behaviour retained deliberately, because changing it would alter established Raw Material
and Packaging Material handling.

It remains a silent no-movement case. A decision is required on whether such lines
should also be blocked.

---

# FRS-03 — Purchase Order Data Retention (Defect Correction)

## 1. What Changed

While creating a Purchase Order, entered values could be cleared without warning shortly
after the screen opened. Buyers lost vendor, dates, dispatch details and item lines
mid-entry. This no longer occurs.

## 2. Why the Change Was Required

The screen prepared itself for a new order not only when opened, but again each time
supporting reference information finished loading in the background. Because that
information arrives a moment after the screen appears, the clean-up ran _while the buyer
was already typing_ — and cleared the form.

The behaviour was intermittent and timing-dependent, which is why it presented as random
data loss and eroded trust in the screen.

## 3. Expected System Behaviour

The form retains everything entered until the buyer explicitly:

- saves the Purchase Order successfully,
- clears the form, or
- leaves the screen.

## 4. Validation Rules

| Scenario                                                  | Expected outcome                      |
| --------------------------------------------------------- | ------------------------------------- |
| Reference information finishes loading while typing       | Entries are retained                  |
| Buyer types before the screen has fully prepared          | Entries are retained                  |
| Buyer enters a delivery address, then the default arrives | The buyer's address is kept           |
| Delivery address left untouched                           | The default address is applied        |
| Product category is switched                              | Entries are retained                  |
| Purchase Order saved successfully                         | Form clears, ready for the next order |
| Buyer leaves edit mode                                    | Form clears                           |

## 5. Expected Results

The screen behaves as expected of an enterprise ERP form: entered data persists until
the user decides otherwise.

## 6. Backward Compatibility

No change to what is saved, how orders are numbered, or how they are processed. This
corrects screen behaviour only.

---

# FRS-04 — Current Stock Report Refinements

## 1. What Changed

- The combined **All** option has been removed from the stock type filter.
- The filter presents exactly three choices, in the order **FG, RM, PM**.
- The **work-in-progress** column is hidden when viewing Packaging Material.
- The available quantity column is labelled **Available Qty**.

## 2. Why the Change Was Required

The combined view mixed categories that are counted in different units and read as a
single list, which invited misreading. Work-in-progress is not a meaningful concept for
packaging material, and the previous column label implied a weight measure that did not
apply across all categories.

## 3. Expected System Behaviour

- A category is always selected; the report opens on Finished Goods.
- Each filter returns exactly the products of that category.
- Packaging Material does not display work-in-progress; Raw Material still does.
- Quantities, valuations and every other column are unchanged.

## 4. Validation Rules

| Scenario                    | Expected outcome                           |
| --------------------------- | ------------------------------------------ |
| Report opened               | Finished Goods shown by default            |
| Packaging Material selected | Work-in-progress column absent             |
| Raw Material selected       | Work-in-progress column present, unchanged |
| Any category selected       | Values identical to those reported today   |

## 5. Impact on Related Modules

Presentation only. No stock figure, valuation or calculation changes. Any other report
or screen that quotes stock continues to quote the same numbers.

## 6. Backward Compatibility

The underlying stock position is untouched. Only the on-screen filter and column
presentation changed.

---

# FRS-05 — Production Batch Report Refinements

## 1. What Changed

- The report date now shows the **batch completion date** rather than the date the report
  was produced.
- **End Date** is shown consistently on screen, in print and in the downloaded copy.
- The ingredient percentage column is retained in the accounts view and presented on a
  single line without wrapping.
- The Packaging Materials section now shows a **Balance** column beside quantity.

## 2. Why the Change Was Required

A report for a batch completed on one date but downloaded on another displayed the
download date, making historic reports appear to be about a different day — unacceptable
for a production record. End Date was inconsistently available depending on how the
report was viewed. Column headings wrapped mid-word and read poorly on a formal document.

The Balance column answers a routine operational question — _how much of this packaging
is left_ — without leaving the report.

## 3. Expected System Behaviour

- The report date reflects when the batch was completed, wherever the report is viewed.
- End Date appears in every presentation of the report and shows the date only.
- Balance shows the same available quantity for that packaging material as the Current
  Stock Report, presented as a reference figure.
- Ingredient quantities, formulation percentages, costs and totals are unchanged.

## 4. Validation Rules

| Scenario                                | Expected outcome                        |
| --------------------------------------- | --------------------------------------- |
| Completed batch report viewed later     | Completion date shown, not today's date |
| Batch not yet completed                 | End Date shown as blank                 |
| Packaging material has a stock figure   | Balance matches Current Stock exactly   |
| Packaging material cannot be identified | Balance shown as blank, never as zero   |

## 5. Impact on Related Modules

Presentation only. No production calculation, formulation, costing or stock figure is
affected. Balance is displayed for reference and does not participate in any total.

**Note:** Balance reflects the stock position at the time the report is produced, not the
position on the batch date.

## 6. Backward Compatibility

Historic batch reports remain valid and continue to reconcile with production records.

---

# FRS-06 — CRM Naming and Navigation

## 1. What Changed

- The module previously labelled _Customer & Sales Management_ is now **CRM** throughout.
- A duplicate CRM entry has been removed from the navigation menu.
- Screens within the module were adjusted to display correctly on smaller devices.

## 2. Why the Change Was Required

Two similarly named entries appeared under Operations, and users could not tell which to
open. The longer label was inconsistent with how the team refers to the module.

## 3. Expected System Behaviour

- The module is named CRM in navigation, page titles, breadcrumbs, menus and messages.
- Exactly one CRM entry appears under Operations.
- Searching for the former name still finds the module.
- All module functionality is unchanged.

## 4. Validation Rules

| Scenario                        | Expected outcome                              |
| ------------------------------- | --------------------------------------------- |
| Operations menu opened          | One CRM entry only                            |
| Former name searched            | Module still found                            |
| Existing CRM records opened     | Unchanged in every respect                    |
| Module opened on a small screen | Content readable without horizontal scrolling |

## 5. Backward Compatibility

Naming and presentation only. Records, permissions and workflows are unchanged. Existing
links to the module continue to work.

---

# Global Restrictions

The following must **not** change as a consequence of any item in this document:

- **Business logic** — order lifecycle, approvals, goods receipt rules, production rules
- **Existing workflows** — no established sequence of steps is reordered or replaced
- **Calculations** — order values, taxes, stock movement arithmetic, production
  formulation, costing and batch calculations
- **Existing reports** — no report loses a column, changes a figure, or is redesigned
- **Permissions** — no user gains or loses access; no permission is granted by default
- **Order numbering** — unchanged in format, sequence and allocation
- **Vendor handling** — unchanged
- **User experience elsewhere** — no screen outside the described changes is altered
- **Duplicate implementations** — no parallel purchasing, receipt, inventory or reporting
  path may be introduced

---

# Backward Compatibility Statement

1. Every existing record — Purchase Orders, receipts, stock balances, production batches,
   CRM records — continues to function without regression.
2. Users working only with Raw Material and Packaging Material experience **no change
   whatsoever**, other than the product list being presented by category.
3. No historic transaction is reinterpreted, recalculated or revalued.
4. No previously valid transaction becomes invalid.
5. Reports covering past periods return the figures they returned before.
6. The only behavioural changes users should notice are those specified in this document.

---

# Final Verification Checklist

## New functionality

- [ ] A Purchase Order can be raised for Finished Goods
- [ ] A Purchase Order can be raised for Raw Material, as before
- [ ] A Purchase Order can be raised for Packaging Material, as before
- [ ] A single Purchase Order can contain FG, RM and PM lines together
- [ ] Categories appear in the order FG, RM, PM, with FG selected on opening
- [ ] Only products of the selected category are offered
- [ ] Finished Goods are offered from Product Variants & SKU's
- [ ] Unit, tax rate, tax code and rate populate automatically
- [ ] A zero tax rate displays as zero, not blank
- [ ] Switching category preserves all entered lines

## Goods receipt and inventory

- [ ] A Finished Goods purchase can be received
- [ ] Stock increases against the correct variant
- [ ] A stock movement is recorded for every received line
- [ ] An ambiguous Finished Goods line is blocked, not guessed
- [ ] An unmatched Finished Goods line is blocked with a clear message
- [ ] A blocked receipt commits nothing at all
- [ ] Raw Material and Packaging Material receipts behave exactly as before

## Data visibility after receipt

- [ ] Current Stock reflects the new quantity
- [ ] Stock movement and ledger views show the receipt
- [ ] Inward history lists the receipt
- [ ] Purchase Order status progresses correctly
- [ ] Purchase reporting includes the transaction
- [ ] Dashboard stock indicators reflect the change
- [ ] Low-stock alerts clear where resolved

## Form behaviour

- [ ] Entered data is never lost while typing
- [ ] Changing an item does not clear other fields
- [ ] Changing dispatch details does not clear other fields
- [ ] Switching category does not clear the form
- [ ] A typed delivery address is never overwritten
- [ ] The form clears only on successful save, explicit clear, or leaving the screen

## Reports

- [ ] Stock filter offers FG, RM, PM only, in that order
- [ ] Work-in-progress is hidden for Packaging Material and retained for Raw Material
- [ ] Available quantity column is labelled Available Qty
- [ ] Batch reports show the completion date, not the download date
- [ ] End Date appears on screen, in print and in the download
- [ ] Ingredient percentage is retained in the accounts view
- [ ] Column headings fit on one line
- [ ] Packaging Balance matches Current Stock

## CRM

- [ ] The module is named CRM everywhere
- [ ] Exactly one CRM entry appears under Operations
- [ ] The former name still finds the module
- [ ] The module is usable on desktop, laptop, tablet and mobile

## No regressions

- [ ] No existing calculation produces a different result
- [ ] No existing report loses a column or changes a figure
- [ ] No user gains or loses access
- [ ] Order numbering is unchanged
- [ ] Historic records open and print as before
- [ ] No parallel purchasing, receipt or reporting path has been introduced

## Enterprise standards

- [ ] Validation messages state what is wrong and what to do
- [ ] Failed transactions commit nothing
- [ ] The interface is consistent with the rest of the application
- [ ] Terminology matches the language the business uses

---

# Open Items Requiring a Business Decision

| Ref    | Item                                                                 | Decision required                                                                     |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| FRS-02 | Receipt lines matching no product post no stock movement             | Should these be blocked, accepting that it changes long-standing RM and PM behaviour? |
| FRS-01 | Finished Goods purchasing is not yet reflected in menu access rights | Should access be granted explicitly, given permissions are otherwise unchanged?       |
| FRS-05 | Packaging Balance shows the position at report time                  | Should it instead be frozen at the batch completion date?                             |
