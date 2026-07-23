import 'dotenv/config';
import db from '../index.js';
import {
  customers,
  employees,
  company,
  fieldIntelligenceReports,
  fieldIntelligenceFollowups,
  fieldIntelligenceCompetitors,
  fieldIntelligenceActivityLog,
  fieldIntelligenceAiInsights,
  fieldIntelligenceDashboardMetrics,
} from '../schema/index.js';
import { eq, sql } from 'drizzle-orm';

async function main() {
  const isClear = process.argv.includes('--clear');

  if (isClear) {
    console.log('🧹 Clearing all Smart CRM test data...');
    try {
      // Delete in correct order to respect foreign keys
      await db.delete(fieldIntelligenceDashboardMetrics);
      await db.delete(fieldIntelligenceAiInsights);
      await db.delete(fieldIntelligenceActivityLog);
      await db.delete(fieldIntelligenceCompetitors);
      await db.delete(fieldIntelligenceFollowups);
      await db.delete(fieldIntelligenceReports);
      console.log('✅ Wiped all Smart CRM field intelligence tables successfully.');
    } catch (err) {
      console.error('❌ Failed to clear CRM tables:', err.message);
    }
    process.exit(0);
  }

  console.log('🌱 Seeding rich, realistic Smart CRM test data...');

  try {
    // 1. Resolve Customer Master
    const customerList = await db.select().from(customers);
    if (customerList.length === 0) {
      console.error(
        '⚠️ No customers found in Customer Master! Please run core seed first: pnpm db:seed'
      );
      process.exit(1);
    }

    const customerMap = {};
    for (const c of customerList) {
      customerMap[c.companyName] = c;
    }

    // 2. Resolve Executive & Org Context
    const [emp] = await db.select().from(employees).limit(1);
    const [comp] = await db.select().from(company).limit(1);

    if (!emp || !comp) {
      console.error('⚠️ Missing employee or company rows in database. Run core seed first.');
      process.exit(1);
    }

    const executiveId = emp.employeeId;
    const executiveName = `${emp.firstName} ${emp.lastName}`.trim();
    const branch = emp.branch || 'Mumbai HQ';
    const region = emp.region || 'West';
    const companyId = comp.companyId;

    // Build standard tenant uuid
    const hex = companyId.toString(16).padStart(12, '0');
    const tenantId = `00000000-0000-0000-0000-${hex}`;

    // Target Companies we want to seed histories for
    const targetCompanies = [
      {
        name: 'ABC Industrial Coatings Pvt Ltd',
        contact: 'Mr. Rakesh Mehta',
        email: 'rakesh@abcindustrial.com',
        mobile: '9100000001',
        category: 'Industrial',
        outstanding: '0.00',
        visits: [
          {
            daysAgo: 90,
            type: 'New Visit',
            purpose: ['Introductory Meet', 'Requirement Analysis'],
            notes:
              'Initial introduction to Mr. Rakesh Mehta (Owner). They consume about 2500 liters of industrial coatings per month, mostly for structural steel fabrication. Currently purchasing from Berger Paints at ₹240/liter with 30 days credit. Interested in seeing our Epoxy Prime coating specifications and testing shade accuracy.',
            observations:
              'Customer is quality-conscious but highly price-sensitive. Complained about drying time and film thickness variations with current supplier.',
            mood: 'Neutral',
            urgency: 40,
            ratings: {
              confidence: 60,
              reliability: 80,
              strength: 50,
              capability: 70,
              potential: 90,
            },
            requirements: ['Epoxy Primer'],
            surfaces: ['Mild Steel', 'Cast Iron'],
            methods: ['Airless Spray'],
            shade: 'Zinc Phosphate Grey',
            finish: 'Matt',
            challenges: ['Drying Time', 'Adhesion Failure'],
            currentSupplier: 'Berger Paints',
            expectedRate: '230.00',
            currentRate: '240.00',
            potentialValue: '150000.00',
            trialApproved: false,
            sampleGiven: false,
          },
          {
            daysAgo: 75,
            type: 'Follow-up',
            purpose: ['Product Demo', 'Sample Delivery'],
            notes:
              'Presented DMOR Epoxy High-Build Primers technical specification sheets. Rakesh was impressed with the solid volume percentages. Delivered a 20-liter sample of Epoxy Zinc Phosphate Grey Primer for initial test run on their structural frames.',
            observations:
              'Rakesh is keen on decreasing cycle time. Delivery was smooth. Followup planned post application.',
            mood: 'Interested',
            urgency: 60,
            ratings: {
              confidence: 70,
              reliability: 80,
              strength: 60,
              capability: 70,
              potential: 90,
            },
            requirements: ['Epoxy Primer'],
            surfaces: ['Mild Steel'],
            methods: ['Airless Spray'],
            shade: 'Zinc Phosphate Grey',
            finish: 'Matt',
            challenges: ['Drying Time'],
            currentSupplier: 'Berger Paints',
            expectedRate: '230.00',
            currentRate: '240.00',
            potentialValue: '150000.00',
            trialApproved: true,
            sampleGiven: true,
            followups: [
              {
                dateOffset: 70,
                notes:
                  'Follow up on the dry-film-thickness (DFT) test results for the grey primer sample.',
                type: 'Call',
              },
            ],
          },
          {
            daysAgo: 60,
            type: 'Product Trial',
            purpose: ['Technical Trial', 'Quality Feedback'],
            notes:
              'Conducted live line trial of the Grey Epoxy Primer sample. The coating achieved 60 microns dry film thickness (DFT) in a single pass. Tested cross-cut adhesion which passed at 5B rating. The drying time was recorded at 25 minutes, which is 15 minutes faster than their current Berger system. Rakesh and the line contractor officially approved the product quality.',
            observations:
              'The applicators appreciated the low overspray. Technical parameters fully satisfied.',
            mood: 'Happy',
            urgency: 75,
            ratings: {
              confidence: 85,
              reliability: 80,
              strength: 75,
              capability: 80,
              potential: 90,
            },
            requirements: ['Epoxy Primer'],
            surfaces: ['Mild Steel'],
            methods: ['Airless Spray'],
            shade: 'Zinc Phosphate Grey',
            finish: 'Matt',
            challenges: [],
            currentSupplier: 'Berger Paints',
            expectedRate: '230.00',
            currentRate: '240.00',
            potentialValue: '200000.00',
            trialApproved: true,
            sampleGiven: false,
          },
          {
            daysAgo: 45,
            type: 'Commercial Neg',
            purpose: ['Commercial Negotiation', 'Quotation Submission'],
            notes:
              'Negotiated commercial terms for a monthly volume of 1000 liters. Offered a final price of ₹230/liter. Rakesh requested 60 credit days. We negotiated down and closed at 45 credit days with a signed dealer agreement. Estimated monthly business potential at ₹2,30,000.',
            observations:
              'Competitor Berger Paints is attempting a price match, but Rakesh prefers our faster dry time.',
            mood: 'Positive',
            urgency: 80,
            ratings: {
              confidence: 90,
              reliability: 80,
              strength: 80,
              capability: 80,
              potential: 95,
            },
            requirements: ['Epoxy Primer'],
            surfaces: ['Mild Steel'],
            methods: ['Airless Spray'],
            shade: 'Zinc Phosphate Grey',
            finish: 'Matt',
            challenges: [],
            currentSupplier: 'Berger Paints',
            expectedRate: '230.00',
            currentRate: '240.00',
            potentialValue: '230000.00',
            trialApproved: true,
            sampleGiven: false,
            competitors: [
              {
                name: 'Berger Paints',
                strengths: 'Large distributor network, local stock depot',
                weaknesses: 'Longer technical validation cycle, slower shade matching times',
                reason: 'Historical supplier relationships',
              },
            ],
          },
          {
            daysAgo: 30,
            type: 'Follow-up',
            purpose: ['Purchase Order Collection'],
            notes:
              'Received their first formal Purchase Order for 800 liters of Zinc Phosphate Grey Epoxy Primer (PO-2026-045). Delivery scheduled for next week. Coordinated with our dispatch desk to ensure stock availability.',
            observations: 'Payment terms document and GSTIN check cleared successfully.',
            mood: 'Excited',
            urgency: 90,
            ratings: {
              confidence: 95,
              reliability: 90,
              strength: 85,
              capability: 80,
              potential: 95,
            },
            requirements: ['Epoxy Primer'],
            surfaces: ['Mild Steel'],
            methods: ['Airless Spray'],
            shade: 'Zinc Phosphate Grey',
            finish: 'Matt',
            challenges: [],
            currentSupplier: 'Berger Paints',
            expectedRate: '230.00',
            currentRate: '240.00',
            potentialValue: '184000.00',
            trialApproved: true,
            sampleGiven: false,
            followups: [
              {
                dateOffset: 25,
                notes: 'Confirm dispatch of 800 liters of Epoxy Primer grey.',
                type: 'Visit',
              },
            ],
          },
          {
            daysAgo: 15,
            type: 'Delivery Check',
            purpose: ['Post-Delivery Review', 'Customer Feedback'],
            notes:
              'Visited the fabrication workshop to inspect the applied primer from our first commercial supply. The film build was consistent, showing no signs of sagging or orange peel. Rakesh is very satisfied. He mentioned they will discuss shifting their Polyurethane (PU) Topcoat requirements to DMOR next month.',
            observations:
              'First commercial batch successfully integrated into their daily production line.',
            mood: 'Happy',
            urgency: 50,
            ratings: {
              confidence: 95,
              reliability: 90,
              strength: 90,
              capability: 80,
              potential: 95,
            },
            requirements: ['Epoxy Primer', 'Polyurethane (PU)'],
            surfaces: ['Mild Steel'],
            methods: ['Airless Spray'],
            shade: 'Zinc Phosphate Grey',
            finish: 'Matt',
            challenges: [],
            currentSupplier: 'Berger Paints',
            expectedRate: '230.00',
            currentRate: '240.00',
            potentialValue: '184000.00',
            trialApproved: true,
            sampleGiven: false,
          },
          {
            daysAgo: 3,
            type: 'Follow-up',
            purpose: ['Repeat Orders', 'New Requirement'],
            notes:
              'Rakesh placed a repeat order for 1200 liters of Epoxy Primer. Additionally, he requested a 5-liter sample of our DMOR Premium PU-7038 White Glossy Topcoat for shade matching and trial on their export machinery contracts.',
            observations:
              'The account is growing steadily. Payment for the first invoice was received within the 45-day credit period.',
            mood: 'Excited',
            urgency: 90,
            ratings: {
              confidence: 98,
              reliability: 95,
              strength: 95,
              capability: 85,
              potential: 98,
            },
            requirements: ['Epoxy Primer', 'Polyurethane (PU)'],
            surfaces: ['Mild Steel'],
            methods: ['Airless Spray'],
            shade: 'PU White Glossy',
            finish: 'Glossy',
            challenges: [],
            currentSupplier: 'Berger Paints',
            expectedRate: '230.00',
            currentRate: '240.00',
            potentialValue: '350000.00',
            trialApproved: true,
            sampleGiven: true,
            followups: [
              {
                dateOffset: -2,
                notes: 'Deliver PU-7038 white gloss sample and arrange for trial next week.',
                type: 'Visit',
              },
            ],
          },
        ],
      },
      {
        name: 'Prime Paints Distributors',
        contact: 'Mr. Sunil Verma',
        email: 'sunil@primepaints.com',
        mobile: '9200000001',
        category: 'Retail Dealer',
        outstanding: '200000.00',
        visits: [
          {
            daysAgo: 90,
            type: 'New Visit',
            purpose: ['Introductory Meet'],
            notes:
              'Met Mr. Sunil Verma (MD) of Prime Paints. They are a large decorative paints dealer in Delhi, currently stocking Asian Paints and Kansai Nerolac. Sunil is looking for a brand that offers higher margins on premium interior/exterior emulsions to counter stiff local competition.',
            observations:
              'Dealer is looking for additional commercial incentives. Reluctant to commit shelf space without marketing schemes.',
            mood: 'Neutral',
            urgency: 30,
            ratings: {
              confidence: 50,
              reliability: 70,
              strength: 40,
              capability: 90,
              potential: 80,
            },
            requirements: ['Decorative Emulsion'],
            surfaces: ['Plastered Wall'],
            methods: ['Roller'],
            shade: 'Various',
            finish: 'Semi-Gloss',
            challenges: ['Price War', 'Competitor Monopolization'],
            currentSupplier: 'Asian Paints',
            expectedRate: '180.00',
            currentRate: '195.00',
            potentialValue: '100000.00',
            trialApproved: false,
            sampleGiven: false,
          },
          {
            daysAgo: 75,
            type: 'Follow-up',
            purpose: ['Commercial Negotiation', 'Quotation Submission'],
            notes:
              'Presented our retail margin structures and visual marketing boards. Sunil requested a 5% higher trade discount than Asian Paints and 60 days credit term. We submitted the pricing sheet.',
            observations: 'Sunil is comparing our price point directly with Kansai Nerolac.',
            mood: 'Neutral',
            urgency: 50,
            ratings: {
              confidence: 55,
              reliability: 70,
              strength: 55,
              capability: 90,
              potential: 80,
            },
            requirements: ['Decorative Emulsion'],
            surfaces: ['Plastered Wall'],
            methods: ['Roller'],
            shade: 'Various',
            finish: 'Semi-Gloss',
            challenges: ['Price War'],
            currentSupplier: 'Asian Paints',
            expectedRate: '180.00',
            currentRate: '195.00',
            potentialValue: '120000.00',
            trialApproved: false,
            sampleGiven: false,
          },
          {
            daysAgo: 60,
            type: 'Follow-up',
            purpose: ['Purchase Order Collection'],
            notes:
              'Sunil agreed to run a pilot run. Placed an initial stock order of premium interior emulsions worth ₹2,00,000 with 45 days credit. Agreed to dedicate one prime display rack for DMOR product lines.',
            observations: 'Dealer wants marketing merchandise (t-shirts, shade cards) immediately.',
            mood: 'Interested',
            urgency: 75,
            ratings: {
              confidence: 70,
              reliability: 75,
              strength: 65,
              capability: 90,
              potential: 80,
            },
            requirements: ['Decorative Emulsion'],
            surfaces: ['Plastered Wall'],
            methods: ['Roller'],
            shade: 'Various',
            finish: 'Semi-Gloss',
            challenges: [],
            currentSupplier: 'Asian Paints',
            expectedRate: '180.00',
            currentRate: '195.00',
            potentialValue: '200000.00',
            trialApproved: false,
            sampleGiven: false,
          },
          {
            daysAgo: 45,
            type: 'Follow-up',
            purpose: ['Site Observations', 'Stock Status'],
            notes:
              'Checked stock levels. Emulsions are moving slowly because local contractors prefer Asian Paints. Sunil requested more aggressive dealer incentives and local painter meets.',
            observations: 'Contractors are asking for Asian Paints by name. Brand pull is low.',
            mood: 'Neutral',
            urgency: 60,
            ratings: {
              confidence: 60,
              reliability: 70,
              strength: 60,
              capability: 85,
              potential: 75,
            },
            requirements: ['Decorative Emulsion'],
            surfaces: ['Plastered Wall'],
            methods: ['Roller'],
            shade: 'Various',
            finish: 'Semi-Gloss',
            challenges: ['Low Brand Pull'],
            currentSupplier: 'Asian Paints',
            expectedRate: '180.00',
            currentRate: '195.00',
            potentialValue: '50000.00',
            trialApproved: false,
            sampleGiven: false,
            followups: [
              {
                dateOffset: 35,
                notes: 'Follow up on the pending invoice payment which falls due.',
                type: 'Call',
              },
            ],
          },
          {
            daysAgo: 30,
            type: 'Follow-up',
            purpose: ['Payment Collection'],
            notes:
              'Followed up on the ₹2,00,000 outstanding invoice which is now past its 45-day credit period. Sunil expressed annoyance, claiming that low sales movement has locked his cash flow. He refused to clear the payment unless we match Asian Paints newer festival discount schemes.',
            observations:
              'Payment delayed. Sunil is leveraging outstanding amount to demand lower rates and higher credit.',
            mood: 'Unhappy',
            urgency: 90,
            ratings: {
              confidence: 40,
              reliability: 50,
              strength: 40,
              capability: 85,
              potential: 60,
            },
            requirements: ['Decorative Emulsion'],
            surfaces: ['Plastered Wall'],
            methods: ['Roller'],
            shade: 'Various',
            finish: 'Semi-Gloss',
            challenges: ['Payment Delay', 'Competitor Pressure'],
            currentSupplier: 'Asian Paints',
            expectedRate: '170.00',
            currentRate: '195.00',
            potentialValue: '0.00',
            trialApproved: false,
            sampleGiven: false,
            competitors: [
              {
                name: 'Asian Paints',
                strengths: 'Aggressive marketing schemes, free contractor trips',
                weaknesses: 'Lower dealer margins on economy range',
                reason: 'High consumer demand',
              },
            ],
          },
          {
            daysAgo: 15,
            type: 'Follow-up',
            purpose: ['Payment Collection', 'Conflict Resolution'],
            notes:
              'Collected a partial payment of ₹1,00,000 after multiple physical follow-ups. The store manager mentioned that they have shifted our stock to the back storage room and returned the display rack to Kansai Nerolac due to better schemes. Outstanding stands at ₹1,00,000.',
            observations:
              'Relationship is declining. Sunil demands a credit extension to 90 days before releasing the remaining payment.',
            mood: 'Angry',
            urgency: 95,
            ratings: {
              confidence: 30,
              reliability: 40,
              strength: 30,
              capability: 80,
              potential: 50,
            },
            requirements: ['Decorative Emulsion'],
            surfaces: ['Plastered Wall'],
            methods: ['Roller'],
            shade: 'Various',
            finish: 'Semi-Gloss',
            challenges: ['Payment Delay', 'Shelf Space Loss'],
            currentSupplier: 'Asian Paints',
            expectedRate: '170.00',
            currentRate: '195.00',
            potentialValue: '0.00',
            trialApproved: false,
            sampleGiven: false,
          },
          {
            daysAgo: 5,
            type: 'Follow-up',
            purpose: ['Conflict Resolution'],
            notes:
              'Final attempt to collect the ₹1,00,000 outstanding. Sunil refused to pay and demanded we supply ₹3,00,000 more of stock under a 90-day credit term first. Under company policy, we informed him that further supply is frozen until outstandings are cleared.',
            observations:
              'High risk of payment defaults. Relationship is frozen. The competitor Asian Paints dominates their store.',
            mood: 'Angry',
            urgency: 100,
            ratings: {
              confidence: 10,
              reliability: 20,
              strength: 10,
              capability: 80,
              potential: 20,
            },
            requirements: ['Decorative Emulsion'],
            surfaces: ['Plastered Wall'],
            methods: ['Roller'],
            shade: 'Various',
            finish: 'Semi-Gloss',
            challenges: ['Account Frozen', 'Default Risk'],
            currentSupplier: 'Asian Paints',
            expectedRate: '170.00',
            currentRate: '195.00',
            potentialValue: '0.00',
            trialApproved: false,
            sampleGiven: false,
            followups: [
              {
                dateOffset: -5,
                notes:
                  'Hand over the account to legal/recovery team if outstanding is not cleared within 7 days.',
                type: 'Call',
              },
            ],
          },
        ],
      },
      {
        name: 'Southern Coatings & Chemicals',
        contact: 'Ms. Kavitha Reddy',
        email: 'kavitha@southerncoatings.com',
        mobile: '9300000001',
        category: 'OEM Manufacturer',
        outstanding: '0.00',
        visits: [
          {
            daysAgo: 95,
            type: 'New Visit',
            purpose: ['Introductory Meet', 'Complaint Handling'],
            notes:
              'Initial meeting with Ms. Kavitha Reddy (Partner). They manufacture premium wooden furniture for export. They are facing severe gloss-retention issues and cracking in their current wood lacquer systems supplied by local vendors. They require a premium polyurethane (PU) wood finish that meets European export standards.',
            observations:
              'Customer is highly technical and needs high gloss levels. Willing to pay premium prices for consistent quality.',
            mood: 'Neutral',
            urgency: 50,
            ratings: {
              confidence: 60,
              reliability: 85,
              strength: 50,
              capability: 90,
              potential: 90,
            },
            requirements: ['Wood PU', 'Melamine'],
            surfaces: ['Teak Wood', 'MDF'],
            methods: ['Conventional Spray'],
            shade: 'Clear Wood Lacquer',
            finish: 'High Gloss',
            challenges: ['Cracking', 'Gloss Loss'],
            currentSupplier: 'Local Suppliers',
            expectedRate: '350.00',
            currentRate: '320.00',
            potentialValue: '200000.00',
            trialApproved: false,
            sampleGiven: false,
          },
          {
            daysAgo: 80,
            type: 'Follow-up',
            purpose: ['Sample Delivery'],
            notes:
              'Delivered a trial kit containing DMOR Premium Wood Coating Melamine Glossy, PU Glossy, and our custom PU catalyst. Explained the catalyst mixing ratio of 4:1 and recommended spray viscosity.',
            observations: 'Kavitha requested a live demonstration next week.',
            mood: 'Interested',
            urgency: 60,
            ratings: {
              confidence: 70,
              reliability: 85,
              strength: 60,
              capability: 90,
              potential: 90,
            },
            requirements: ['Wood PU'],
            surfaces: ['Teak Wood'],
            methods: ['Conventional Spray'],
            shade: 'Clear Wood Lacquer',
            finish: 'High Gloss',
            challenges: [],
            currentSupplier: 'Local Suppliers',
            expectedRate: '350.00',
            currentRate: '320.00',
            potentialValue: '200000.00',
            trialApproved: true,
            sampleGiven: true,
          },
          {
            daysAgo: 65,
            type: 'Product Trial',
            purpose: ['Technical Trial', 'Complaint Handling'],
            notes:
              'The initial trial failed due to severe pinholes and orange peel effect. Kavitha was highly upset as they have export deadlines. Visited the site with our technical chemist to troubleshoot. Found that their spray gun pressure was set too high (5 bar instead of 3 bar) and they used cheap local thinner. Coordinated a second trial using our DMOR Polyurethane Thinner.',
            observations:
              'Troubleshooting showed application error, not product failure. Customer appreciated the quick response.',
            mood: 'Unhappy',
            urgency: 90,
            ratings: {
              confidence: 55,
              reliability: 80,
              strength: 55,
              capability: 90,
              potential: 90,
            },
            requirements: ['Wood PU'],
            surfaces: ['Teak Wood'],
            methods: ['Conventional Spray'],
            shade: 'Clear Wood Lacquer',
            finish: 'High Gloss',
            challenges: ['Pinholes', 'Orange Peel'],
            currentSupplier: 'Local Suppliers',
            expectedRate: '350.00',
            currentRate: '320.00',
            potentialValue: '200000.00',
            trialApproved: true,
            sampleGiven: true,
            followups: [
              {
                dateOffset: 60,
                notes: 'Perform second trial under Chemist supervision.',
                type: 'Visit',
              },
            ],
          },
          {
            daysAgo: 50,
            type: 'Product Trial',
            purpose: ['Technical Trial', 'Quality Feedback'],
            notes:
              'Re-conducted the wood PU trial under the direct supervision of our technical chemist. The finish came out absolutely flawless, achieving a high gloss level of 96 gloss units with zero pinholes. Kavitha Reddy is highly satisfied with the technical resolution and our proactive service.',
            observations:
              'Chemist trained their spray team on correct pressure and solvent ratios.',
            mood: 'Happy',
            urgency: 80,
            ratings: {
              confidence: 85,
              reliability: 85,
              strength: 75,
              capability: 95,
              potential: 90,
            },
            requirements: ['Wood PU'],
            surfaces: ['Teak Wood'],
            methods: ['Conventional Spray'],
            shade: 'Clear Wood Lacquer',
            finish: 'High Gloss',
            challenges: [],
            currentSupplier: 'Local Suppliers',
            expectedRate: '350.00',
            currentRate: '320.00',
            potentialValue: '250000.00',
            trialApproved: true,
            sampleGiven: false,
          },
          {
            daysAgo: 35,
            type: 'Follow-up',
            purpose: ['Purchase Order Collection'],
            notes:
              'Kavitha placed their first order for 300 liters of Wood PU Glossy and 100 liters of PU Hardener. Agreed on a price of ₹350/liter with standard 30 credit days.',
            observations:
              'Customer was glad to sign standard credit terms due to quality approval.',
            mood: 'Happy',
            urgency: 85,
            ratings: {
              confidence: 90,
              reliability: 90,
              strength: 85,
              capability: 95,
              potential: 90,
            },
            requirements: ['Wood PU'],
            surfaces: ['Teak Wood'],
            methods: ['Conventional Spray'],
            shade: 'Clear Wood Lacquer',
            finish: 'High Gloss',
            challenges: [],
            currentSupplier: 'Local Suppliers',
            expectedRate: '350.00',
            currentRate: '320.00',
            potentialValue: '140000.00',
            trialApproved: true,
            sampleGiven: false,
          },
          {
            daysAgo: 20,
            type: 'Delivery Check',
            purpose: ['Post-Delivery Review'],
            notes:
              'Followed up on the first batch application. Product consistency is high, and the export furniture batch has been successfully cleared for shipment. Outstanding invoice was paid on day 28.',
            observations:
              'Adhesion tests on MDF boards also passed successfully. Excellent potential for repeat orders.',
            mood: 'Excited',
            urgency: 60,
            ratings: {
              confidence: 95,
              reliability: 95,
              strength: 90,
              capability: 95,
              potential: 95,
            },
            requirements: ['Wood PU'],
            surfaces: ['Teak Wood', 'MDF'],
            methods: ['Conventional Spray'],
            shade: 'Clear Wood Lacquer',
            finish: 'High Gloss',
            challenges: [],
            currentSupplier: 'Local Suppliers',
            expectedRate: '350.00',
            currentRate: '320.00',
            potentialValue: '140000.00',
            trialApproved: true,
            sampleGiven: false,
          },
          {
            daysAgo: 6,
            type: 'Follow-up',
            purpose: ['Repeat Orders', 'New Requirement'],
            notes:
              'Visited Kavitha. She placed a repeat order for 500 liters of Wood PU Glossy. Discussed introducing our outdoor anti-fungal PU sealer for their upcoming range of garden furniture next month.',
            observations:
              'Relationship is very strong. Customer treats DMOR as a technical partner, not just a vendor.',
            mood: 'Excited',
            urgency: 85,
            ratings: {
              confidence: 98,
              reliability: 98,
              strength: 95,
              capability: 95,
              potential: 98,
            },
            requirements: ['Wood PU'],
            surfaces: ['Teak Wood'],
            methods: ['Conventional Spray'],
            shade: 'PU Anti-Fungal Sealer',
            finish: 'Satin',
            challenges: [],
            currentSupplier: 'Local Suppliers',
            expectedRate: '350.00',
            currentRate: '320.00',
            potentialValue: '250000.00',
            trialApproved: true,
            sampleGiven: true,
            followups: [
              {
                dateOffset: -4,
                notes: 'Deliver Anti-Fungal PU Sealer sample and plan outdoor exposure test.',
                type: 'Visit',
              },
            ],
          },
        ],
      },
    ];

    let reportCount = 0;
    let followupCount = 0;
    let competitorCount = 0;

    for (const tc of targetCompanies) {
      const dbCust = customerMap[tc.name];
      if (!dbCust) {
        console.log(
          `⚠️ Customer "${tc.name}" not found in Customer Master, skipping history generation for it.`
        );
        continue;
      }

      console.log(`📝 Seeding visits for: ${tc.name}...`);

      for (let i = 0; i < tc.visits.length; i++) {
        const v = tc.visits[i];
        const visitDate = new Date();
        visitDate.setDate(visitDate.getDate() - v.daysAgo);

        // Expected order date is visitDate + 7 days
        const expOrderDate = new Date(visitDate);
        expOrderDate.setDate(expOrderDate.getDate() + 7);

        const reportNumber = `REP-${tc.name.split(' ')[0].toUpperCase()}-${visitDate.getFullYear()}${(visitDate.getMonth() + 1).toString().padStart(2, '0')}${visitDate.getDate().toString().padStart(2, '0')}-${i + 1}`;

        // Insert report
        const [rep] = await db
          .insert(fieldIntelligenceReports)
          .values({
            reportNumber,
            visitDate,
            timeIn: '10:00 AM',
            timeOut: '11:30 AM',
            visitDuration: 90,
            gpsLatitude: '19.11760000',
            gpsLongitude: '72.86310000',
            executiveId,
            executiveName,
            branch,
            region,
            visitType: v.type,
            visitPurpose: v.purpose,
            customerName: tc.name,
            customerId: dbCust.customerId,
            contactPerson: tc.contact || dbCust.contactPerson,
            designation: tc.category === 'Retail Dealer' ? 'Managing Director' : 'Partner',
            mobile: tc.mobile || dbCust.mobileNo?.[0] || '9999999999',
            whatsapp: tc.mobile || dbCust.mobileNo?.[0] || '9999999999',
            email: tc.email || dbCust.emailId || 'test@example.com',
            gstNumber: dbCust.gstNumber || '27AAAAA0000A1Z5',
            address: dbCust.address || 'MIDC Industrial Area',
            city: dbCust.location || 'Mumbai',
            state: 'Maharashtra',
            pinCode: '400093',
            businessCategory: tc.category,
            monthlyConsumption: '2000.00',
            currentSupplier: v.currentSupplier || 'Various',
            paintRequirementTypes: v.requirements,
            surfaceTypes: v.surfaces,
            applicationMethods: v.methods,
            requiredShade: v.shade,
            requiredFinish: v.finish,
            technicalChallenges: v.challenges,
            currentSystemUsed:
              v.challenges.length > 0 ? 'Poor performing generic brand' : 'Standard local finish',
            monthlyConsumptionText: '2000 Liters per month average',
            currentPurchaseRate: v.currentRate || '0.00',
            expectedRate: v.expectedRate || '0.00',
            creditDays: tc.category === 'Retail Dealer' ? 45 : 30,
            outstandingAmount: tc.outstanding,
            purchaseDecisionBy: tc.contact,
            purchaseCycle: 'Monthly',
            potentialBusinessValue: v.potentialValue,
            expectedMonthlyBusiness: v.potentialValue,
            conversionProbability: v.ratings.confidence,
            discussionNotes: v.notes,
            importantObservations: v.observations,
            customerMood: v.mood,
            hiddenOpportunity:
              'Shifting total procurement of raw materials and PU lines to DMOR due to strict European compliance requirements.',
            riskFactors:
              tc.category === 'Retail Dealer'
                ? 'High threat of competitor Asian Paints margin subsidies.'
                : 'None detected currently.',
            immediateRequirement:
              v.challenges.length > 0
                ? 'Urgent technical support for adhesion/drying resolution.'
                : 'Monthly stock replenishment.',
            expectedOrderDate: expOrderDate,
            expectedOrderQuantity: '500.00',
            trialApproved: v.trialApproved,
            sampleGiven: v.sampleGiven,
            followupUrgencyScore: Math.round(v.urgency / 10),
            dealerConfidence: Math.round(v.ratings.confidence / 10),
            paymentReliability: Math.round(v.ratings.reliability / 10),
            relationshipStrength: Math.round(v.ratings.strength / 10),
            technicalCapability: Math.round(v.ratings.capability / 10),
            longTermPotential: Math.round(v.ratings.potential / 10),
            executiveRecommendation:
              'Maintain close technical contact. Deliver samples within 24 hours of requests.',
            dynamicFields: {
              contractorFeedback:
                'Applicators highly satisfied with the film consistency and non-dripping nature of the primer.',
              weatherConditions: 'Dry, warm climate. Ideal for lacquer drying speed.',
            },
            status: 'Submitted',
            companyId,
            tenantId,
            createdBy: executiveId,
          })
          .returning();

        reportCount++;

        // Insert followups if defined
        if (v.followups) {
          for (const f of v.followups) {
            const fDate = new Date();
            fDate.setDate(fDate.getDate() - f.dateOffset);
            await db.insert(fieldIntelligenceFollowups).values({
              reportId: rep.id,
              followupDate: fDate,
              notes: f.notes,
              actionType: f.type,
              followupMode: 'Phone',
              status: 'Open',
              companyId,
              tenantId,
              createdBy: executiveId,
            });
            followupCount++;
          }
        }

        // Insert competitors if defined
        if (v.competitors) {
          for (const c of v.competitors) {
            await db.insert(fieldIntelligenceCompetitors).values({
              reportId: rep.id,
              competitorName: c.name,
              strengths: c.strengths,
              weaknesses: c.weaknesses,
              reasonUsingCompetitor: c.reason,
              reasonShiftToUs: 'Better technical service and drying times',
              companyId,
              tenantId,
              createdBy: executiveId,
            });
            competitorCount++;
          }
        }

        // Insert activity log
        await db.insert(fieldIntelligenceActivityLog).values({
          reportId: rep.id,
          activityType: 'Status Change',
          details: {
            from: 'Draft',
            to: 'Submitted',
            user: executiveName,
          },
          companyId,
          tenantId,
          createdBy: executiveId,
        });
      }
    }

    console.log(`\n🎉 Seed Completed Successfully:`);
    console.log(`   ✓ ${reportCount} Field Intelligence Reports created.`);
    console.log(`   ✓ ${followupCount} Follow-ups created.`);
    console.log(`   ✓ ${competitorCount} Competitors maps created.`);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }

  process.exit(0);
}

main();
