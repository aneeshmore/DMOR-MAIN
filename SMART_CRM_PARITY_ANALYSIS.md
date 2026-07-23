# Smart CRM — New Report Module Functional Audit

This document provides a 100% comprehensive business, workflow, UI/UX, validation, and behavior analysis of the **New Report creation workflow** within the Smart CRM (Field Intelligence Reports) module in `Basic-Dmor-Version`.

The objective is to establish an exact functional blueprint for recreating the creation flow inside `DMOR-OMS-WEB-SOFTWARE` with single-company adaptations.

---

## Part 1: Form Structure, Layout, & Dynamic Behaviors

### 1. FORM STRUCTURE & LAYOUT

The New Report form uses a dynamic, multi-layered layout structured to progressively gather field intelligence while maintaining user focus. On desktop, the screen is split into a **two-column layout**:

- **Main Left Column (Flexible width)**: Stacks form sections vertically in a card-based pattern.
- **Sticky Right Sidebar (360px fixed width)**: Holds the Order Status select widget and the AI Suggestion Panel (used for historical lookup during new entries).

#### 1.1 Section Ordering

The form sections are arranged as follows:

1. **Previous Visits collapsible history panel** (Top of form, appears once a customer is chosen)
2. **Customer Details Section** (Layer 1 — Core demographic & account identification)
3. **Media Capture Section** (Photo capture & document uploads)
4. **Visit Details Section** (Layer 1 — Timing, category, and GPS coordinates)
5. **Category-Specific Dynamic Section** (Layer 2 — Changes based on selected Visit Category)
6. **Sales & Commercial Section** (Repeatable product requirement cards)
7. **Competitor Analysis Section** (Repeatable competitor profiles)
8. **Discussion Summary Section** (Narrative meeting details & risks)
9. **Order & Business Possibility Section** (Conversion probability & volumes)
10. **Immediate Action Items & Followups Section** (Repeatable action checklists)
11. **Executive Ratings & Management Intelligence** (Layer 3 — Slider scores & executive advice)

---

### 2. THE THREE-LAYER DESIGN SYSTEM

To ensure field officers can complete the report quickly without being overwhelmed by fields, the module groups fields into **Layers**:

```
┌────────────────────────────────────────────────────────┐
│  Layer 1: Core Visit & Customer Identity (Mandatory)   │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Layer 2: Dynamic Category Specific (Conditional)      │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Layer 3: Ratings, Commercials & Followups (Advanced)  │
└────────────────────────────────────────────────────────┘
```

- **Layer 1 — Required Core**: Visit date, timing, purpose, GPS coordinates, company/customer name. Drafts require ONLY Layer 1 to be saved.
- **Layer 2 — Smart Forms**: Category-specific questionnaires. Only appears when a _Visit Category_ (e.g., Dealer Visit, Site Visit, Complaint Visit) is selected.
- **Layer 3 — Management Intel**: Advanced commercial details, competitor brands, and slider-based executive scores (confidence, reliability, potential). Required for full report submission.

---

### 3. COMPREHENSIVE FIELD MATRIX & CONSTRAINTS

The following matrix documents every field in the New Report flow:

#### 3.1 Layer 1: Visit & Customer Identity

| Section      | Field Label          | Database Column                 | Component Type            | Required (Submit) | Required (Draft) | Data Constraints / Defaults               | Dependent Behavior                                                             |
| ------------ | -------------------- | ------------------------------- | ------------------------- | :---------------: | :--------------: | ----------------------------------------- | ------------------------------------------------------------------------------ |
| **Customer** | Customer Name        | `customer_name`                 | AutoComplete              |        ✅         |        ✅        | Free text or select from Customer Master. | Typing/selecting triggers `getCompanyIntelligence`. Summary statistics appear. |
| **Customer** | Customer Type        | `customer_type_id`              | Select                    |        ❌         |        ❌        | Prepopulated from CustomerType master     | None                                                                           |
| **Customer** | Assigned Salesperson | `salesperson_id`                | Select                    |        ❌         |        ❌        | Prepopulated from Employee master         | Restricted to current user if not admin.                                       |
| **Customer** | Area                 | `dynamic_fields.Area`           | Input                     |        ❌         |        ❌        | String, max 255 chars                     | None                                                                           |
| **Customer** | Opening Balance      | `dynamic_fields.OpeningBalance` | InputNumber               |        ❌         |        ❌        | Positive decimals only                    | None                                                                           |
| **Customer** | Contact Person       | `contact_person`                | Input                     |        ❌         |        ❌        | String, max 255 chars                     | None                                                                           |
| **Customer** | Designation          | `designation`                   | Select                    |        ❌         |        ❌        | 19 static paint-industry options          | None                                                                           |
| **Customer** | Contact Role         | `contact_role`                  | Select                    |        ❌         |        ❌        | Predefined roles (e.g. Influencer)        | None                                                                           |
| **Customer** | Mobile               | `mobile`                        | Input + Country Code      |        ❌         |        ❌        | Numeric strings                           | None                                                                           |
| **Customer** | WhatsApp             | `whatsapp`                      | Input                     |        ❌         |        ❌        | Numeric strings                           | None                                                                           |
| **Customer** | Email                | `email`                         | Input                     |        ❌         |        ❌        | Email validation format                   | None                                                                           |
| **Customer** | GST Number           | `gst_number`                    | Input                     |        ❌         |        ❌        | Capital alphanumeric, max 50              | None                                                                           |
| **Customer** | Address              | `address`                       | Textarea                  |        ❌         |        ❌        | Text                                      | None                                                                           |
| **Customer** | Pincode              | `pin_code`                      | Input                     |        ❌         |        ❌        | 6-digit numeric                           | Trigger-calls PIN API to fill City/State.                                      |
| **Customer** | City                 | `city`                          | Input                     |        ❌         |        ❌        | String                                    | Auto-filled by Pincode API lookup                                              |
| **Customer** | State                | `state`                         | Input                     |        ❌         |        ❌        | String                                    | Auto-filled by Pincode API lookup                                              |
| **Customer** | Business Category    | `business_category`             | Select                    |        ❌         |        ❌        | Predefined (Contractor, Dealer, etc.)     | None                                                                           |
| **Visit**    | Visit Date           | `visit_date`                    | DatePicker                |        ✅         |        ✅        | Defaults to current date.                 | None                                                                           |
| **Visit**    | Time In              | `time_in`                       | TimePicker                |        ❌         |        ✅        | 12-hour format (h:mm A)                   | Updates duration.                                                              |
| **Visit**    | Time Out             | `time_out`                      | TimePicker                |        ✅         |        ✅        | 12-hour format. Must be > Time In.        | Updates duration. Triggers validator check.                                    |
| **Visit**    | Visit Duration       | `visit_duration_minutes`        | Input                     |        ❌         |        ❌        | Read-only. Auto-calculated.               | Difference between Time In and Time Out.                                       |
| **Visit**    | Latitude             | `gps_latitude`                  | Input                     |        ✅         |        ✅        | Decimals. GPS fetch button.               | Fetched from browser API.                                                      |
| **Visit**    | Longitude            | `gps_longitude`                 | Input                     |        ✅         |        ✅        | Decimals.                                 | Fetched from browser API.                                                      |
| **Visit**    | Visit Purpose        | `visit_purpose`                 | Multi-select              |        ✅         |        ✅        | Aligned to 12 static purposes.            | None                                                                           |
| **Visit**    | Visit Category       | `visit_category`                | Select (with color icons) |        ✅         |        ✅        | 10 static categories.                     | Controls Layer 2 smart form layout.                                            |

#### 3.2 Layer 2: Smart Form Fields (Conditional on Category)

| Category Selected          | Field Label                 | Database Column                           | Component Type  | Required (Submit) | Required (Draft) | Constraint / Details               |
| -------------------------- | --------------------------- | ----------------------------------------- | --------------- | :---------------: | :--------------: | ---------------------------------- |
| **Dealer Visit**           | Stock Level                 | `dynamic_fields.stockLevel`               | Select          |        ❌         |        ❌        | Low, Medium, High                  |
|                            | Competitor Display Present? | `dynamic_fields.competitorDisplayPresent` | Select (Yes/No) |        ❌         |        ❌        | Boolean                            |
|                            | Scheme Discussion Status    | `dynamic_fields.schemeDiscussionStatus`   | Input           |        ❌         |        ❌        | String                             |
|                            | Order Requirement           | `dynamic_fields.orderRequirement`         | Input           |        ❌         |        ❌        | String                             |
| **Site Visit**             | Project Scale (Sq.Ft.)      | `dynamic_fields.projectScale`             | InputNumber     |        ❌         |        ❌        | Positive numbers                   |
|                            | Estimated Area (Sq.Ft.)     | `dynamic_fields.estimatedArea`            | InputNumber     |        ❌         |        ❌        | Positive numbers                   |
|                            | Painting Start Date (Est.)  | `dynamic_fields.paintingStartDate`        | DatePicker      |        ❌         |        ❌        | Future dates                       |
|                            | Specification Available?    | `dynamic_fields.specAvailable`            | Checkbox        |        ❌         |        ❌        | Boolean                            |
|                            | Trial Required?             | `dynamic_fields.trialRequired`            | Checkbox        |        ❌         |        ❌        | Boolean                            |
| **Painter Visit**          | Monthly Usage (Litres)      | `dynamic_fields.monthlyUsage`             | InputNumber     |        ❌         |        ❌        | Positive numbers                   |
|                            | Sample Given?               | `dynamic_fields.sampleGiven`              | Checkbox        |        ❌         |        ❌        | Boolean                            |
|                            | Training Needed?            | `dynamic_fields.trainingNeeded`           | Checkbox        |        ❌         |        ❌        | Boolean                            |
| **Industrial / Architect** | Presentation Given?         | `dynamic_fields.presentationGiven`        | Checkbox        |        ❌         |        ❌        | Boolean                            |
|                            | Sample Required?            | `dynamic_fields.sampleRequired`           | Checkbox        |        ❌         |        ❌        | Boolean                            |
| **Technical Visit**        | Site Conditions             | `dynamic_fields.siteConditions`           | Textarea        |        ❌         |        ❌        | Text                               |
| **Shade Approval**         | Customer Approved?          | `dynamic_fields.shadeApproved`            | Checkbox        |        ❌         |        ❌        | Boolean                            |
|                            | Written Approval Obtained?  | `dynamic_fields.writtenApproval`          | Checkbox        |        ❌         |        ❌        | Boolean                            |
| **Complaint Visit**        | Complaint Type              | `dynamic_fields.complaintType`            | Select          |        ✅         |        ❌        | 15 categories (Product, App, etc.) |
|                            | Product Involved            | `dynamic_fields.complaintProduct`         | Input           |        ✅         |        ❌        | String                             |
|                            | Batch Number                | `dynamic_fields.batchNumber`              | Input           |        ❌         |        ❌        | Alphanumeric                       |
|                            | Invoice / Challan Number    | `dynamic_fields.invoiceNumber`            | Input           |        ❌         |        ❌        | Alphanumeric                       |
|                            | Resolution Status           | `dynamic_fields.resolutionStatus`         | Select          |        ✅         |        ❌        | Pending, In Progress, Resolved     |
|                            | Severity                    | `dynamic_fields.severity`                 | Select          |        ✅         |        ❌        | Low, Medium, High, Critical        |
|                            | Complaint Raised By         | `dynamic_fields.raisedBy`                 | Input           |        ✅         |        ❌        | String                             |
|                            | Action Taken                | `dynamic_fields.actionTaken`              | Textarea        |        ❌         |        ❌        | Text                               |
|                            | Detailed Description        | `dynamic_fields.description`              | Textarea        |        ✅         |        ❌        | Text                               |

#### 3.3 Layer 3: Advanced Business Intelligence

| Section           | Field Label              | Database Column                                                 | Component Type     | Required (Submit)  | Required (Draft) | Constraints & Details                                                                               |
| ----------------- | ------------------------ | --------------------------------------------------------------- | ------------------ | :----------------: | :--------------: | --------------------------------------------------------------------------------------------------- |
| **Product Cards** | Required Product         | `dynamic_fields.productRequirements[i].requiredProduct`         | Select             |         ❌         |        ❌        | Multi-select. Populated from Product Master (FG/RM types). First card mirrored to `required_shade`. |
|                   | Required Finish          | `dynamic_fields.productRequirements[i].requiredFinish`          | Select             |         ❌         |        ❌        | 6 options. First card mirrored to `required_finish`.                                                |
|                   | Monthly Consumption      | `dynamic_fields.productRequirements[i].monthlyConsumptionText`  | Input              |         ❌         |        ❌        | E.g. "200 Ltrs". First card mirrored to `monthly_consumption_text`.                                 |
|                   | Expected Monthly Value   | `dynamic_fields.productRequirements[i].expectedMonthlyBusiness` | InputNumber        |         ❌         |        ❌        | Mirrors to `expected_monthly_business`.                                                             |
|                   | Current Paint Supplier   | `dynamic_fields.productRequirements[i].currentSupplier`         | Select (Creatable) |         ❌         |        ❌        | Populated from Supplier Master. Custom options allowed. Mirrors to `current_supplier`.              |
|                   | Current Purchase Rate    | `dynamic_fields.productRequirements[i].currentPurchaseRate`     | InputNumber        |         ❌         |        ❌        | Mirrors to `current_purchase_rate`.                                                                 |
|                   | Expected Rate            | `dynamic_fields.productRequirements[i].expectedRate`            | InputNumber        |         ❌         |        ❌        | Mirrors to `expected_rate`.                                                                         |
|                   | Credit Days              | `dynamic_fields.productRequirements[i].creditDays`              | InputNumber        |         ❌         |        ❌        | Positive integers. Mirrors to `credit_days`.                                                        |
|                   | Outstanding Amount       | `dynamic_fields.productRequirements[i].outstandingAmount`       | InputNumber        |         ❌         |        ❌        | Positive decimals. Mirrors to `outstanding_amount`.                                                 |
|                   | Purchase Cycle           | `dynamic_fields.productRequirements[i].purchaseCycle`           | Select             |         ❌         |        ❌        | Predefined. Mirrors to `purchase_cycle`.                                                            |
| **Competitors**   | Competitor Name          | `competitorName` (Relation table)                               | Select (Creatable) | ✅ (If card added) |        ❌        | Predefined competitor brands list.                                                                  |
|                   | Strengths / Weaknesses   | `strengths` / `weaknesses`                                      | Textarea           |         ❌         |        ❌        | Voice-enabled inputs.                                                                               |
| **Discussion**    | Key Discussion Notes     | `discussion_notes`                                              | Textarea           |         ✅         |        ❌        | Voice-enabled. Min 1 char.                                                                          |
|                   | Important Observations   | `important_observations`                                        | Textarea           |         ✅         |        ❌        | Voice-enabled. Min 1 char.                                                                          |
|                   | Customer Mood            | `customer_mood`                                                 | Select             |         ✅         |        ❌        | 5 options with emojis.                                                                              |
|                   | Painting Requirement     | `dynamic_fields.immediateRequirementText`                       | Input              |         ❌         |        ❌        | Alphanumeric                                                                                        |
|                   | Hidden Opportunity       | `hidden_opportunity`                                            | Textarea           |         ❌         |        ❌        | Voice-enabled                                                                                       |
|                   | Risk Factors             | `risk_factors`                                                  | Multi-select       |         ✅         |        ❌        | Predefined chips (e.g. Credit Exposure)                                                             |
| **Order Poss**    | Conversion Prob (%)      | `conversion_probability`                                        | InputNumber        |         ✅         |        ❌        | Range: 0 to 100.                                                                                    |
|                   | Expected Order Date      | `expected_order_date`                                           | DatePicker         |         ❌         |        ❌        | Future dates                                                                                        |
|                   | Expected Order Qty       | `expected_order_quantity`                                       | InputNumber        |         ✅         |        ❌        | Positive numbers                                                                                    |
|                   | Immediate Requirement    | `immediate_requirement`                                         | Select (Yes/No)    |         ✅         |        ❌        | Boolean mapping.                                                                                    |
|                   | Trial Approved           | `trial_approved`                                                | Checkbox           |         ❌         |        ❌        | Boolean                                                                                             |
|                   | Sample Supplied          | `sample_given`                                                  | Checkbox           |         ❌         |        ❌        | Boolean                                                                                             |
|                   | Sample Required          | `dynamic_fields.sampleRequired`                                 | Checkbox           |         ❌         |        ❌        | Boolean                                                                                             |
| **Action Items**  | Action Type              | `actionType` (Relation table)                                   | Select             | ✅ (If card added) |        ❌        | 14 predefined action types.                                                                         |
|                   | Follow-up Mode           | `followupMode`                                                  | Select             | ✅ (If card added) |        ❌        | Visit, Call, WhatsApp, Email, Video Call                                                            |
|                   | Follow-up Date           | `followupDate`                                                  | DatePicker         |         ❌         |        ❌        | Future dates                                                                                        |
| **Ratings**       | Follow-up Urgency        | `followup_urgency_score`                                        | Slider             |         ✅         |        ❌        | 1-10 scale (High = Red)                                                                             |
|                   | Ratings (5 categories)   | `[category]_score`                                              | Sliders            |         ✅         |        ❌        | 1-10 scale (High = Green)                                                                           |
|                   | Executive Recommendation | `executive_recommendation`                                      | Multi-select       |         ✅         |        ❌        | 12 recommendations. DB stores comma-joined.                                                         |
| **Sidebar**       | Order Status             | `dynamic_fields.orderStatus`                                    | Multi-select       |         ✅         |        ❌        | 6 options. Stored in dynamicFields array.                                                           |

---

### 4. VALIDATION & STATE TRANSITIONS

The form implements different validation behaviors depending on the transition:

#### 4.1 Save Draft Validation (Minimal Validation)

To save a report as a draft, the following core parameters are validated. All other fields are bypassed:

- **Customer Name**: Cannot be blank. (If blank, it is automatically set to "Unnamed Draft" on the backend, but the client must enter a name if editing or validating).
- **Visit Date**: Must be a valid date.
- **Time In / Time Out**: Standard structural format.
- **Visit Category**: Must be selected.
- **Visit Purpose**: Must have at least one option selected.
- **GPS Coordinates**: Latitude and Longitude must be captured.

#### 4.2 Submit Report Validation (Full Validation)

When a user clicks "Submit Report", the form executes a full schema validation of all sections:

1. **Time Out Order Check**: The Time Out value must be chronological after Time In. If invalid, the field triggers an error: `"Time Out cannot be before Time In"`.
2. **Dynamic Fields**: If category is "Complaint Visit", specific fields like complaint type, product, resolution status, severity, raised by, and description become mandatory.
3. **Product Requirements**: If any product requirement card is active, it must not violate numeric bounds.
4. **Competitor Cards**: If a competitor block is added, the _Competitor Name_ is mandatory.
5. **Action Cards**: If an action item block is added, the _Action Type_ is mandatory.
6. **Required Text Narrative**: Discussion Notes and Important Observations must have text entered.
7. **Multi-Select and Chips**: Risk Factors, Executive Recommendation, and Order Status must contain entries.
8. **Rating Sliders**: All 6 score sliders must have a value (defaults to 5 if untouched).

---

### 5. DRAFT SAVING & RESTORATION MECHANICS

The draft system behaves as a state-preserving workspace:

#### 5.1 Save Flow (Pending State)

- When a report has no `reportId` (Create Mode) and the user clicks **Save Draft**:
  - The client runs a partial validation.
  - The payload is sent with `status = "Draft"`.
  - The backend generates a database ID and sequential report number.
  - The client is redirected to the Edit page of that draft: `/smart-crm/{id}/edit`.
  - **In-Memory File Upload**: If photos were taken prior to saving, they were held as local blobs with a mock `reportId = 'draft'`. On draft creation, the client triggers the files upload to the backend using the new ID.

#### 5.2 Edit Draft Behavior (Strict Mutation Locking)

Once a report is successfully saved as a draft, **strict business restrictions apply**:

- **Visit Details Lock**: The entire Visit Details section (Visit Date, Time In/Out, Latitude/Longitude, Visit Purpose) becomes **read-only** (`disabled={isDraftEdit}`).
- **Visit Category Lock**: The category selector is locked. The user cannot change the visit type or category (e.g. from Site Visit to Complaint Visit) after the draft has been recorded.
- **Media System Lock**: **All media additions, camera captures, and deletions are locked** (`isDraftEdit` is true). No new photos can be uploaded, and existing files cannot be removed.
- **Customer Identity Lock**: The core Customer Name AutoComplete is disabled.

#### 5.3 Unsaved Changes Guard

If the form detects changes versus the initial state on hitting "Cancel", a modal prompts:

1. **Save as Draft**: Attempts to save the current form state as a draft and returns to the previous page.
2. **Discard Changes**: Resets the form fields immediately and navigates back.
3. **Continue Editing**: Closes the modal.

---

### 6. MEDIA CAPTURE, WATERMARKING & STORAGE

The media module contains detailed client-side canvas manipulation and device sensor integration.

```
Photo Captured / Uploaded
          │
          ▼
1. Image Compression (Resize to max-width: 1920px)
          │
          ▼
2. Gather Forensic Details (Browser Geolocation API)
          │
          ▼
3. Render Forensic Watermark (Canvas Draw: Date, Time, GPS, Source)
          │
          ▼
4. Final JPEG Compression (Keep file size ≤ 500 KB)
          │
          ▼
5. Secure Upload (Associate with Report ID on Server)
```

#### 6.1 Compression Pipeline

- **Bypass Rule**: If a file size is under 500 KB, it skips compression.
- **Downscaling**: Images larger than a width of 1920px are downscaled while maintaining aspect ratio.
- **Quality Reduction**: The canvas exports a JPEG using a compression factor starting at 0.9. If the resulting blob is still over 500 KB, the quality is decreased by `0.15` iteratively down to `0.3` until the file size is under 500 KB.

#### 6.2 Forensic Watermarking

Before the file is sent, the browser queries the device and embeds a stamp directly into the pixels:

- **Device Source Identification**: The stamp identifies if the upload is a `MOBILE CAMERA` capture (based on user agent matches for iOS/Android) or a `DESKTOP / LAPTOP UPLOAD`.
- **GPS Coordinates**: The system requests the browser's current position using high accuracy. If coordinates are unavailable, denied, or fail, it writes `Not Available`.
- **Stamped Metadata**: Five lines of text are rendered in the **bottom-right corner**:
  1. `DATE : {DD MMM YYYY}` (e.g., `20 Jul 2026`)
  2. `TIME : {HH:MM:SS AM/PM}` (e.g., `11:30:25 AM`)
  3. `LAT : {Latitude value to 6 decimals}`
  4. `LON : {Longitude value to 6 decimals}`
  5. `SOURCE : {Device Source}`
- **Legibility Halo**: Text is drawn in white (`rgba(255, 255, 255, 0.92)`) with a text shadow (`shadowColor = 'rgba(0, 0, 0, 0.65)'`, blur is `Math.round(fontSize / 6)`) to ensure legibility on both light and dark backgrounds. No solid background box is drawn.
- **Dynamic Font Scaling**: Font size is set to `(Math.max(10, Math.round(base * 0.013)) + 2.5) * 2`, where `base` is the shorter edge of the canvas. If the text clips, the font size is scaled down.

#### 6.3 Storage Limits

- **500 KB Cap**: The total combined size of all uploaded files and active pending files for a single report **cannot exceed 500 KB**. If this limit is exceeded, the upload fails with `Storage Limit Reached`.
- **Capacity Indicator**: A progress bar in the media card shows the percentage of storage used. It changes color from Green (0-70%) to Orange (70-90%) to Red (>90%).

---

### 7. BUSINESS RULES & MASTER DATA INTEGRATION

The creation of a report integrates with masters and runs background rules:

#### 7.1 Auto-Customer Creation

When a report is saved with status `Submitted`, the system check for customer duplicates:

- **Trigger**: Checked on save if `status === 'Submitted'`.
- **Duplicate Check**: Queries the customer repository by company name and phone.
- **Action**: If no match is found, a customer is created in the Customer Master with address, pincode, contact, salesperson, and initial opening balance.
- **Fail-safe**: If auto-creation fails (due to DB checks or duplicate keys), the transaction aborts and the report is **not** saved.

#### 7.2 Salesperson Isolation

- **Role Isolation**: Users with a role of "Salesperson" can only view, edit, or delete reports where they are marked as the `executiveId`.
- **Executive Auto-fill**: On creating a report, the `executiveId` is set to the logged-in employee's ID.

#### 7.3 Master Data Dependencies

The New Report form queries the following endpoints during preparation:

- `GET /masters/customers`: AutoComplete sources.
- `GET /masters/customer-types`: Category dynamic options.
- `GET /employees/salespersons`: Salesperson selection.
- `GET /suppliers`: Seeded current supplier dropdown list.
- `GET /field-intelligence/competitor-brands`: Seeded competitor list.
- `GET /masters/products`: Core paint products.

---

### 8. APIs & DATA TRANSFORMATIONS

#### 8.1 API Endpoints for Creation

- `POST /field-intelligence`: Submits report values.
- `POST /field-intelligence/{id}/uploads`: Uploads media.

#### 8.2 Data Normalization (`transformForSubmit`)

- **First Card Mirroring**: The user can add multiple product requirement cards. To preserve backward compatibility with tables that expect flat columns, the first card's values are copied to the root columns:
  - `requiredProduct` → `required_shade` (comma-joined string)
  - `requiredFinish` → `required_finish`
  - `expectedMonthlyBusiness` → `expected_monthly_business`
  - `currentSupplier` → `current_supplier`
  - `currentPurchaseRate` → `current_purchase_rate`
  - `expectedRate` → `expected_rate`
  - `creditDays` → `credit_days`
  - `outstandingAmount` → `outstanding_amount`
  - `purchaseCycle` → `purchase_cycle`
    All other cards are saved in `dynamicFields.productRequirements`.
- **String Transformations**:
  - `executiveRecommendation`: Mapped to a comma-joined string.
  - `riskFactors`: Array mapped to a comma-joined string.
  - `immediateRequirement`: Boolean true/false mapped to Yes/No.

---

### 9. USER EXPERIENCE FEATURES

- **Submit Readiness Indicator**: The bottom action bar displays a status indicator:
  - 🟢 `Ready to submit` if all validation passes.
  - 🔴 `Fill required fields to Submit (Draft can be saved anytime)` if errors exist.
- **Auto-Calculations**: Entering Time In and Time Out calculates the visit duration.
- **Pincode Lookup State**: Shows a loading indicator on pincode change before filling City and State.

---

### 10. SINGLE-COMPANY RE-ARCHITECTURE FOR DMOR-OMS

When implementing this module in `DMOR-OMS-WEB-SOFTWARE`, the following adjustments must be followed:

1. **Remove `ownerId` and `companySlug`**: All queries, routes, and S3 file naming should be modified to drop tenant mappings.
2. **Database Schema Adaptation**: Use single-company schemas.
3. **API Paths**: Adjust paths to match the single-tenant API endpoints:
   - Client path: `/api/v1/field-intelligence`
   - Image upload: `/api/v1/field-intelligence/:id/uploads`
   - Serve file: `/api/v1/field-intelligence/uploads/:uploadId/view`

---

## Part 2: Microscopic Functional Analysis

### 12. CUSTOMER AUTOCOMPLETE DROPDOWN & PRE-FILL WORKFLOW

The Customer selection field uses an Ant Design `AutoComplete` component linked to the `customerName` form field.

#### 12.1 The Dropdown List Format

When a salesperson types into the field, a search is run against the customer cache. The dropdown option renders a custom row layout:

- **Left Column**: The **Company Name** (rendered in bold, e.g., `Shree Balaji Paints`).
- **Right Column**: The **Location** (`Location, State`) and **Current Outstanding Balance** (`Out: ₹X,XXX`), styled in a smaller, grey font (e.g. `Pune, Maharashtra • Out: ₹45,200`).

This layout enables the field executive to verify that they are selecting the correct branch and view the customer's outstanding balance before opening the report.

#### 12.2 The "New Customer" vs. "Existing Customer" Selection States

```
                 [Type Customer Name]
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
 [Select Match from Dropdown]     [Type Non-Matching Name]
         │                                 │
         ▼                                 ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│  State: EXISTING         │      │  State: NEW              │
│  - Pre-fills 16 fields   │      │  - Fields remain empty   │
│  - Fields locked on Edit │      │  - User inputs manually  │
│  - Summary Panel loaded  │      │  - Auto-create on Submit │
└──────────────────────────┘      └──────────────────────────┘
```

##### State A: Matching Customer Selected

When a match is selected:

1. All demographic, contact, and billing fields are automatically filled with data from the Customer Master:
   - `customerId`, `contactPerson`, `mobile`, `email`, `city`, `state`, `gstNumber`, `address`, `pinCode`, `businessCategory`, `designation`, `purchaseDecisionBy`
   - Nested dynamic fields: `Area`, `OpeningBalance`, `CustomerTypeID`, `SalesPersonID`, `CountryCode` (defaults to `+91`)
2. The **Customer Details** section collapses, and a summary panel displays:
   - Company name & location avatar.
   - Outstanding balance.
   - Last visit date.
   - Last order quantity.
   - Potential rating.
3. When editing a saved draft, these pre-filled customer details are locked (`disabled={isDraftEdit}`) to maintain data integrity.

##### State B: New Customer Typed (No Match Selected)

If the user types a new company name:

1. The form remains in the `NEW` customer state.
2. All 16 fields in the Customer Details card remain empty and editable.
3. The summary panel displays placeholders:
   - Outstanding: `No Data`
   - Last Visit: `No Previous Visits`
   - Last Order: `No Orders Yet`
   - Potential: `Not Available`
4. The user must manually enter the contact person, designation, mobile number, pincode, address, and city/state.
5. Saving as a **Draft** saves the report but does _not_ create a customer record in the master.
6. Clicking **Submit Report** triggers validation. On submission, the backend automatically creates a new customer profile in the database. If this creation fails, the report submission is rejected.

---

### 13. THE "MOBILE CAMERA ONLY" MEDIA CONSTRAINT

To prevent field executives from uploading old photos from their gallery, the media upload interface is restricted to **direct camera capture**.

#### 13.1 The HTML File Input Configuration

The file selector is rendered via a hidden HTML5 `<input>` element:

```html
<input type="file" accept="image/*" capture="environment" multiple style="display: none;" />
```

- `type="file"`: Declares a file input control.
- `accept="image/*"`: Restricts the file selector to image files.
- `capture="environment"`: Tells mobile operating systems (iOS and Android) to open the native **rear-facing camera** directly. This bypasses the typical file selector that allows choosing between the camera and the gallery.
- `multiple`: Allows the user to take and upload multiple photos sequentially.

#### 13.2 User Experience Behavior

- On mobile devices, clicking **Take Photo** opens the camera app. Once the photo is taken, it is processed and added to the upload queue.
- On desktop devices, the `capture="environment"` attribute degrades gracefully, opening a standard file selector for local image files.
- There is no file explorer or drag-and-drop area. The helper text reads: **"Camera only - images are automatically compressed"**.

---

### 14. THE FORENSIC WATERMARK ENHANCEMENT SYSTEM

Every captured image runs through a client-side watermarking pipeline that writes metadata directly into the image canvas pixels.

#### 14.1 Watermark Elements & Dynamic Sizing

The watermark consists of 5 stacked lines rendered in the **bottom-right corner** of the image:

1. `DATE : {DD MMM YYYY}` (e.g. `20 Jul 2026`)
2. `TIME : {HH:MM:SS AM/PM}` (e.g. `11:35:26 AM`)
3. `LAT : {Latitude to 6 decimal places}` (e.g. `18.520400`)
4. `LON : {Longitude to 6 decimal places}` (e.g. `73.856700`)
5. `SOURCE : {MOBILE CAMERA or DESKTOP / LAPTOP UPLOAD}`

##### Font Size Formula

To ensure the watermark is readable on both high-resolution photos and small previews, the font size scales dynamically:
$$\text{Base Size} = \min(\text{Image Width}, \text{Image Height})$$
$$\text{Calculated Font Size (px)} = \left(\max\left(10, \text{round}\left(\text{Base Size} \times 0.013\right)\right) + 2.5\right) \times 2$$

##### Padding & Margin

The bottom-right margin is calculated as:
$$\text{Margin (px)} = \text{round}\left(\text{Base Size} \times 0.025\right) + \text{round}\left(\text{Font Size} \times 0.25\right)$$

##### Line Spacing

$$\text{Line Height (px)} = \text{round}\left(\text{Font Size} \times 1.4\right)$$

#### 14.2 Visual Enhancements (Shadow Halo)

To make the text legible against any background (such as white walls or dark machinery) without obscuring the image with a solid box:

- **Fill Color**: White with high opacity (`rgba(255, 255, 255, 0.92)`).
- **Text Shadow**: A blurred black shadow is drawn underneath the text:
  - `shadowColor = 'rgba(0, 0, 0, 0.65)'`
  - `shadowBlur = Math.max(1, Math.round(fontSize / 6))`
- **Alignment**: Text is right-aligned (`textAlign = 'right'`) and baseline-aligned (`textBaseline = 'bottom'`).

#### 14.3 Overflow Auto-Fit Logic

Before drawing the text, the canvas measures the width of the longest text line:
$$\text{Max Allowed Width} = \text{Canvas Width} - (\text{Margin} \times 2)$$
$$\text{Widest Line Width} = \max(\text{Line}_1\text{ width}, \dots, \text{Line}_5\text{ width})$$

If the widest line exceeds the allowed width:
$$\text{Adjusted Font Size} = \max\left(9, \text{floor}\left(\frac{\text{Calculated Font Size} \times \text{Max Allowed Width}}{\text{Widest Line Width}}\right)\right)$$

This adjustment ensures that the watermark text never clips on portrait, landscape, or low-resolution images.

#### 14.4 Cross-Reference Verification

The watermarked details serve as an audit trail to verify form fields:

- The watermarked **GPS Latitude & Longitude** coordinates (derived from `navigator.geolocation`) are compared with the form's `latitude` and `longitude` fields in the **Visit Details** section.
- The watermarked **Date & Time** (from the device clock at capture time) is compared with the **Visit Date** and **Time In/Out** entered in the form.
- The **Source** value is checked to confirm that the photo was taken using the mobile camera.

---

### 15. FIELD-BY-FIELD DETAIL & CONSTRAINTS

| Section      | Field                | UI Component     | Input Constraints & Validations                                                                                                                                    |
| ------------ | -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Customer** | Company Name         | `AutoComplete`   | Required. Length: 3–100 characters.                                                                                                                                |
|              | Business Category    | `Select`         | Required. Selected from 13 options.                                                                                                                                |
|              | Contact Person       | `Input`          | Required. Length: 3–50 characters. Alphabets and spaces only (`/^[a-zA-Z\s]*$/`).                                                                                  |
|              | Designation / Role   | `Select`         | Required. Selected from 20 options.                                                                                                                                |
|              | Country Code         | `Select`         | Preloaded default: `+91`. Selected from 200+ codes.                                                                                                                |
|              | Mobile Number        | `Input`          | Required. 10-digit numeric format (`/^\d{10}$/`).                                                                                                                  |
|              | Email ID             | `Input`          | Optional. Email format validation. No spaces allowed. Max 100 characters.                                                                                          |
|              | Purchase Decision By | `Select`         | Optional. Selected from 11 decision maker roles.                                                                                                                   |
|              | GST Number           | `Input`          | Optional. 15-character alphanumeric format check (`/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/`). Values are automatically converted to uppercase. |
|              | Customer Type        | `Select`         | Optional. Prepopulated from CustomerType master.                                                                                                                   |
|              | Assigned Salesperson | `Select`         | Optional. Prepopulated from Employee master. Restricted based on user access level.                                                                                |
|              | Pincode              | `Input`          | Required. 6-digit numeric format (`/^\d{6}$/`). Fetches City and State on completion.                                                                              |
|              | Location / City      | `Input`          | Required. Length: 3–50 characters. Alphabets and spaces only.                                                                                                      |
|              | State                | `Input`          | Required. Length: 3–50 characters. Alphabets and spaces only.                                                                                                      |
|              | Area                 | `Input`          | Optional. Length: 3–50 characters.                                                                                                                                 |
|              | Opening Balance      | `Input (number)` | Optional. Decimal format.                                                                                                                                          |
|              | Complete Address     | `Textarea`       | Required. Length: 5–500 characters. Resizing is disabled in the UI.                                                                                                |
| **Visit**    | Visit Date           | `DatePicker`     | Required. Format: `DD-MM-YYYY`. Includes quick presets.                                                                                                            |
|              | Time In              | `TimePicker`     | Required for Draft. 12-hour format with AM/PM.                                                                                                                     |
|              | Time Out             | `TimePicker`     | Required. Must be chronologically after Time In.                                                                                                                   |
|              | Visit Duration       | `Input`          | Read-only. Shows the calculated difference in minutes.                                                                                                             |
|              | Latitude / Longitude | `Input`          | Required. Decimal format. Includes a GPS fetch button.                                                                                                             |
|              | Visit Purpose        | `Select`         | Required. Multi-select list of 12 options.                                                                                                                         |
|              | Visit Category       | `Select`         | Required. Selected from 10 categories. Determines the dynamic fields.                                                                                              |

---

## Part 3: Implementation Guidelines & Strategy

### 11. Implementation Strategy (Reuse Existing Implementation)

This implementation is intended to **enhance and complete** the existing Smart CRM module in `DMOR-OMS-WEB-SOFTWARE`, **not rewrite it from scratch**. The overall goal is to achieve functional parity with the audited reference while preserving the existing codebase wherever possible.

#### Implementation Rules

- Before implementing any feature, **analyze the existing implementation** in `DMOR-OMS-WEB-SOFTWARE`.
- If a feature, component, service, hook, API, validation, or workflow **already exists and behaves correctly**, **reuse it** rather than rewriting or replacing it.
- Only modify existing code where necessary to match the audited functionality or to fix missing behavior.
- Implement **only the missing functionality, validations, restrictions, business rules, UI behaviors, and workflows** identified during the audit.
- Do **not** duplicate components, services, repositories, APIs, or utility functions when equivalent implementations already exist.
- Preserve the existing project architecture, coding style, routing, state management, validation framework, and reusable UI components.
- Avoid large-scale refactoring unless it is essential to implement the required functionality.
- If an existing implementation already satisfies the functional blueprint, **leave it unchanged**.
- Any enhancement should be **incremental, localized, backward compatible, and maintainable**.

#### Guiding Principle

> **Analyze first, reuse second, extend third, create new only when absolutely necessary.**

The objective is to make `DMOR-OMS-WEB-SOFTWARE` functionally equivalent to the audited Smart CRM reference—not to recreate or replace code that already exists and works correctly.
