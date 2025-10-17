// functions/update_total_generation/index.js
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fetchEtTotal() {
  try {
    const response = await fetch(INVERTER_API_URL, {
      headers: { Authorization: `Bearer ${INVERTER_API_TOKEN}` },
    });
    const json = await response.json();

    // Adjust this to match your API structure
    const etotal = json.data?.etotal || json.etotal || 0;
    return Number(etotal);
  } catch (err) {
    console.error("❌ Error fetching inverter data:", err);
    return null;
  }
}

async function updateSupabase(total) {
  const { error } = await supabase
    .from("system_metrics")
    .upsert({
      metric_name: "total_generation",
      metric_value: total,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("⚠️ Supabase update failed:", error);
  } else {
    console.log(`✅ Updated total_generation: ${total}`);
  }
}

(async () => {
  const total = await fetchEtTotal();
  if (total !== null) await updateSupabase(total);
})();
