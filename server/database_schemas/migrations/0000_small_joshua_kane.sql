CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."units" (
	"unit_id" serial PRIMARY KEY NOT NULL,
	"unit_name" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "units_unit_name_unique" UNIQUE("unit_name")
);
--> statement-breakpoint
CREATE TABLE "app"."vehicles" (
	"vehicle_id" serial PRIMARY KEY NOT NULL,
	"vehicle_number" varchar(50) NOT NULL,
	"vehicle_model" varchar(100),
	"driver_name" varchar(100),
	"capacity" numeric(12, 4),
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "vehicles_vehicle_number_unique" UNIQUE("vehicle_number")
);
--> statement-breakpoint
CREATE TABLE "app"."tnc" (
	"tnc_id" serial PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'General' NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."idempotency_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"user_id" integer,
	"status_code" integer,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "app"."master_products" (
	"master_product_id" serial PRIMARY KEY NOT NULL,
	"master_product_name" varchar(255) NOT NULL,
	"product_type" varchar(5) NOT NULL,
	"description" text,
	"default_unit_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"min_stock_level" integer DEFAULT 0,
	"gst" varchar(50),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."master_product_fg" (
	"master_product_id" integer PRIMARY KEY NOT NULL,
	"default_packaging_type" varchar(100),
	"fg_density" numeric(12, 3),
	"viscosity" numeric(12, 3),
	"water_percentage" numeric(5, 2),
	"production_cost" numeric(12, 3),
	"available_quantity" numeric(18, 4) DEFAULT 0,
	"purchase_cost" numeric(12, 3),
	"subcategory" varchar(50) DEFAULT 'General',
	"hardener_id" integer,
	"hsn_code" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "app"."master_product_rm" (
	"master_product_id" integer PRIMARY KEY NOT NULL,
	"rm_density" numeric(12, 3),
	"rm_solids" numeric(6, 2),
	"purchase_cost" numeric(12, 3),
	"available_qty" numeric(18, 4),
	"can_be_added_multiple_times" boolean DEFAULT false,
	"subcategory" varchar(50) DEFAULT 'General',
	"solid_density" numeric(12, 3),
	"oil_absorption" numeric(12, 3),
	"hsn_code" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "app"."master_product_pm" (
	"master_product_id" integer PRIMARY KEY NOT NULL,
	"capacity" numeric(12, 4),
	"purchase_cost" numeric(12, 3),
	"available_qty" numeric(18, 4),
	"hsn_code" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "app"."products" (
	"product_id" serial PRIMARY KEY NOT NULL,
	"product_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"master_product_id" integer NOT NULL,
	"packaging_id" integer,
	"product_name" varchar(255) NOT NULL,
	"selling_price" numeric(12, 3) DEFAULT '0' NOT NULL,
	"available_quantity" numeric(18, 4) DEFAULT '0',
	"reserved_quantity" numeric(18, 4) DEFAULT '0',
	"available_weight_kg" numeric(18, 4) DEFAULT '0',
	"reserved_weight_kg" numeric(18, 4) DEFAULT '0',
	"package_capacity_kg" numeric(12, 4),
	"min_stock_level" integer DEFAULT 0,
	"filling_density" numeric(12, 4),
	"is_fd_sync_with_density" boolean DEFAULT true,
	"incentive_amount" numeric(12, 3) DEFAULT '0',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."product_bom" (
	"bom_id" bigserial PRIMARY KEY NOT NULL,
	"finished_good_id" integer NOT NULL,
	"raw_material_id" integer NOT NULL,
	"percentage" numeric(6, 4) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."product_development" (
	"development_id" serial PRIMARY KEY NOT NULL,
	"development_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"category_id" integer,
	"product_name" varchar(200) NOT NULL,
	"master_product_id" integer,
	"density" numeric(12, 3),
	"viscosity" numeric(12, 3),
	"percentage_value" numeric(8, 4),
	"production_hours" numeric(8, 2),
	"mixing_ratio_part" numeric(10, 4),
	"calculation_basis" varchar(10) DEFAULT 'Ltr',
	"status" varchar(20) DEFAULT 'Draft',
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."product_development_finished_goods" (
	"dev_finished_good_id" serial PRIMARY KEY NOT NULL,
	"development_id" integer NOT NULL,
	"product_id" integer,
	"product_name" varchar(200) NOT NULL,
	"packaging_cost" numeric(14, 3),
	"packing_cost_per_unit" numeric(14, 3),
	"pack_qty" numeric(18, 4),
	"package_capacity_kg" numeric(12, 4),
	"unit_selling_rate" numeric(14, 3),
	"per_ltr_cost" numeric(14, 3),
	"production_cost" numeric(14, 3),
	"gross_profit" numeric(14, 3),
	"gross_profit_percentage" numeric(5, 2),
	"density_kg_per_l" numeric(12, 3),
	"expected_total_weight_kg" numeric(18, 4),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."product_development_materials" (
	"dev_material_id" serial PRIMARY KEY NOT NULL,
	"development_id" integer NOT NULL,
	"material_id" integer NOT NULL,
	"percentage" numeric(8, 4) NOT NULL,
	"total_percentage" numeric(8, 3),
	"sequence" integer NOT NULL,
	"waiting_time" integer DEFAULT 0,
	"rate" numeric(14, 3),
	"amount" numeric(14, 3),
	"solid_percentage" numeric(5, 2),
	"solid" numeric(18, 4),
	"density" numeric(12, 3),
	"wt_per_ltr" numeric(18, 4),
	"sv" numeric(18, 4),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."branches" (
	"branch_id" serial PRIMARY KEY NOT NULL,
	"branch_name" varchar(255) NOT NULL,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "branches_branch_name_unique" UNIQUE("branch_name")
);
--> statement-breakpoint
CREATE TABLE "app"."departments" (
	"department_id" serial PRIMARY KEY NOT NULL,
	"department_name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system_department" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "departments_department_name_unique" UNIQUE("department_name")
);
--> statement-breakpoint
CREATE TABLE "app"."employees" (
	"employee_id" serial PRIMARY KEY NOT NULL,
	"employee_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"username" varchar(100),
	"password_hash" varchar(255),
	"mobile_no" varchar(20)[] NOT NULL,
	"country_code" varchar(10)[],
	"email_id" varchar(255),
	"department_id" integer,
	"current_branch_id" integer,
	"status" varchar(20) DEFAULT 'Active' NOT NULL,
	"joining_date" timestamp,
	"dob" timestamp,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"company_name" varchar(255),
	"gstin" varchar(50),
	"pincode" varchar(10),
	"address_city" varchar(100),
	"address_state" varchar(100),
	"area" varchar(100),
	"address_complete" varchar(500),
	"customer_type" varchar(50) DEFAULT 'Dealer',
	CONSTRAINT "employees_username_unique" UNIQUE("username"),
	CONSTRAINT "employees_email_id_unique" UNIQUE("email_id")
);
--> statement-breakpoint
CREATE TABLE "app"."company" (
	"company_id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"logo_url" text,
	"address" text,
	"factory_address" text,
	"gst_number" varchar(50),
	"email" varchar(255),
	"contact_number" varchar(50),
	"pan_number" varchar(50),
	"bank_name" varchar(100),
	"account_number" varchar(50),
	"ifsc_code" varchar(20),
	"branch" varchar(100),
	"terms_and_conditions" text,
	"udyam_registration_number" varchar(50),
	"pincode" varchar(20),
	"state" varchar(100),
	"cgst" varchar(50),
	"sgst" varchar(50),
	"igst" varchar(50),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."customers" (
	"customer_id" serial PRIMARY KEY NOT NULL,
	"customer_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"contact_person" varchar(255) NOT NULL,
	"mobile_no" varchar(20)[] NOT NULL,
	"country_code" varchar(10)[],
	"email_id" varchar(255),
	"location" varchar(255),
	"area" varchar(255),
	"address" text,
	"gst_number" varchar(50),
	"pin_code" varchar(10),
	"current_balance" numeric(14, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true NOT NULL,
	"sales_person_id" integer,
	"customer_type_id" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."customer_types" (
	"customer_type_id" serial PRIMARY KEY NOT NULL,
	"customer_type_name" varchar(100) NOT NULL,
	"is_system_type" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "customer_types_customer_type_name_unique" UNIQUE("customer_type_name")
);
--> statement-breakpoint
CREATE TABLE "app"."orders" (
	"order_id" serial PRIMARY KEY NOT NULL,
	"order_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(50),
	"customer_id" integer NOT NULL,
	"salesperson_id" integer,
	"order_date" timestamp with time zone DEFAULT now(),
	"total_amount" numeric(14, 3) DEFAULT '0',
	"status" varchar(30) DEFAULT 'Pending' NOT NULL,
	"delivery_address" text,
	"notes" text,
	"priority_level" varchar(20) DEFAULT 'Normal' NOT NULL,
	"expected_delivery_date" date,
	"production_batch_id" integer,
	"pm_remarks" text,
	"admin_remarks" text,
	"dispatch_id" integer,
	"dispatch_remarks" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."order_details" (
	"order_detail_id" bigserial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(14, 3) NOT NULL,
	"discount" numeric(5, 2) DEFAULT '0',
	"total_price" numeric(20, 4) GENERATED ALWAYS AS ((quantity * unit_price) * (1 - discount / 100)) STORED,
	"reserved_fg" boolean DEFAULT false,
	"required_weight_kg" numeric(18, 4),
	"package_count" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."accounts" (
	"account_id" serial PRIMARY KEY NOT NULL,
	"account_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"order_id" integer NOT NULL,
	"bill_no" varchar(50),
	"bill_date" date,
	"bill_amount" numeric(14, 2),
	"payment_status" varchar(20) DEFAULT 'Pending' NOT NULL,
	"payment_cleared" boolean DEFAULT false,
	"payment_date" date,
	"payment_method" varchar(50),
	"payment_reference" varchar(100),
	"accountant_id" integer,
	"processed_date" timestamp with time zone,
	"remarks" text,
	"tax_amount" numeric(14, 2) DEFAULT '0',
	"tax_percentage" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "accounts_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "app"."dispatches" (
	"dispatch_id" serial PRIMARY KEY NOT NULL,
	"vehicle_no" varchar(50) NOT NULL,
	"driver_name" varchar(100),
	"remarks" text,
	"status" varchar(50) DEFAULT 'In Transit',
	"dispatch_date" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."payments" (
	"payment_id" serial PRIMARY KEY NOT NULL,
	"payment_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_mode" varchar(50) NOT NULL,
	"reference_no" varchar(100),
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."customer_transactions" (
	"transaction_id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"reference_id" integer,
	"reference_type" varchar(50),
	"description" text,
	"debit" numeric(14, 2) DEFAULT '0',
	"credit" numeric(14, 2) DEFAULT '0',
	"balance" numeric(14, 2) DEFAULT '0',
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."quotations" (
	"quotation_id" serial PRIMARY KEY NOT NULL,
	"quotation_no" varchar(50) NOT NULL,
	"quotation_date" varchar(50),
	"company_name" varchar(255),
	"buyer_name" varchar(255),
	"customer_id" integer,
	"content" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'Pending' NOT NULL,
	"rejection_remark" varchar(500),
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."production_batches_enhanced" (
	"batch_id" serial PRIMARY KEY NOT NULL,
	"batch_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"batch_no" varchar(50) NOT NULL,
	"master_product_id" integer NOT NULL,
	"scheduled_date" date NOT NULL,
	"planned_quantity" numeric(18, 4) NOT NULL,
	"density" numeric(12, 3),
	"viscosity" numeric(12, 3),
	"water_percentage" numeric(5, 2),
	"actual_quantity" numeric(18, 4),
	"actual_density" numeric(12, 3),
	"actual_weight_kg" numeric(18, 4),
	"actual_water_percentage" numeric(5, 2),
	"actual_viscosity" numeric(12, 3),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"time_required_hours" numeric(8, 2),
	"actual_time_hours" numeric(8, 2),
	"pm_remarks" text,
	"production_remarks" text,
	"supervisor_id" integer,
	"labour_names" text,
	"machine_no" varchar(20),
	"status" varchar(20) DEFAULT 'Scheduled' NOT NULL,
	"batch_type" varchar(20) DEFAULT 'MAKE_TO_ORDER' NOT NULL,
	"bom_version" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"completed_by" integer,
	"cancelled_by" integer,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	CONSTRAINT "production_batches_enhanced_batch_no_unique" UNIQUE("batch_no")
);
--> statement-breakpoint
CREATE TABLE "app"."batch_products" (
	"batch_product_id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"order_id" integer,
	"order_detail_id" integer,
	"planned_units" integer NOT NULL,
	"package_capacity_kg" numeric(12, 4),
	"planned_weight_kg" numeric(18, 4),
	"produced_units" integer,
	"produced_weight_kg" numeric(18, 4),
	"variance" numeric(18, 4),
	"fulfillment_type" varchar(20) DEFAULT 'MAKE_TO_ORDER' NOT NULL,
	"is_fulfilled" boolean DEFAULT false,
	"fulfilled_at" timestamp with time zone,
	"inventory_updated" boolean DEFAULT false,
	"inventory_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."batch_materials" (
	"batch_material_id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"material_id" integer NOT NULL,
	"sequence" integer DEFAULT 0,
	"waiting_time" integer DEFAULT 0,
	"is_additional" boolean DEFAULT false,
	"required_quantity" numeric(18, 4) NOT NULL,
	"required_use_per" numeric(18, 4),
	"required_use_qty" numeric(18, 4),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."batch_activity_log" (
	"log_id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"previous_status" varchar(20),
	"new_status" varchar(20),
	"performed_by" integer NOT NULL,
	"notes" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."suppliers" (
	"supplier_id" serial PRIMARY KEY NOT NULL,
	"supplier_name" varchar(255) NOT NULL,
	"contact_person" varchar(255),
	"mobile_no" varchar(20),
	"mobile_no2" varchar(20),
	"address" text,
	"pincode" varchar(10),
	"state" varchar(100),
	"gst_no" varchar(20),
	"credit_days" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "suppliers_supplier_name_unique" UNIQUE("supplier_name")
);
--> statement-breakpoint
CREATE TABLE "app"."material_inward" (
	"inward_id" bigserial PRIMARY KEY NOT NULL,
	"inward_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"master_product_id" integer NOT NULL,
	"product_id" integer,
	"supplier_id" integer,
	"bill_no" varchar(50) DEFAULT '' NOT NULL,
	"inward_date" timestamp with time zone DEFAULT now(),
	"quantity" numeric(18, 4) NOT NULL,
	"unit_id" integer,
	"unit_price" numeric(14, 3) DEFAULT '0',
	"total_cost" numeric(20, 3) DEFAULT '0',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."material_discard" (
	"discard_id" bigserial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"discard_date" timestamp with time zone DEFAULT now(),
	"quantity" integer NOT NULL,
	"product_type" varchar(10) DEFAULT 'FG' NOT NULL,
	"reason" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."stock_ledger" (
	"ledger_id" bigserial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"change_qty" integer NOT NULL,
	"reference_table" text,
	"reference_id" bigint,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "app"."inventory_transactions" (
	"transaction_id" bigserial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"master_product_id" integer,
	"transaction_type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"weight_kg" numeric(18, 4),
	"density_kg_per_l" numeric(12, 6),
	"balance_before" integer,
	"balance_after" integer,
	"reference_type" varchar(50),
	"reference_id" integer,
	"unit_price" numeric(14, 4),
	"total_value" numeric(20, 4),
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."purchase_order_items" (
	"item_id" serial PRIMARY KEY NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"item_description" varchar(500) NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit" varchar(50),
	"unit_price" numeric(14, 2) DEFAULT '0',
	"total_price" numeric(14, 2) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."purchase_orders" (
	"purchase_order_id" serial PRIMARY KEY NOT NULL,
	"po_number" varchar(50) NOT NULL,
	"supplier_id" integer,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"status" varchar(50) DEFAULT 'Pending' NOT NULL,
	"total_amount" numeric(14, 2) DEFAULT '0',
	"delivery_terms" text,
	"notes" text,
	"delivery_address" text,
	"dispatched_through" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "app"."roles" (
	"role_id" serial PRIMARY KEY NOT NULL,
	"role_name" varchar(100) NOT NULL,
	"description" text,
	"department_id" integer,
	"landing_page" varchar(255) DEFAULT '/dashboard',
	"is_sales_role" boolean DEFAULT false NOT NULL,
	"is_supervisor_role" boolean DEFAULT false NOT NULL,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "roles_role_name_unique" UNIQUE("role_name")
);
--> statement-breakpoint
CREATE TABLE "app"."permissions" (
	"permission_id" serial PRIMARY KEY NOT NULL,
	"permission_name" varchar(150) NOT NULL,
	"description" text,
	"page_path" varchar(255),
	"page_label" varchar(100),
	"page_group" varchar(50),
	"parent_id" integer,
	"is_page" boolean DEFAULT true,
	"available_actions" jsonb DEFAULT '["view","create","modify","delete"]'::jsonb,
	CONSTRAINT "permissions_permission_name_unique" UNIQUE("permission_name")
);
--> statement-breakpoint
CREATE TABLE "app"."role_permissions" (
	"role_permission_id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"granted_actions" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "app"."employee_roles" (
	"employee_role_id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"notification_id" serial PRIMARY KEY NOT NULL,
	"recipient_id" integer,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"priority" varchar(20) DEFAULT 'normal',
	"is_read" boolean DEFAULT false,
	"is_acknowledged" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."notification_rules" (
	"rule_id" serial PRIMARY KEY NOT NULL,
	"notification_type" varchar(100) NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."crm_visits" (
	"visit_id" serial PRIMARY KEY NOT NULL,
	"visit_date" timestamp with time zone DEFAULT now() NOT NULL,
	"sales_executive_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"visit_type" varchar(50) NOT NULL,
	"lead_status" text DEFAULT 'Contacted',
	"notes" text NOT NULL,
	"is_next_visit_required" boolean DEFAULT false NOT NULL,
	"next_visit_date" timestamp with time zone,
	"next_visit_notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."field_intelligence_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid,
	"activity_type" varchar(100) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"company_id" integer NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."field_intelligence_ai_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"insight_type" varchar(100) NOT NULL,
	"observation" text NOT NULL,
	"reasoning" text,
	"severity" varchar(50) DEFAULT 'medium',
	"company_id" integer NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."field_intelligence_competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"competitor_name" varchar(255) NOT NULL,
	"strengths" text,
	"weaknesses" text,
	"reason_using_competitor" text,
	"reason_shift_to_us" text,
	"company_id" integer NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."field_intelligence_dashboard_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_key" varchar(100) NOT NULL,
	"metric_value" jsonb NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now(),
	"company_id" integer NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."field_intelligence_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"followup_date" timestamp with time zone NOT NULL,
	"notes" text,
	"action_type" varchar(100),
	"followup_mode" varchar(50),
	"status" varchar(50) DEFAULT 'Open' NOT NULL,
	"company_id" integer NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."field_intelligence_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_number" varchar(100) NOT NULL,
	"visit_date" timestamp with time zone DEFAULT now(),
	"time_in" varchar(50),
	"time_out" varchar(50),
	"visit_duration" integer,
	"gps_latitude" numeric(10, 8),
	"gps_longitude" numeric(11, 8),
	"executive_id" integer NOT NULL,
	"executive_name" varchar(255),
	"branch" varchar(255),
	"region" varchar(255),
	"visit_type" varchar(50) DEFAULT 'New Visit',
	"visit_purpose" jsonb DEFAULT '[]'::jsonb,
	"customer_name" varchar(255) NOT NULL,
	"customer_id" integer,
	"contact_person" varchar(255),
	"designation" varchar(255),
	"mobile" varchar(50),
	"whatsapp" varchar(50),
	"email" varchar(255),
	"gst_number" varchar(50),
	"address" text,
	"city" varchar(255),
	"state" varchar(255),
	"pin_code" varchar(20),
	"business_category" varchar(100),
	"monthly_consumption" numeric(15, 2),
	"current_supplier" varchar(255),
	"paint_requirement_types" jsonb DEFAULT '[]'::jsonb,
	"surface_types" jsonb DEFAULT '[]'::jsonb,
	"application_methods" jsonb DEFAULT '[]'::jsonb,
	"required_shade" varchar(255),
	"required_finish" varchar(255),
	"technical_challenges" jsonb DEFAULT '[]'::jsonb,
	"current_system_used" text,
	"monthly_consumption_text" text,
	"current_purchase_rate" numeric(15, 2),
	"expected_rate" numeric(15, 2),
	"credit_days" integer DEFAULT 0,
	"outstanding_amount" numeric(15, 2) DEFAULT 0,
	"purchase_decision_by" varchar(255),
	"purchase_cycle" varchar(100),
	"potential_business_value" numeric(15, 2) DEFAULT 0,
	"expected_monthly_business" numeric(15, 2) DEFAULT 0,
	"conversion_probability" integer DEFAULT 0,
	"discussion_notes" text,
	"important_observations" text,
	"customer_mood" varchar(50),
	"hidden_opportunity" text,
	"risk_factors" text,
	"immediate_requirement" text,
	"expected_order_date" timestamp with time zone,
	"expected_order_quantity" numeric(15, 2) DEFAULT 0,
	"trial_approved" boolean DEFAULT false,
	"sample_given" boolean DEFAULT false,
	"followup_urgency_score" integer DEFAULT 0,
	"dealer_confidence" integer DEFAULT 0,
	"payment_reliability" integer DEFAULT 0,
	"relationship_strength" integer DEFAULT 0,
	"technical_capability" integer DEFAULT 0,
	"long_term_potential" integer DEFAULT 0,
	"executive_recommendation" text,
	"dynamic_fields" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(50) DEFAULT 'Draft' NOT NULL,
	"company_id" integer NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "field_intelligence_reports_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
CREATE TABLE "app"."field_intelligence_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"file_type" varchar(100) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" varchar(100),
	"file_size" integer,
	"uploaded_by" integer,
	"company_id" integer NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."test_certificate_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"certificate_id" integer NOT NULL,
	"property_name" varchar(150) NOT NULL,
	"result_value" varchar(255) NOT NULL,
	"specification" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."test_certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"tenant_id" varchar(50) NOT NULL,
	"certificate_no" varchar(100) NOT NULL,
	"batch_id" integer NOT NULL,
	"batch_number" varchar(50) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"colour" varchar(100),
	"manufacturing_date" timestamp with time zone,
	"testing_date" timestamp with time zone,
	"remarks" text,
	"status" varchar(20) DEFAULT 'Draft' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "test_certificates_certificate_no_unique" UNIQUE("certificate_no")
);
--> statement-breakpoint
ALTER TABLE "app"."master_product_fg" ADD CONSTRAINT "master_product_fg_master_product_id_master_products_master_product_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."master_product_fg" ADD CONSTRAINT "master_product_fg_hardener_id_master_products_master_product_id_fk" FOREIGN KEY ("hardener_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."master_product_rm" ADD CONSTRAINT "master_product_rm_master_product_id_master_products_master_product_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."master_product_pm" ADD CONSTRAINT "master_product_pm_master_product_id_master_products_master_product_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."products" ADD CONSTRAINT "products_master_product_id_master_products_master_product_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."products" ADD CONSTRAINT "products_packaging_id_master_products_master_product_id_fk" FOREIGN KEY ("packaging_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_bom" ADD CONSTRAINT "product_bom_finished_good_id_products_product_id_fk" FOREIGN KEY ("finished_good_id") REFERENCES "app"."products"("product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_bom" ADD CONSTRAINT "product_bom_raw_material_id_products_product_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "app"."products"("product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_development" ADD CONSTRAINT "product_development_master_product_id_master_products_master_product_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_development" ADD CONSTRAINT "product_development_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_development_finished_goods" ADD CONSTRAINT "product_development_finished_goods_development_id_product_development_development_id_fk" FOREIGN KEY ("development_id") REFERENCES "app"."product_development"("development_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_development_finished_goods" ADD CONSTRAINT "product_development_finished_goods_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_development_materials" ADD CONSTRAINT "product_development_materials_development_id_product_development_development_id_fk" FOREIGN KEY ("development_id") REFERENCES "app"."product_development"("development_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_development_materials" ADD CONSTRAINT "product_development_materials_material_id_master_products_master_product_id_fk" FOREIGN KEY ("material_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."employees" ADD CONSTRAINT "employees_department_id_departments_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "app"."departments"("department_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."employees" ADD CONSTRAINT "employees_current_branch_id_branches_branch_id_fk" FOREIGN KEY ("current_branch_id") REFERENCES "app"."branches"("branch_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."orders" ADD CONSTRAINT "orders_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("customer_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_details" ADD CONSTRAINT "order_details_order_id_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("order_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."accounts" ADD CONSTRAINT "accounts_order_id_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("order_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."accounts" ADD CONSTRAINT "accounts_accountant_id_employees_employee_id_fk" FOREIGN KEY ("accountant_id") REFERENCES "app"."employees"("employee_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("customer_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."customer_transactions" ADD CONSTRAINT "customer_transactions_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("customer_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."production_batches_enhanced" ADD CONSTRAINT "production_batches_enhanced_master_product_id_master_product_fg_master_product_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "app"."master_product_fg"("master_product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."production_batches_enhanced" ADD CONSTRAINT "production_batches_enhanced_supervisor_id_employees_employee_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."production_batches_enhanced" ADD CONSTRAINT "production_batches_enhanced_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."production_batches_enhanced" ADD CONSTRAINT "production_batches_enhanced_completed_by_employees_employee_id_fk" FOREIGN KEY ("completed_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."production_batches_enhanced" ADD CONSTRAINT "production_batches_enhanced_cancelled_by_employees_employee_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."batch_products" ADD CONSTRAINT "batch_products_batch_id_production_batches_enhanced_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "app"."production_batches_enhanced"("batch_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."batch_products" ADD CONSTRAINT "batch_products_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."batch_products" ADD CONSTRAINT "batch_products_order_id_orders_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("order_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."batch_products" ADD CONSTRAINT "batch_products_order_detail_id_order_details_order_detail_id_fk" FOREIGN KEY ("order_detail_id") REFERENCES "app"."order_details"("order_detail_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."batch_materials" ADD CONSTRAINT "batch_materials_batch_id_production_batches_enhanced_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "app"."production_batches_enhanced"("batch_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."batch_materials" ADD CONSTRAINT "batch_materials_material_id_master_products_master_product_id_fk" FOREIGN KEY ("material_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."batch_activity_log" ADD CONSTRAINT "batch_activity_log_batch_id_production_batches_enhanced_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "app"."production_batches_enhanced"("batch_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."batch_activity_log" ADD CONSTRAINT "batch_activity_log_performed_by_employees_employee_id_fk" FOREIGN KEY ("performed_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."material_inward" ADD CONSTRAINT "material_inward_master_product_id_master_products_master_product_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."material_inward" ADD CONSTRAINT "material_inward_supplier_id_suppliers_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "app"."suppliers"("supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_master_product_id_master_products_master_product_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "app"."master_products"("master_product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "app"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "app"."suppliers"("supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."roles" ADD CONSTRAINT "roles_department_id_departments_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "app"."departments"("department_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."permissions" ADD CONSTRAINT "permissions_parent_id_permissions_permission_id_fk" FOREIGN KEY ("parent_id") REFERENCES "app"."permissions"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "app"."roles"("role_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "app"."permissions"("permission_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."employee_roles" ADD CONSTRAINT "employee_roles_employee_id_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "app"."employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."employee_roles" ADD CONSTRAINT "employee_roles_role_id_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "app"."roles"("role_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_recipient_id_employees_employee_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_activity_log" ADD CONSTRAINT "field_intelligence_activity_log_report_id_field_intelligence_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "app"."field_intelligence_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_activity_log" ADD CONSTRAINT "field_intelligence_activity_log_company_id_company_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_activity_log" ADD CONSTRAINT "field_intelligence_activity_log_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_ai_insights" ADD CONSTRAINT "field_intelligence_ai_insights_report_id_field_intelligence_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "app"."field_intelligence_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_ai_insights" ADD CONSTRAINT "field_intelligence_ai_insights_company_id_company_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_ai_insights" ADD CONSTRAINT "field_intelligence_ai_insights_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_competitors" ADD CONSTRAINT "field_intelligence_competitors_report_id_field_intelligence_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "app"."field_intelligence_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_competitors" ADD CONSTRAINT "field_intelligence_competitors_company_id_company_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_competitors" ADD CONSTRAINT "field_intelligence_competitors_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_dashboard_metrics" ADD CONSTRAINT "field_intelligence_dashboard_metrics_company_id_company_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_dashboard_metrics" ADD CONSTRAINT "field_intelligence_dashboard_metrics_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_followups" ADD CONSTRAINT "field_intelligence_followups_report_id_field_intelligence_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "app"."field_intelligence_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_followups" ADD CONSTRAINT "field_intelligence_followups_company_id_company_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_followups" ADD CONSTRAINT "field_intelligence_followups_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_reports" ADD CONSTRAINT "field_intelligence_reports_executive_id_employees_employee_id_fk" FOREIGN KEY ("executive_id") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_reports" ADD CONSTRAINT "field_intelligence_reports_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_reports" ADD CONSTRAINT "field_intelligence_reports_company_id_company_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_reports" ADD CONSTRAINT "field_intelligence_reports_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_uploads" ADD CONSTRAINT "field_intelligence_uploads_report_id_field_intelligence_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "app"."field_intelligence_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_uploads" ADD CONSTRAINT "field_intelligence_uploads_uploaded_by_employees_employee_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "app"."employees"("employee_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_uploads" ADD CONSTRAINT "field_intelligence_uploads_company_id_company_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."field_intelligence_uploads" ADD CONSTRAINT "field_intelligence_uploads_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."test_certificate_results" ADD CONSTRAINT "test_certificate_results_certificate_id_test_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "app"."test_certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."test_certificates" ADD CONSTRAINT "test_certificates_company_id_company_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("company_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."test_certificates" ADD CONSTRAINT "test_certificates_batch_id_production_batches_enhanced_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "app"."production_batches_enhanced"("batch_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."test_certificates" ADD CONSTRAINT "test_certificates_created_by_employees_employee_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."employees"("employee_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_rules_unique_target_idx" ON "app"."notification_rules" USING btree ("notification_type","target_type","target_id");