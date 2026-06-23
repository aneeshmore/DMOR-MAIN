// ─────────────────────────────────────────────────────────────────────────────
// FIR Constants – Application-level lookup values (no DB ENUM changes)
// ─────────────────────────────────────────────────────────────────────────────

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman & Nicobar Islands',
  'Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi (NCT)',
  'Jammu & Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

export const INDIAN_CITIES: Record<string, readonly string[]> = {
  Maharashtra: [
    'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur',
    'Thane', 'Navi Mumbai', 'Pimpri-Chinchwad', 'Ahmednagar', 'Satara',
    'Sangli', 'Jalgaon', 'Akola', 'Amravati', 'Latur', 'Chandrapur',
    'Dhule', 'Ratnagiri', 'Alibag', 'Vasai-Virar',
  ],
  Gujarat: [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar',
    'Gandhinagar', 'Anand', 'Morbi', 'Mehsana', 'Vapi', 'Valsad',
    'Bharuch', 'Nadiad', 'Junagadh', 'Porbandar',
  ],
  'Delhi (NCT)': ['New Delhi', 'Delhi', 'Noida', 'Gurgaon', 'Faridabad', 'Ghaziabad', 'Greater Noida'],
  Karnataka: [
    'Bengaluru', 'Mysuru', 'Hubli', 'Dharwad', 'Belagavi', 'Mangaluru',
    'Tumkur', 'Shivamogga', 'Ballari', 'Vijayapura', 'Kalaburagi',
  ],
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
    'Tirunelveli', 'Erode', 'Vellore', 'Thoothukudi', 'Ambattur',
  ],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Secunderabad'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajamahendravaram', 'Tirupati'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Bhilwara', 'Alwar'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Allahabad', 'Meerut', 'Ghaziabad', 'Bareilly'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Chandigarh', 'Mohali', 'Bathinda'],
  Haryana: ['Gurugram', 'Faridabad', 'Rohtak', 'Hisar', 'Panipat', 'Ambala', 'Karnal'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar', 'Dewas', 'Ratlam'],
  Bihar: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur', 'Berhampur'],
  Kerala: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Malappuram'],
  Assam: ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Nagaon'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg'],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh'],
  'Himachal Pradesh': ['Shimla', 'Solan', 'Manali', 'Dharamshala', 'Mandi'],
  Goa: ['Panaji', 'Vasco da Gama', 'Margao', 'Mapusa'],
};

// Flat sorted city list for when no state is selected yet
export const MAJOR_CITIES = [
  'Ahmedabad', 'Akola', 'Amravati', 'Amritsar', 'Anand',
  'Aurangabad', 'Bengaluru', 'Bharuch', 'Bhavnagar', 'Bhopal',
  'Bhilai', 'Bhubaneswar', 'Chandigarh', 'Chennai', 'Coimbatore',
  'Dehradun', 'Delhi', 'Durgapur', 'Erode', 'Faridabad',
  'Gandhinagar', 'Gurgaon', 'Guwahati', 'Gwalior', 'Howrah',
  'Hubli', 'Hyderabad', 'Indore', 'Jabalpur', 'Jaipur',
  'Jamshedpur', 'Jamnagar', 'Jodhpur', 'Kanpur', 'Karimnagar',
  'Kochi', 'Kolhapur', 'Kolkata', 'Kozhikode', 'Lucknow',
  'Ludhiana', 'Madurai', 'Mangaluru', 'Meerut', 'Mohali',
  'Mumbai', 'Mysuru', 'Nagpur', 'Nashik', 'Navi Mumbai',
  'New Delhi', 'Noida', 'Panipat', 'Patna', 'Pimpri-Chinchwad',
  'Pune', 'Raipur', 'Rajkot', 'Ranchi', 'Rohtak',
  'Rourkela', 'Salem', 'Secunderabad', 'Surat', 'Thane',
  'Thiruvananthapuram', 'Tiruchirappalli', 'Tirunelveli', 'Udaipur',
  'Vadodara', 'Vapi', 'Varanasi', 'Vasai-Virar', 'Vijayawada',
  'Visakhapatnam', 'Warangal',
].sort() as string[];

export const FINISH_TYPES = [
  'Glossy (90%+ Gloss)',
  'Semi-Gloss (50–60%)',
  'Satin (30–40%)',
  'Eggshell (15–25%)',
  'Matt (10–20%)',
  'Flat Matt (<5%)',
  'Texture / Structure',
  'Metallic',
  'Pearlescent',
  'Hammer Finish',
  'Wrinkle Finish',
] as const;

export const SHADE_OPTIONS = [
  'White / Off-White',
  'Ivory / Cream',
  'Beige',
  'Grey (Light)',
  'Grey (Medium)',
  'Grey (Dark)',
  'Black',
  'Red / Red Oxide',
  'Yellow',
  'Green',
  'Blue',
  'Sky Blue',
  'Silver',
  'Golden / Gold',
  'Aluminium',
  'RAL 7035 (Light Grey)',
  'RAL 9010 (Pure White)',
  'RAL 3000 (Flame Red)',
  'RAL 5015 (Sky Blue)',
  'RAL 6010 (Grass Green)',
  'Custom Shade',
  'To be Matched',
] as const;

export const PRODUCT_CATEGORIES = [
  'Primers',
  'Epoxy Coatings',
  'Polyurethane (PU) Coatings',
  'NC Lacquers',
  'Enamel Paints',
  'Acrylic Emulsions',
  'Heat Resistant Paints',
  'Anti-Corrosion Coatings',
  'Zinc-Rich Primers',
  'Road Marking Paints',
  'Marine Coatings',
  'Powder Coatings',
  'Water-Based Coatings',
  'Industrial Maintenance Coatings',
  'Wood Finishes / Sealers',
  'Thinners & Reducers',
  'Wall Putty',
  'Texture Finishes',
] as const;

export const VISIT_TYPES = [
  'Dealer Visit',
  'Site Visit',
  'Painter Visit',
  'Industrial Visit',
  'Architect Visit',
  'Market Feedback',
  'Customer Follow-up',
  'Technical Visit',
  'Shade Approval Visit',
  'Complaint Visit',
  // Legacy values – kept for backward compatibility
  'New Visit',
  'Follow-up Visit',
  'Complaint Check',
  'Routine Retention',
] as const;

export const VISIT_PURPOSES = [
  'Product Demo',
  'Rate Negotiation',
  'New Lead Pitch',
  'Technical Support',
  'Shade Approval',
  'Routine Catch-up',
  'Sample Delivery',
  'Complaint Resolution',
  'Trial Follow-up',
  'Scheme Discussion',
  'Collection / Payment',
  'Market Survey',
  'Order Follow-up',
  'Project Prospecting',
] as const;

export const DESIGNATION_OPTIONS = [
  'Proprietor / Owner',
  'Managing Director',
  'General Manager',
  'Purchase Manager',
  'Purchase Officer',
  'Store Manager',
  'Production Manager',
  'Maintenance Manager',
  'Site Engineer',
  'Project Manager',
  'Architect',
  'Interior Designer',
  'Contractor',
  'Painter (Applicator)',
  'Dealer / Retailer',
  'Distributor',
  'Other',
] as const;

export const BUSINESS_CATEGORIES = [
  'OEM / Manufacturing',
  'Dealer / Retailer',
  'Project Contractor',
  'Industrial Maintenance',
  'Infrastructure Project',
  'Construction & Real Estate',
  'Automotive / Body Shop',
  'Marine / Shipping',
  'Furniture / Wood Coating',
  'Food & Pharma (Hygienic)',
  'Architect / Interior Design',
  'Government / PSU',
  'Export / Trading House',
] as const;

export const PURCHASE_DECISION_OPTIONS = [
  'Proprietor / Owner',
  'Managing Director',
  'Purchase Manager',
  'Production Manager',
  'Site Engineer',
  'Architect',
  'Committee Decision',
  'HO Approval Required',
] as const;

export const CONTACT_ROLES = [
  'Decision Maker',
  'Influencer',
  'Technical Evaluator',
  'Purchase Executive',
  'Gatekeeper',
  'End User',
] as const;

export const CUSTOMER_MOOD_OPTIONS = [
  { value: 'Highly Interested', label: '😊 Highly Interested / Welcoming' },
  { value: 'Neutral', label: '😐 Neutral / Satisfied with Current Supplier' },
  { value: 'Skeptical', label: '🤔 Skeptical / Price-Sensitive' },
  { value: 'Dissatisfied', label: '😤 Dissatisfied with Competitor (Good Entry)' },
  { value: 'Unresponsive', label: '🚫 Unresponsive / Not Available' },
] as const;

export const RISK_FACTOR_OPTIONS = [
  'Slow Payment History',
  'High Outstanding',
  'Strong Competitor Tie-up',
  'Owner Relation with Competitor',
  'Price-Only Decision',
  'Seasonal Business',
  'High Credit Demand',
  'Political Influence',
  'Project Cancellation Risk',
  'Internal Sourcing',
] as const;

export const EXECUTIVE_RECOMMENDATION_OPTIONS = [
  'Immediate Order Expected',
  'Trial Required',
  'Sample to be Provided',
  'Scheme to be Discussed',
  'Management Intervention Required',
  'Send Technical TDS',
  'Payment Collection Pending',
  'Follow-up Next Week',
  'High Priority Account',
  'Monitor Competitor Activity',
  'Price Approval Required',
  'Long-term Development Account',
] as const;

export const COMPETITOR_BRANDS = [
  'Asian Paints',
  'Berger Paints',
  'Kansai Nerolac',
  'Akzo Nobel (Dulux)',
  'Shalimar Paints',
  'Jotun Paints',
  'PPG Industries',
  'Hempel',
  'Sigma / Chromaline',
  'JSW Paints',
  'Indigo Paints',
  'Nippon Paints',
  'Snowcem',
  'Local Brand',
  'Other',
] as const;

export const PAINT_REQUIREMENT_TYPES = [
  'PU Coatings',
  'Epoxy Primers',
  'Acrylic Topcoats',
  'NC Paints',
  'Heat Resistant Coatings',
  'Specialty Thinners',
  'Zinc Phosphate Primer',
  'Water-Based Coatings',
  'Anti-Corrosion Coatings',
  'Road Marking Paint',
  'Wood Finishes',
  'Wall Putty',
  'Texture Finish',
  'Powder Coatings',
] as const;

export const SURFACE_TYPES = [
  'Mild Steel (MS)',
  'Stainless Steel (SS)',
  'Aluminum',
  'Plastics / ABS',
  'Concrete / Masonry',
  'Wood / MDF',
  'GI Sheet',
  'Cast Iron',
  'Galvanized Steel',
  'FRP / Fiberglass',
  'Rubber / Elastomeric',
] as const;

export const APPLICATION_METHODS = [
  'Conventional Air Spray',
  'Airless Spraying',
  'Electrostatic Spray',
  'Dip Coating',
  'Roller / Brush',
  'Auto-Coating Line',
  'Flow Coating',
  'Curtain Coating',
] as const;

export const TECHNICAL_CHALLENGES = [
  'Adhesion Failure',
  'Color Variations',
  'Slow Curing',
  'Corrosion / Rusting',
  'Sagging / Runs',
  'Orange Peel Effect',
  'Poor Coverage',
  'Blistering / Bubbling',
  'Cratering',
  'Shade Mismatch',
  'Excessive Thinning Required',
] as const;

export const COMPLAINT_TYPES = [
  'Adhesion Failure',
  'Color Variation / Shade Mismatch',
  'Blistering / Peeling',
  'Poor Gloss / Finish Defect',
  'Slow Drying / Curing',
  'Rust Bleeding / Flash Rust',
  'Settling / Pigment Separation',
  'Batch Quality Issue',
  'Packaging Defect',
  'Short Quantity',
  'Delivery Issue',
  'Other',
] as const;

export const RESOLUTION_STATUS_OPTIONS = [
  'Pending Investigation',
  'Under Review',
  'Solution Provided',
  'Replacement Arranged',
  'Credit Note Issued',
  'Closed – Customer Satisfied',
  'Escalated to Management',
] as const;

export const FOLLOWUP_TYPES = [
  'Phone Call',
  'In-Person Visit',
  'WhatsApp Message',
  'Email',
  'Video Call',
  'Sample Delivery',
  'Trial Visit',
  'Technical Support',
  'Payment Collection',
  'Document Submission',
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'Critical', label: '🔴 Critical' },
  { value: 'High', label: '🟠 High' },
  { value: 'Medium', label: '🟡 Medium' },
  { value: 'Low', label: '🟢 Low' },
] as const;

export const FILE_TYPES = [
  'Customer Photo',
  'Factory Photo',
  'Product Photo',
  'Shade Sample',
  'Competitor Photo',
  'Competitor Bucket',
  'Visiting Card',
  'Purchase Order',
  'Complaint Photo',
  'Site Photo',
  'Site Condition',
  'Video Upload',
  'Document',
] as const;

// ── Dynamic Field Config per Visit Type ──────────────────────────────────────
// Controls which sections / fields are visible based on selected visitType

export type VisitTypeSections = {
  showComplaintFields: boolean;
  showDealerFields: boolean;
  showIndustrialFields: boolean;
  showArchitectFields: boolean;
  showTechnicalFields: boolean;
  showSiteFields: boolean;
  showMarketFeedback: boolean;
  showGeneralTechnical: boolean;
  showSalesCommercial: boolean;
  showCompetitorAnalysis: boolean;
  showOrderPossibility: boolean;
};

export const VISIT_TYPE_SECTIONS: Record<string, VisitTypeSections> = {
  'Complaint Visit': {
    showComplaintFields: true,
    showDealerFields: false,
    showIndustrialFields: false,
    showArchitectFields: false,
    showTechnicalFields: false,
    showSiteFields: false,
    showMarketFeedback: false,
    showGeneralTechnical: false,
    showSalesCommercial: false,
    showCompetitorAnalysis: false,
    showOrderPossibility: false,
  },
  'Complaint Check': {
    showComplaintFields: true,
    showDealerFields: false,
    showIndustrialFields: false,
    showArchitectFields: false,
    showTechnicalFields: false,
    showSiteFields: false,
    showMarketFeedback: false,
    showGeneralTechnical: false,
    showSalesCommercial: false,
    showCompetitorAnalysis: false,
    showOrderPossibility: false,
  },
  'Dealer Visit': {
    showComplaintFields: false,
    showDealerFields: true,
    showIndustrialFields: false,
    showArchitectFields: false,
    showTechnicalFields: false,
    showSiteFields: false,
    showMarketFeedback: false,
    showGeneralTechnical: true,
    showSalesCommercial: true,
    showCompetitorAnalysis: true,
    showOrderPossibility: true,
  },
  'Industrial Visit': {
    showComplaintFields: false,
    showDealerFields: false,
    showIndustrialFields: true,
    showArchitectFields: false,
    showTechnicalFields: false,
    showSiteFields: false,
    showMarketFeedback: false,
    showGeneralTechnical: true,
    showSalesCommercial: true,
    showCompetitorAnalysis: true,
    showOrderPossibility: true,
  },
  'Architect Visit': {
    showComplaintFields: false,
    showDealerFields: false,
    showIndustrialFields: false,
    showArchitectFields: true,
    showTechnicalFields: false,
    showSiteFields: false,
    showMarketFeedback: false,
    showGeneralTechnical: false,
    showSalesCommercial: false,
    showCompetitorAnalysis: false,
    showOrderPossibility: true,
  },
  'Technical Visit': {
    showComplaintFields: false,
    showDealerFields: false,
    showIndustrialFields: false,
    showArchitectFields: false,
    showTechnicalFields: true,
    showSiteFields: false,
    showMarketFeedback: false,
    showGeneralTechnical: true,
    showSalesCommercial: false,
    showCompetitorAnalysis: false,
    showOrderPossibility: false,
  },
  'Site Visit': {
    showComplaintFields: false,
    showDealerFields: false,
    showIndustrialFields: false,
    showArchitectFields: false,
    showTechnicalFields: false,
    showSiteFields: true,
    showMarketFeedback: false,
    showGeneralTechnical: true,
    showSalesCommercial: true,
    showCompetitorAnalysis: true,
    showOrderPossibility: true,
  },
  'Shade Approval Visit': {
    showComplaintFields: false,
    showDealerFields: false,
    showIndustrialFields: false,
    showArchitectFields: true,
    showTechnicalFields: false,
    showSiteFields: false,
    showMarketFeedback: false,
    showGeneralTechnical: false,
    showSalesCommercial: false,
    showCompetitorAnalysis: false,
    showOrderPossibility: true,
  },
  'Market Feedback': {
    showComplaintFields: false,
    showDealerFields: false,
    showIndustrialFields: false,
    showArchitectFields: false,
    showTechnicalFields: false,
    showSiteFields: false,
    showMarketFeedback: true,
    showGeneralTechnical: false,
    showSalesCommercial: false,
    showCompetitorAnalysis: true,
    showOrderPossibility: false,
  },
  'Painter Visit': {
    showComplaintFields: false,
    showDealerFields: false,
    showIndustrialFields: false,
    showArchitectFields: false,
    showTechnicalFields: true,
    showSiteFields: true,
    showMarketFeedback: false,
    showGeneralTechnical: true,
    showSalesCommercial: true,
    showCompetitorAnalysis: true,
    showOrderPossibility: true,
  },
};

// Default: show everything (fallback for legacy/new visit types)
export const DEFAULT_SECTIONS: VisitTypeSections = {
  showComplaintFields: false,
  showDealerFields: false,
  showIndustrialFields: false,
  showArchitectFields: false,
  showTechnicalFields: false,
  showSiteFields: false,
  showMarketFeedback: false,
  showGeneralTechnical: true,
  showSalesCommercial: true,
  showCompetitorAnalysis: true,
  showOrderPossibility: true,
};

export function getSectionsForVisitType(visitType: string): VisitTypeSections {
  return VISIT_TYPE_SECTIONS[visitType] || DEFAULT_SECTIONS;
}
