// All 33 RBI-scheduled public + private sector banks in India, with their IFSC prefix and a
// real bank logo (served from public/banks/, copied from the banks-in-india npm package's
// bundled icon set — see the comment on INDIAN_BANKS below for why the package itself isn't
// kept as a live dependency).
export const INDIAN_BANKS = [
  { name: "Axis Bank", ifsc: "UTIB", icon: "bi_axisbank.png" },
  { name: "Bandhan Bank", ifsc: "BDBL", icon: "bi_bandhanbank.png" },
  { name: "Bank of Baroda", ifsc: "BARB", icon: "bi_bankofbaroda.png" },
  { name: "Bank of India", ifsc: "BKID", icon: "bi_bankofindia.png" },
  { name: "Bank of Maharashtra", ifsc: "MAHB", icon: "bi_bankofmaharashtra.png" },
  { name: "Canara Bank", ifsc: "CNRB", icon: "bi_canarabank.png" },
  { name: "Central Bank of India", ifsc: "CBIN", icon: "bi_centralbankofindia.png" },
  { name: "City Union Bank", ifsc: "CIUB", icon: "bi_cityunionbank.png" },
  { name: "CSB Bank", ifsc: "CSBK", icon: "bi_csb.png" },
  { name: "DCB Bank", ifsc: "DCBL", icon: "bi_dcbbank.png" },
  { name: "Dhanlaxmi Bank", ifsc: "DLXB", icon: "bi_dhanbank.png" },
  { name: "Federal Bank", ifsc: "FDRL", icon: "bi_federalbank.png" },
  { name: "HDFC Bank", ifsc: "HDFC", icon: "bi_hdfcbank.png" },
  { name: "ICICI Bank", ifsc: "ICIC", icon: "bi_icicibank.png" },
  { name: "IDBI Bank", ifsc: "IBKL", icon: "bi_idbi.png" },
  { name: "IDFC FIRST Bank", ifsc: "IDFB", icon: "bi_idfcbank.png" },
  { name: "Indian Bank", ifsc: "IDIB", icon: "bi_indianbank.png" },
  { name: "Indian Overseas Bank", ifsc: "IOBA", icon: "bi_iob.png" },
  { name: "IndusInd Bank", ifsc: "INDB", icon: "bi_indusind.png" },
  { name: "Jammu & Kashmir Bank", ifsc: "JAKA", icon: "bi_jkbank.png" },
  { name: "Karnataka Bank", ifsc: "KARB", icon: "bi_karnatakabank.png" },
  { name: "Karur Vysya Bank", ifsc: "KVBL", icon: "bi_kvb.png" },
  { name: "Kotak Mahindra Bank", ifsc: "KKBK", icon: "bi_kotak.png" },
  { name: "Nainital Bank", ifsc: "NTBL", icon: "bi_nainitalbank.png" },
  { name: "Punjab & Sind Bank", ifsc: "PSIB", icon: "bi_punjabandsindbank.png" },
  { name: "Punjab National Bank", ifsc: "PUNB", icon: "bi_pnbindia.png" },
  { name: "RBL Bank", ifsc: "RATN", icon: "bi_rblbank.png" },
  { name: "South Indian Bank", ifsc: "SIBL", icon: "bi_southindianbank.png" },
  { name: "State Bank of India", ifsc: "SBIN", icon: "bi_sbi.png" },
  { name: "Tamilnad Mercantile Bank", ifsc: "TMBL", icon: "bi_tmb.png" },
  { name: "UCO Bank", ifsc: "UCBA", icon: "bi_ucobank.png" },
  { name: "Union Bank of India", ifsc: "UBIN", icon: "bi_unionbankonline.png" },
  { name: "YES Bank", ifsc: "YESB", icon: "bi_yesbank.png" },
];

export const bankIconUrl = (icon) => `/banks/${icon}`;
