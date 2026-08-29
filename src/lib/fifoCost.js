import { supabase } from './supabaseClient';
import { fetchAllBatched } from './fetchUtils.js';

/**
 * Resolves the FIFO (First-In, First-Out) cost for a set of products
 * being sold.
 *
 * For each product, this function:
 * 1. Fetches all "received" purchase batches, ordered by date (oldest first).
 * 2. Fetches total units already sold (from sale_items with unit_cost recorded).
 * 3. "Consumes" the oldest batches first, skipping units already attributed
 *    to prior sales.
 * 4. Returns a weighted average cost across the batches consumed for the
 *    requested sale quantity.
 *
 * If no purchase history exists, falls back to products.cost_price.
 *
 * IMPORTANT: both queries below are paginated with fetchAllBatched().
 * Supabase/PostgREST caps unpaginated .select() calls at 1000 rows. For a
 * business with more than 1000 purchase_items or sale_items rows, the old
 * plain .select() calls here would silently truncate — which corrupted the
 * "already sold" running total and the purchase-batch list, causing
 * sale_items.unit_cost to come back as 0 (or otherwise wrong) once volume
 * crossed that threshold. See conversation notes on the P&L investigation.
 *
 * @param {string|number} businessId
 * @param {Array<{product_id: number|string, quantity: number}>} items
 * @returns {Promise<Record<string|number, number>>}
 *   A map of product_id → unit cost (weighted average FIFO cost).
 */
export async function getFifoCosts(businessId, items) {
  const costMap = {};

  // Deduplicate product IDs and sum requested quantities per product
  const requestedByProduct = {};
  for (const item of items) {
    const pid = Number(item.product_id);
    requestedByProduct[pid] =
      (requestedByProduct[pid] || 0) + Number(item.quantity || 0);
  }

  const productIds = Object.keys(requestedByProduct).map(Number);

  if (productIds.length === 0) return costMap;

  // 1. Fetch all received purchase batches for these products, FIFO order.
  //    Paginated — a business can easily have >1000 purchase_items rows
  //    across all products, and an unpaginated call here would silently
  //    drop batches, understating available cost history for a product.
  const { data: purchaseBatches, error: batchErr } = await fetchAllBatched(() =>
    supabase
      .from('purchase_items')
      .select(`
        id,
        product_id,
        quantity,
        unit_cost,
        purchase_id,
        purchases!inner (
          purchase_date,
          purchase_status,
          business_id
        )
      `)
      .eq('purchases.business_id', businessId)
      .eq('purchases.purchase_status', 'received')
      .in('product_id', productIds)
      .order('id', { ascending: true })
  );

  if (batchErr) {
    console.error('FIFO: Error fetching purchase batches:', batchErr);
    // Fall back to products.cost_price below
  }

  // 2. Fetch total units already sold per product (from sale_items).
  //    We need this to know how many units from old batches are already
  //    "consumed" and should be skipped.
  //
  //    Paginated for the same reason as above. Only confirmed/shipped sales
  //    count as consumed inventory for FIFO. Returned or partially_returned
  //    sales are later restored back into stock via stock_ledger, so they
  //    should not keep consuming the original purchase batches for future
  //    cost calculations.
  const { data: soldRows, error: soldErr } = await fetchAllBatched(() =>
    supabase
      .from('sale_items')
      .select(`
        product_id,
        quantity,
        sales!inner (
          business_id,
          status
        )
      `)
      .eq('sales.business_id', businessId)
      .in('sales.status', ['confirmed', 'shipped'])
      .in('product_id', productIds)
  );

  if (soldErr) {
    console.error('FIFO: Error fetching sold quantities:', soldErr);
  }

  const totalSoldByProduct = {};
  (soldRows || []).forEach((row) => {
    const pid = Number(row.product_id);
    totalSoldByProduct[pid] =
      (totalSoldByProduct[pid] || 0) + Number(row.quantity || 0);
  });

  // 3. Fetch product fallback cost prices
  const { data: productsData } = await supabase
    .from('products')
    .select('id, cost_price')
    .in('id', productIds);

  const fallbackCosts = {};
  (productsData || []).forEach((p) => {
    fallbackCosts[p.id] = Number(p.cost_price || 0);
  });

  // 4. Group batches by product and sort by purchase_date then id (FIFO)
  const batchesByProduct = {};
  (purchaseBatches || []).forEach((batch) => {
    const pid = Number(batch.product_id);
    if (!batchesByProduct[pid]) batchesByProduct[pid] = [];
    batchesByProduct[pid].push({
      quantity: Number(batch.quantity || 0),
      unitCost: Number(batch.unit_cost || 0), // Note: purchase_items has unit_cost
      purchaseDate: batch.purchases?.purchase_date || '',
      id: batch.id,
    });
  });

  // Sort each product's batches: by purchase_date ASC, then by id ASC
  Object.values(batchesByProduct).forEach((batches) => {
    batches.sort((a, b) => {
      const dateCompare = a.purchaseDate.localeCompare(b.purchaseDate);
      if (dateCompare !== 0) return dateCompare;
      return a.id - b.id;
    });
  });

  // 5. For each product, resolve FIFO cost
  for (const pid of productIds) {
    const batches = batchesByProduct[pid] || [];
    const requestedQty = requestedByProduct[pid] || 0;

    if (batches.length === 0 || requestedQty <= 0) {
      // No purchase history — use fallback
      costMap[pid] = fallbackCosts[pid] || 0;
      continue;
    }

    // Skip already-consumed units (FIFO order)
    let alreadySold = totalSoldByProduct[pid] || 0;
    let totalCostForSale = 0;
    let unitsAssigned = 0;

    for (const batch of batches) {
      if (unitsAssigned >= requestedQty) break;

      let batchRemaining = batch.quantity;

      // First, skip units from this batch that were already sold
      if (alreadySold > 0) {
        const skip = Math.min(alreadySold, batchRemaining);
        batchRemaining -= skip;
        alreadySold -= skip;
      }

      if (batchRemaining <= 0) continue;

      // Consume from this batch for the current sale
      const take = Math.min(batchRemaining, requestedQty - unitsAssigned);
      totalCostForSale += take * batch.unitCost;
      unitsAssigned += take;
    }

    if (unitsAssigned > 0) {
      // Weighted average cost across consumed batches
      costMap[pid] = Math.round((totalCostForSale / unitsAssigned) * 100) / 100;
    } else {
      // All batches consumed — fall back to the most recent batch cost
      // or the product's default cost
      const lastBatch = batches[batches.length - 1];
      costMap[pid] = lastBatch ? lastBatch.unitCost : (fallbackCosts[pid] || 0);
    }
  }

  return costMap;
}
