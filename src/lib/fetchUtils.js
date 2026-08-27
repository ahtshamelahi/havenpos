/**
 * fetchAllBatched
 * 
 * Safely fetches an entire dataset from Supabase without hitting the 1000-row limit.
 * It uses pagination internally to fetch 1000 rows at a time until the table is exhausted.
 * 
 * @param {Function} queryFactory - A function that returns a fresh Supabase query builder.
 *                                  e.g. () => supabase.from('products').select('*').eq('business_id', id)
 * @returns {Promise<{ data: Array|null, error: Object|null }>}
 */
export async function fetchAllBatched(queryFactory) {
  let allData = [];
  let keepFetching = true;
  let start = 0;
  const step = 1000;

  try {
    while (keepFetching) {
      const query = queryFactory();
      // Supabase .range(from, to) is inclusive, so 0 to 999 fetches 1000 items
      const { data, error } = await query.range(start, start + step - 1);
      
      if (error) {
        return { data: null, error };
      }
      
      if (!data || data.length === 0) {
        keepFetching = false;
        break;
      }
      
      allData = [...allData, ...data];
      
      // If the API returns less than the step size, we are on the last page.
      if (data.length < step) {
        keepFetching = false;
      } else {
        start += step;
      }
    }
    
    return { data: allData, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}
